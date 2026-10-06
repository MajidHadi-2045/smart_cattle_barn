/**
 * FLUSH REDIS REMOTE VPS
 * Dijalankan dari laptop CMD untuk mengosongkan RAM Redis di Server VPS via HTTP API
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TARGET_API_URL || 'http://smartcattlebarn.site:4000';

function flushRemoteRedis() {
  console.log('=====================================================================');
  console.log('FLUSH REDIS CACHE - REMOTE VPS');
  console.log(`Target: ${BASE_URL}/api/system/flush-redis`);
  console.log('=====================================================================\n');

  const client = BASE_URL.startsWith('https') ? https : http;
  const req = client.request(`${BASE_URL}/api/system/flush-redis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(raw);
        if (data.success) {
          console.log(`✅ SUCCESS: ${data.message}`);
          console.log('RAM Redis di VPS sekarang sudah bersih murni (~1.5 MB).');
        } else {
          console.log(`⚠️ FAILED: ${data.message}`);
        }
      } catch (e) {
        console.log(`❌ ERROR: Respon server tidak valid.`);
      }
    });
  });

  let isDestroyed = false;

  req.on('error', (err) => {
    if (!isDestroyed) {
      console.log(`❌ ERROR: Gagal menghubungi server VPS: ${err.message}`);
    }
  });

  req.setTimeout(10000, () => {
    isDestroyed = true;
    req.destroy();
    console.log(`❌ ERROR: Request timeout ke VPS (Pastikan VPS sudah di-update dengan git pull & npm run build).`);
  });

  req.end();
}

flushRemoteRedis();
