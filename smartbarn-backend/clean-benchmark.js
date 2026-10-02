const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'benchmark_logs');

console.log('=====================================================================');
console.log('PEMBERSIHAN RIWAYAT BENCHMARK - SMART CATTLE BARN');
console.log('=====================================================================');

function cleanDirectoryRecursively(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const curPath = path.join(dir, file);
    try {
      if (fs.lstatSync(curPath).isDirectory()) {
        cleanDirectoryRecursively(curPath);
        fs.rmdirSync(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    } catch (err) {
      console.warn(`[PERINGATAN] Tidak dapat menghapus ${file}: ${err.message}`);
    }
  }
}

if (fs.existsSync(logDir)) {
  try {
    fs.rmSync(logDir, { recursive: true, force: true });
    console.log(`[BERHASIL] Seluruh folder riwayat ${logDir} telah dihapus.`);
    console.log('[INFO] Disk space dan checkpoint pengujian berhasil dikosongkan.');
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      console.log('\n[INFO] File summary_results.csv sedang dibuka di Microsoft Excel atau editor lain.');
      console.log('-> Melakukan pembersihan file checkpoint dan log output...');
      cleanDirectoryRecursively(logDir);
      console.log('\n[PANDUAN] Silakan TUTUP Microsoft Excel atau tab file CSV, lalu jalankan kembali:');
      console.log('         node clean-benchmark.js\n');
    } else {
      console.error(`[GAGAL] Gagal menghapus folder riwayat:`, err.message);
    }
  }
} else {
  console.log('[INFO] Folder benchmark_logs belum ada atau sudah bersih.');
}
console.log('=====================================================================\n');
