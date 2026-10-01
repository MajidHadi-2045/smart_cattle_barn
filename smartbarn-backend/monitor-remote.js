/**
 * MONITOR REMOTE SERVER (CPU, RAM BACKEND & REDIS)
 * Dijalankan di Laptop via Internet untuk memantau metrik VPS secara real-time
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TARGET_API_URL || 'http://smartcattlebarn.site:4000';

function fetchMetrics() {
  const client = BASE_URL.startsWith('https') ? https : http;
  const req = client.get(`${BASE_URL}/api/system/metrics`, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(raw);
        const time = new Date().toLocaleTimeString('id-ID');
        console.log(`[${time}] CPU Backend (${data.processName}): ${data.cpu}%  |  RAM Backend: ${data.memoryMb} MB  |  RAM Redis: ${data.redisMemory}`);
      } catch (e) {
        console.log(`[${new Date().toLocaleTimeString('id-ID')}] Respon tidak valid dari server`);
      }
    });
  });

  req.on('error', (err) => {
    console.log(`[${new Date().toLocaleTimeString('id-ID')}] Gagal menghubungi VPS: ${err.message}`);
  });

  req.setTimeout(3000, () => {
    req.destroy();
  });
}

console.log('=====================================================================');
console.log('REAL-TIME REMOTE MONITORING - SMART CATTLE BARN VPS');
console.log(`Target: ${BASE_URL}/api/system/metrics`);
console.log('=====================================================================');

setInterval(fetchMetrics, 2000);
fetchMetrics();
