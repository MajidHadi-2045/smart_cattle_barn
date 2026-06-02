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

  constructor(private prisma: PrismaService) {
    super();

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
    const bodyTemperature = data.bodyTemperature !== undefined ? parseFloat(data.bodyTemperature) : null;

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
