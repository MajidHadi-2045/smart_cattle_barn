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
    let ringkasanTeks = '';

    // 2. Tarik Data Sesuai Pilihan (Populasi, Kesehatan, Lingkungan, Pakan, Limbah)
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
          { header: 'Waktu', key: 'timestamp', width: 120 },
          { header: 'Zona', key: 'zone', width: 95 },
          { header: 'Suhu', key: 'temperature', width: 70 },
          { header: 'Kelembapan', key: 'humidity', width: 70 },
          { header: 'Amonia', key: 'ammonia', width: 70 },
          { header: 'THI', key: 'thi', width: 70 },
        ];

        ringkasanTeks = 'Laporan Lingkungan Kandang memuat data sensor real-time (suhu, kelembapan, amonia, dan THI) dari berbagai zona selama periode yang dipilih. Rata-rata parameter lingkungan membantu mendeteksi tingkat stres panas (heat stress) pada ternak secara dini guna menjaga kenyamanan termal sapi.';
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
          { header: 'Tanggal', key: 'createdAt', width: 80 },
          { header: 'ID Sapi', key: 'cattleId', width: 60 },
          { header: 'Diagnosa', key: 'diagnosa', width: 110 },
          { header: 'Penanganan', key: 'penanganan', width: 110 },
          { header: 'Pemeriksa', key: 'pemeriksa', width: 75 },
          { header: 'Status', key: 'status', width: 60 },
        ];

        ringkasanTeks = `Laporan Kesehatan & Medis Ternak mencatat seluruh diagnosis dan penanganan medis oleh dokter hewan. Selama periode ini, tercatat ${rawHealth.length} pemeriksaan kesehatan. Memantau laporan ini sangat penting untuk menekan angka penularan penyakit di kandang.`;
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
          { header: 'ID Sapi', key: 'cattleId', width: 70 },
          { header: 'Breed', key: 'breed', width: 100 },
          { header: 'Gender', key: 'gender', width: 75 },
          { header: 'Berat', key: 'weight', width: 70 },
          { header: 'Zona', key: 'zone', width: 110 },
          { header: 'Status', key: 'status', width: 70 },
        ];

        const totalSehat = rawPop.filter(item => item.status === 'SEHAT').length;
        const totalHamil = rawPop.filter(item => item.status === 'HAMIL').length;
        ringkasanTeks = `Laporan Total Populasi Ternak memberikan gambaran menyeluruh mengenai sebaran jenis sapi, berat badan, serta status kesehatan populasi saat ini. Saat ini, terdapat ${rawPop.length} sapi aktif, dengan rincian status kesehatan: ${totalSehat} Sehat, ${totalHamil} Hamil.`;
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
          { header: 'Waktu', key: 'date', width: 120 },
          { header: 'ID Sapi', key: 'cattleId', width: 90 },
          { header: 'Jenis Pakan', key: 'feedType', width: 95 },
          { header: 'Berat (As-Fed)', key: 'weightKg', width: 100 },
          { header: 'BK', key: 'bkPercent', width: 90 },
        ];

        const totalBeratPakan = rawFeed.reduce((acc, item) => acc + item.weightKg, 0);
        ringkasanTeks = `Laporan Konsumsi Pakan merekam total distribusi pakan (As-Fed) beserta kadar Bahan Kering (BK) untuk pemantauan nutrisi harian. Total pakan yang didistribusikan dalam periode ini adalah ${totalBeratPakan.toFixed(1)} kg. Keseimbangan nutrisi sangat menentukan tingkat pertumbuhan bobot harian sapi.`;
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
          { header: 'Waktu', key: 'date', width: 120 },
          { header: 'Sumber', key: 'source', width: 125 },
          { header: 'Feses Padat', key: 'feces', width: 125 },
          { header: 'Urine Cair', key: 'urine', width: 125 },
        ];

        const totalFeses = rawWaste.reduce((acc, item) => acc + item.fecesKg, 0) + rawZoneWaste.reduce((acc, item) => acc + item.fecesKg, 0);
        const totalUrine = rawWaste.reduce((acc, item) => acc + item.urineL, 0) + rawZoneWaste.reduce((acc, item) => acc + item.urineL, 0);
        ringkasanTeks = `Laporan Manajemen Limbah mencatat akumulasi feses padat dan urine cair yang dihasilkan baik oleh individu sapi maupun zona kandang. Total limbah tercatat pada periode ini: Feses Padat ${totalFeses.toFixed(1)} kg dan Urine Cair ${totalUrine.toFixed(1)} L. Berguna untuk perencanaan pengolahan biogas dan pupuk organik.`;
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

    // 5. Query Metadata Populasi Ternak untuk Summary Card
    const totalSapi = await this.prisma.livestock.count();
    const breedData = await this.prisma.livestock.groupBy({
      by: ['breed'],
      _count: {
        id: true,
      },
    });
    const breedSummary = breedData.map((b) => `${b.breed} (${b._count.id} ekor)`).join(', ');

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
    doc.moveDown(1.5);

    // Summary Card Box
    const summaryTop = doc.y;
    const cardHeight = 105;
    
    // Draw card background
    doc.rect(50, summaryTop, doc.page.width - 100, cardHeight).fill('#f8fafc');
    doc.rect(50, summaryTop, 4, cardHeight).fill('#0ea5e9'); // Left blue accent border
    
    // Draw text inside the card
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('RINGKASAN & INFORMASI POPULASI', 65, summaryTop + 10);
    
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569');
    doc.text('Total Populasi Sapi:', 65, summaryTop + 26);
    doc.font('Helvetica').text(`${totalSapi} Ekor`, 180, summaryTop + 26);

    doc.font('Helvetica-Bold').text('Sebaran Jenis (Breed):', 65, summaryTop + 40);
    doc.font('Helvetica').text(breedSummary || '-', 180, summaryTop + 40, { width: doc.page.width - 240 });

    doc.font('Helvetica-Bold').text('Ringkasan Laporan:', 65, summaryTop + 58);
    doc.font('Helvetica').fillColor('#64748b').text(ringkasanTeks, 180, summaryTop + 58, { width: doc.page.width - 240, align: 'justify' });

    doc.y = summaryTop + cardHeight + 20;

    // Table Header
    const tableTop = doc.y;
    doc.rect(50, tableTop - 5, doc.page.width - 100, 25).fill('#f1f5f9');
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9);
    let currentX = 55;
    columns.forEach(col => {
      doc.text(col.header, currentX, tableTop + 2, { width: col.width - 5, lineBreak: false } as any);
      currentX += col.width; 
    });
    doc.font('Helvetica');
    doc.y = tableTop + 20;
    
    // Rows
    let isEven = false;
    data.forEach((row) => {
        let x = 55;
        const rowY = doc.y;
        
        if (rowY > doc.page.height - 100) {
            doc.addPage();
            // Header table di halaman baru
            const newTableTop = doc.y;
            doc.rect(50, newTableTop - 5, doc.page.width - 100, 25).fill('#f1f5f9');
            doc.fillColor('#334155').font('Helvetica-Bold').fontSize(9);
            let cx = 55;
            columns.forEach(col => {
              doc.text(col.header, cx, newTableTop + 2, { width: col.width - 5, lineBreak: false } as any);
              cx += col.width; 
            });
            doc.font('Helvetica');
            doc.y = newTableTop + 20;
        }

        const y = doc.y;
        if (isEven) {
            doc.rect(50, y - 3, doc.page.width - 100, 18).fill('#f8fafc');
        }
        doc.fillColor('#475569');

        columns.forEach(col => {
            doc.fontSize(8).text(row[col.key] || '-', x, y, { width: col.width - 5, lineBreak: false } as any);
            x += col.width;
        });
        doc.y = y + 15;
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
  }
}