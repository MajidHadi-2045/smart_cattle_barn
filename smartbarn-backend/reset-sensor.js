const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetSensors() {
  try {
    console.log('Menghapus data sensor lama...');
    
    // Hapus data detak jantung & suhu sapi
    const deleteVitals = await prisma.livestockVital.deleteMany();
    console.log(`- Terhapus ${deleteVitals.count} data Vital Sapi`);

    // Hapus data lingkungan (Suhu ruangan, kelembaban, amonia)
    const deleteEnv = await prisma.environmentData.deleteMany();
    console.log(`- Terhapus ${deleteEnv.count} data Lingkungan`);

    // Hapus data sirkulasi udara (Kecepatan angin)
    const deleteWind = await prisma.airCirculation.deleteMany();
    console.log(`- Terhapus ${deleteWind.count} data Sirkulasi Udara`);

    console.log('\nBerhasil! Semua data sensor telah di-reset menjadi kosong (0).');
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetSensors();
