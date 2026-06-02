// src/environment/environment.module.ts
import { Module } from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { EnvironmentController } from './environment.controller';
import { EnvironmentGateway } from './environment.gateway';
import { PrismaModule } from '../prisma/prisma.module'; // Wajib ada untuk akses DB

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [EnvironmentController],
  providers: [EnvironmentService, EnvironmentGateway],
  exports: [EnvironmentService],
})
export class EnvironmentModule {}