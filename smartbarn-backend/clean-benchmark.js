const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'benchmark_logs');

console.log('=====================================================================');
console.log('PEMBERSIHAN RIWAYAT BENCHMARK - SMART CATTLE BARN');
console.log('=====================================================================');

if (fs.existsSync(logDir)) {
  try {
    fs.rmSync(logDir, { recursive: true, force: true });
    console.log(`[BERHASIL] Seluruh folder riwayat ${logDir} telah dihapus.`);
    console.log('[INFO] Disk space dan memori riwayat pengujian berhasil dikosongkan.');
  } catch (err) {
    console.error(`[GAGAL] Gagal menghapus folder riwayat:`, err.message);
  }
} else {
  console.log('[INFO] Folder benchmark_logs belum ada atau sudah bersih.');
}
console.log('=====================================================================\n');
