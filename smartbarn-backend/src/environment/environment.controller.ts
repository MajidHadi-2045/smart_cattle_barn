// src/environment/environment.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Query } from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { EnvironmentGateway } from './environment.gateway';
import { Redis } from 'ioredis';

@Controller('environment')
export class EnvironmentController {
  private redis: Redis;

  constructor(
    private environmentService: EnvironmentService,
    private gateway: EnvironmentGateway,
  ) {
    this.redis = new Redis({ 
      host: process.env.REDIS_HOST || 'localhost', 
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1 
    });
    this.redis.on('error', () => {});
  }

  // ==========================================
  // A. ENDPOINT PENERIMA SENSOR DARI ESP32 / SIMULATOR
  // ==========================================
  @Post('sensor')
  async receiveData(@Body() data: any) {
    if (data.type === 'zone_sensor' || data.type === 'section_sensor') {
      const zId = data.zoneId || data.sectionId;
      try {
        await this.redis.set(`live:zone:${zId}:environment`, JSON.stringify({ ...data, zoneId: zId, type: 'zone_sensor' }), 'EX', 70);
      } catch (err) {}
      this.gateway.server.emit('websocket:environment', { ...data, zoneId: zId, type: 'zone_sensor' });
      await this.environmentService.saveZoneSensorData(zId, data);
    } else if (data.type === 'wind_sensor') {
      try {
        await this.redis.set(`live:zone:${data.zoneId}:windspeed`, JSON.stringify(data), 'EX', 70);
      } catch (err) {}
      this.gateway.server.emit('websocket:windspeed', data);
      await this.environmentService.saveWindData(data.zoneId, data.windspeed);
    }
    return { status: 'success' };
  }

  // ==========================================
  // B. ENDPOINT UNTUK DASHBOARD UI (GRAFIK & LIVE)
  // ==========================================
  @Get('live/:zoneId')
  async getLive(@Param('zoneId') zoneId: string) {
    let data: string | null = null;
    try {
      data = await this.redis.get(`live:zone:${zoneId}:environment`);
    } catch (err) {}
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      const timestamp = parsed.timestamp ? new Date(parsed.timestamp).getTime() : Date.now();
      
      // Jika data lebih dari 2 menit, anggap sudah tidak aktif (stale)
      if (Date.now() - timestamp > 120000) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  @Get('live-wind/:zoneId')
  async getLiveWind(@Param('zoneId') zoneId: string) {
    let data: string | null = null;
    try {
      data = await this.redis.get(`live:zone:${zoneId}:windspeed`);
    } catch (err) {}
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      const timestamp = parsed.timestamp ? new Date(parsed.timestamp).getTime() : Date.now();

      if (Date.now() - timestamp > 120000) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  @Get('wind/trend/:zoneId')
  async getWindTrend(@Param('zoneId') zoneId: string, @Query('range') range: string) {
    return this.environmentService.getWindTrendData(+zoneId, range);
  }

  @Get('trend/:zoneId')
  async getTrend(@Param('zoneId') zoneId: string, @Query('range') range: string) {
    return this.environmentService.getTrendData(+zoneId, range);
  }

  @Get('circulation')
  async getCirculation() {
    return this.environmentService.getLatestWindspeed();
  }

  // ==========================================
  // C. ENDPOINT KONTROL AKTUATOR (KIPAS, SPRINKLER, LAMPU)
  // ==========================================
  @Get('actuator/:sectionId')
  async getActuatorState(@Param('sectionId') sectionId: string) {
    return this.environmentService.getActuatorState(+sectionId);
  }

  @Patch('actuator/:sectionId')
  async toggleActuator(
    @Param('sectionId') sectionId: string,
    @Body() body: { device: 'fanOn' | 'sprinklerOn' | 'lampOn'; state: boolean },
  ) {
    const result = await this.environmentService.toggleActuator(
      +sectionId,
      body.device,
      body.state,
    );

    this.gateway.server.emit(`actuator-command-section-${sectionId}`, {
      device: body.device,
      command: body.state ? 'ON' : 'OFF',
    });

    return result;
  }
}