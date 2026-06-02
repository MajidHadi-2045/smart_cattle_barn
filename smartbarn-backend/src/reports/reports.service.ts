// src/reports/reports.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private activityService: ActivityService
  ) {}

  async generateReport(
    jenisLaporan: string,
    startDate: string,
    endDate: string,
    format: 'CSV' | 'XLSX' | 'PDF',
    author: string = 'Admin',
  ): Promise<any> {
    // 1. Validasi & Set Rentang Tanggal
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); 

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Format tanggal tidak valid');
    }

    let data: any[] = [];
    let columns: any[] = [];

    // 2. Tarik Data Sesuai Pilihan
    switch (jenisLaporan) {
      case 'Lingkungan':
        const rawEnv = await this.prisma.environmentData.findMany({
          where: { timestamp: { gte: start, lte: end } },
          include: { zone: true },
          orderBy: { timestamp: 'asc' },
        });
        
        data = rawEnv.map((item) => ({
          timestamp: item.timestamp.toLocaleString('id-ID'),
          zone: item.zone?.name || '-',
          temperature: item.temperature + ' °C',
          humidity: item.humidity + ' %',
          ammonia: item.ammonia + ' ppm',
          thi: item.thi ? item.thi.toFixed(2) : '-'
        }));

        columns = [
          { header: 'Waktu', key: 'timestamp', width: 20 },
          { header: 'Zona', key: 'zone', width: 20 },
          { header: 'Suhu', key: 'temperature', width: 15 },
          { header: 'Kelembapan', key: 'humidity', width: 15 },
          { header: 'Amonia', key: 'ammonia', width: 15 },
          { header: 'THI', key: 'thi', width: 15 },
        ];
        break;

      case 'Kesehatan':
        const rawHealth = await this.prisma.health.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: { 
            livestock: { 
              include: { section: { include: { zone: true } } } 
            } 
          },
        });
        
        data = rawHealth.map((item) => ({
          createdAt: item.createdAt.toLocaleString('id-ID'),
          cattleId: item.cattleId,
          diagnosa: item.diagnosa,
          penanganan: item.penanganan,
          pemeriksa: item.pemeriksa,
          status: item.status,
        }));

        columns = [
          { header: 'Tanggal', key: 'createdAt', width: 15 },
          { header: 'ID Sapi', key: 'cattleId', width: 15 },
          { header: 'Diagnosa', key: 'diagnosa', width: 20 },
          { header: 'Penanganan', key: 'penanganan', width: 20 },
          { header: 'Pemeriksa', key: 'pemeriksa', width: 15 },
          { header: 'Status', key: 'status', width: 15 },
        ];
        break;

      case 'Populasi':
        const rawPop = await this.prisma.livestock.findMany({
          include: { section: { include: { zone: true } } }
        });
        data = rawPop.map(item => ({
          cattleId: item.cattleId,
          breed: item.breed,
          gender: item.gender,
          weight: (item.currentWeight || item.initialWeight) + ' kg',
          zone: item.section?.zone?.name || '-',
          status: item.status
        }));
        columns = [
          { header: 'ID Sapi', key: 'cattleId', width: 15 },
          { header: 'Breed', key: 'breed', width: 20 },
          { header: 'Gender', key: 'gender', width: 15 },
          { header: 'Berat', key: 'weight', width: 15 },
          { header: 'Zona', key: 'zone', width: 20 },
          { header: 'Status', key: 'status', width: 15 },
        ];
        break;

      case 'Pakan':
        const rawFeed = await this.prisma.livestockFeedRecord.findMany({
          where: { feedDate: { gte: start, lte: end } },
          orderBy: { feedDate: 'asc' },
        });
        data = rawFeed.map(item => ({
          date: item.feedDate.toLocaleString('id-ID'),
          cattleId: item.cattleId,
          feedType: item.feedType,
          weightKg: item.weightKg + ' kg',
          bkPercent: item.bkPercent + ' %'
        }));
        columns = [
          { header: 'Waktu', key: 'date', width: 20 },
          { header: 'ID Sapi', key: 'cattleId', width: 20 },
          { header: 'Jenis Pakan', key: 'feedType', width: 20 },
          { header: 'Berat (As-Fed)', key: 'weightKg', width: 20 },
          { header: 'BK', key: 'bkPercent', width: 20 },
        ];
        break;

      case 'Limbah':
        const [rawWaste, rawZoneWaste] = await Promise.all([
          this.prisma.livestockWaste.findMany({
            where: { date: { gte: start, lte: end } },
            orderBy: { date: 'asc' },
          }),
          this.prisma.zoneWaste.findMany({
            where: { date: { gte: start, lte: end } },
            include: { zone: true },
            orderBy: { date: 'asc' },
          })
        ]);

        const combinedWaste: any[] = [];
        rawWaste.forEach(item => {
          combinedWaste.push({
            date: item.date.toLocaleDateString('id-ID'),
            source: `Sapi ${item.cattleId}`,
            feces: item.fecesKg + ' kg',
            urine: item.urineL + ' L',
          });
        });
        rawZoneWaste.forEach(item => {
          combinedWaste.push({
            date: item.date.toLocaleDateString('id-ID'),
            source: item.zone?.name || `Kandang #${item.zoneId}`,
            feces: item.fecesKg + ' kg',
            urine: item.urineL + ' L',
          });
        });

        data = combinedWaste.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        columns = [
          { header: 'Waktu', key: 'date', width: 25 },
          { header: 'Sumber', key: 'source', width: 25 },
          { header: 'Feses Padat', key: 'feces', width: 25 },
          { header: 'Urine Cair', key: 'urine', width: 25 },
        ];
        break;

      default:
        throw new BadRequestException(`Jenis laporan '${jenisLaporan}' tidak didukung`);
    }

    // 4. Catat Riwayat Pembuatan Laporan ke Database
    await this.prisma.report.create({
      data: {
        reportType: jenisLaporan,
        startDate: start,
        endDate: end,
        fileFormat: 'PDF',
      },
    });

    await this.activityService.log(author, 'UNDUH', 'LAPORAN', `Mengunduh laporan ${jenisLaporan} format PDF`);

    // IMPLEMENTASI PDF MENGGUNAKAN PDFKIT
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: any[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));

    // Desain Header Korporat
    doc.rect(0, 0, doc.page.width, 110).fill('#0ea5e9');
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('SMART CATTLE BARN', 50, 35);
    doc.fontSize(10).font('Helvetica').text('Sistem Manajemen Peternakan Sapi Modern & Cerdas', 50, 70);
    doc.fontSize(10).text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 50, 85, { align: 'right', width: doc.page.width - 100 });
    
    doc.moveDown(5);

    // Judul Dokumen
    doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text(`Laporan: ${jenisLaporan.toUpperCase()}`, 50);
    doc.fontSize(11).font('Helvetica').fillColor('#64748b').text(`Periode: ${startDate} s/d ${endDate}`);
    doc.moveDown(2);

    // Table Header
    const tableTop = doc.y;
    doc.rect(50, tableTop - 5, doc.page.width - 100, 25).fill('#f1f5f9');
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9);
    let currentX = 55;
    columns.forEach(col => {
      doc.text(col.header, currentX, tableTop + 2);
      currentX += col.width * 5; 
    });
    doc.font('Helvetica');
    doc.moveDown(1.5);
    
    // Rows
    let isEven = false;
    data.forEach((row) => {
        let x = 55;
        const y = doc.y;
        
        if (y > doc.page.height - 100) {
            doc.addPage();
            // Header table di halaman baru
            const newTableTop = doc.y;
            doc.rect(50, newTableTop - 5, doc.page.width - 100, 25).fill('#f1f5f9');
            doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9);
            let cx = 55;
            columns.forEach(col => {
              doc.text(col.header, cx, newTableTop + 2);
              cx += col.width * 5; 
            });
            doc.font('Helvetica');
            doc.moveDown(1.5);
        }

        if (isEven) {
            doc.rect(50, doc.y - 3, doc.page.width - 100, 18).fill('#f8fafc');
        }
        doc.fillColor('#475569');

        columns.forEach(col => {
            doc.fontSize(8).text(row[col.key] || '-', x, doc.y, { width: col.width * 5, truncate: true });
            x += col.width * 5;
        });
        doc.moveDown(1);
        isEven = !isEven;
    });

    // Footer
    doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill('#f8fafc');
    doc.fillColor('#94a3b8').fontSize(8).text('© 2026 Smart Cattle Barn - Generasi Otomatisasi Terpercaya', 50, doc.page.height - 30, { align: 'center', width: doc.page.width - 100 });

    doc.end();

    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    return { buffer, extension: 'pdf', contentType: 'application/pdf' };

    throw new BadRequestException('Format tidak didukung');
  }
}