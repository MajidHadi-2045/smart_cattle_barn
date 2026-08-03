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

      // HITUNG THI (Temperature Humidity Index) DAN AMONIA
      const T = parseFloat(data.temperature);
      const RH = parseFloat(data.humidity) / 100;
      const thi = (0.8 * T) + (RH * (T - 14.4)) + 46.4;
      const ammonia = data.ammonia !== undefined ? parseFloat(data.ammonia) : null;

      // ==============================================================
      // IMPLEMENTASI UNTUK SKRIPSI: SMART PUSH NOTIFICATION (DEBOUNCING)
      // ==============================================================
      if (thi > 75) { // 75 = Sapi mulai stres panas
        const alertKey = `alert:thi:zone:${zoneId}`;
        const hasAlerted = await this.redisPub.get(alertKey);
        
        // JIKA BELUM ADA PERINGATAN DALAM 30 MENIT TERAKHIR
        if (!hasAlerted) {
           // 1. Kunci selama 30 Menit (1800 detik) agar HP pegawai tidak meledak dibanjiri notifikasi
           await this.redisPub.set(alertKey, '1', 'EX', 1800);
           
           // 2. Ambil token HP untuk seluruh peran (MANAGER, STAFF, VETERINER)
           const targets = await this.prisma.user.findMany({
             where: { 
               role: { in: ['MANAGER', 'STAFF', 'VETERINER'] }, 
               pushToken: { not: null } 
             }
           });
           
           // 3. Tembak Notifikasi ke masing-masing HP
           const { sendPushNotification } = require('../utils/expoPush');
           const title = "⚠️ BAHAYA STRES PANAS SAPI!";
           const body = `Kandang ${zoneId} sangat panas (THI: ${thi.toFixed(1)}). Segera nyalakan Blower/Kipas!`;

           targets.forEach(user => {
              sendPushNotification(user.pushToken, title, body);
           });

           // 4. SIARKAN JUGA KE WEBSITE (DASHBOARD) AGAR MUNCUL POP-UP
           const notifPayload = {
             id: Date.now(),
             title,
             body,
             timestamp: new Date().toISOString()
           };

           this.redisPub.publish('websocket:alert', JSON.stringify(notifPayload));
           
           // Simpan ke history notifikasi agar tidak hilang
           await this.redisPub.lpush('system:notifications', JSON.stringify(notifPayload));
           await this.redisPub.ltrim('system:notifications', 0, 49);

           this.logger.warn(`Push Notification dikirim ke ${targets.length} pegawai untuk bahaya THI Kandang ${zoneId}.`);
        }
      }

      // --------------------------------------------------------------
      // NOTIFIKASI BAHAYA GAS AMONIA TINGGI (NH3 > 20 PPM)
      // --------------------------------------------------------------
      if (ammonia !== null && ammonia > 20) { // 20 ppm = batas aman ambang kualitas udara kandang
        const alertKey = `alert:ammonia:zone:${zoneId}`;
        const hasAlerted = await this.redisPub.get(alertKey);

        if (!hasAlerted) {
           await this.redisPub.set(alertKey, '1', 'EX', 1800); // Kunci 30 Menit

           const targets = await this.prisma.user.findMany({
             where: { 
               role: { in: ['MANAGER', 'STAFF', 'VETERINER'] }, 
               pushToken: { not: null } 
             }
           });

           const { sendPushNotification } = require('../utils/expoPush');
           const title = "⚠️ BAHAYA GAS AMONIA TINGGI!";
           const body = `Kandang ${zoneId} kadar Amonia tinggi (${ammonia.toFixed(1)} ppm). Segera bersihkan kotoran & tingkatkan ventilasi!`;

           targets.forEach(user => {
              sendPushNotification(user.pushToken, title, body);
           });

           const notifPayload = {
             id: Date.now(),
             title,
             body,
             timestamp: new Date().toISOString()
           };

           this.redisPub.publish('websocket:alert', JSON.stringify(notifPayload));
           
           await this.redisPub.lpush('system:notifications', JSON.stringify(notifPayload));
           await this.redisPub.ltrim('system:notifications', 0, 49);

           this.logger.warn(`Push Notification dikirim ke ${targets.length} pegawai untuk bahaya Amonia Kandang ${zoneId}.`);
        }
      }
      // ==============================================================

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
        const latency = Date.now() - messageTimestamp;
        this.logger.log(
          `[Telemetry] Cow ${cattleId} - Latency: ${latency}ms, RSSI: ${data.rssi || 'N/A'} dBm, Battery: ${data.batteryVoltage || 'N/A'} V`
        );

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
