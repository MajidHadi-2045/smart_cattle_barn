// src/feed/feed.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { FeedService } from './feed.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // --- ENDPOINT SILO ---
  @Get('silo')
  getSilos() {
    return this.feedService.getAllSilos();
  }

  @Post('silo')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  createSilo(@Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.createSilo(data, author);
  }

  @Patch('silo/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateSilo(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.updateSilo(+id, data, author);
  }

  @Delete('silo/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  removeSilo(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.removeSilo(+id, author);
  }

  // Contoh Payload JSON untuk frontend: { "amount": 50, "type": "ADD" }
  @Patch('silo/:id/stock')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateStock(
    @Param('id') id: string, 
    @Body() body: { amount: number, type: 'ADD' | 'SUBTRACT' },
    @Req() req: any
  ) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.updateStock(+id, body.amount, body.type, author);
  }

  // --- ENDPOINT JADWAL PAKAN ---
  @Get('schedule')
  getSchedules() {
    return this.feedService.getSchedules();
  }

  @Post('schedule')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  createSchedule(@Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.createSchedule(data, author);
  }

  @Patch('schedule/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  updateSchedule(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.updateSchedule(+id, data, author);
  }

  @Delete('schedule/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  removeSchedule(@Param('id') id: string, @Req() req: any) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.removeSchedule(+id, author);
  }

  // --- REPORT & TRANSAKSI SILO ---
  @Get('report')
  getFeedReport() {
    return this.feedService.getFeedReport();
  }

  @Get('silo/:id/transaction')
  getTransactions(@Param('id') id: string) {
    return this.feedService.getSiloTransactions(+id);
  }

  @Post('silo/:id/transaction')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  createTransaction(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any
  ) {
    const author = req.user?.name ? `${req.user.name} (${req.user.role})` : req.user?.email || 'Admin';
    return this.feedService.createTransaction(+id, body, author);
  }
}