// src/livestock/livestock.module.ts
import { Module } from '@nestjs/common';
import { LivestockService } from './livestock.service';
import { LivestockController } from './livestock.controller';
import { LivestockGateway } from './livestock.gateway';
import { LivestockProcessor } from './livestock.processor';
import { HeartrateProcessor } from './heartrate.processor';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    PrismaModule, 
    ActivityModule,
    BullModule.registerQueue({
      name: 'vital-queue',
    }),
    BullModule.registerQueue({
      name: 'heartrate-queue',
    }),
  ],
  controllers: [LivestockController],
  providers: [LivestockService, LivestockGateway, LivestockProcessor, HeartrateProcessor],
})
export class LivestockModule {}