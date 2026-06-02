// src/livestock/livestock.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { ActivityService } from '../activity/activity.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LivestockService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService
  ) {
    this.redis = new Redis({ 
      host: process.env.REDIS_HOST || 'localhost', 
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1 
    });
    this.redis.on('error', () => {});
  }

  /**
   * 1. STATISTIK DASHBOARD (Cache-Aside Diaktifkan!)
   */
  async getDashboardStats(sectionId: number) {
    const cacheKey = `livestock:stats:section:${sectionId}`;

    // A. Cek Cache Redis (Super Cepat)
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (err) {
      console.warn('Redis Connection Down (getDashboardStats).');
    }

    // B. Hitung agregat dari PostgreSQL jika cache kosong
    const stats = await this.prisma.livestock.groupBy({
      by: ['status'],
      where: { sectionId },
      _count: { _all: true },
    });

    const result = {
      total: stats.reduce((acc, curr) => acc + curr._count._all, 0),
      sehat: stats.find((s) => s.status === 'SEHAT')?._count._all || 0,
      sakit: stats.find((s) => s.status === 'SAKIT')?._count._all || 0,
      hamil: stats.find((s) => s.status === 'HAMIL')?._count._all || 0,
    };

    // C. Simpan ke Redis selama 5 menit (300 detik)
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch (err) {
      // Abaikan kegagalan set cache jika Redis mati
    }

    return result;
  }

  /**
   * Helper untuk memformat data Prisma sesuai struktur Frontend
   */
  private mapToFrontendDTO = (cattle: any, config?: any) => {
    const ageInMonths = cattle.birthDate 
      ? Math.floor((new Date().getTime() - new Date(cattle.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    // Cari data HR dan Suhu terbaru yang tidak null dari batch vitals
    const latestHeartRate = cattle.vitals?.find((v: any) => v.heartRate !== null)?.heartRate || 0;
    const latestTemp = cattle.vitals?.find((v: any) => v.bodyTemperature !== null)?.bodyTemperature || 0;

    const fedCountToday = cattle.feedRecords?.length || 0;
    const feedingFrequency = config?.feed?.goal || config?.feedGoal || cattle.feedingFrequency || 2;

    return {
      id: cattle.cattleId,
      dbId: cattle.id,
      cattleId: cattle.cattleId,
      name: `Sapi ${cattle.cattleId}`,
      breed: cattle.breed || 'Local Breed',
      gender: cattle.gender,
      age: ageInMonths,
      weight: cattle.currentWeight || cattle.initialWeight,
      sectionId: cattle.sectionId,
      section: cattle.section,
      status: cattle.status,
      healthStatus: cattle.status,
      lastTemp: latestTemp,
      lastHeartRate: latestHeartRate,
      temp: latestTemp,
      heartRate: latestHeartRate,
      targetBkPercent: cattle.targetBkPercent ?? 2.5,
      forageRatio: cattle.forageRatio ?? 60,
      concentrateRatio: cattle.concentrateRatio ?? 40,
      forageDM: cattle.forageDM ?? 20,
      concentrateDM: cattle.concentrateDM ?? 86,
      feedingFrequency,
      fedCountToday,
    };
  };

  /**
   * 2. TAMPILKAN DAFTAR SAPI BERDASARKAN ZONA
   */
  async findAllBySection(sectionId: number) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    try {
      const data = await this.prisma.livestock.findMany({
        where: { sectionId },
        orderBy: { createdAt: 'desc' },
        include: {
          section: { include: { zone: true } },
          vitals: {
            orderBy: { timestamp: 'desc' },
            take: 5,
            select: { bodyTemperature: true, heartRate: true }
          },
          feedRecords: {
            where: {
              feedDate: { gte: todayStart }
            },
            select: { id: true }
          }
        }
      });
      const config = this.loadChecklistConfig();
      return data.map(cow => this.mapToFrontendDTO(cow, config));
    } catch (err) {
      console.warn('Database Connection Down in findAllBySection. Returning empty list.');
      return [];
    }
  }

  /**
   * 3. TAMBAH SAPI BARU
   */
  async create(data: any, author: string = 'Admin') {
    const newLivestock = await this.prisma.livestock.create({
      data: {
        cattleId: data.rfid || data.cattleId,
        breed: data.breed,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        initialWeight: parseFloat(data.initialWeight || data.weight || 0),
        sectionId: parseInt(data.sectionId),
        status: data.status || 'SEHAT',
      },
    });

    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Menambah ternak baru: ${newLivestock.cattleId}`);

    // Invalidasi cache dashboard
    try {
      await this.redis.del('dashboard:farm-summary');
    } catch (err) {}

    return newLivestock;
  }

  /**
   * 4. TAMPILKAN SEMUA SAPI (GLOBAL)
   */
  async findAll() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    try {
      const data = await this.prisma.livestock.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          section: { include: { zone: true } },
          vitals: {
            orderBy: { timestamp: 'desc' },
            take: 5, 
            select: { bodyTemperature: true, heartRate: true }
          },
          feedRecords: {
            where: {
              feedDate: { gte: todayStart }
            },
            select: { id: true }
          }
        }
      });
      const config = this.loadChecklistConfig();
      return data.map(cow => this.mapToFrontendDTO(cow, config));
    } catch (err) {
      console.warn('Database Connection Down in findAll. Returning empty list.');
      return [];
    }
  }

  /**
   * 5. LIHAT DETAIL 1 SAPI & HISTORI KESEHATAN (Untuk Modal EKG)
   */
  async findOne(id: number) {
    if (isNaN(id) || id === undefined || id === null) {
      console.warn('Invalid ID passed to findOne (NaN/null/undefined). Skipping database query.');
      return null;
    }
    try {
      return await this.prisma.livestock.findUnique({
        where: { id },
        include: {
          vitals: {
            orderBy: { timestamp: 'desc' },
            take: 20, 
          },
          healthRecords: {
            orderBy: { createdAt: 'desc' }
          }
        },
      });
    } catch (err) {
      console.warn(`Database Connection Down or error in findOne for id ${id}. Returning null.`);
      return null;
    }
  }

  /**
   * 6. PERBARUI DATA SAPI
   */
  async update(id: number, data: any, author: string = 'Admin') {
    const updated = await (this.prisma.livestock as any).update({
      where: { id: parseInt(id as any) },
      data: {
        status: data.status,
        sectionId: data.sectionId ? parseInt(data.sectionId) : undefined,
        currentWeight: data.currentWeight
          ? parseFloat(data.currentWeight)
          : undefined,
        targetBkPercent: data.targetBkPercent !== undefined ? parseFloat(data.targetBkPercent) : undefined,
        forageRatio: data.forageRatio !== undefined ? parseFloat(data.forageRatio) : undefined,
        concentrateRatio: data.concentrateRatio !== undefined ? parseFloat(data.concentrateRatio) : undefined,
        forageDM: data.forageDM !== undefined ? parseFloat(data.forageDM) : undefined,
        concentrateDM: data.concentrateDM !== undefined ? parseFloat(data.concentrateDM) : undefined,
        feedingFrequency: data.feedingFrequency !== undefined ? parseInt(data.feedingFrequency) : undefined,
      },
    });

    await this.activityService.log(author, 'EDIT', 'TERNAK', `Memperbarui data ternak: ${updated.cattleId}`);

    try {
      await this.redis.del('dashboard:farm-summary');
    } catch (err) {}
    return updated;
  }

  /**
   * 7. HAPUS DATA SAPI
   */
  async remove(id: number, author: string = 'Admin') {
    const deleted = await this.prisma.livestock.delete({
      where: { id: parseInt(id as any) },
    });
    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus ternak: ${deleted.cattleId}`);
    try {
      await this.redis.del(`livestock:stats:section:${deleted.sectionId}`);
      await this.redis.del('dashboard:farm-summary');
    } catch (err) {}
    return deleted;
  }

  async removeByCattleId(cattleId: string, author: string = 'Admin') {
    const deleted = await this.prisma.livestock.delete({
      where: { cattleId },
    });
    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus ternak: ${deleted.cattleId}`);
    try {
      await this.redis.del(`livestock:stats:section:${deleted.sectionId}`);
      await this.redis.del('dashboard:farm-summary');
    } catch (err) {}
    return deleted;
  }

  /**
   * ==========================================
   * MANAJEMEN LIMBAH & PENGATURAN (FITUR BARU)
   * ==========================================
   */

  // 1. Dapatkan Setting Default
  async getSettings() {
    const feces = await this.prisma.systemSettings.findUnique({ where: { key: 'DEFAULT_FECES_KG' } });
    const urine = await this.prisma.systemSettings.findUnique({ where: { key: 'DEFAULT_URINE_L' } });
    
    return {
      fecesKg: feces ? parseFloat(feces.value) : 25,
      urineL: urine ? parseFloat(urine.value) : 120
    };
  }

  // 2. Simpan Setting Default
  async updateSettings(fecesKg: number, urineL: number, author: string = 'Admin') {
    await this.prisma.systemSettings.upsert({
      where: { key: 'DEFAULT_FECES_KG' },
      update: { value: fecesKg.toString() },
      create: { key: 'DEFAULT_FECES_KG', value: fecesKg.toString() }
    });
    await this.prisma.systemSettings.upsert({
      where: { key: 'DEFAULT_URINE_L' },
      update: { value: urineL.toString() },
      create: { key: 'DEFAULT_URINE_L', value: urineL.toString() }
    });
    
    await this.activityService.log(author, 'EDIT', 'SILO', 'Memperbarui pengaturan default limbah');
    return { success: true };
  }

  // 3. Catat Limbah Manual (Multi-select)
  async recordWaste(cattleIds: string[], fecesKg: number, urineL: number, author: string = 'Admin') {
    const config = this.loadChecklistConfig();
    const period = config.waste?.period || 'daily';
    const goal = config.waste?.goal || 1;
    const startDate = this.getStartDateForPeriod(period);

    for (const cattleId of cattleIds) {
        const count = await this.prisma.livestockWaste.count({
            where: {
                cattleId,
                date: { gte: startDate }
            }
        });
        if (count >= goal) {
            throw new BadRequestException(`Batas pencatatan limbah (${goal} kali per ${period === 'monthly' ? 'bulan' : period === 'weekly' ? 'minggu' : 'hari'}) sudah tercapai untuk sapi ${cattleId}.`);
        }
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const promises = cattleIds.map(cattleId => 
      this.prisma.livestockWaste.upsert({
        where: { cattleId_date: { cattleId, date: today } },
        update: { fecesKg, urineL, isAuto: false },
        create: { cattleId, date: today, fecesKg, urineL, isAuto: false }
      })
    );

    await Promise.all(promises);

    const cattleList = cattleIds.length > 3 ? `${cattleIds.slice(0, 3).join(', ')}... (+${cattleIds.length - 3} lainnya)` : cattleIds.join(', ');
    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Mencatat limbah manual untuk sapi: ${cattleList}`);
    return { success: true, count: cattleIds.length };
  }

  // 3b. Catat Limbah Kandang (ZoneWaste)
  async recordZoneWaste(zoneId: number, fecesKg: number, urineL: number, author: string = 'Admin') {
    const config = this.loadChecklistConfig();
    const period = config.waste?.period || 'daily';
    const goal = config.waste?.goal || 1;
    const startDate = this.getStartDateForPeriod(period);

    const count = await this.prisma.zoneWaste.count({
        where: {
            zoneId,
            date: { gte: startDate }
        }
    });

    if (count >= goal) {
        throw new BadRequestException(`Batas pencatatan limbah (${goal} kali per ${period === 'monthly' ? 'bulan' : period === 'weekly' ? 'minggu' : 'hari'}) sudah tercapai untuk zona/kandang ini.`);
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const result = await this.prisma.zoneWaste.upsert({
      where: {
        zoneId_date: {
          zoneId,
          date: today
        }
      },
      update: {
        fecesKg,
        urineL
      },
      create: {
        zoneId,
        date: today,
        fecesKg,
        urineL
      },
      include: {
        zone: true
      }
    });

    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Mencatat limbah kandang untuk ${result.zone?.name || `Kandang #${zoneId}`}: Feces ${fecesKg} Kg, Urine ${urineL} L`);
    return result;
  }

  // 4. Catat Limbah Otomatis (Global untuk semua sapi hari ini)
  async autoRecordWasteAll() {
    const settings = await this.getSettings();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const allCattle = await this.prisma.livestock.findMany({ select: { cattleId: true } });
    
    const wasteData = allCattle.map(cow => ({
      cattleId: cow.cattleId,
      date: today,
      fecesKg: settings.fecesKg,
      urineL: settings.urineL,
      isAuto: true
    }));

    const result = await this.prisma.livestockWaste.createMany({
      data: wasteData,
      skipDuplicates: true
    });

    return { success: true, countAdded: result.count };
  }

  // 5. Ambil Ringkasan Limbah Hari Ini
  async getWasteSummary() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const aggregate = await this.prisma.livestockWaste.aggregate({
      where: { date: today },
      _sum: { fecesKg: true, urineL: true },
      _avg: { fecesKg: true, urineL: true },
      _count: { id: true }
    });

    return {
      totalFeces: aggregate._sum.fecesKg || 0,
      totalUrine: aggregate._sum.urineL || 0,
      avgFeces: aggregate._avg.fecesKg || 0,
      avgUrine: aggregate._avg.urineL || 0,
      cowCount: aggregate._count.id || 0
    };
  }

  /**
   * ==========================================
   * MANAJEMEN PERTUMBUHAN & PAKAN (FITUR BARU)
   * ==========================================
   */

  private getStartDateForPeriod(period: string) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (period === 'weekly') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
    } else if (period === 'monthly') {
      start.setDate(1);
    }
    return start;
  }

  // 1. Catat Berat Sapi (Dengan opsi tanggal mundur/kustom)
  async recordWeight(cattleId: string, weight: number, author: string = 'Admin', dateStr?: string) {
    const config = this.loadChecklistConfig();
    const period = config.weight?.period || 'monthly';
    const goal = config.weight?.goal || 1;
    const startDate = this.getStartDateForPeriod(period);

    const count = await this.prisma.livestockWeightRecord.count({
        where: {
            cattleId,
            weighDate: { gte: startDate }
        }
    });

    if (count >= goal) {
        throw new BadRequestException(`Batas pencatatan timbang (${goal} kali per ${period === 'monthly' ? 'bulan' : period === 'weekly' ? 'minggu' : 'hari'}) sudah tercapai untuk sapi ${cattleId}.`);
    }

    // 1. Simpan history
    const weighDate = dateStr ? new Date(dateStr) : new Date();
    
    const record = await this.prisma.livestockWeightRecord.create({
      data: { cattleId, weight, weighDate }
    });

    // 2. Update current weight di Livestock
    await this.prisma.livestock.update({
      where: { cattleId },
      data: { currentWeight: weight }
    });

    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Mencatat berat sapi ${cattleId}: ${weight} kg pada ${weighDate.toISOString().split('T')[0]}`);
    return record;
  }

  // 2. Catat Pemberian Pakan per Sapi
  async recordFeed(cattleId: string, feedType: string, weightKg: number, bkPercent: number = 100, author: string = 'Admin') {
    const cow = await this.getFeedNeeds(cattleId);
    const config = this.loadChecklistConfig();
    const period = config.feed?.period || 'daily';
    const goal = cow.prefs.feedingFrequency || config.feed?.goal || 1;
    
    const startDate = this.getStartDateForPeriod(period);
    
    const count = await this.prisma.livestockFeedRecord.count({
        where: {
            cattleId,
            feedDate: { gte: startDate }
        }
    });

    if (count >= goal) {
        throw new BadRequestException(`Batas pakan (${goal} kali per ${period === 'monthly' ? 'bulan' : period === 'weekly' ? 'minggu' : 'hari'}) sudah tercapai untuk sapi ${cattleId}.`);
    }

    const asFedWeight = weightKg; // Berat yang diberikan
    const bkConsumed = weightKg * (bkPercent / 100); // Berat BK sesungguhnya

    const record = await this.prisma.livestockFeedRecord.create({
      data: { cattleId, feedType, weightKg, bkPercent, asFedWeight }
    });

    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Mencatat pakan sapi ${cattleId}: ${feedType} ${weightKg}kg`);
    return record;
  }

  private loadChecklistConfig() {
    try {
      const configPath = path.join(process.cwd(), 'checklist-config.json');
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(data);
        if (parsed.feedGoal !== undefined) {
          return {
            feed: { goal: parsed.feedGoal, period: 'daily' },
            waste: { goal: parsed.wasteGoal, period: 'daily' },
            weight: { goal: parsed.weightGoal, period: 'monthly' }
          };
        }
        return parsed;
      }
    } catch (err) {
      // Ignored
    }
    return { feed: { goal: 2, period: 'daily' }, waste: { goal: 1, period: 'daily' }, weight: { goal: 1, period: 'monthly' } };
  }

  // 3. Dapatkan Kebutuhan Pakan (BK & As-fed)
  async getFeedNeeds(cattleId: string) {
    const cow = await (this.prisma.livestock as any).findUnique({
      where: { cattleId },
      select: { 
          currentWeight: true, 
          initialWeight: true,
          targetBkPercent: true,
          forageRatio: true,
          concentrateRatio: true,
          forageDM: true,
          concentrateDM: true,
          feedingFrequency: true
      }
    });

    if (!cow) throw new Error('Cow not found');
    const weight = cow.currentWeight || cow.initialWeight || 0;

    // Ambil target atau gunakan default
    const cowData = cow as any;
    const bkPercentTarget = cowData.targetBkPercent || 2.5;
    const bkRequirement = weight * (bkPercentTarget / 100); 
    
    const forageRatio = cowData.forageRatio ?? 60;
    const concentrateRatio = cowData.concentrateRatio ?? 40;
    const forageDM = cowData.forageDM ?? 20;
    const concentrateDM = cowData.concentrateDM ?? 86;
    const feedingFrequency = cowData.feedingFrequency ?? 2;

    let suggestedForageAsFed = 0;
    let suggestedConcentrateAsFed = 0;

    if (concentrateRatio === 999) {
      // Mode TMR: 100% pakan TMR dengan forageDM sebagai DM TMR
      suggestedForageAsFed = bkRequirement / (forageDM / 100);
      suggestedConcentrateAsFed = 0;
    } else {
      suggestedForageAsFed = (bkRequirement * (forageRatio / 100)) / (forageDM / 100);
      suggestedConcentrateAsFed = (bkRequirement * (concentrateRatio / 100)) / (concentrateDM / 100);
    }

    const config = this.loadChecklistConfig();
    const feedGoal = config.feed?.goal || config.feedGoal || 1;

    return {
      weight,
      bkRequirement,
      suggestedForageAsFed,
      suggestedConcentrateAsFed,
      feedGoal,
      // Sertakan juga parameter asli agar Frontend bisa menampilkannya di form
      prefs: {
          targetBkPercent: bkPercentTarget,
          forageRatio,
          concentrateRatio,
          forageDM,
          concentrateDM,
          feedingFrequency
      }
    };
  }

  // 4. Data untuk Grafik: BK vs Bobot vs Limbah vs THI
  async getPerformanceChartData(period: string = 'minggu') {
    let days = 7;
    if (period === 'hari') days = 1;
    else if (period === 'bulan') days = 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1); // +1 so if days=1 it's just today

    let wastes: any[] = [];
    let feeds: any[] = [];
    let envData: any[] = [];
    let isDummy = true;

    try {
      // Ambil Limbah per hari
      wastes = await (this.prisma.livestockWaste.groupBy as any)({
        by: ['date'],
        where: { date: { gte: startDate } },
        _sum: { fecesKg: true, urineL: true }
      });

      // Ambil Pakan per hari (Asumsi rata-rata BK% * Weight)
      feeds = await this.prisma.livestockFeedRecord.findMany({
        where: { feedDate: { gte: startDate } }
      });

      // Ambil THI (Rata-rata per hari)
      envData = await this.prisma.environmentData.findMany({
        where: { timestamp: { gte: startDate } }
      });

      // Kita hanya cek wastes dan feeds. Karena envData terus masuk dari sensor/simulator,
      // maka kita abaikan envData sebagai penentu apakah data "asli" kinerja ternak sudah ada.
      const hasRealData = wastes.length > 0 || feeds.length > 0;
      isDummy = !hasRealData;
    } catch (err) {
      console.warn('Error fetching chart data from database, falling back to simulation:', err.message);
      isDummy = true;
    }

    // Proses data harian
    const chartData: any[] = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      let totalWaste = 0;
      let totalBk = 0;
      let avgThi = 0;
      let simulatedWeightGain = 0;

      if (!isDummy) {
        const dailyWastes = wastes.find(w => new Date(w.date).toISOString().split('T')[0] === dateStr);
        totalWaste = (dailyWastes?._sum.fecesKg || 0) + (dailyWastes?._sum.urineL || 0);

        const dailyFeeds = feeds.filter(f => new Date(f.feedDate).toISOString().split('T')[0] === dateStr);
        totalBk = dailyFeeds.reduce((acc, f) => acc + (f.weightKg * ((f.bkPercent || 100) / 100)), 0);

        const dailyEnv = envData.filter(e => new Date(e.timestamp).toISOString().split('T')[0] === dateStr && e.thi !== null);
        avgThi = dailyEnv.length ? dailyEnv.reduce((acc, e) => acc + (e.thi || 0), 0) / dailyEnv.length : 0;

        // Mockup pertambahan bobot jika belum ada algoritma pasti, tapi kita hubungkan dengan BK dan THI
        // BK tinggi -> ADG naik. THI tinggi (Stres) -> ADG turun
        if (totalBk > 0) {
          simulatedWeightGain = (totalBk * 0.15) - (avgThi > 72 ? (avgThi - 72) * 0.05 : 0);
          if (simulatedWeightGain < 0) simulatedWeightGain = 0;
        }
      } else {
        // Generate Dummy Data for this day
        // Waste: ~30-40 kg/L total
        // BK: ~15-20 kg
        // THI: ~68-75
        // Weight Gain: ~1.0-1.5 kg
        totalWaste = 30 + Math.random() * 10;
        totalBk = 15 + Math.random() * 5;
        avgThi = 68 + Math.random() * 7;
        simulatedWeightGain = 1.0 + Math.random() * 0.5;
      }

      chartData.push({
        date: dateStr,
        waste: parseFloat(totalWaste.toFixed(2)),
        bk: parseFloat(totalBk.toFixed(2)),
        thi: parseFloat(avgThi.toFixed(2)),
        weightGain: parseFloat(simulatedWeightGain.toFixed(2))
      });
    }

    return {
      data: chartData,
      isDummy
    };
  }

  // ==========================================
  // RIWAYAT & EDIT DATA INPUT BARU (EDIT/DELETE)
  // ==========================================

  // 1. Ambil 20 Input Terbaru untuk Pakan, Timbangan, dan Limbah
  async getRecentInputs() {
    try {
      const [feeds, weights, wastes, zoneWastes] = await Promise.all([
        this.prisma.livestockFeedRecord.findMany({
          orderBy: { feedDate: 'desc' },
          take: 10,
        }),
        this.prisma.livestockWeightRecord.findMany({
          orderBy: { weighDate: 'desc' },
          take: 10,
        }),
        this.prisma.livestockWaste.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.zoneWaste.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { zone: true }
        })
      ]);

      const combined: any[] = [];

      feeds.forEach(f => {
        combined.push({
          id: f.id,
          type: 'PAKAN',
          cattleId: f.cattleId,
          title: `Pemberian Pakan`,
          details: `${f.feedType} - ${f.weightKg} kg`,
          date: f.feedDate,
          raw: f
        });
      });

      weights.forEach(w => {
        combined.push({
          id: w.id,
          type: 'TIMBANGAN',
          cattleId: w.cattleId,
          title: `Penimbangan Sapi`,
          details: `${w.weight} kg`,
          date: w.weighDate,
          raw: w
        });
      });

      wastes.forEach(w => {
        combined.push({
          id: w.id,
          type: 'LIMBAH',
          cattleId: w.cattleId,
          title: `Pencatatan Limbah`,
          details: `Feces: ${w.fecesKg} kg, Urine: ${w.urineL} L`,
          date: w.date,
          raw: w
        });
      });

      zoneWastes.forEach(zw => {
        combined.push({
          id: zw.id,
          type: 'LIMBAH_KANDANG',
          zoneId: zw.zoneId,
          zoneName: zw.zone?.name || `Kandang #${zw.zoneId}`,
          title: `Limbah Kandang (${zw.zone?.name || `Kandang #${zw.zoneId}`})`,
          details: `Feces: ${zw.fecesKg} kg, Urine: ${zw.urineL} L`,
          date: zw.date,
          raw: zw
        });
      });

      // Urutkan berdasarkan tanggal terbaru
      return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
    } catch (err) {
      console.error('Error fetching recent inputs:', err);
      return [];
    }
  }

  // 2. Edit & Hapus Pakan
  async updateFeedRecord(id: number, data: { weightKg?: number, feedType?: string }, author: string = 'Admin') {
    const old = await this.prisma.livestockFeedRecord.findUnique({ where: { id } });
    if (!old) throw new Error('Data pakan tidak ditemukan');

    const updated = await this.prisma.livestockFeedRecord.update({
      where: { id },
      data: {
        weightKg: data.weightKg !== undefined ? parseFloat(data.weightKg as any) : undefined,
        feedType: data.feedType,
        asFedWeight: data.weightKg !== undefined ? parseFloat(data.weightKg as any) : undefined,
      }
    });

    await this.activityService.log(author, 'EDIT', 'TERNAK', `Mengubah pakan sapi ${updated.cattleId}: ${old.weightKg}kg -> ${updated.weightKg}kg`);
    return updated;
  }

  async deleteFeedRecord(id: number, author: string = 'Admin') {
    const deleted = await this.prisma.livestockFeedRecord.delete({ where: { id } });
    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus pakan sapi ${deleted.cattleId}: ${deleted.feedType} ${deleted.weightKg}kg`);
    return { success: true };
  }

  // 3. Edit & Hapus Timbangan
  async updateWeightRecord(id: number, data: { weight?: number }, author: string = 'Admin') {
    const old = await this.prisma.livestockWeightRecord.findUnique({ where: { id } });
    if (!old) throw new Error('Data timbangan tidak ditemukan');

    const updated = await this.prisma.livestockWeightRecord.update({
      where: { id },
      data: {
        weight: data.weight !== undefined ? parseFloat(data.weight as any) : undefined,
      }
    });

    // Update current weight di tabel Livestock
    await this.prisma.livestock.update({
      where: { cattleId: updated.cattleId },
      data: { currentWeight: updated.weight }
    });

    await this.activityService.log(author, 'EDIT', 'TERNAK', `Mengubah timbangan sapi ${updated.cattleId}: ${old.weight}kg -> ${updated.weight}kg`);
    return updated;
  }

  async deleteWeightRecord(id: number, author: string = 'Admin') {
    const deleted = await this.prisma.livestockWeightRecord.delete({ where: { id } });
    
    // Cari berat terakhir yang tersisa
    const latest = await this.prisma.livestockWeightRecord.findFirst({
      where: { cattleId: deleted.cattleId },
      orderBy: { weighDate: 'desc' }
    });

    // Update current weight di Livestock ke nilai sebelumnya (atau initial jika kosong)
    const cow = await this.prisma.livestock.findUnique({ where: { cattleId: deleted.cattleId } });
    if (cow) {
      await this.prisma.livestock.update({
        where: { cattleId: deleted.cattleId },
        data: { currentWeight: latest ? latest.weight : cow.initialWeight }
      });
    }

    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus timbangan sapi ${deleted.cattleId}: ${deleted.weight}kg`);
    return { success: true };
  }

  // 4. Edit & Hapus Limbah
  async updateWasteRecord(id: number, data: { fecesKg?: number, urineL?: number }, author: string = 'Admin') {
    const old = await this.prisma.livestockWaste.findUnique({ where: { id } });
    if (!old) throw new Error('Data limbah tidak ditemukan');

    const updated = await this.prisma.livestockWaste.update({
      where: { id },
      data: {
        fecesKg: data.fecesKg !== undefined ? parseFloat(data.fecesKg as any) : undefined,
        urineL: data.urineL !== undefined ? parseFloat(data.urineL as any) : undefined,
      }
    });

    await this.activityService.log(author, 'EDIT', 'TERNAK', `Mengubah limbah sapi ${updated.cattleId}: Feces ${old.fecesKg}kg -> ${updated.fecesKg}kg`);
    return updated;
  }

  async deleteWasteRecord(id: number, author: string = 'Admin') {
    const deleted = await this.prisma.livestockWaste.delete({ where: { id } });
    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus limbah sapi ${deleted.cattleId}`);
    return { success: true };
  }

  // 5. Edit & Hapus Limbah Kandang
  async updateZoneWasteRecord(id: number, data: { fecesKg?: number, urineL?: number }, author: string = 'Admin') {
    const old = await this.prisma.zoneWaste.findUnique({ where: { id }, include: { zone: true } });
    if (!old) throw new Error('Data limbah kandang tidak ditemukan');

    const updated = await this.prisma.zoneWaste.update({
      where: { id },
      data: {
        fecesKg: data.fecesKg !== undefined ? parseFloat(data.fecesKg as any) : undefined,
        urineL: data.urineL !== undefined ? parseFloat(data.urineL as any) : undefined,
      },
      include: { zone: true }
    });

    await this.activityService.log(author, 'EDIT', 'TERNAK', `Mengubah limbah kandang ${updated.zone?.name || updated.zoneId}: Feces ${old.fecesKg}kg -> ${updated.fecesKg}kg`);
    return updated;
  }

  async deleteZoneWasteRecord(id: number, author: string = 'Admin') {
    const deleted = await this.prisma.zoneWaste.delete({ where: { id }, include: { zone: true } });
    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus limbah kandang ${deleted.zone?.name || deleted.zoneId}`);
    return { success: true };
  }
}