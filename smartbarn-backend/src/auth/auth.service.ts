// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ==========================================
  // FUNGSI LOGIN DENGAN VALIDASI EKSTRA
  // ==========================================
  async login(identifier: string, pass: string, role: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier }
        ]
      }
    });
    if (!user) throw new UnauthorizedException('Email atau Username tidak ditemukan');
    // VALIDASI ROLE: Pastikan peran yang dipilih di aplikasi sesuai dengan database
    if (user.role !== role) {
      throw new UnauthorizedException(`Akses ditolak. Anda terdaftar sebagai ${user.role}, bukan ${role}.`);
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Password salah');

    // CEK STATUS: Tolak akses jika akun sedang CUTI atau NONAKTIF
    if (user.status !== 'AKTIF') {
      throw new UnauthorizedException('Akun Anda sedang dinonaktifkan. Hubungi Manajer.');
    }

    // Payload JWT memuat identitas kunci pengguna
    const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
      // Kirim juga data profil dasar untuk ditampilkan di pojok kanan atas Dashboard Frontend
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.photo,
        createdAt: user.createdAt,
      }
    };
  }

  // ==========================================
  // FUNGSI REGISTER (Khusus inisialisasi awal)
  // ==========================================
  async register(data: any) {
    // Cek apakah email sudah terdaftar
    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new UnauthorizedException('Email sudah digunakan');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const tempId = `REQ_${Date.now()}`; // ID sementara untuk pendaftaran mandiri
    const upperRole = (data.role || 'STAFF').toUpperCase();

    return this.prisma.user.create({
      data: {
        id: tempId,
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: upperRole as any,
        status: 'MENUNGGU_KONFIRMASI'
      },
    });
  }
}