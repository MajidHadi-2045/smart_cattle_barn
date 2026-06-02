import { Module } from '@nestjs/common';
import { IotService } from './iot.service';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentModule } from '../environment/environment.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    EnvironmentModule,
    // Register BullMQ Queue ONLY for High-Velocity Heartrate processing (Alur 1)
    BullModule.registerQueue({
      name: 'heartrate-queue',
    }),
  ],
  providers: [IotService],
  exports: [IotService],
})
export class IotModule {}
