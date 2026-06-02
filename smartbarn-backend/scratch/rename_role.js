const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Role Update: KANDANG -> STAFF ---');
  
  try {
    // 1. Tambahkan STAFF ke Enum Role (jika belum ada di tingkat DB)
    // Catatan: ALTER TYPE tidak bisa dijalankan dalam transaksi di beberapa versi Postgres
    console.log('Menambahkan nilai STAFF ke Enum Role...');
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF'`);
    
    // 2. Update semua user yang masih memiliki role KANDANG
    console.log('Mengubah role user dari KANDANG ke STAFF...');
    const result = await prisma.$executeRawUnsafe(`UPDATE "User" SET role = 'STAFF' WHERE role::text = 'KANDANG'`);
    console.log(`Berhasil memperbarui ${result} user.`);

    // 3. (Opsional) Hapus KANDANG dari Enum? 
    // Postgres tidak mendukung penghapusan value enum dengan mudah. 
    // Biarkan saja, yang penting data sudah migrasi.

    console.log('Migrasi data selesai!');
  } catch (error) {
    console.error('Terjadi kesalahan saat migrasi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
