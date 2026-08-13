// src/reports/reports.controller.ts
import { Controller, Get, Query, Res, BadRequestException, UseGuards, Req } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('download')
  @UseGuards(AuthGuard)
  async downloadReport(
    @Query('jenis') queryJenis: string,
    @Query('start') queryStart: string,
    @Query('end') queryEnd: string,
    @Query('format') queryFormat: any,
    @Query('type') type: string,
    @Res() res: Response, 
    @Req() req: any,
  ) {
    const jenis = queryJenis || type || 'Ternak';
    const start = queryStart || '2026-01-01';
    const end = queryEnd || new Date().toISOString().split('T')[0];
    const format = 'PDF'; // Format laporan resmi aplikasi khusus PDF

    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    const file = await this.reportsService.generateReport(jenis, start, end, format, author);

    if (!file) {
      throw new BadRequestException('Gagal membuat laporan');
    }

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Laporan_${jenis.replace(/\s+/g, '_')}_${start}.${file.extension}`,
    );

    res.send(file.buffer);
  }
}