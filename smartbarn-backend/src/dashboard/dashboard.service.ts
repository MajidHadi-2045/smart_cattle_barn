import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DashboardService {
  private redis: Redis;

  constructor(private prisma: PrismaService) {
    // Membaca dari .env, dengan fallback ke localhost jika .env tidak ditemukan
    this.redis = new Redis({ 
      host: process.env.REDIS_HOST || 'localhost', 
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1, // Batasi percobaan agar cepat fallback ke database
    });
    this.redis.on('error', (err) => {
      // Tangani error koneksi secara diam-diam agar tidak menimbun log atau memicu crash
    });
  }

  private cachedConfig: any = null;

  private getConfigPath() {
    return path.join(process.cwd(), 'checklist-config.json');
  }

  private loadConfig() {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }
    try {
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed.feedGoal !== undefined) {
          this.cachedConfig = {
            feed: { goal: parsed.feedGoal, period: 'daily' },
            waste: { goal: parsed.wasteGoal, period: 'daily' },
            weight: { goal: parsed.weightGoal, period: 'monthly' }
          };
          return this.cachedConfig;
        }
        this.cachedConfig = parsed;
        return this.cachedConfig;
      }
    } catch (err) {
      console.warn('Error reading checklist config, using defaults:', err);
    }
    this.cachedConfig = { 
      feed: { goal: 2, period: 'daily' }, 
      waste: { goal: 1, period: 'daily' }, 
      weight: { goal: 1, period: 'monthly' } 
    };
    return this.cachedConfig;
  }

  async saveConfig(config: any) {
    try {
      this.cachedConfig = config;
      const configPath = this.getConfigPath();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return { success: true, config };
    } catch (err) {
      console.error('Error saving checklist config:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * KELOMPOK 1: CACHE-ASIDE
   * Mengambil data untuk 4 Card paling atas di Dashboard Utama
   */
  async getFarmSummary() {
    const cacheKey = 'dashboard:farm-summary';

    // 1. CEK CACHE REDIS DENGAN HATI-HATI
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData); // Langsung kirim ke Frontend jika ada
      }
    } catch (err) {
      console.warn('Redis Connection Down. Falling back to PostgreSQL directly...');
    }

    // 2. JIKA KOSONG / REDIS DOWN, HITUNG DARI POSTGRESQL (Gunakan groupBy untuk efisiensi koneksi)
    let result = { total: 0, sehat: 0, sakit: 0, hamil: 0 };
    try {
      const stats = await this.prisma.livestock.groupBy({
        by: ['status'],
        _count: { _all: true },
      });

      result = {
        total: stats.reduce((acc, curr) => acc + curr._count._all, 0),
        sehat: stats.find((s) => s.status === 'SEHAT')?._count._all || 0,
        sakit: 
          (stats.find((s) => s.status === 'SAKIT')?._count._all || 0) + 
          (stats.find((s) => s.status === 'DALAM_PERAWATAN')?._count._all || 0) +
          (stats.find((s) => s.status === 'KRITIS')?._count._all || 0),
        hamil: stats.find((s) => s.status === 'HAMIL')?._count._all || 0,
      };
    } catch (err) {
      console.warn('Database Connection Down in DashboardService. Returning default stats...');
    }

    // 3. SIMPAN KE CACHE (TTL 300 detik / 5 menit agar kebal Cache Stampede)
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (err) {
      // Abaikan kegagalan set cache jika Redis sedang mati
    }

    return result;
  }

  // KELOMPOK 2: MANAJEMEN LIMBAH (Cache-Aside Diaktifkan!)
  async getWasteSummary(filter: 'daily' | 'weekly' | 'monthly') {
    const cacheKey = `dashboard:waste:${filter}`;

    // 1. Cek Cache Redis (Super Cepat < 1ms)
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis Connection Down (getWasteSummary).');
    }

    const now = new Date();
    let startDate = new Date();

    if (filter === 'daily') {
      startDate.setHours(0, 0, 0, 0); // Hari ini saja
    } else if (filter === 'weekly') {
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0); // 7 hari terakhir
    } else if (filter === 'monthly') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0); // Bulan ini
    }

    let result = { fecesKg: 0, urineL: 0 };
    try {
      const [wastes, zoneWastes] = await Promise.all([
        this.prisma.livestockWaste.aggregate({
          where: { date: { gte: startDate } },
          _sum: {
            fecesKg: true,
            urineL: true
          }
        }),
        this.prisma.zoneWaste.aggregate({
          where: { date: { gte: startDate } },
          _sum: {
            fecesKg: true,
            urineL: true
          }
        })
      ]);

      result = {
        fecesKg: (wastes._sum.fecesKg || 0) + (zoneWastes._sum.fecesKg || 0),
        urineL: (wastes._sum.urineL || 0) + (zoneWastes._sum.urineL || 0)
      };
    } catch (err) {
      console.warn('Database Connection Down in getWasteSummary. Returning default values...');
    }

    // 2. Simpan ke Cache selama 300 detik (5 menit)
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (err) {}

    return result;
  }

  // KELOMPOK 3: DAILY OPERATIONAL CHECKLIST
  private getStartDateForPeriod(period: string) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (period === 'weekly') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Senin sebagai awal minggu
      start.setDate(diff);
    } else if (period === 'monthly') {
      start.setDate(1);
    }
    return start;
  }

  async getDailyChecklist() {
    const config = this.loadConfig();
    let totalCows = 0;
    
    let feedResult = { completedCows: 0, isDone: false };
    let wasteResult = { completedCows: 0, isDone: false };
    let weightResult = { completedCows: 0, isDone: false };

    try {
      totalCows = await this.prisma.livestock.count();

      if (totalCows > 0) {
        // Feed
        const feedStart = this.getStartDateForPeriod(config.feed.period);
        const feeds = await this.prisma.livestockFeedRecord.groupBy({
          by: ['cattleId'],
          where: { feedDate: { gte: feedStart } },
          _count: { _all: true }
        });
        feedResult.completedCows = feeds.filter(f => f._count._all >= config.feed.goal).length;
        feedResult.isDone = feedResult.completedCows >= totalCows;

        // Waste
        const wasteStart = this.getStartDateForPeriod(config.waste.period);
        const wastes = await this.prisma.livestockWaste.groupBy({
          by: ['cattleId'],
          where: { date: { gte: wasteStart } },
          _count: { _all: true }
        });
        wasteResult.completedCows = wastes.filter(w => w._count._all >= config.waste.goal).length;
        wasteResult.isDone = wasteResult.completedCows >= totalCows;

        // Weight
        const weightStart = this.getStartDateForPeriod(config.weight.period);
        const weights = await this.prisma.livestockWeightRecord.groupBy({
          by: ['cattleId'],
          where: { weighDate: { gte: weightStart } },
          _count: { _all: true }
        });
        weightResult.completedCows = weights.filter(w => w._count._all >= config.weight.goal).length;
        weightResult.isDone = weightResult.completedCows >= totalCows;
      }
    } catch (err) {
      console.warn('Database Connection Down in getDailyChecklist. Returning default zeros...');
    }

    const periodMap = { daily: 'hari ini', weekly: 'minggu ini', monthly: 'bulan ini' };

    return {
      config,
      feedTask: {
        done: feedResult.isDone,
        count: feedResult.completedCows,
        goal: totalCows,
        title: 'Pemberian Pakan Sapi',
        subtitle: feedResult.isDone 
          ? `Selesai! ${feedResult.completedCows}/${totalCows} sapi diberi pakan ${config.feed.goal}x ${periodMap[config.feed.period]}` 
          : `${feedResult.completedCows}/${totalCows} sapi diberi pakan ${config.feed.goal}x ${periodMap[config.feed.period]}`
      },
      wasteTask: {
        done: wasteResult.isDone,
        count: wasteResult.completedCows,
        goal: totalCows,
        title: 'Pencatatan Limbah Sapi',
        subtitle: wasteResult.isDone 
          ? `Selesai! ${wasteResult.completedCows}/${totalCows} sapi dicatat limbah ${config.waste.goal}x ${periodMap[config.waste.period]}` 
          : `${wasteResult.completedCows}/${totalCows} sapi dicatat limbah ${config.waste.goal}x ${periodMap[config.waste.period]}`
      },
      weightTask: {
        done: weightResult.isDone,
        pendingCows: Math.max(0, totalCows - weightResult.completedCows),
        goal: totalCows,
        title: 'Penimbangan Sapi',
        subtitle: weightResult.isDone 
          ? `Selesai! ${weightResult.completedCows}/${totalCows} sapi ditimbang ${config.weight.goal}x ${periodMap[config.weight.period]}` 
          : `${weightResult.completedCows}/${totalCows} sapi ditimbang ${config.weight.goal}x ${periodMap[config.weight.period]}`
      }
    };
  }

  async getNotifications() {
    try {
      const notifs = await this.redis.lrange('system:notifications', 0, -1);
      return notifs.map(n => JSON.parse(n));
    } catch (err) {
      return [];
    }
  }
}