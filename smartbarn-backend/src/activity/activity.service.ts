import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async log(userName: string, action: 'TAMBAH' | 'EDIT' | 'HAPUS' | 'UNDUH', module: 'TERNAK' | 'MEDIS' | 'SILO' | 'LAPORAN', details: string) {
    try {
      return await this.prisma.activityLog.create({
        data: { userName, action, module, details },
      });
    } catch (err) {
      console.error('Failed to save activity log:', err.message);
    }
  }

  async getRecentLogs() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.activityLog.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
