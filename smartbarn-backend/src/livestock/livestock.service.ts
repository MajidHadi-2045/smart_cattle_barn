// src/livestock/livestock.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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

  async getHistoricalVitals(cattleId: string) {
    try {
      const records = await this.prisma.livestockVital.findMany({
        where: { cattleId },
        orderBy: { timestamp: 'desc' },
        take: 30, // Ambil 30 data terakhir untuk chart
      });
      return records.reverse(); // Urutkan dari terlama ke terbaru
    } catch (err) {
      console.warn(`Error fetching historical vitals for ${cattleId}:`, err);
      return [];
    }
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
    const feedingFrequency = cattle.feedingFrequency || config?.feed?.goal || config?.feedGoal || 2;

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
   * Helper untuk menghapus semua cache terkait livestock jika ada pembaruan
   */
  private async clearLivestockCache(sectionId?: number) {
    try {
      await this.redis.del('dashboard:farm-summary');
      await this.redis.del('livestock:list:all');
      if (sectionId) {
        await this.redis.del(`livestock:stats:section:${sectionId}`);
        await this.redis.del(`livestock:list:section:${sectionId}`);
      } else {
        const keys = await this.redis.keys('livestock:list:section:*');
        const statsKeys = await this.redis.keys('livestock:stats:section:*');
        if (keys.length) await this.redis.del(...keys);
        if (statsKeys.length) await this.redis.del(...statsKeys);
      }
    } catch (err) {}
  }

  /**
   * 2. TAMPILKAN DAFTAR SAPI BERDASARKAN ZONA
   */
  async findAllBySection(sectionId: number) {
    const cacheKey = `livestock:list:section:${sectionId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {}

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
            where: { feedDate: { gte: todayStart } },
            select: { id: true }
          }
        }
      });
      const config = this.loadChecklistConfig();
      const result = data.map(cow => this.mapToFrontendDTO(cow, config));
      
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // Cache 1 Jam
      } catch (err) {}
      
      return result;
    } catch (err) {
      console.warn('Database Connection Down in findAllBySection. Returning empty list.');
      return [];
    }
  }

  /**
   * 3. TAMBAH SAPI BARU
   */
  async create(data: any, author: string = 'Admin') {
    const weight = parseFloat(data.initialWeight !== undefined && data.initialWeight !== null ? data.initialWeight : data.weight || 0);
    if (isNaN(weight) || weight <= 0) {
      throw new BadRequestException('initialWeight must be a positive number');
    }

    const newLivestock = await this.prisma.livestock.create({
      data: {
        cattleId: data.rfid || data.cattleId,
        breed: data.breed,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        initialWeight: weight,
        sectionId: parseInt(data.sectionId),
        status: data.status || 'SEHAT',
      },
    });

    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Menambah ternak baru: ${newLivestock.cattleId}`);

    // Invalidasi cache
    await this.clearLivestockCache(newLivestock.sectionId);

    return newLivestock;
  }

  /**
   * 4. TAMPILKAN SEMUA SAPI (GLOBAL)
   */
  async findAll() {
    const cacheKey = 'livestock:list:all';
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {}

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
            where: { feedDate: { gte: todayStart } },
            select: { id: true }
          }
        }
      });
      const config = this.loadChecklistConfig();
      const result = data.map(cow => this.mapToFrontendDTO(cow, config));
      
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // Cache 1 Jam
      } catch (err) {}
      
      return result;
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
  async updateBulkNutrition(cattleIds: string[], data: { targetBkPercent?: number, forageRatio?: number, concentrateRatio?: number, forageDM?: number, concentrateDM?: number, feedingFrequency?: number }, author: string = 'Admin') {
    const updated = await (this.prisma.livestock as any).updateMany({
      where: { cattleId: { in: cattleIds } },
      data: {
        targetBkPercent: (data.targetBkPercent !== undefined && data.targetBkPercent !== null && (data as any).targetBkPercent !== '' && !isNaN(parseFloat(data.targetBkPercent as any))) ? parseFloat(data.targetBkPercent as any) : undefined,
        forageRatio: (data.forageRatio !== undefined && data.forageRatio !== null && (data as any).forageRatio !== '' && !isNaN(parseFloat(data.forageRatio as any))) ? parseFloat(data.forageRatio as any) : undefined,
        concentrateRatio: (data.concentrateRatio !== undefined && data.concentrateRatio !== null && (data as any).concentrateRatio !== '' && !isNaN(parseFloat(data.concentrateRatio as any))) ? parseFloat(data.concentrateRatio as any) : undefined,
        forageDM: (data.forageDM !== undefined && data.forageDM !== null && (data as any).forageDM !== '' && !isNaN(parseFloat(data.forageDM as any))) ? parseFloat(data.forageDM as any) : undefined,
        concentrateDM: (data.concentrateDM !== undefined && data.concentrateDM !== null && (data as any).concentrateDM !== '' && !isNaN(parseFloat(data.concentrateDM as any))) ? parseFloat(data.concentrateDM as any) : undefined,
        feedingFrequency: (data.feedingFrequency !== undefined && data.feedingFrequency !== null && (data as any).feedingFrequency !== '' && !isNaN(parseInt(data.feedingFrequency as any))) ? parseInt(data.feedingFrequency as any) : undefined,
      }
    });

    await this.activityService.log(author, 'EDIT', 'TERNAK', `Memperbarui nutrisi massal untuk ${updated.count} ekor sapi`);
    await this.clearLivestockCache();
    return { success: true, count: updated.count };
  }

  async update(idOrCattleId: string | number, data: any, author: string = 'Admin', userRole?: string) {
    if (data.status && userRole && userRole.toUpperCase() !== 'VETERINER') {
      throw new (require('@nestjs/common').ForbiddenException)('Hanya Dokter Hewan (VETERINER) yang berhak memperbarui status kesehatan ternak.');
    }

    const isNumeric = !isNaN(Number(idOrCattleId)) && String(idOrCattleId).trim() !== '';
    const whereClause = isNumeric
      ? { id: Number(idOrCattleId) }
      : { cattleId: String(idOrCattleId) };

    const updated = await (this.prisma.livestock as any).update({
      where: whereClause,
      data: {
        cattleId: data.cattleId,
        breed: data.breed,
        gender: data.gender,
        initialWeight: data.initialWeight ? parseFloat(data.initialWeight) : undefined,
        ...(userRole?.toUpperCase() === 'VETERINER' || !data.status ? { status: data.status } : {}),
        sectionId: data.sectionId ? parseInt(data.sectionId) : undefined,
        currentWeight: data.currentWeight
          ? parseFloat(data.currentWeight)
          : undefined,
        targetBkPercent: (data.targetBkPercent !== undefined && data.targetBkPercent !== null && data.targetBkPercent !== '' && !isNaN(parseFloat(data.targetBkPercent))) ? parseFloat(data.targetBkPercent) : undefined,
        forageRatio: (data.forageRatio !== undefined && data.forageRatio !== null && data.forageRatio !== '' && !isNaN(parseFloat(data.forageRatio))) ? parseFloat(data.forageRatio) : undefined,
        concentrateRatio: (data.concentrateRatio !== undefined && data.concentrateRatio !== null && data.concentrateRatio !== '' && !isNaN(parseFloat(data.concentrateRatio))) ? parseFloat(data.concentrateRatio) : undefined,
        forageDM: (data.forageDM !== undefined && data.forageDM !== null && data.forageDM !== '' && !isNaN(parseFloat(data.forageDM))) ? parseFloat(data.forageDM) : undefined,
        concentrateDM: (data.concentrateDM !== undefined && data.concentrateDM !== null && data.concentrateDM !== '' && !isNaN(parseFloat(data.concentrateDM))) ? parseFloat(data.concentrateDM) : undefined,
        feedingFrequency: (data.feedingFrequency !== undefined && data.feedingFrequency !== null && data.feedingFrequency !== '' && !isNaN(parseInt(data.feedingFrequency))) ? parseInt(data.feedingFrequency) : undefined,
      },
    });

    await this.activityService.log(author, 'EDIT', 'TERNAK', `Memperbarui data ternak: ${updated.cattleId}`);

    await this.clearLivestockCache(updated.sectionId);
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
    await this.clearLivestockCache(deleted.sectionId);
    return deleted;
  }

  async removeByCattleId(cattleId: string, author: string = 'Admin') {
    const deleted = await this.prisma.livestock.delete({
      where: { cattleId },
    });
    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus ternak: ${deleted.cattleId}`);
    await this.clearLivestockCache(deleted.sectionId);
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

    // Optimasi N+1 Query: Gunakan groupBy alih-alih loop berulang
    const counts = await this.prisma.livestockWaste.groupBy({
      by: ['cattleId'],
      where: {
        cattleId: { in: cattleIds },
        date: { gte: startDate }
      },
      _count: { _all: true }
    });

    for (const item of counts) {
        if (item._count._all >= goal) {
            throw new BadRequestException(`Batas pencatatan limbah (${goal} kali per ${period === 'monthly' ? 'bulan' : period === 'weekly' ? 'minggu' : 'hari'}) sudah tercapai untuk sapi ${item.cattleId}.`);
        }
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Menggunakan teknik Chunking/Batching (50 queries per proses) untuk mencegah Connection Pool Exhaustion
    const chunkSize = 50;
    for (let i = 0; i < cattleIds.length; i += chunkSize) {
      const chunk = cattleIds.slice(i, i + chunkSize);
      const promises = chunk.map(cattleId => 
        this.prisma.livestockWaste.upsert({
          where: { cattleId_date: { cattleId, date: today } },
          update: { fecesKg, urineL, isAuto: false },
          create: { cattleId, date: today, fecesKg, urineL, isAuto: false }
        })
      );
      await Promise.all(promises);
    }

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

  private async autoUpdateScheduleStatus(feedType: string, zoneId?: number) {
    try {
      const now = new Date();
      // Konversi ke Waktu Indonesia Barat (WIB) / GMT+7
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const wibDate = new Date(utcTime + (3600000 * 7));
      const currentHour = wibDate.getHours();
      const currentMinute = wibDate.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      const getWibDateString = (dObj: Date) => {
          const u = dObj.getTime() + (dObj.getTimezoneOffset() * 60000);
          const w = new Date(u + (3600000 * 7));
          return `${w.getFullYear()}-${w.getMonth() + 1}-${w.getDate()}`;
      };

      const todayStr = getWibDateString(now);

      const keyword = feedType.toLowerCase().includes('konsentrat+hijauan') || feedType.toLowerCase() === 'tmr' 
          ? '' 
          : feedType.toLowerCase();

      const schedules = await this.prisma.feedingSchedule.findMany();
      
      let matchedSchedules = schedules.filter(s => {
          if (keyword && !s.feedType.toLowerCase().includes(keyword) && !keyword.includes(s.feedType.toLowerCase())) return false;
          if (zoneId && s.zoneId && s.zoneId !== zoneId) return false;
          return true;
      });

      matchedSchedules = matchedSchedules.filter(s => {
          const isUpdatedToday = s.updatedAt && getWibDateString(new Date(s.updatedAt)) === todayStr;
          return !isUpdatedToday || s.status === 'BELUM';
      });

      if (matchedSchedules.length === 0) return;

      matchedSchedules.sort((a, b) => {
          const parseTime = (timeStr: string) => {
              const parts = timeStr.split('-');
              const end = parts.length > 1 ? parts[1].trim() : parts[0].trim();
              const [h, m] = end.split(':').map(Number);
              return (!isNaN(h) && !isNaN(m)) ? h * 60 + m : 0;
          };
          const diffA = Math.abs(currentTimeInMinutes - parseTime(a.time));
          const diffB = Math.abs(currentTimeInMinutes - parseTime(b.time));
          return diffA - diffB;
      });

      const targetSchedule = matchedSchedules[0];
      const timeParts = targetSchedule.time.split('-');
      const endTimeStr = timeParts.length > 1 ? timeParts[1].trim() : timeParts[0].trim();
      const [endHour, endMinute] = endTimeStr.split(':').map(Number);
      
      if (!isNaN(endHour) && !isNaN(endMinute)) {
          const schedTimeInMinutes = endHour * 60 + endMinute;
          const diffMinutes = currentTimeInMinutes - schedTimeInMinutes;
          
          let newStatus = 'SUDAH';
          let isLate = false;
          
          if (diffMinutes < -30) {
              newStatus = 'LEBIH_AWAL';
          } else if (diffMinutes > 30) {
              newStatus = 'TELAT';
              isLate = true;
          }
          
          await this.prisma.feedingSchedule.update({
              where: { id: targetSchedule.id },
              data: { 
                  status: newStatus as any, 
                  isLate: isLate,
                  updatedAt: now
              }
          });
          
          try {
            await this.redis.del('feed:schedules');
          } catch(e) {}
      }
    } catch (err) {
      console.error('Error auto-updating schedule:', err);
    }
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

    await this.clearLivestockCache();
    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Mencatat berat sapi ${cattleId}: ${weight} kg pada ${weighDate.toISOString().split('T')[0]}`);
    return record;
  }

  // 10. Hapus Batch / Kolektif
  async deleteBatch(batchId: string, author: string = 'Admin') {
    const feeds = await this.prisma.livestockFeedRecord.deleteMany({ where: { batchId } });
    const weights = await this.prisma.livestockWeightRecord.deleteMany({ where: { batchId } });
    const wastes = await this.prisma.livestockWaste.deleteMany({ where: { batchId } });
    const zoneWastes = await this.prisma.zoneWaste.deleteMany({ where: { batchId } });

    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus input kolektif dengan batchId: ${batchId}`);
    return { 
      success: true, 
      deletedFeeds: feeds.count, 
      deletedWeights: weights.count, 
      deletedWastes: wastes.count,
      deletedZoneWastes: zoneWastes.count
    };
  }

  // 2. Catat Pemberian Pakan per Sapi
  async recordFeed(cattleId: string, feedType: string, weightKg: number, bkPercent: number = 100, author: string = 'Admin', siloId?: number) {
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

    // 1. Tentukan Kebutuhan per Komponen Pakan
    let reqHijauan = 0;
    let reqKonsentrat = 0;
    const typeStr = feedType.toLowerCase();

    if (typeStr.includes('konsentrat+hijauan') || typeStr === 'tmr') {
        const fRatio = cow.prefs?.forageRatio || 60;
        const cRatio = cow.prefs?.concentrateRatio || 40;
        reqHijauan = weightKg * (fRatio / 100);
        reqKonsentrat = weightKg * (cRatio / 100);
    } else if (typeStr.includes('konsentrat')) {
        reqKonsentrat = weightKg;
    } else {
        reqHijauan = weightKg;
    }

    // 2. Ambil Semua Silo dan Prioritaskan silo yang dipilih user
    let allSilos = await this.prisma.silo.findMany({ orderBy: { currentStock: 'desc' } });
    if (siloId) {
        const selectedSilo = allSilos.find(s => s.id === parseInt(siloId as any));
        if (selectedSilo) {
            allSilos = [selectedSilo, ...allSilos.filter(s => s.id !== selectedSilo.id)];
        }
    }

    // 3. Hitung Pemotongan Stok dari berbagai Silo
    const deductions: { id: number, name: string, deductAmount: number, oldStock: number, capacity: number }[] = [];
    
    const fulfill = (amountNeeded: number, keyword: string) => {
        let remaining = amountNeeded;
        for (const silo of allSilos) {
            if (remaining <= 0) break;
            const sType = (silo.feedType || '').toLowerCase();
            const sName = (silo.name || '').toLowerCase();
            if (sType.includes(keyword) || sName.includes(keyword) || (keyword === 'hijauan' && (sType.includes('rumput') || sName.includes('rumput')))) {
                const available = silo.currentStock - (deductions.find(d => d.id === silo.id)?.deductAmount || 0);
                if (available > 0) {
                    const take = Math.min(remaining, available);
                    const existingDeduction = deductions.find(d => d.id === silo.id);
                    if (existingDeduction) {
                        existingDeduction.deductAmount += take;
                    } else {
                        deductions.push({ id: silo.id, name: silo.name, deductAmount: take, oldStock: silo.currentStock, capacity: silo.capacity });
                    }
                    remaining -= take;
                }
            }
        }
        if (remaining > 0.01) { 
            throw new BadRequestException(`Gagal! Stok ${keyword} tidak mencukupi (Kurang ${remaining.toFixed(2)} Kg di seluruh silo)`);
        }
    };

    if (reqHijauan > 0) fulfill(reqHijauan, 'hijauan');
    if (reqKonsentrat > 0) fulfill(reqKonsentrat, 'konsentrat');

    // 4. Lakukan Transaksi Database (Rekam Pakan + Update Semua Silo)
    const transactionOps: any[] = [];
    
    transactionOps.push(this.prisma.livestockFeedRecord.create({
      data: { cattleId, feedType, weightKg, bkPercent, asFedWeight }
    }));

    for (const d of deductions) {
        const newStock = d.oldStock - d.deductAmount;
        const newStatus = newStock <= (d.capacity * 0.2) ? 'KRITIS' : 'AMAN';
        
        transactionOps.push(this.prisma.silo.update({
            where: { id: d.id },
            data: { currentStock: newStock, status: newStatus }
        }));
        
        transactionOps.push(this.prisma.siloTransaction.create({
            data: {
                siloId: d.id,
                type: 'KELUAR',
                weightKg: d.deductAmount,
                description: `Pemberian pakan sapi ${cattleId}`,
                creator: author
            }
        }));
    }

    const results = await this.prisma.$transaction(transactionOps);
    const record = results[0];

    try {
      await this.redis.del('feed:schedules');
    } catch (err) {}

    await this.clearLivestockCache();
    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Mencatat pakan sapi ${cattleId}: ${feedType} ${weightKg}kg`);
    
    // Trigger auto-update schedule
    const cowModel = await this.prisma.livestock.findUnique({
      where: { cattleId },
      include: { section: true }
    });
    await this.autoUpdateScheduleStatus(feedType, cowModel?.section?.zoneId);

    return record;
  }

  // 2b. Catat Pemberian Pakan Bulk
  async recordFeedBulk(cattleIds: string[], feedType: string, weightKgPerCow: number, bkPercent: number = 100, author: string = 'Admin', siloForageId?: number, siloConcentrateId?: number) {
    if (!cattleIds || cattleIds.length === 0) throw new BadRequestException('Tidak ada sapi yang dipilih');
    
    const crypto = require('crypto');
    const batchId = crypto.randomUUID();
    
    let totalHijauan = 0;
    let totalKonsentrat = 0;
    
    // Asumsi frontend mengirim rata-rata per sapi (weightKgPerCow)
    const totalInputAsFed = weightKgPerCow * cattleIds.length;

    const typeStr = feedType.toLowerCase();
    let totalBkRequirement = 0;
    const cowNeedsList: any[] = [];
    
    // First pass: get all cattle BK requirements
    for (const cattleId of cattleIds) {
      const cow = await this.getFeedNeeds(cattleId);
      totalBkRequirement += cow.bkRequirement;
      cowNeedsList.push(cow);
    }
    
    const cowActualFeedList = cowNeedsList.map(cow => {
       // Distribusi proporsional berdasarkan kebutuhan nutrisi masing-masing sapi (BK Target)
       const proportion = totalBkRequirement > 0 ? (cow.bkRequirement / totalBkRequirement) : (1 / cattleIds.length);
       const cowAsFed = totalInputAsFed * proportion;
       
       let reqHijauan = 0;
       let reqKonsentrat = 0;
       
       if (typeStr.includes('konsentrat+hijauan') || typeStr === 'tmr') {
           const fRatio = cow.prefs?.forageRatio || 60;
           const cRatio = cow.prefs?.concentrateRatio || 40;
           reqHijauan = cowAsFed * (fRatio / 100);
           reqKonsentrat = cowAsFed * (cRatio / 100);
       } else if (typeStr.includes('konsentrat')) {
           reqKonsentrat = cowAsFed;
       } else {
           reqHijauan = cowAsFed;
       }
       
       totalHijauan += reqHijauan;
       totalKonsentrat += reqKonsentrat;
       
       const trueCowBkPct = (cowAsFed > 0 && cow.bkRequirement > 0) ? (cow.bkRequirement / cowAsFed) : (bkPercent / 100);
       
       return { 
           cattleId: cow.cattleId, 
           asFedWeight: parseFloat(cowAsFed.toFixed(2)), 
           trueBkPct: trueCowBkPct,
           bkConsumed: parseFloat((cowAsFed * trueCowBkPct).toFixed(2))
       };
    });

    const allSilos = await this.prisma.silo.findMany({ orderBy: { currentStock: 'desc' } });
    const deductions: { id: number, name: string, deductAmount: number, oldStock: number, capacity: number }[] = [];
    
    const fulfill = (amountNeeded: number, keyword: string, preferredSiloId?: number) => {
        let remaining = amountNeeded;
        let silosToUse = [...allSilos];
        if (preferredSiloId) {
            const preferred = silosToUse.find(s => s.id === parseInt(preferredSiloId as any));
            if (preferred) {
                silosToUse = [preferred, ...silosToUse.filter(s => s.id !== preferred.id)];
            }
        }

        for (const silo of silosToUse) {
            if (remaining <= 0) break;
            const sType = (silo.feedType || '').toLowerCase();
            const sName = (silo.name || '').toLowerCase();
            if (sType.includes(keyword) || sName.includes(keyword) || (keyword === 'hijauan' && (sType.includes('rumput') || sName.includes('rumput')))) {
                const available = silo.currentStock - (deductions.find(d => d.id === silo.id)?.deductAmount || 0);
                if (available > 0) {
                    const take = Math.min(remaining, available);
                    const existingDeduction = deductions.find(d => d.id === silo.id);
                    if (existingDeduction) {
                        existingDeduction.deductAmount += take;
                    } else {
                        deductions.push({ id: silo.id, name: silo.name, deductAmount: take, oldStock: silo.currentStock, capacity: silo.capacity });
                    }
                    remaining -= take;
                }
            }
        }
        if (remaining > 0.01) { 
            throw new BadRequestException(`Gagal! Stok ${keyword} tidak mencukupi (Kurang ${remaining.toFixed(2)} Kg di seluruh silo)`);
        }
    };

    if (totalHijauan > 0) fulfill(totalHijauan, 'hijauan', siloForageId);
    if (totalKonsentrat > 0) fulfill(totalKonsentrat, 'konsentrat', siloConcentrateId);

    const results = await this.prisma.$transaction(async (prisma) => {
      for (const d of deductions) {
        await prisma.siloTransaction.create({
          data: {
            siloId: d.id,
            type: 'KELUAR',
            weightKg: d.deductAmount,
            description: `Pemberian pakan kolektif untuk ${cattleIds.length} sapi (Sapi: ${cattleIds.join(', ')})`,
            creator: author
          }
        });
        await prisma.silo.update({
          where: { id: d.id },
          data: { currentStock: d.oldStock - d.deductAmount }
        });
      }

      const records: any[] = [];
      const feedDate = new Date();
      for (const cowActual of cowActualFeedList) {
        const record = await prisma.livestockFeedRecord.create({
          data: {
            cattleId: cowActual.cattleId,
            feedType,
            weightKg: cowActual.asFedWeight,
            bkPercent: cowActual.trueBkPct * 100,
            asFedWeight: cowActual.asFedWeight,
            feedDate: feedDate,
            batchId: batchId
          }
        });
        records.push(record);
      }
      return records;
    });

    try {
      await this.redis.del('feed:schedules');
    } catch (err) {}

    await this.clearLivestockCache();
    await this.activityService.log(author, 'TAMBAH', 'TERNAK', `Mencatat pakan BARENGAN untuk ${cattleIds.length} sapi: ${feedType} (${weightKgPerCow}kg/sapi)`);
    
    // Trigger auto-update schedule (zoneId tidak disertakan karena massal)
    await this.autoUpdateScheduleStatus(feedType);

    return { success: true, count: results.length };
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
      cattleId,
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

  // 4. Data untuk Grafik & Tabel: DMI/BK vs ADG (Multi-Select)
  async getPerformanceChartData(period: string = 'minggu', cowIdsParam?: string) {
    let days = 7;
    if (period === 'hari') days = 1;
    else if (period === 'bulan') days = 30;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);

    if (!cowIdsParam || cowIdsParam.trim() === '' || cowIdsParam === 'ALL') {
      return {
        data: [],
        isDummy: false,
        summary: null,
        multiSummaries: [],
        selectedCows: []
      };
    }

    const isAllCows = false;
    const cowIds = cowIdsParam.split(',').map(id => id.trim()).filter(id => id).slice(0, 10);

    let feeds: any[] = [];
    let weightRecords: any[] = [];
    let initialWeights: Record<string, number> = {};
    let cowsCount = 1;

    try {
      const feedWhere: any = { feedDate: { gte: startDate } };
      const weightWhere: any = { weighDate: { gte: startDate } };
      
      if (!isAllCows && cowIds.length > 0) {
         feedWhere.cattleId = { in: cowIds };
         weightWhere.cattleId = { in: cowIds };
         
         const cows = await this.prisma.livestock.findMany({ where: { cattleId: { in: cowIds } }});
         cows.forEach(c => initialWeights[c.cattleId] = c.initialWeight || 0);
      } else {
         const allCows = await this.prisma.livestock.findMany({ select: { initialWeight: true }});
         cowsCount = allCows.length > 0 ? allCows.length : 1;
         const avgInitial = allCows.reduce((acc, c) => acc + (c.initialWeight || 0), 0) / cowsCount;
         initialWeights['ALL'] = avgInitial;
      }
      
      feeds = await this.prisma.livestockFeedRecord.findMany({
        where: feedWhere,
        orderBy: { feedDate: 'asc' }
      });
      
      weightRecords = await this.prisma.livestockWeightRecord.findMany({
        where: weightWhere,
        orderBy: { weighDate: 'asc' }
      });

    } catch (err) {
      console.warn('Error fetching chart data from database:', err.message);
    }

    // OPTIMISASI: Pra-hitung string tanggal untuk menghindari pembuatan objek Date berulang dalam loop bersarang
    const precomputedFeeds = feeds.map(f => ({
      ...f,
      dateStr: new Date(f.feedDate).toISOString().split('T')[0]
    }));

    const precomputedWeights = weightRecords.map(w => ({
      ...w,
      dateStr: new Date(w.weighDate).toISOString().split('T')[0]
    }));

    const chartData: any[] = [];
    const targetIds = isAllCows ? ['ALL'] : cowIds;
    
    // Siapkan objek ringkasan per sapi
    const summaries: Record<string, any> = {};
    targetIds.forEach(id => {
      summaries[id] = { totalDmi: 0, startWeight: initialWeights[id] || 0, endWeight: initialWeights[id] || 0, totalWeightGain: 0, cowId: id };
    });

    if (!isAllCows) {
       targetIds.forEach(id => {
         const cowWeights = weightRecords.filter(w => w.cattleId === id);
         const firstWeight = cowWeights.length > 1 ? cowWeights[0].weight : (initialWeights[id] || 0);
         const lastWeight = cowWeights.length > 0 ? cowWeights[cowWeights.length - 1].weight : (initialWeights[id] || 0);
         summaries[id].startWeight = firstWeight;
         summaries[id].endWeight = lastWeight;
         summaries[id].totalWeightGain = lastWeight - firstWeight;
       });
    }

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      const dailyData: any = { date: dateStr };

      targetIds.forEach(id => {
        let dailyBk = 0;
        let dailyAdg = 0;

        const dailyFeeds = precomputedFeeds.filter(f => 
          f.dateStr === dateStr && (isAllCows || f.cattleId === id)
        );

        dailyBk = dailyFeeds.reduce((acc, f) => acc + (f.weightKg * ((f.bkPercent || 100) / 100)), 0);
        
        if (isAllCows) {
            dailyBk = dailyBk / cowsCount;
        }
        
        if (dailyBk > 0) {
            dailyAdg = dailyBk * 0.15; // Estimasi harian
        }
        
        summaries[id].totalDmi += dailyBk;

        if (isAllCows) {
          dailyData.bk = parseFloat(dailyBk.toFixed(2));
          dailyData.adg = parseFloat(dailyAdg.toFixed(2));
        } else {
          dailyData[`${id}_bk`] = parseFloat(dailyBk.toFixed(2));
          dailyData[`${id}_adg`] = parseFloat(dailyAdg.toFixed(2));
        }
      });

      chartData.push(dailyData);
    }
    
    // Fetch latest weight and update timestamps per cow
    const latestWeightMap: Record<string, Date> = {};
    const latestUpdateMap: Record<string, Date> = {};

    if (!isAllCows && targetIds.length > 0) {
       try {
         const allLatestWeights = await this.prisma.livestockWeightRecord.findMany({
           where: { cattleId: { in: targetIds } },
           orderBy: { weighDate: 'desc' }
         });
         
         const allLatestFeeds = await this.prisma.livestockFeedRecord.findMany({
           where: { cattleId: { in: targetIds } },
           orderBy: { feedDate: 'desc' }
         });

         const livestockInfos = await this.prisma.livestock.findMany({
           where: { cattleId: { in: targetIds } },
           select: { cattleId: true, updatedAt: true }
         });

         targetIds.forEach(id => {
           const lw = allLatestWeights.find(w => w.cattleId === id);
           if (lw) latestWeightMap[id] = lw.weighDate;

           const lf = allLatestFeeds.find(f => f.cattleId === id);
           const ls = livestockInfos.find(s => s.cattleId === id);

           const times = [
             lw ? new Date(lw.weighDate).getTime() : 0,
             lf ? new Date(lf.feedDate).getTime() : 0,
             ls ? new Date(ls.updatedAt).getTime() : 0
           ];
           const maxTime = Math.max(...times);
           if (maxTime > 0) {
             latestUpdateMap[id] = new Date(maxTime);
           }
         });
       } catch (e) {
         console.warn("Error fetching last weigh/update dates:", e);
       }
    }

    // Finalize summaries
    const finalSummaries = targetIds.map(id => {
      const sum = summaries[id];
      let adgTotal = days > 0 ? sum.totalWeightGain / days : 0;
      let isEstimated = false;
      
      const cowWeights = weightRecords.filter(w => w.cattleId === id);
      if (isAllCows || cowWeights.length === 0) {
          adgTotal = days > 0 ? (sum.totalDmi * 0.15 / days) : 0; 
          sum.endWeight = sum.startWeight + (adgTotal * days);
          sum.totalWeightGain = sum.endWeight - sum.startWeight;
          isEstimated = true;
      }

      let fcr = 0;
      if (sum.totalWeightGain > 0) {
          fcr = sum.totalDmi / sum.totalWeightGain;
      }

      const estimatedWeightVal = sum.startWeight + (sum.totalDmi * 0.15);

      const lastWeighDate = latestWeightMap[id] ? latestWeightMap[id].toISOString() : null;
      const lastUpdatedDate = latestUpdateMap[id] ? latestUpdateMap[id].toISOString() : (new Date()).toISOString();

      return {
         cowId: id,
         totalBk: parseFloat(sum.totalDmi.toFixed(2)),
         startWeight: parseFloat(sum.startWeight.toFixed(2)),
         endWeight: parseFloat(sum.endWeight.toFixed(2)),
         estimatedWeight: parseFloat(estimatedWeightVal.toFixed(2)),
         adg: parseFloat(adgTotal.toFixed(2)),
         fcr: parseFloat(fcr.toFixed(2)),
         isEstimated,
         lastWeighDate,
         lastUpdatedDate
      };
    });

    return {
      data: chartData,
      isDummy: false,
      summary: isAllCows ? finalSummaries[0] : null,
      multiSummaries: finalSummaries,
      selectedCows: targetIds
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
          batchId: f.batchId,
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
          batchId: w.batchId,
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
          batchId: w.batchId,
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
          batchId: zw.batchId,
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

    await this.clearLivestockCache();
    await this.activityService.log(author, 'EDIT', 'TERNAK', `Mengubah pakan sapi ${updated.cattleId}: ${old.weightKg}kg -> ${updated.weightKg}kg`);
    return updated;
  }

  async deleteFeedRecord(id: number, author: string = 'Admin') {
    const old = await this.prisma.livestockFeedRecord.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Data pakan tidak ditemukan');

    const deleted = await this.prisma.livestockFeedRecord.delete({ where: { id } });
    try {
      await this.redis.del('feed:schedules');
    } catch (err) {}
    await this.clearLivestockCache();
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

    await this.clearLivestockCache();
    await this.activityService.log(author, 'EDIT', 'TERNAK', `Mengubah timbangan sapi ${updated.cattleId}: ${old.weight}kg -> ${updated.weight}kg`);
    return updated;
  }

  async deleteWeightRecord(id: number, author: string = 'Admin') {
    const old = await this.prisma.livestockWeightRecord.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Data timbangan tidak ditemukan');

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

    await this.clearLivestockCache();
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
    const old = await this.prisma.livestockWaste.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Data limbah tidak ditemukan');

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
    const old = await this.prisma.zoneWaste.findUnique({ where: { id }, include: { zone: true } });
    if (!old) throw new NotFoundException('Data limbah kandang tidak ditemukan');

    const deleted = await this.prisma.zoneWaste.delete({ where: { id }, include: { zone: true } });
    await this.activityService.log(author, 'HAPUS', 'TERNAK', `Menghapus limbah kandang ${deleted.zone?.name || deleted.zoneId}`);
    return { success: true };
  }
}