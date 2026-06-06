// src/health/health.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class HealthService {
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

  // ==========================================
  // 1. STATISTIK KESEHATAN (CACHE-ASIDE)
  // ==========================================
  async getHealthSummary() {
    const cacheKey = 'health:summary';

    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (err) {}

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dalamPerawatan, sembuhBulanIni] = await Promise.all([
      this.prisma.health.count({
        where: { status: 'DALAM_PERAWATAN' },
      }),
      this.prisma.health.count({
        where: {
          status: 'SEMBUH',
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    const result = { dalamPerawatan, sembuhBulanIni };
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 600);
    } catch (err) {}

    return result;
  }

  private async clearHealthAndLivestockCache() {
    try {
      await this.redis.del('health:summary');
      await this.redis.del('health:list:all');
      await this.redis.del('dashboard:farm-summary');
      await this.redis.del('livestock:list:all');
      const keys = await this.redis.keys('livestock:list:section:*');
      const statsKeys = await this.redis.keys('livestock:stats:section:*');
      if (keys.length) await this.redis.del(...keys);
      if (statsKeys.length) await this.redis.del(...statsKeys);
      await this.redis.del('users:staff-list');
    } catch (err) {}
  }

  // ==========================================
  // 2. RIWAYAT PEMERIKSAAN (CACHE-ASIDE)
  // ==========================================
  async findAllRecords() {
    const cacheKey = 'health:list:all';
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {}
    try {
      const data = await this.prisma.health.findMany({
        orderBy: { createdAt: 'desc' }, 
        include: {
          livestock: { 
            include: {
              section: { include: { zone: true } }
            }
          }
        }
      });
      try {
        await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 3600); // 1 Hour TTL
      } catch (err) {}
      return data;
    } catch (err) {
      console.warn('Database Connection Down in findAllRecords. Returning empty list.');
      return [];
    }
  }

  // ==========================================
  // 3. TAMBAH REKAM MEDIS & SINKRONISASI (TRANSACTION)
  // ==========================================
  // ==========================================
  // 3. TAMBAH REKAM MEDIS & SINKRONISASI (TRANSACTION)
  // ==========================================
  async createRecord(data: any, author: string = 'Admin') {
    const diagnosa = (data.diagnosis || data.diagnosa || '').toString();
    const penanganan = data.treatment || data.penanganan;
    const pemeriksa = data.vet || data.pemeriksa;
    
    // Status untuk tabel Health
    let healthStatus: any = data.status; // DALAM_PERAWATAN, SEMBUH, KRITIS, MATI
    if (data.status === 'Sembuh') healthStatus = 'SEMBUH';
    if (data.status === 'Dalam Perawatan') healthStatus = 'DALAM_PERAWATAN';
    if (data.status === 'Kritis') healthStatus = 'KRITIS';
    if (data.status === 'Mati') healthStatus = 'MATI';

    // Status untuk tabel Livestock
    let livestockStatus: any = 'DALAM_PERAWATAN';
    if (healthStatus === 'SEMBUH') livestockStatus = 'SEHAT';
    if (healthStatus === 'KRITIS') livestockStatus = 'KRITIS';
    if (healthStatus === 'MATI') livestockStatus = 'MATI';

    const [newRecord] = await this.prisma.$transaction([
      this.prisma.health.create({
        data: {
          cattleId: data.cattleId,
          diagnosa: diagnosa || '-',
          penanganan: penanganan || '-',
          pemeriksa: pemeriksa || '-',
          status: healthStatus, 
        },
      }),
      this.prisma.livestock.update({
        where: { cattleId: data.cattleId },
        data: { 
          status: livestockStatus,
        },
      })
    ]);

    await this.activityService.log(author, 'TAMBAH', 'MEDIS', `Menambah rekam medis untuk sapi: ${data.cattleId}`);

    await this.clearHealthAndLivestockCache();

    return newRecord;
  }

  // ==========================================
  // 4. UPDATE REKAM MEDIS & SINKRONISASI
  // ==========================================
  async updateRecord(id: number, data: any, author: string = 'Admin') {
    const diagnosa = (data.diagnosis || data.diagnosa || '').toString();
    
    // Siapkan data update untuk Health
    const healthUpdate: any = {
      diagnosa: diagnosa,
      penanganan: data.treatment || data.penanganan,
      pemeriksa: data.vet || data.pemeriksa,
    };

    // Normalize Status
    let healthStatus: any = data.status;
    if (data.status === 'Sembuh') healthStatus = 'SEMBUH';
    if (data.status === 'Dalam Perawatan') healthStatus = 'DALAM_PERAWATAN';
    if (data.status === 'Kritis') healthStatus = 'KRITIS';
    if (data.status === 'Mati') healthStatus = 'MATI';
    
    if (healthStatus) healthUpdate.status = healthStatus;

    // Tentukan status ternak
    let livestockStatus: any = 'DALAM_PERAWATAN';
    if (healthStatus === 'SEMBUH') livestockStatus = 'SEHAT';
    if (healthStatus === 'KRITIS') livestockStatus = 'KRITIS';
    if (healthStatus === 'MATI') livestockStatus = 'MATI';

    // Jalankan transaksi
    const [updatedRecord] = await this.prisma.$transaction([
      this.prisma.health.update({
        where: { id: Number(id) },
        data: healthUpdate, // Tidak menyertakan cattleId di sini karena error Prisma
      }),
      this.prisma.livestock.update({
        where: { cattleId: data.cattleId },
        data: { 
          status: livestockStatus,
        },
      })
    ]);

    await this.activityService.log(author, 'EDIT', 'MEDIS', `Memperbarui rekam medis sapi: ${data.cattleId}`);

    await this.clearHealthAndLivestockCache();
    return updatedRecord;
  }

  async removeRecord(id: number, author: string = 'Admin') {
    const record = await this.prisma.health.findUnique({ where: { id: Number(id) } });
    await this.prisma.health.delete({ where: { id: Number(id) } });
    await this.activityService.log(author, 'HAPUS', 'MEDIS', `Menghapus rekam medis sapi: ${record?.cattleId || id}`);
    await this.clearHealthAndLivestockCache();
    return { message: 'Rekam medis dihapus' };
  }

  // ==========================================
  // BULK VACCINATION & MASS HEALTH RECORD
  // ==========================================
  async createBulkRecords(data: any, author: string = 'Admin') {
    const diagnosa = (data.diagnosis || data.diagnosa || '').toString();
    const penanganan = data.treatment || data.penanganan;
    const pemeriksa = data.vet || data.pemeriksa;
    
    // Status untuk tabel Health
    let healthStatus: any = data.status || 'SEMBUH'; // default sembuh untuk vaksin
    if (data.status === 'Sembuh') healthStatus = 'SEMBUH';
    if (data.status === 'Dalam Perawatan') healthStatus = 'DALAM_PERAWATAN';
    if (data.status === 'Kritis') healthStatus = 'KRITIS';
    if (data.status === 'Mati') healthStatus = 'MATI';

    // Status untuk tabel Livestock
    let livestockStatus: any = 'SEHAT'; // default sehat untuk vaksin
    if (healthStatus === 'SEMBUH') livestockStatus = 'SEHAT';
    if (healthStatus === 'KRITIS') livestockStatus = 'KRITIS';
    if (healthStatus === 'DALAM_PERAWATAN') livestockStatus = 'DALAM_PERAWATAN';
    if (healthStatus === 'MATI') livestockStatus = 'MATI';

    // Ambil daftar cattleId yang akan divaksin
    let targetCattleIds: string[] = [];
    if (data.cattleIds && data.cattleIds.length > 0) {
      targetCattleIds = data.cattleIds;
    } else {
      // Jika tidak diisi / kosong, berarti SEMUA sapi!
      const allCows = await this.prisma.livestock.findMany({
        select: { cattleId: true }
      });
      targetCattleIds = allCows.map(c => c.cattleId);
    }

    if (targetCattleIds.length === 0) {
      return { success: false, count: 0, message: 'Tidak ada sapi yang dipilih atau tersedia.' };
    }

    // Lakukan batch inserts & updates di prisma transaction
    const createdRecords = await this.prisma.$transaction(async (tx) => {
      // 1. Buat records di tabel Health
      const recordsToCreate = targetCattleIds.map(cid => ({
        cattleId: cid,
        diagnosa: diagnosa || 'Vaksinasi',
        penanganan: penanganan || '-',
        pemeriksa: pemeriksa || '-',
        status: healthStatus,
      }));

      await tx.health.createMany({
        data: recordsToCreate,
      });

      // 2. Update status sapi-sapi tersebut di Livestock
      await tx.livestock.updateMany({
        where: { cattleId: { in: targetCattleIds } },
        data: { status: livestockStatus },
      });

      // Kembalikan records yang baru dibuat
      return tx.health.findMany({
        where: {
          cattleId: { in: targetCattleIds },
          diagnosa: diagnosa || 'Vaksinasi',
          createdAt: { gte: new Date(Date.now() - 5000) } // Yang dibuat dalam 5 detik terakhir
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    await this.activityService.log(author, 'TAMBAH', 'MEDIS', `Mencatat vaksinasi massal untuk ${targetCattleIds.length} sapi`);

    await this.clearHealthAndLivestockCache();

    return { success: true, count: targetCattleIds.length, records: createdRecords };
  }
}