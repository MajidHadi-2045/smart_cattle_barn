const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Mencari binary iperf3 lokal di folder backend atau di sistem PATH
 */
function resolveIperfPath() {
  const isWin = os.platform() === 'win32';
  const localWinPath = path.join(__dirname, 'iperf3.exe');
  const localLinuxPath = path.join(__dirname, 'iperf3');

  if (isWin && fs.existsSync(localWinPath)) {
    return `"${localWinPath}"`;
  } else if (!isWin && fs.existsSync(localLinuxPath)) {
    return `"${localLinuxPath}"`;
  }
  return 'iperf3';
}

/**
 * Mengukur Ping RTT (Min, Max, Avg) dan Jitter (ms) dengan 10 paket ICMP
 */
function measurePingAndJitter(targetHost, packetCount = 10) {
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
      const matches = rawOut.matchAll(/time[=<](\d+)ms/gi);
      for (const m of matches) rtts.push(parseFloat(m[1]));
    } else {
      const matches = rawOut.matchAll(/time=([\d.]+)\s*ms/gi);
      for (const m of matches) rtts.push(parseFloat(m[1]));
    }

    if (rtts.length === 0) {
      return { minRtt: 0, maxRtt: 0, avgRtt: 0, jitter: 0, packetLoss: 100, packetsSent: packetCount };
    }

    const minRtt = Math.min(...rtts);
    const maxRtt = Math.max(...rtts);
    const sumRtt = rtts.reduce((a, b) => a + b, 0);
    const avgRtt = parseFloat((sumRtt / rtts.length).toFixed(2));

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
 * Pengukuran Jaringan Berstandar Industri & Akademis menggunakan iPerf3 (L4 Transport Layer)
 * Mengukur: Ping RTT, Jitter (RFC 3550), Packet Loss (%), Download Mbps (TCP Reverse), Upload Mbps (TCP)
 */
function measureIperf3Benchmark(targetHost, options = { duration: 3, udpBitrate: '10M' }) {
  let cleanHost = targetHost.replace(/^https?:\/\//i, '').replace(/:\d+.*$/, '').replace(/\/.*$/, '');
  
  // Jika localhost / 127.0.0.1
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return {
      success: true,
      pingAvgMs: 0.1,
      jitterMs: 0.05,
      packetLossPercent: 0,
      downloadMbps: 1000.0,
      uploadMbps: 1000.0,
      protocol: 'iPerf3 (Loopback)'
    };
  }

  const iperfBin = resolveIperfPath();
  const dur = options.duration || 3;
  const result = {
    success: false,
    pingAvgMs: 0,
    jitterMs: 0,
    packetLossPercent: 0,
    downloadMbps: 0,
    uploadMbps: 0,
    protocol: 'iPerf3'
  };

  // 1. Ambil Latensi RTT Dasar dari Ping ICMP
  const icmp = measurePingAndJitter(cleanHost, 10);
  result.pingAvgMs = icmp.avgRtt;
  result.jitterMs = icmp.jitter;
  result.packetLossPercent = icmp.packetLoss;

  // 2. Uji UDP iPerf3 untuk Jitter & Packet Loss Transmisi Aktif
  try {
    const udpCmd = `${iperfBin} -c ${cleanHost} -u -b ${options.udpBitrate || '10M'} -t 2 -J`;
    const udpOut = execSync(udpCmd, { encoding: 'utf-8', timeout: 15000 });
    const udpJson = JSON.parse(udpOut);
    
    if (udpJson && udpJson.end && udpJson.end.sum) {
      if (typeof udpJson.end.sum.jitter_ms === 'number') {
        result.jitterMs = parseFloat(udpJson.end.sum.jitter_ms.toFixed(2));
      }
      if (typeof udpJson.end.sum.lost_percent === 'number') {
        result.packetLossPercent = parseFloat(udpJson.end.sum.lost_percent.toFixed(2));
      }
    }
  } catch (e) {
    // Fallback ke nilai ICMP jika UDP diblokir
  }

  // 3. Uji Download Throughput via TCP Reverse Mode (-R)
  try {
    const downCmd = `${iperfBin} -c ${cleanHost} -R -t ${dur} -J`;
    const downOut = execSync(downCmd, { encoding: 'utf-8', timeout: 25000 });
    const downJson = JSON.parse(downOut);

    if (downJson && downJson.end) {
      const bps = downJson.end.sum_sent?.bits_per_second || downJson.end.sum_received?.bits_per_second || 0;
      result.downloadMbps = parseFloat((bps / 1000000).toFixed(2));
    }
  } catch (e) {
    result.downloadError = e.message;
  }

  // 4. Uji Upload Throughput via TCP Normal Mode
  try {
    const upCmd = `${iperfBin} -c ${cleanHost} -t ${dur} -J`;
    const upOut = execSync(upCmd, { encoding: 'utf-8', timeout: 25000 });
    const upJson = JSON.parse(upOut);

    if (upJson && upJson.end) {
      const bps = upJson.end.sum_received?.bits_per_second || upJson.end.sum_sent?.bits_per_second || 0;
      result.uploadMbps = parseFloat((bps / 1000000).toFixed(2));
    }
  } catch (e) {
    result.uploadError = e.message;
  }

  result.success = true;
  return result;
}

module.exports = {
  measurePingAndJitter,
  measureIperf3Benchmark,
};
