// src/users/users.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt'; // Tambahan untuk Keamanan

@Injectable()
export class UsersService {
  private redis: Redis;

  constructor(private prisma: PrismaService) {
    this.redis = new Redis({ 
      host: process.env.REDIS_HOST || 'localhost', 
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1 
    });
    this.redis.on('error', () => {});
  }

  // ==========================================
  // BAGIAN 1: MANAJEMEN STAF & PROFIL
  // ==========================================
  async getAllStaff() {
    const cacheKey = 'users:staff-list';

    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) return JSON.parse(cachedData);
    } catch (err) {}

    const staff = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        task: true,
        createdAt: true,
        photo: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    try {
      await this.redis.set(cacheKey, JSON.stringify(staff), 'EX', 3600);
    } catch (err) {}
    return staff;
  }

  private async generateUserId(role: string) {
    const prefix = role === 'SUPER_ADMIN' ? 'ADM' : role === 'VETERINER' ? 'VET' : 'STF';
    
    // Cari user terakhir dengan prefix tersebut untuk menentukan nomor urut
    const lastUser = await this.prisma.user.findFirst({
      where: { id: { startsWith: prefix } },
      orderBy: { id: 'desc' }
    });
    
    let nextNum = 1;
    if (lastUser && lastUser.id.includes('_')) {
      const parts = lastUser.id.split('_');
      const lastNum = parseInt(parts[1]);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    
    return `${prefix}_${nextNum.toString().padStart(3, '0')}`;
  }

  async createStaff(data: any) {
    const passwordToHash = data.password || 'SmartBarn123!';
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);
    const customId = await this.generateUserId(data.role);

    const newStaff = await this.prisma.user.create({
      data: {
        id: customId,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        task: data.task,
        phone: data.phone,
        status: 'AKTIF'
      },
    });
    
    try {
      await this.redis.del('users:staff-list');
    } catch (err) {}
    return newStaff;
  }

  async getUserProfile(id: string) {
    const cacheKey = `users:profile:${id}`;
    
    try {
      const cachedProfile = await this.redis.get(cacheKey);
      if (cachedProfile) return JSON.parse(cachedProfile);
    } catch (err) {}

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, photo: true },
    });

    if (user) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
      } catch (err) {}
    }
    return user;
  }

  async deleteStaff(id: string) {
    const deletedUser = await this.prisma.user.delete({
      where: { id },
    });
    
    try {
      await this.redis.del('users:staff-list');
    } catch (err) {}
    
    return deletedUser;
  }

  // ==========================================
  // BAGIAN 2: PERMINTAAN MASUK / PENGAJUAN AKUN
  // ==========================================
  async getPendingRequests() {
    return this.prisma.userRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequest(data: any) {
    return this.prisma.userRequest.create({
      data: {
        requester: data.requester,
        calonName: data.calonName,
        calonEmail: data.calonEmail,
        posisi: data.posisi,
        alasan: data.alasan,
      },
    });
  }

  async processRequest(id: number, action: 'TERIMA' | 'TOLAK') {
    const request = await this.prisma.userRequest.findUnique({ where: { id } });
    if (!request) throw new BadRequestException('Permintaan tidak ditemukan');

    if (action === 'TOLAK') {
      return this.prisma.userRequest.update({
        where: { id },
        data: { status: 'REJECTED' },
      });
    }

    // Jika 'TERIMA', buat password sementara & enkripsi
    const defaultPassword = 'SmartBarn123!';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const customId = await this.generateUserId(request.posisi as any);

    // STABILITAS: Gunakan Prisma Transaction agar aksi ini berjalan atomik
    const [newUser, updatedRequest] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          id: customId,
          name: request.calonName,
          email: request.calonEmail,
          password: hashedPassword, 
          role: request.posisi as any, 
          status: 'AKTIF',
        },
      }),
      this.prisma.userRequest.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      })
    ]);

    // Reset cache karena ada penambahan tim baru
    try {
      await this.redis.del('users:staff-list');
    } catch (err) {}

    return newUser;
  }

  // ==========================================
  // BAGIAN 3: KONFIRMASI PENDAFTARAN MANDIRI
  // ==========================================
  async getPendingUsers() {
    return this.prisma.user.findMany({
      where: { status: 'MENUNGGU_KONFIRMASI' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async approveUser(id: string) {
    const pendingUser = await this.prisma.user.findUnique({ where: { id } });
    if (!pendingUser) throw new BadRequestException('User tidak ditemukan');
    
    const newId = await this.generateUserId(pendingUser.role);
    const { id: oldId, ...userData } = pendingUser;

    await this.prisma.$transaction([
        this.prisma.user.delete({ where: { id: oldId } }),
        this.prisma.user.create({
            data: {
                ...userData,
                id: newId,
                status: 'AKTIF'
            }
        })
    ]);

    try {
      await this.redis.del('users:staff-list');
    } catch (err) {}
    return { message: `User disetujui dengan ID baru: ${newId}` };
  }

  async rejectUser(id: string) {
    await this.prisma.user.delete({
      where: { id }
    });
    try {
      await this.redis.del('users:staff-list');
    } catch (err) {}
    return { message: 'Pengguna ditolak dan dihapus' };
  }

  // ==========================================
  // BAGIAN 4: PROFIL
  // ==========================================
  async updateUserPhoto(id: string, photo: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { photo }
    });
    
    // Ambil semua data kecuali password sebelum dikembalikan
    const { password, ...userWithoutPassword } = user;
    
    try {
      await this.redis.del('users:staff-list');
    } catch (err) {}
    
    return { message: 'Foto berhasil diperbarui', photoUrl: userWithoutPassword.photo };
  }
}