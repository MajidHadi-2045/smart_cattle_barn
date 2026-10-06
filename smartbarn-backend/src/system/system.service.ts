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
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', () => {});
  }

  private cachedRedisMem = 'N/A';
  private lastRedisCheck = 0;

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

    // 2. Baca Memory Redis secara async non-blocking (cached 3 detik agar 0% beban CPU)
    if (currentTime - this.lastRedisCheck > 3000) {
      this.lastRedisCheck = currentTime;
      if (this.redis && this.redis.status !== 'end') {
        this.redis.info('memory').then((info) => {
          const match = info.match(/used_memory_human:(.+)/);
          if (match) this.cachedRedisMem = match[1].trim();
        }).catch(() => {});
      }
    }

    return {
      success: true,
      cpu: parseFloat(cpu),
      memoryMb: parseFloat(memMb),
      redisMemory: this.cachedRedisMem,
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

  async flushRedis() {
    try {
      if (this.redis && this.redis.status !== 'end') {
        await this.redis.flushall();
        this.cachedRedisMem = '1.5M';
        return {
          success: true,
          message: 'Redis cache successfully flushed on remote VPS.',
          timestamp: new Date().toISOString(),
        };
      }
      return { success: false, message: 'Redis client not active' };
    } catch (e) {
      return { success: false, message: `Failed to flush Redis: ${e.message}` };
    }
  }
}
