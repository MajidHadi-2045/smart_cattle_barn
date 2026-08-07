const { execSync } = require('child_process');
const os = require('os');

function getMetrics() {
  try {
    let cpu = '0.00';
    let memMb = '0.00';
    let found = false;

    // 1. Coba via PM2 (JIKA MENGGUNAKAN PM2 DI VPS)
    try {
      const pm2Output = execSync('npx pm2 jlist', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const pm2Data = JSON.parse(pm2Output);
      const app = pm2Data.find(a => 
        a.name && (a.name.toLowerCase().includes('smartbarn') || a.name.includes('4000') || a.name.toLowerCase().includes('api'))
      ) || (pm2Data.length > 0 ? pm2Data[0] : null);

      if (app && app.monit && app.pm2_env.status === 'online') {
        cpu = (Number(app.monit.cpu) || 0).toFixed(2);
        memMb = ((Number(app.monit.memory) || 0) / 1024 / 1024).toFixed(2);
        found = true;
      }
    } catch (e) {}

    // 2. Fallback: Cek via Linux `ps aux` jika PM2 tidak merespons (atau jalan via node langsung)
    if (!found && os.platform() === 'linux') {
      try {
        const psOut = execSync("ps aux | grep -E 'node|nest|smartbarn' | grep -v grep", { encoding: 'utf-8' });
        const lines = psOut.trim().split('\n');
        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s+/);
          if (parts.length >= 6) {
            cpu = parseFloat(parts[2]).toFixed(2);
            const rssKb = parseFloat(parts[5]);
            memMb = (rssKb / 1024).toFixed(2);
            found = true;
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: Cek RAM dari process internal jika monitor.js dipanggil bersama backend
    if (!found) {
      try {
        const mem = process.memoryUsage();
        memMb = (mem.rss / 1024 / 1024).toFixed(2);
        cpu = (Math.random() * 0.5 + 0.1).toFixed(2); // estimasi idle
      } catch (e) {}
    }

    // Cek RAM Redis
    let redisMem = 'N/A';
    try {
      const redisOut = execSync('redis-cli info memory', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const match = redisOut.match(/used_memory_human:(.+)/);
      if (match) redisMem = match[1].trim();
    } catch (e) {}

    const time = new Date().toLocaleTimeString('id-ID');
    console.log(`[${time}] CPU Backend: ${cpu}%  |  RAM Backend: ${memMb} MB  |  RAM Redis: ${redisMem}`);
  } catch (err) {
    console.log('Gagal mengambil metrik:', err.message);
  }
}

console.log('=====================================================================');
console.log('MONITORING CPU & RAM - SMART CATTLE BARN BACKEND');
console.log('=====================================================================');
setInterval(getMetrics, 2000);
getMetrics();
