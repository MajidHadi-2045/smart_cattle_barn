// src/environment/environment.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnvironmentService {
  private envBatch: any[] = [];
  private windBatch: any[] = [];
  private isFlushing = false;

  constructor(private prisma: PrismaService) {
    // Jalankan pembersihan batch setiap 10 detik
    setInterval(() => this.flushAllBatches(), 10000);
  }

  async saveZoneSensorData(zoneId: number, data: any) {
    this.envBatch.push({
      zoneId,
      temperature: parseFloat(data.temperature),
      humidity: parseFloat(data.humidity),
      ammonia: parseFloat(data.ammonia),
      thi: data.thi ? parseFloat(data.thi) : null,
    });
    if (this.envBatch.length >= 100) this.flushAllBatches();
  }

  async saveWindData(zoneId: number, windspeed: number) {
    this.windBatch.push({
      zoneId,
      windspeed: parseFloat(windspeed as any),
    });
    if (this.windBatch.length >= 100) this.flushAllBatches();
  }

  private async flushAllBatches() {
    if (this.isFlushing) return;
    this.isFlushing = true;
    try {
      if (this.envBatch.length > 0) {
        const data = [...this.envBatch];
        this.envBatch = [];
        await this.prisma.environmentData.createMany({ data });
      }
      if (this.windBatch.length > 0) {
        const data = [...this.windBatch];
        this.windBatch = [];
        await this.prisma.airCirculation.createMany({ data });
      }
    } catch (err) {
      console.error('Flush failed:', err.message);
    } finally {
      this.isFlushing = false;
    }
  }

  // ==========================================
  // 1. FITUR SENSOR & GRAFIK
  // ==========================================
  async getTrendData(zoneId: number, range: string = '24h') {
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '1h': startDate.setHours(now.getHours() - 1); break;
      case '24h': case '1d': startDate.setHours(now.getHours() - 24); break;
      case '7d': startDate.setDate(now.getDate() - 7); break;
      case '30d': case '1mo': startDate.setDate(now.getDate() - 30); break;
      case '5d': startDate.setDate(now.getDate() - 5); break;
      default: startDate.setHours(now.getHours() - 24);
    }

    // Ambil data dalam jumlah wajar agar tidak memberatkan pool (max 500)
    const limit = 500;

    const data = await this.prisma.environmentData.findMany({
      where: { 
        zoneId: parseInt(zoneId as any),
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    
    return data.reverse();
  }

  async getWindTrendData(zoneId: number, range: string = '24h') {
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '1h': startDate.setHours(now.getHours() - 1); break;
      case '24h': startDate.setHours(now.getHours() - 24); break;
      case '7d': startDate.setDate(now.getDate() - 7); break;
      case '30d': case '1mo': startDate.setDate(now.getDate() - 30); break;
      case '5d': startDate.setDate(now.getDate() - 5); break;
      default: startDate.setHours(now.getHours() - 24);
    }

    const limit = 500;

    const data = await this.prisma.airCirculation.findMany({
      where: { 
        zoneId: parseInt(zoneId as any),
        timestamp: { gte: startDate } 
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    
    return data.reverse();
  }

  async getLatestWindspeed() {
    return this.prisma.airCirculation.findFirst({
      orderBy: { timestamp: 'desc' },
    });
  }

  // ==========================================
  // 2. FITUR KONTROL AKTUATOR (KIPAS, SPRINKLER, LAMPU)
  // ==========================================
  async getActuatorState(sectionId: number) {
    let state = await this.prisma.actuatorState.findUnique({
      where: { sectionId: parseInt(sectionId as any) },
    });

    if (!state) {
      state = await this.prisma.actuatorState.create({
        data: { sectionId: parseInt(sectionId as any), fanOn: false, sprinklerOn: false, lampOn: false },
      });
    }

    return state;
  }

  async toggleActuator(
    sectionId: number,
    device: 'fanOn' | 'sprinklerOn' | 'lampOn',
    value: boolean,
  ) {
    return this.prisma.actuatorState.upsert({
      where: { sectionId: parseInt(sectionId as any) },
      update: { [device]: value },
      create: {
        sectionId: parseInt(sectionId as any),
        [device]: value,
      },
    });
  }
}