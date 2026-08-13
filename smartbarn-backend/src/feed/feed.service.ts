// src/feed/feed.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class FeedService {
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
  // BAGIAN 1: MANAJEMEN SILO (STOK PAKAN)
  // Direct Database (Tanpa Cache untuk hindari Race Condition)
  // ==========================================
  
  async getAllSilos() {
    try {
      const silos = await this.prisma.silo.findMany({
        orderBy: { id: 'asc' },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const siloTransactionsToday = await this.prisma.siloTransaction.groupBy({
        by: ['siloId'],
        where: {
          createdAt: { gte: todayStart },
          type: 'KELUAR'
        },
        _sum: {
          weightKg: true
        }
      });

      return silos.map(silo => {
        const match = siloTransactionsToday.find(t => t.siloId === silo.id);
        const estimasiKeluarHariIni = match?._sum?.weightKg || 0;

        return {
          ...silo,
          estimasiKeluarHariIni
        };
      });
    } catch (err) {
      console.warn('Database Connection Down in getAllSilos. Returning basic silos.', err);
      return [];
    }
  }

  // 1. Tambah Silo Baru
  async createSilo(data: any, author: string = 'Admin') {
    const silo = await this.prisma.silo.create({
      data: {
        name: data.name,
        feedType: data.feedType || 'Umum',
        capacity: parseFloat(data.capacity || 100),
        currentStock: parseFloat(data.currentStock || 0),
        unit: data.unit || 'Kg',
        status: 'AMAN',
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null
      }
    });

    await this.activityService.log(author, 'TAMBAH', 'SILO', `Menambahkan silo baru: ${silo.name}`);
    return silo;
  }

  // 2. Perbarui Data Silo (Nama, Kapasitas, Stok)
  async updateSilo(id: number, data: any, author: string = 'Admin') {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.feedType) updateData.feedType = data.feedType;
    if (data.capacity) updateData.capacity = parseFloat(data.capacity);
    if (data.currentStock !== undefined) updateData.currentStock = parseFloat(data.currentStock);
    if (data.unit) updateData.unit = data.unit;
    if (data.expiryDate !== undefined) {
      updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    }

    // Hitung ulang status jika stok atau kapasitas berubah
    if (updateData.currentStock !== undefined || updateData.capacity !== undefined) {
      const silo = await this.prisma.silo.findUnique({ where: { id } });
      if (!silo) throw new BadRequestException('Silo tidak ditemukan');
      const cap = updateData.capacity || silo.capacity;
      const stock = updateData.currentStock !== undefined ? updateData.currentStock : silo.currentStock;
      updateData.status = stock <= (cap * 0.2) ? 'KRITIS' : 'AMAN';
    }

    const updated = await this.prisma.silo.update({
      where: { id },
      data: updateData
    });
    await this.activityService.log(author, 'EDIT', 'SILO', `Memperbarui data silo: ${updated.name}`);
    return updated;
  }

  // 3. Hapus Silo
  async removeSilo(id: number, author: string = 'Admin') {
    const silo = await this.prisma.silo.findUnique({ where: { id: parseInt(id as any) } });
    const deleted = await this.prisma.silo.delete({ where: { id: parseInt(id as any) } });
    await this.activityService.log(author, 'HAPUS', 'SILO', `Menghapus silo: ${silo?.name || id}`);
    return deleted;
  }

  // Mengubah stok dengan Validasi (Mencegah Minus & Optimasi Query)
  async updateStock(id: number, amount: number, type: 'ADD' | 'SUBTRACT', author: string = 'Admin') {
    // 1. Ambil data silo saat ini
    const silo = await this.prisma.silo.findUnique({ where: { id } });
    if (!silo) throw new BadRequestException('Silo tidak ditemukan');

    // 2. Hitung stok baru
    let newStock = type === 'ADD' ? silo.currentStock + amount : silo.currentStock - amount;
    
    // Cegah stok menjadi minus (negatif)
    if (newStock < 0) {
      throw new BadRequestException('Pengurangan gagal, stok tidak mencukupi!');
    }

    // 3. Tentukan status baru (KRITIS jika stok <= 20% dari kapasitas)
    const newStatus = newStock <= (silo.capacity * 0.2) ? 'KRITIS' : 'AMAN';

    // 4. Lakukan 1 kali Update ke Database (Lebih efisien)
    const updated = await this.prisma.silo.update({
      where: { id },
      data: { 
        currentStock: newStock,
        status: newStatus 
      },
    });
    const aksi = type === 'ADD' ? 'Menambah' : 'Mengurangi';
    await this.activityService.log(author, 'EDIT', 'SILO', `${aksi} stok silo ${updated.name} sebanyak ${amount} ${updated.unit}`);
    return updated;
  }

  // ==========================================
  // BAGIAN 2: MANAJEMEN JADWAL PAKAN
  // Menggunakan Cache-Aside
  // ==========================================

  async getSchedules() {
    const cacheKey = 'feed:schedules';

    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (err) {}

    let schedules: any[] = [];
    try {
      // 2. Ambil dari PostgreSQL jika cache kosong
      const rawSchedules = await this.prisma.feedingSchedule.findMany({
        include: {
          zone: {
            select: { name: true }
          }
        },
        orderBy: { time: 'asc' },
      });

      const getWibDateString = (dObj: Date) => {
          const u = dObj.getTime() + (dObj.getTimezoneOffset() * 60000);
          const w = new Date(u + (3600000 * 7));
          return `${w.getFullYear()}-${w.getMonth() + 1}-${w.getDate()}`;
      };

      const todayStr = getWibDateString(new Date());

      schedules = rawSchedules.map(schedule => {
        // @ts-ignore
        const isUpdatedToday = schedule.updatedAt && getWibDateString(new Date(schedule.updatedAt)) === todayStr;
        
        let status: string = isUpdatedToday ? schedule.status : 'BELUM';
        // @ts-ignore
        let isLate = schedule.isLate || false;

        // Evaluasi TELAT hanya saat status masih BELUM
        if (status === 'BELUM' && schedule.time) {
          const now = new Date();
          // Konversi ke Waktu Indonesia Barat (WIB) / GMT+7
          const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
          const wibDate = new Date(utcTime + (3600000 * 7));
          const currentHour = wibDate.getHours();
          const currentMinute = wibDate.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          
          const timeParts = schedule.time.split('-');
          const endTimeStr = timeParts.length > 1 ? timeParts[1].trim() : timeParts[0].trim();
          const [endHour, endMinute] = endTimeStr.split(':').map(Number);
          
          if (!isNaN(endHour) && !isNaN(endMinute)) {
             const endTimeInMinutes = endHour * 60 + endMinute;
             if (currentTimeInMinutes > endTimeInMinutes) {
                 status = 'TELAT'; // Akan dirender frontend menjadi tulisan "TELAT"
             }
          }
        }
        
        // Jika sudah manual selesai (SUDAH) tapi telat
        if (status === 'SUDAH' && isLate) {
            status = 'SUDAH_TELAT';
        }
        
        return {
          ...schedule,
          status: status
        };
      });

      // 3. Simpan ke Cache selama 1 jam (3600 detik)
      try {
        await this.redis.set(cacheKey, JSON.stringify(schedules), 'EX', 3600);
      } catch (err) {}
    } catch (err) {
      console.warn('Database Connection Down in getSchedules. Returning empty list.');
      schedules = [];
    }

    return schedules;
  }

  async createSchedule(data: any, author: string = 'Admin') {
    const rawZoneId = data.zoneId !== undefined && data.zoneId !== null ? data.zoneId : (data.location || data.targetSectionId || data.sectionId || 1);
    const zoneId = parseInt(rawZoneId);
    
    if (isNaN(zoneId)) {
      throw new BadRequestException('ID Kandang tidak valid atau belum dipilih');
    }

    const newSchedule = await this.prisma.feedingSchedule.create({
      data: {
        time: data.time,
        zoneId: zoneId,
        feedType: data.feedType,
        status: data.status || 'BELUM',
      },
      include: {
        zone: {
          select: { name: true }
        }
      }
    });
    
    try {
      await this.redis.del('feed:schedules'); 
    } catch (err) {}
    await this.activityService.log(author, 'TAMBAH', 'SILO', `Menambah jadwal pakan baru jam ${newSchedule.time}`);
    return newSchedule;
  }

  async updateSchedule(id: number, data: any, author: string = 'Admin') {
    const updateData: any = { ...data };
    
    // Jika ada perubahan lokasi/kandang, validasi dulu
    if (data.zoneId || data.location) {
      const zoneId = parseInt(data.zoneId || data.location);
      if (isNaN(zoneId)) {
        throw new BadRequestException('ID Kandang tidak valid');
      }
      updateData.zoneId = zoneId;
      delete updateData.location; // Hapus field lama jika ada
    }
    
    // Logika perhitungan telat saat di-toggle manual ke SUDAH
    if (data.status === 'SUDAH') {
       const schedule = await this.prisma.feedingSchedule.findUnique({ where: { id: parseInt(id as any) } });
       if (schedule && schedule.time) {
          const now = new Date();
          // Konversi ke Waktu Indonesia Barat (WIB) / GMT+7
          const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
          const wibDate = new Date(utcTime + (3600000 * 7));
          const currentHour = wibDate.getHours();
          const currentMinute = wibDate.getMinutes();
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          
          const timeParts = schedule.time.split('-');
          const endTimeStr = timeParts.length > 1 ? timeParts[1].trim() : timeParts[0].trim();
          const [endHour, endMinute] = endTimeStr.split(':').map(Number);
          
          if (!isNaN(endHour) && !isNaN(endMinute)) {
             const endTimeInMinutes = endHour * 60 + endMinute;
             updateData.isLate = currentTimeInMinutes > endTimeInMinutes;
          }
       }
    } else if (data.status === 'BELUM') {
       updateData.isLate = false;
    }

    const updated = await this.prisma.feedingSchedule.update({
      where: { id: parseInt(id as any) },
      data: updateData,
      include: {
        zone: {
          select: { name: true }
        }
      }
    });
    
    try {
      await this.redis.del('feed:schedules'); // Invalidasi cache
    } catch (err) {}
    await this.activityService.log(author, 'EDIT', 'SILO', `Memperbarui jadwal pakan jam ${updated.time}`);
    return updated;
  }

  async removeSchedule(id: number, author: string = 'Admin') {
    const schedule = await this.prisma.feedingSchedule.findUnique({ where: { id } });
    await this.prisma.feedingSchedule.delete({ where: { id } });
    try {
      await this.redis.del('feed:schedules'); // Invalidasi cache
    } catch (err) {}
    if (schedule) {
      await this.activityService.log(author, 'HAPUS', 'SILO', `Menghapus jadwal pakan jam ${schedule.time}`);
    }
    return { message: 'Jadwal dihapus' };
  }

  // ==========================================
  // BAGIAN 3: TRANSAKSI SILO (MASUK/KELUAR) & LAPORAN
  // ==========================================

  async createTransaction(siloId: number, data: any, author: string = 'Admin') {
    const silo = await this.prisma.silo.findUnique({ where: { id: siloId } });
    if (!silo) throw new BadRequestException('Silo tidak ditemukan');

    let type = String(data.type || 'MASUK').toUpperCase();
    if (type === 'IN' || type === 'ADD' || type === 'RESTOCK') type = 'MASUK';
    if (type === 'OUT' || type === 'SUBTRACT') type = 'KELUAR';

    const rawWeight = data.weightKg !== undefined && data.weightKg !== null ? data.weightKg : data.amount;
    const weightKg = parseFloat(rawWeight);
    const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    const description = data.description || data.notes || undefined;

    if (isNaN(weightKg) || weightKg <= 0) {
      throw new BadRequestException('Jumlah pakan tidak valid');
    }

    let newStock = silo.currentStock;
    if (type === 'MASUK') {
      newStock += weightKg;
    } else if (type === 'KELUAR') {
      newStock -= weightKg;
    } else {
      throw new BadRequestException('Tipe transaksi harus MASUK atau KELUAR');
    }

    if (newStock < 0) {
      throw new BadRequestException('Pengurangan gagal, stok tidak mencukupi!');
    }

    const newStatus = newStock <= (silo.capacity * 0.2) ? 'KRITIS' : 'AMAN';

    // Simpan dalam satu transaction
    const updatedSilo = await this.prisma.$transaction(async (tx) => {
      const s = await tx.silo.update({
        where: { id: siloId },
        data: {
          currentStock: newStock,
          status: newStatus,
          expiryDate: type === 'MASUK' && expiryDate ? expiryDate : undefined
        }
      });

      await tx.siloTransaction.create({
        data: {
          siloId,
          type,
          weightKg,
          description,
          expiryDate,
          creator: author
        }
      });

      return s;
    });

    const actionText = type === 'MASUK' ? 'Pakan Masuk' : 'Pakan Keluar';
    await this.activityService.log(author, 'TAMBAH', 'SILO', `Transaksi ${actionText} untuk silo ${silo.name}: ${weightKg} ${silo.unit}`);

    return updatedSilo;
  }

  async getSiloTransactions(siloId: number) {
    return await this.prisma.siloTransaction.findMany({
      where: { siloId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getFeedReport() {
    try {
      const transactions = await this.prisma.siloTransaction.findMany({
        include: {
          silo: {
            select: { name: true, feedType: true, unit: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const totalCows = await this.prisma.livestock.count();
      
      const breedSummary = await this.prisma.livestock.groupBy({
        by: ['breed'],
        _count: {
          id: true
        }
      });

      const formattedBreeds = breedSummary.map(item => ({
        breed: item.breed || 'Lokal / Lainnya',
        count: item._count.id
      }));

      return {
        transactions,
        cows: {
          total: totalCows,
          breeds: formattedBreeds
        }
      };
    } catch (err) {
      console.error('Error getting feed report:', err);
      return {
        transactions: [],
        cows: { total: 0, breeds: [] }
      };
    }
  }
}// trigger restart 
