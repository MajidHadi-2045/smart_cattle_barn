import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.zone.findMany({
      include: { sections: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; description?: string }) {
    return this.prisma.zone.create({
      data,
    });
  }

  // --- SECTION MANAGEMENT ---
  async addSection(zoneId: number, name: string) {
    return this.prisma.section.create({
      data: { name, zoneId },
    });
  }

  async removeSection(id: number) {
    return this.prisma.section.delete({
      where: { id },
    });
  }

  async update(id: number, data: { name?: string; description?: string }) {
    return this.prisma.zone.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    return this.prisma.zone.delete({
      where: { id },
    });
  }
}
