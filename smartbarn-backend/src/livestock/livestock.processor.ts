// src/livestock/livestock.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('vital-queue')
export class LivestockProcessor extends WorkerHost {
  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const data = job.data;
    
    try {
      // COLD PATH: Menyimpan histori ke PostgreSQL dengan aman
      await this.prisma.livestockVital.create({
        data: {
          cattleId: data.cattleId,
          heartRate: parseFloat(data.heartRate),
          bodyTemperature: parseFloat(data.bodyTemperature),
        },
      });
      // console.log(`[BullMQ] Data vital ${data.cattleId} berhasil disimpan.`);
    } catch (error) {
      console.error(`[BullMQ Error] Gagal menyimpan data vital ${data.cattleId}:`, error.message);
      // Melempar error agar BullMQ tahu job ini gagal dan bisa melakukan Retry (Backpressure)
      throw error; 
    }
  }
}