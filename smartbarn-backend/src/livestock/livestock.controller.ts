// src/livestock/livestock.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LivestockService } from './livestock.service';
import { LivestockGateway } from './livestock.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { CreateLivestockDto } from './dto/create-livestock.dto';


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

  // =========================================================
  // BAGIAN 1: API PENERIMAAN DATA TELEMETRI SENSOR (REAL-TIME)
  // Contoh format JSON: { "cattleId": "C-302", "heartRate": 65, "bodyTemperature": 39.5 }
  // =========================================================
  @Post('vital')
  async receiveVitalData(@Body() data: any) {
    // TAHAP 1 (WEB-SOCKET): Kirim sinyal broadcast seketika ke aplikasi klien (UI/Dashboard)
    this.gateway.server.emit(`vital-update-${data.cattleId}`, data);

    // TAHAP 2 (PARALEL NON-BLOCKING): Tulis ke Redis Cache & Antrekan ke BullMQ secara bersamaan
    await Promise.all([
      this.redis
        .set(`vital:${data.cattleId}`, JSON.stringify(data))
        .catch(() => {}),
      this.vitalQueue
        .add('save-vital', data, {
          removeOnComplete: true,
          removeOnFail: 100,
        })
        .catch((err) => {
          console.warn('Queue addition failed:', err.message);
        }),
    ]);

    return { status: 'success', message: 'Data received' };
  }

  // ==========================================
  // 2. ENDPOINT DASHBOARD & FILTER (STATIS)
  // Harus diletakkan di atas endpoint dinamis /:id
  // ==========================================
  @Get('vital/history/:cattleId')
  getHistoricalVitals(@Param('cattleId') cattleId: string) {
    return this.livestockService.getHistoricalVitals(cattleId);
  }

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
  @Roles('STAFF')
  create(@Body() data: CreateLivestockDto, @Req() req: any) {
    if (data.initialWeight <= 0) {
      throw new BadRequestException('Berat awal harus berupa angka positif');
    }
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
  @Roles('STAFF')
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
  @Roles('STAFF')
  recordWaste(@Body() data: { cattleIds: string[], fecesKg: number, urineL: number }, @Req() req: any) {
    if (data.fecesKg < 0 || data.urineL < 0) {
      throw new BadRequestException('Berat limbah tidak valid');
    }
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    if (!data.cattleIds || !Array.isArray(data.cattleIds)) {
      throw new BadRequestException('cattleIds harus berupa array string');
    }
    return this.livestockService.recordWaste(data.cattleIds, data.fecesKg, data.urineL, author);
  }

  @Post('waste/zone')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  recordZoneWaste(@Body() data: { zoneId: number, fecesKg: number, urineL: number }, @Req() req: any) {
    if (data.fecesKg < 0 || data.urineL < 0) {
      throw new BadRequestException('Berat limbah tidak valid');
    }
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
  @Roles('STAFF')
  recordWeight(@Body() data: { cattleId: string, weight: number, date?: string }, @Req() req: any) {
    if (data.weight <= 0) {
      throw new BadRequestException('Berat badan harus berupa angka positif');
    }
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.recordWeight(data.cattleId, data.weight, author, data.date);
  }

  @Post('feed')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF', 'VETERINER')
  recordFeed(@Body() data: { cattleId: string, feedType: string, weightKg: number, bkPercent: number, siloId?: number }, @Req() req: any) {
    const weight = parseFloat(data.weightKg as any);
    if (isNaN(weight) || weight <= 0) {
      throw new BadRequestException('Jumlah pakan harus berupa angka positif lebih dari 0');
    }
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.recordFeed(data.cattleId, data.feedType, weight, data.bkPercent, author, data.siloId);
  }

  @Post('feed-bulk')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  recordFeedBulk(@Body() data: { cattleIds: string[], feedType: string, weightKgPerCow: number, bkPercent: number, siloForageId?: number, siloConcentrateId?: number }, @Req() req: any) {
    const weight = parseFloat(data.weightKgPerCow as any);
    if (isNaN(weight) || weight <= 0) {
      throw new BadRequestException('Jumlah pakan harus berupa angka positif lebih dari 0');
    }
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.recordFeedBulk(data.cattleIds, data.feedType, weight, data.bkPercent, author, data.siloForageId, data.siloConcentrateId);
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

  @Delete('history/batch/:batchId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  deleteBatch(@Param('batchId') batchId: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteBatch(batchId, author);
  }

  @Patch('feed/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateFeed(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateFeedRecord(+id, data, author);
  }

  @Delete('feed/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  deleteFeed(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteFeedRecord(+id, author);
  }

  @Patch('weight/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateWeight(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateWeightRecord(+id, data, author);
  }

  @Delete('weight/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  deleteWeight(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteWeightRecord(+id, author);
  }

  @Patch('waste/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateWaste(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateWasteRecord(+id, data, author);
  }

  @Delete('waste/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  deleteWaste(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteWasteRecord(+id, author);
  }

  @Patch('waste/zone/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateZoneWaste(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateZoneWasteRecord(+id, data, author);
  }

  @Delete('waste/zone/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  deleteZoneWaste(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.deleteZoneWasteRecord(+id, author);
  }

  @Post('reset-performance/:cattleId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'STAFF')
  resetCowPerformanceData(@Param('cattleId') cattleId: string) {
    return this.livestockService.resetCowPerformanceData(cattleId);
  }

  // ==========================================
  // Dynamic CRUD routes moved to bottom to prevent route matching conflicts
  // ==========================================
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.livestockService.findOne(id);
  }

  @Patch('bulk/nutrition')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateBulkNutrition(@Body() data: { cattleIds: string[], targetBkPercent?: number, forageRatio?: number, concentrateRatio?: number, forageDM?: number, concentrateDM?: number, feedingFrequency?: number }, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.updateBulkNutrition(data.cattleIds, data, author);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF', 'VETERINER')
  update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.update(id, data, author, req.user?.role);
  }

  @Delete(':cattleId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  remove(@Param('cattleId') cattleId: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.livestockService.removeByCattleId(cattleId, author);
  }
}