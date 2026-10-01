import { Injectable } from '@nestjs/common';
import { execSync, exec } from 'child_process';
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
    let cpu = '0.00';
    let memMb = '0.00';
    let processName = 'smartbarn-api-4000';
    let found = false;

    // 1. Coba baca via PM2 jika jalan di bawah PM2
    try {
      const pm2Output = execSync('npx pm2 jlist', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 1500 });
      const pm2Data = JSON.parse(pm2Output);
      const app = pm2Data.find((a: any) => a.pm2_env && a.pm2_env.status === 'online' && a.name !== 'monitor') || pm2Data[0];
      if (app && app.monit && app.pm2_env && app.pm2_env.status === 'online') {
        cpu = (Number(app.monit.cpu) || 0).toFixed(2);
        memMb = ((Number(app.monit.memory) || 0) / 1024 / 1024).toFixed(2);
        processName = app.name || 'smartbarn-api-4000';
        found = true;
      }
    } catch (e) {}

    // 2. Fallback Linux ps aux
    if (!found && os.platform() === 'linux') {
      try {
        const psOut = execSync("ps aux | grep -E 'dist/main|smartbarn|nest' | grep -v grep | grep -v monitor", { encoding: 'utf-8', timeout: 1500 });
        const lines = psOut.trim().split('\n');
        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s+/);
          if (parts.length >= 6) {
            cpu = parseFloat(parts[2]).toFixed(2);
            const rssKb = parseFloat(parts[5]);
            memMb = (rssKb / 1024).toFixed(2);
            processName = 'NestJS Linux Process';
            found = true;
          }
        }
      } catch (e) {}
    }

    // 3. Fallback Node.js internal process cpu & memory
    if (!found) {
      const mem = process.memoryUsage();
      memMb = (mem.rss / 1024 / 1024).toFixed(2);

      const currentUsage = process.cpuUsage(this.lastCpuUsage);
      const currentTime = Date.now();
      const timeDiffMs = (currentTime - this.lastCpuTime) || 1000;
      const totalCpuMicros = (currentUsage.user + currentUsage.system);
      const cpuPercent = (totalCpuMicros / (timeDiffMs * 1000 * os.cpus().length)) * 100;
      cpu = Math.min(100, Math.max(0, cpuPercent)).toFixed(2);

      this.lastCpuUsage = process.cpuUsage();
      this.lastCpuTime = currentTime;
      processName = 'Node.js Internal';
    }

    // Baca Memory Redis
    let redisMem = 'N/A';
    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connecting') {
        const info = await this.redis.info('memory');
        const match = info.match(/used_memory_human:(.+)/);
        if (match) redisMem = match[1].trim();
      } else {
        const redisOut = execSync('redis-cli info memory', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 1500 });
        const match = redisOut.match(/used_memory_human:(.+)/);
        if (match) redisMem = match[1].trim();
      }
    } catch (e) {}

    return {
      success: true,
      cpu: parseFloat(cpu),
      memoryMb: parseFloat(memMb),
      redisMemory: redisMem,
      processName,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  restartServer(processName: string = 'smartbarn-api-4000') {
    setTimeout(() => {
      try {
        exec(`pm2 restart ${processName} || npx pm2 restart all`, () => {
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
