import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import * as os from 'os';
import { Redis } from 'ioredis';

@Injectable()
export class SystemService {
  private redis: Redis;
  private lastCpuUsage = process.cpuUsage();
  private lastCpuTime = Date.now();

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    this.redis.on('error', () => {});
  }

  async getMetrics() {
    // 1. Native High-Performance Zero-Overhead Node.js CPU & Memory
    const mem = process.memoryUsage();
    const memMb = (mem.rss / 1024 / 1024).toFixed(2);

    const currentTime = Date.now();
    const timeDiffMs = Math.max(1, currentTime - this.lastCpuTime);
    const currentUsage = process.cpuUsage(this.lastCpuUsage);
    
    // Total CPU time consumed in microseconds
    const totalCpuMicros = (currentUsage.user + currentUsage.system);
    // Available CPU capacity in microseconds across all CPU cores
    const cpuCores = Math.max(1, os.cpus().length);
    const cpuPercent = (totalCpuMicros / (timeDiffMs * 1000 * cpuCores)) * 100;
    const cpu = Math.min(100, Math.max(0, cpuPercent)).toFixed(2);

    // Update state for next calculation
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = currentTime;

    // 2. Baca Memory Redis secara native non-blocking
    let redisMem = 'N/A';
    try {
      if (this.redis.status === 'ready') {
        const info = await this.redis.info('memory');
        const match = info.match(/used_memory_human:(.+)/);
        if (match) redisMem = match[1].trim();
      }
    } catch (e) {}

    return {
      success: true,
      cpu: parseFloat(cpu),
      memoryMb: parseFloat(memMb),
      redisMemory: redisMem,
      processName: 'smartbarn-api-4000',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  restartServer(processName: string = 'smartbarn-api-4000') {
    setTimeout(() => {
      try {
        exec(`pm2 restart ${processName} || pm2 restart all`, () => {
          process.exit(0);
        });
      } catch (e) {
        process.exit(0);
      }
    }, 500);

    return {
      success: true,
      message: `Triggered PM2 restart for ${processName}. Server will restart in 500ms.`,
      timestamp: new Date().toISOString(),
    };
  }
}
