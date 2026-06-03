// src/health/health.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { HealthService } from './health.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Minta data 2 kartu ringkasan atas
  @Get('summary')
  getSummary() {
    return this.healthService.getHealthSummary();
  }

  // Minta data tabel riwayat pemeriksaan
  @Get()
  findAll() {
    return this.healthService.findAllRecords();
  }

  // Submit form "Input Kondisi Sakit"
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'VETERINER')
  create(@Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.healthService.createRecord(data, author);
  }

  // Submit bulk checkup / mass vaccination
  @Post('bulk')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'VETERINER')
  createBulk(@Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.healthService.createBulkRecords(data, author);
  }

  // Edit rekam medis
  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'VETERINER')
  update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.healthService.updateRecord(+id, data, author);
  }

  // Hapus rekam medis
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'VETERINER')
  remove(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.healthService.removeRecord(+id, author);
  }
}