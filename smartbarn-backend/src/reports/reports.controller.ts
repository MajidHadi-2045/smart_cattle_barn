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
    @Query('jenis') jenis: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('format') format: 'CSV' | 'XLSX' | 'PDF',
    @Res() res: Response, 
    @Req() req: any,
  ) {
    if (!jenis || !start || !end || !format) {
      throw new BadRequestException('Parameter laporan tidak lengkap (jenis, start, end, format wajib diisi)');
    }

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