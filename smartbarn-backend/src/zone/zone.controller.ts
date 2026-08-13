import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ZoneService } from './zone.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Get()
  findAll() {
    return this.zoneService.findAll();
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  create(@Body() data: { name: string; description?: string; location?: string }) {
    return this.zoneService.create(data);
  }

  @Post(':id/sections')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  addSection(@Param('id') id: string, @Body() data: { name: string; capacity?: any }) {
    return this.zoneService.addSection(+id, data.name, data.capacity);
  }

  @Delete('sections/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  removeSection(@Param('id') id: string) {
    return this.zoneService.removeSection(+id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  update(@Param('id') id: string, @Body() data: { name?: string; description?: string }) {
    return this.zoneService.update(+id, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('STAFF')
  remove(@Param('id') id: string) {
    return this.zoneService.remove(+id);
  }
}
