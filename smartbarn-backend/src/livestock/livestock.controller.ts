// src/livestock/livestock.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LivestockService } from './livestock.service';
import { LivestockGateway } from './livestock.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

@Controller('livestock')
export class LivestockController {
  private redis: Redis;

  constructor(
    private readonly livestockService: LivestockService,
    private gateway: LivestockGateway, // Jalur WebSocket untuk EKG
    @InjectQueue('heartrate-queue') private vitalQueue: Queue, // Jalur Antrean (Batching) untuk PostgreSQL
  ) {
    this.redis = new Redis({ 
      host: process.env.REDIS_HOST || 'localhost', 
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1 
    });
    this.redis.on('error', () => {});
  }

  // ==========================================
  // 1. ENDPOINT IOT SENSOR KALUNG SAPI (HIGH VELOCITY)
  // Payload ESP32: { "cattleId": "C-302", "heartRate": 65, "bodyTemperature": 39.5 }
  // ==========================================
  @Post('vital')
  async receiveVitalData(@Body() data: any) {
    // A. HOT PATH: Simpan status vital TERAKHIR di RAM (Redis)
    try {
      await this.redis.set(`vital:${data.cattleId}`, JSON.stringify(data));
    } catch (err) {
      // Abaikan kegagalan set jika Redis mati
    }
    
    // B. HOT PATH: Pancarkan langsung ke Frontend untuk grafik EKG bergerak
    this.gateway.server.emit(`vital-update-${data.cattleId}`, data);

    // C. COLD PATH: Masukkan ke antrean untuk disimpan pelan-pelan ke PostgreSQL
    try {
      await this.vitalQueue.add('save-vital', data, { removeOnComplete: true });
    } catch (err) {
      console.warn('Queue addition failed:', err.message);
    }

    return { status: 'success', message: 'Data received' };
  }

  // ==========================================
  // 2. ENDPOINT DASHBOARD & FILTER (STATIS)
  // Harus diletakkan di atas endpoint dinamis /:id
  // ==========================================
  @Get('stats/:sectionId')
  getStats(@Param('sectionId') sectionId: string) {
    return this.livestockService.getDashboardStats(+sectionId);
  }

  @Get('section/:sectionId')
  getBySection(@Param('sectionId') sectionId: string) {
    return this.livestockService.findAllBySection(+sectionId);
  }

  // ==========================================
  // 3. ENDPOINT CRUD STANDAR (DINAMIS & UMUM)
  // ==========================================
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  create(@Body() data: any, @Req() req: any) {
    if (data.birthDate) {
      data.birthDate = new Date(data.birthDate);
    }
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.create(data, author);
  }

  @Get()
  findAll() {
    return this.livestockService.findAll();
  }

  // ==========================================
  // 4. ENDPOINT PENGATURAN & LIMBAH
  // ==========================================
  @Get('waste/settings')
  getSettings() {
    return this.livestockService.getSettings();
  }

  @Post('waste/settings')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  updateSettings(@Body() data: { fecesKg: number, urineL: number }, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateSettings(data.fecesKg, data.urineL, author);
  }

  @Get('waste/summary')
  getWasteSummary() {
    return this.livestockService.getWasteSummary();
  }

  @Post('waste')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  recordWaste(@Body() data: { cattleIds: string[], fecesKg: number, urineL: number }, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    if (!data.cattleIds || !Array.isArray(data.cattleIds)) {
      throw new Error('cattleIds harus berupa array string');
    }
    return this.livestockService.recordWaste(data.cattleIds, data.fecesKg, data.urineL, author);
  }

  @Post('waste/zone')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  recordZoneWaste(@Body() data: { zoneId: number, fecesKg: number, urineL: number }, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.recordZoneWaste(+data.zoneId, data.fecesKg, data.urineL, author);
  }

  @Post('waste/auto-all')
  autoRecordWasteAll() {
    return this.livestockService.autoRecordWasteAll();
  }

  // ==========================================
  // 5. ENDPOINT PERTUMBUHAN & PAKAN (FITUR BARU)
  // ==========================================
  
  @Get('performance-chart')
  getPerformanceChart(@Query('period') period?: string, @Query('cowId') cowId?: string) {
    return this.livestockService.getPerformanceChartData(period || 'minggu', cowId);
  }

  @Post('weight')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  recordWeight(@Body() data: { cattleId: string, weight: number, date?: string }, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.recordWeight(data.cattleId, data.weight, author, data.date);
  }

  @Post('feed')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  recordFeed(@Body() data: { cattleId: string, feedType: string, weightKg: number, bkPercent: number }, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.recordFeed(data.cattleId, data.feedType, data.weightKg, data.bkPercent, author);
  }

  @Get('feed-needs/:cattleId')
  getFeedNeeds(@Param('cattleId') cattleId: string) {
    return this.livestockService.getFeedNeeds(cattleId);
  }

  // ==========================================
  // RIWAYAT & EDIT DATA INPUT BARU (EDIT/DELETE)
  // ==========================================
  @Get('recent-inputs')
  getRecentInputs() {
    return this.livestockService.getRecentInputs();
  }

  @Patch('feed/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  updateFeed(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateFeedRecord(+id, data, author);
  }

  @Delete('feed/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  deleteFeed(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteFeedRecord(+id, author);
  }

  @Patch('weight/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  updateWeight(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateWeightRecord(+id, data, author);
  }

  @Delete('weight/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  deleteWeight(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteWeightRecord(+id, author);
  }

  @Patch('waste/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  updateWaste(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateWasteRecord(+id, data, author);
  }

  @Delete('waste/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  deleteWaste(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteWasteRecord(+id, author);
  }

  @Patch('waste/zone/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  updateZoneWaste(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateZoneWasteRecord(+id, data, author);
  }

  @Delete('waste/zone/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  deleteZoneWaste(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteZoneWasteRecord(+id, author);
  }

  // ==========================================
  // Dynamic CRUD routes moved to bottom to prevent route matching conflicts
  // ==========================================
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.livestockService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.update(+id, data, author);
  }

  @Delete(':cattleId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  remove(@Param('cattleId') cattleId: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.removeByCattleId(cattleId, author);
  }
}