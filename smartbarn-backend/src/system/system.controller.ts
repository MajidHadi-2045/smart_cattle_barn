import { Controller, Get, Post, Query, Body, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { SystemService } from './system.service';
import * as crypto from 'crypto';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('metrics')
  async getMetrics() {
    return this.systemService.getMetrics();
  }

  @Post('restart')
  async restartServer(@Body() body: any) {
    const processName = body?.processName || 'smartbarn-api-4000';
    return this.systemService.restartServer(processName);
  }

  @Post('flush-redis')
  async flushRedis() {
    return this.systemService.flushRedis();
  }

  @Get('speedtest/download')
  getSpeedtestDownload(@Query('size') sizeMb: string, @Res() res: Response) {
    const mb = Math.min(10, Math.max(1, parseInt(sizeMb || '3', 10)));
    const totalBytes = mb * 1024 * 1024;
    const randomBuffer = crypto.randomBytes(totalBytes);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', totalBytes);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(randomBuffer);
  }

  @Post('speedtest/upload')
  speedtestUpload(@Req() req: Request) {
    const receivedBytes = req.socket.bytesRead || 0;
    return {
      success: true,
      message: 'Upload payload received successfully',
      bytesReceived: receivedBytes,
      timestamp: new Date().toISOString(),
    };
  }
}
