const { execSync } = require('child_process');

function getMetrics() {
  try {
    let cpu = '0';
    let memMb = '0';

    try {
      const pm2Output = execSync('npx pm2 jlist', { encoding: 'utf-8' });
      const pm2Data = JSON.parse(pm2Output);
      const app = pm2Data.find(a => a.name.includes('smartbarn') || a.name.includes('4000')) || pm2Data[0];
      if (app && app.monit) {
        cpu = app.monit.cpu;
        memMb = (app.monit.memory / 1024 / 1024).toFixed(1);
      }
    } catch (e) {
      // Fallback jika pm2 jlist tidak ada
    }

    let redisMem = 'N/A';
    try {
      const redisOut = execSync('redis-cli info memory', { encoding: 'utf-8' });
      const match = redisOut.match(/used_memory_human:(.+)/);
      if (match) redisMem = match[1].trim();
    } catch(e) {}

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
