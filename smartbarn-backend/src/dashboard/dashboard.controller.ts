import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dashboard') 
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @UseInterceptors(CacheInterceptor)
  async getSummary() {
    return this.dashboardService.getFarmSummary();
  }

  @Get('waste')
  async getWasteSummary(@Query('filter') filter: 'daily' | 'weekly' | 'monthly') {
    return this.dashboardService.getWasteSummary(filter || 'daily');
  }

  @Get('daily-checklist')
  async getDailyChecklist() {
    return this.dashboardService.getDailyChecklist();
  }

  @Get('notifications')
  async getNotifications() {
    return this.dashboardService.getNotifications();
  }

  @Post('checklist-config')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  async saveChecklistConfig(@Body() body: any) {
    return this.dashboardService.saveConfig(body);
  }
}