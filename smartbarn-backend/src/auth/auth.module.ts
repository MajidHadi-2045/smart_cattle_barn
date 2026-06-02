// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module'; // WAJIB DITAMBAHKAN

@Module({
  imports: [
    PrismaModule, // WAJIB DITAMBAHKAN
    JwtModule.register({
      global: true, // Memungkinkan pelindung JWT dipakai di modul Feed, dll
      secret: process.env.JWT_SECRET || 'rahasia_super_aman_smartbarn', 
      signOptions: { expiresIn: '1d' }, // Token valid selama 1 hari
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}