import { ZoneModule } from './zone/zone.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LivestockModule } from './livestock/livestock.module';
import { HealthModule } from './health/health.module';
import { FeedModule } from './feed/feed.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { EnvironmentModule } from './environment/environment.module';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { IotModule } from './iot/iot.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ActivityModule } from './activity/activity.module';

@Module({
  imports: [
    // Configure Redis for BullMQ globally
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    // Configure Global Cache Manager
    CacheModule.register({
      isGlobal: true,
      ttl: 1800000, // Default TTL 30 minutes in milliseconds
    }),
    PrismaModule, 
    AuthModule, 
    DashboardModule, 
    LivestockModule, 
    HealthModule, 
    FeedModule, 
    UsersModule, 
    ReportsModule, 
    EnvironmentModule,
    IotModule,
    WebsocketModule,
    ZoneModule,
    ActivityModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
