import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { Redis } from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EnvironmentService } from '../environment/environment.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IotService implements OnModuleInit, OnModuleDestroy {
  private mqttClient: mqtt.MqttClient;
  private redisPub: Redis;
  private readonly logger = new Logger(IotService.name);

  constructor(
    @InjectQueue('heartrate-queue') private heartrateQueue: Queue,
    private environmentService: EnvironmentService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    // 1. Connect to MQTT Broker
    this.mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883');
    
    // 2. Connect to Redis for Pub/Sub
    this.redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
    });
    this.redisPub.on('error', (err) => {
      this.logger.warn('IoT Redis connection offline.');
    });

    this.mqttClient.on('connect', () => {
      this.logger.log('Connected to MQTT Broker');
      
      // Subscribe to all relevant barn topics
      this.mqttClient.subscribe('barn/#', (err) => {
        if (err) {
          this.logger.error('Failed to subscribe to MQTT topics', err);
        } else {
          this.logger.log('Subscribed to MQTT topic: barn/#');
        }
      });
    });

    this.mqttClient.on('message', async (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        await this.handleMessage(topic, data);
      } catch (error) {
        this.logger.error(`Error parsing MQTT message on ${topic}:`, error);
      }
    });
  }

  onModuleDestroy() {
    this.mqttClient.end();
    try {
      this.redisPub.quit();
    } catch (err) {}
  }

  private async handleMessage(topic: string, data: any) {
    const segments = topic.split('/');
    
    const messageTimestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
    const isStale = (Date.now() - messageTimestamp) > 120000; // Lebih dari 2 menit dianggap usang

    // STRUCTURE: barn/zone/{zoneId}/windspeed
    if (segments[1] === 'zone' && segments[3] === 'windspeed') {
      const zoneId = parseInt(segments[2]);
      try {
        this.redisPub.publish('websocket:windspeed', JSON.stringify({ ...data, zoneId }));
      } catch (err) {}
      
      if (isStale) {
        this.logger.warn(`Ignoring stale windspeed data for zone ${zoneId} (Timestamp: ${data.timestamp})`);
        return;
      }

      // Update live key for dashboard with 2-minute expiry
      try {
        await this.redisPub.set(`live:zone:${zoneId}:windspeed`, JSON.stringify({
            ...data,
            zoneId,
            type: 'wind_sensor'
        }), 'EX', 70);
      } catch (err) {}

      await this.environmentService.saveWindData(zoneId, data.windspeed);
    } 
    // STRUCTURE: barn/zone/{zoneId}/environment OR barn/section/{sectionId}/environment
    else if ((segments[1] === 'zone' || segments[1] === 'section') && segments[3] === 'environment') {
      let zoneId = segments[1] === 'zone' ? parseInt(segments[2]) : null;
      const sectionId = segments[1] === 'section' ? parseInt(segments[2]) : null;

      if (sectionId && !zoneId) {
        const sec = await this.prisma.section.findUnique({
          where: { id: sectionId },
          select: { zoneId: true }
        });
        if (sec) {
          zoneId = sec.zoneId;
        }
      }

      if (!zoneId) {
        this.logger.warn(`Ignoring environment data: unable to resolve zoneId for topic ${topic}`);
        return;
      }

      try {
        this.redisPub.publish('websocket:environment', JSON.stringify({ ...data, zoneId }));
      } catch (err) {}
      
      if (isStale) {
        this.logger.warn(`Ignoring stale environment data for zone ${zoneId} (Timestamp: ${data.timestamp})`);
        return;
      }

      // HITUNG THI (Temperature Humidity Index)
      const T = parseFloat(data.temperature);
      const RH = parseFloat(data.humidity) / 100;
      const thi = (0.8 * T) + (RH * (T - 14.4)) + 46.4;

      // Update the "live" key for dashboard
      try {
        await this.redisPub.set(`live:zone:${zoneId}:environment`, JSON.stringify({ 
            ...data, 
            zoneId, 
            thi: parseFloat(thi.toFixed(2)),
            type: 'zone_sensor' 
        }), 'EX', 70);
      } catch (err) {}

      await this.environmentService.saveZoneSensorData(zoneId, { 
          ...data, 
          thi: parseFloat(thi.toFixed(2)) 
      });
    } 
    // STRUCTURE: barn/cow/{cattleId}/vitals
    else if (segments[1] === 'cow' && segments[3] === 'vitals') {
      const cattleId = segments[2];
      
      // Hot Path
      try {
        this.redisPub.publish('websocket:vital-update', JSON.stringify({ 
            cattleId, 
            heartRate: data.heartRate,
            bodyTemperature: data.temp,
            timestamp: data.timestamp || new Date().toISOString()
        }));
      } catch (err) {}
      
      // Cold Path (via BullMQ)
      try {
        await this.heartrateQueue.add('process-heartrate', { ...data, cattleId }, {
            removeOnComplete: true,
            removeOnFail: 1000
        });
      } catch (err) {}
    }
  }
}
