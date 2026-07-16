import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('heartrate-queue')
export class HeartrateProcessor extends WorkerHost {
  private readonly logger = new Logger(HeartrateProcessor.name);
  private isFlushing = false;
  private batch: any[] = [];
  private readonly MAX_BATCH_SIZE = 200; // Dikumpulkan lebih banyak agar efisien
  private redisClient: any;

  constructor(private prisma: PrismaService) {
    super();

    const Redis = require('ioredis');
    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Simpan data setiap 10 detik atau jika batch penuh (200 data)
    setInterval(() => {
      this.flushBatch();
    }, 10000); 
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const data = job.data;
    
    // Alur 1: High Velocity Heartrate
    const cattleId = (data.cattleId || data.cowId || '').toString().trim();
    if (!cattleId) return {};

    const heartRate = data.heartRate !== undefined ? parseFloat(data.heartRate) : null;
    const rawTemp = data.temp !== undefined ? data.temp : data.bodyTemperature;
    const bodyTemperature = rawTemp !== undefined ? parseFloat(rawTemp) : null;

    if (heartRate === null && bodyTemperature === null) return {};

    this.batch.push({
      cattleId: cattleId,
      heartRate,
      bodyTemperature,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    });

    if (this.batch.length >= this.MAX_BATCH_SIZE) {
      await this.flushBatch();
    }

  // ==============================================================
  // IMPLEMENTASI SKRIPSI: PUSH NOTIFICATION DARURAT MEDIS (SEMUA ROLE)
  // ==============================================================
  if ((heartRate && heartRate > 100) || (bodyTemperature && bodyTemperature > 39.5)) {
    const alertKey = `alert:vital:cow:${cattleId}`;
    const hasAlerted = await this.redisClient.get(alertKey);

    if (!hasAlerted) {
      await this.redisClient.set(alertKey, '1', 'EX', 1800); // Kunci 30 menit agar tidak spam
      
      // AMBIL SEMUA USER (Staff, Manager, Veteriner) yang punya token
      const targets = await this.prisma.user.findMany({
        where: { pushToken: { not: null } } 
      });

      const { sendPushNotification } = require('../utils/expoPush');
      const title = "🚨 DARURAT KESEHATAN SAPI!";
      const body = `Sapi ${cattleId} Kritis! (Suhu: ${bodyTemperature||'-'}°C, Detak: ${heartRate||'-'}). Segera tangani!`;

      targets.forEach(user => {
        sendPushNotification(user.pushToken, title, body);
      });

      this.redisClient.publish('websocket:alert', JSON.stringify({
        title,
        body,
        timestamp: new Date().toISOString()
      }));

      // SIMPAN KE HISTORY NOTIFIKASI DI REDIS
      const notifData = {
        id: Date.now(),
        title,
        body,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString()
      };
      await this.redisClient.lpush('system:notifications', JSON.stringify(notifData));
      await this.redisClient.ltrim('system:notifications', 0, 49); // Batasi history max 50 notif

      this.logger.warn(`Push Notification Medis Sapi ${cattleId} dikirim ke ${targets.length} pengguna.`);
    }
  }
  // ==============================================================

    return {};
  }

  private async flushBatch() {
    if (this.batch.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      await this.prisma.livestockVital.createMany({
        data: currentBatch,
        skipDuplicates: true,
      });

      this.logger.log(`[Cold Path] Successfully batch inserted ${currentBatch.length} records.`);
    } catch (error) {
      if (error.code === 'P2003') {
        const ids = [...new Set(currentBatch.map(b => b.cattleId))];
        this.logger.error(`Foreign key violation. Some cattleIds in [${ids.join(', ')}] are not registered.`);
      } else {
        this.logger.error('[Cold Path] Failed to insert heartrate batch', error.message);
      }
    } finally {
      this.isFlushing = false;
    }
  }
}
