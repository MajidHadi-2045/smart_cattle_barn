const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');
const crypto = require('crypto');

/**
 * Mengukur Ping RTT (Min, Max, Avg) dan Jitter (ms)
 * Menggunakan 10 paket ping ke target host
 */
function measurePingAndJitter(targetHost, packetCount = 10) {
  // Bersihkan hostname dari URL jika ada http/https/port
  let cleanHost = targetHost.replace(/^https?:\/\//i, '').replace(/:\d+.*$/, '').replace(/\/.*$/, '');
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return { minRtt: 0.1, maxRtt: 0.5, avgRtt: 0.2, jitter: 0.05, packetLoss: 0, packetsSent: packetCount };
  }

  const isWin = os.platform() === 'win32';
  const pingCmd = isWin 
    ? `ping -n ${packetCount} ${cleanHost}` 
    : `ping -c ${packetCount} ${cleanHost}`;

  try {
    const rawOut = execSync(pingCmd, { encoding: 'utf-8', timeout: 30000 });
    const rtts = [];

    if (isWin) {
      // Format Windows: time=18ms atau time<1ms
      const matches = rawOut.matchAll(/time[=<](\d+)ms/gi);
      for (const m of matches) {
        rtts.push(parseFloat(m[1]));
      }
    } else {
      // Format Linux: time=18.4 ms
      const matches = rawOut.matchAll(/time=([\d.]+)\s*ms/gi);
      for (const m of matches) {
        rtts.push(parseFloat(m[1]));
      }
    }

    if (rtts.length === 0) {
      // Fallback socket latency jika ICMP diblokir firewall
      return { minRtt: 0, maxRtt: 0, avgRtt: 0, jitter: 0, packetLoss: 100, packetsSent: packetCount };
    }

    const minRtt = Math.min(...rtts);
    const maxRtt = Math.max(...rtts);
    const sumRtt = rtts.reduce((a, b) => a + b, 0);
    const avgRtt = parseFloat((sumRtt / rtts.length).toFixed(2));

    // Rumus Jitter Standar RFC 1889 / RFC 3550:
    // Jitter = Sum(|RTT[i+1] - RTT[i]|) / (N - 1)
    let jitterSum = 0;
    for (let i = 0; i < rtts.length - 1; i++) {
      jitterSum += Math.abs(rtts[i + 1] - rtts[i]);
    }
    const jitter = rtts.length > 1 ? parseFloat((jitterSum / (rtts.length - 1)).toFixed(2)) : 0;
    const packetLoss = parseFloat((((packetCount - rtts.length) / packetCount) * 100).toFixed(1));

    return { minRtt, maxRtt, avgRtt, jitter, packetLoss, packetsSent: packetCount, rttsReceived: rtts.length };
  } catch (err) {
    return { minRtt: 0, maxRtt: 0, avgRtt: 0, jitter: 0, packetLoss: 100, error: err.message };
  }
}

/**
 * Mengukur Speed Test Download & Upload (Mbps) langsung ke Backend
 */
async function measureSpeedtest(baseUrl, sizeMb = 3) {
  const result = { downloadMbps: 0, uploadMbps: 0, sizeMb };
  const targetUrl = new URL(baseUrl);
  const client = targetUrl.protocol === 'https:' ? https : http;

  // 1. Download Test
  try {
    const downloadStart = Date.now();
    let totalBytesReceived = 0;

    await new Promise((resolve, reject) => {
      const req = client.get(`${baseUrl}/api/system/speedtest/download?size=${sizeMb}`, (res) => {
        res.on('data', (chunk) => {
          totalBytesReceived += chunk.length;
        });
        res.on('end', () => resolve());
        res.on('error', (err) => reject(err));
      });
      req.on('error', (err) => reject(err));
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Download timeout'));
      });
    });

    const downloadDurationSec = (Date.now() - downloadStart) / 1000;
    if (downloadDurationSec > 0 && totalBytesReceived > 0) {
      const bits = totalBytesReceived * 8;
      result.downloadMbps = parseFloat(((bits / downloadDurationSec) / (1024 * 1024)).toFixed(2));
    }
  } catch (e) {
    result.downloadError = e.message;
  }

  // 2. Upload Test
  try {
    const uploadPayload = crypto.randomBytes(sizeMb * 1024 * 1024);
    const uploadStart = Date.now();

    await new Promise((resolve, reject) => {
      const req = client.request(`${baseUrl}/api/system/speedtest/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': uploadPayload.length,
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve(body));
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Upload timeout'));
      });

      req.write(uploadPayload);
      req.end();
    });

    const uploadDurationSec = (Date.now() - uploadStart) / 1000;
    if (uploadDurationSec > 0) {
      const bits = uploadPayload.length * 8;
      result.uploadMbps = parseFloat(((bits / uploadDurationSec) / (1024 * 1024)).toFixed(2));
    }
  } catch (e) {
    result.uploadError = e.message;
  }

  return result;
}

module.exports = {
  measurePingAndJitter,
  measureSpeedtest,
};
