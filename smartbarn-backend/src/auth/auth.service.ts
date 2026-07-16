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
  async login(identifier: string, pass: string, role: string, pushToken?: string) {
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
      throw new UnauthorizedException('Akses ditolak. Email, Password, atau Role Anda salah.');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Password salah');

    // CEK STATUS: Tolak akses jika akun sedang CUTI atau NONAKTIF
    if (user.status !== 'AKTIF') {
      throw new UnauthorizedException('Akun Anda sedang dinonaktifkan. Hubungi Manajer.');
    }

    // UPDATE PUSH TOKEN BILA ADA DARI MOBILE APP
    if (pushToken) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { pushToken }
      });
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
        phone: data.phone, // Tambahkan nomer HP
        password: hashedPassword,
        name: data.name,
        role: upperRole as any,
        status: 'MENUNGGU_KONFIRMASI'
      },
    });
  }

  // ==========================================
  // FUNGSI LUPA PASSWORD (NODEMAILER)
  // ==========================================
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Demi keamanan, tetap kembalikan sukses meski email tidak ada, agar hacker tidak tahu
      return { message: 'Jika email terdaftar, link reset telah dikirim.' };
    }

    // Buat Token Rahasia yang kedaluwarsa dalam 15 menit
    // Kami menggunakan password hash saat ini sebagai bagian dari kunci.
    // Jika password diubah, token ini otomatis tidak berlaku lagi (Super Aman!)
    const secret = process.env.JWT_SECRET + user.password;
    const token = await this.jwtService.signAsync(
      { email: user.email, id: user.id }, 
      { secret, expiresIn: '15m' }
    );

    // Kirim Email Menggunakan Nodemailer
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Isi ini di .env nanti (misal: akun@gmail.com)
        pass: process.env.EMAIL_PASS  // Isi ini di .env nanti (16 digit App Password)
      }
    });

   // const resetLink = `https://smartcattlebarn.site/reset-password?token=${token}&email=${user.email}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}&email=${user.email}`;

    const mailOptions = {
      from: `"Smart Barn System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '🔑 Link Reset Password - Smart Cattle Barn',
      html: `
        <h3>Halo ${user.name},</h3>
        <p>Kami menerima permintaan untuk mereset password Anda.</p>
        <p>Silakan klik tombol di bawah ini untuk membuat password baru. Link ini hanya berlaku selama 15 menit.</p>
        <a href="${resetLink}" style="padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Reset Password Saya</a>
        <br><br>
        <p>Jika Anda tidak pernah meminta reset password, abaikan saja email ini.</p>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      return { message: 'Link reset password berhasil dikirim ke email Anda.' };
    } catch (error) {
      console.error('Error pengiriman email:', error);
      throw new UnauthorizedException('Gagal mengirim email. Pastikan setting SMTP di .env sudah benar.');
    }
  }

  // ==========================================
  // FUNGSI RESET PASSWORD (SIMPAN PASSWORD BARU)
  // ==========================================
  async resetPassword(token: string, newPassword: string) {
    // Karena kita butuh password lama untuk verifikasi token, kita dekode dulu emailnya (tanpa verify)
    const decoded: any = this.jwtService.decode(token);
    if (!decoded || !decoded.email) {
      throw new UnauthorizedException('Token reset password tidak valid atau rusak.');
    }

    const user = await this.prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) throw new UnauthorizedException('Pengguna tidak ditemukan.');

    // Sekarang verifikasi token menggunakan password hash lama sebagai kunci
    const secret = process.env.JWT_SECRET + user.password;
    try {
      this.jwtService.verify(token, { secret });
    } catch (err) {
      throw new UnauthorizedException('Token sudah kedaluwarsa atau password sudah pernah diubah.');
    }

    // Jika valid, hash password baru dan simpan
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    return { message: 'Password Anda berhasil diperbarui! Silakan login dengan password baru.' };
  }
}