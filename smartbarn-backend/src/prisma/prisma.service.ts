import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Versi 5 otomatis membaca DATABASE_URL dari .env melalui schema.prisma
  async onModuleInit() {
    await this.$connect();
    console.log('✅ DATABASE CONNECTED SUCCESSFULLY (Prisma v5)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('❌ DATABASE DISCONNECTED');
  }
}