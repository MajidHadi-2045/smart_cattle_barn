import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ZoneService } from './zone.service';

@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Get()
  findAll() {
    return this.zoneService.findAll();
  }

  @Post()
  create(@Body() data: { name: string; description?: string }) {
    return this.zoneService.create(data);
  }

  @Post(':id/sections')
  addSection(@Param('id') id: string, @Body() data: { name: string }) {
    return this.zoneService.addSection(+id, data.name);
  }

  @Delete('sections/:id')
  removeSection(@Param('id') id: string) {
    return this.zoneService.removeSection(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: { name?: string; description?: string }) {
    return this.zoneService.update(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.zoneService.remove(+id);
  }
}
