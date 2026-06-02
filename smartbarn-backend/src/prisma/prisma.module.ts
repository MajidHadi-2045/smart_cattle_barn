import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Tambahkan @Global agar PrismaService bisa diakses di semua modul (Auth, Livestock, dll)
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // <--- INI BAGIAN PALING PENTING YANG HILANG
})
export class PrismaModule {}