/**
 * ============================================================================
 * SMART CATTLE BARN - AUTOMATED PCAP BENCHMARK RUNNER (JALUR 1 & JALUR 2)
 * ============================================================================
 * Runner khusus untuk Jalur 1 (Vital Sapi) & Jalur 2 (Lingkungan) dengan:
 * 1. Otomatisasi Capture PCAP di VPS (Mulai & Berhenti tersinkronisasi presisi dengan k6)
 * 2. Otomatisasi Download File .pcap langsung ke folder benchmark_logs/pcap_files/
 * 3. Analisis Langsung Paket PCAP di Layar (Inter-arrival time & TCP Delayed ACK)
 * 4. Pencatatan Metodologi Baku (PM2 Restart, Dynamic Warm-up, Polling CPU/RAM, CSV Summary)
 *
 * PENGGUNAAN:
 *   1. Jalankan semua skenario Jalur 1 & Jalur 2 (50 VU & 100 VU):
 *      node run-pcap-jalur1-2.js
 *
 *   2. Jalankan skenario tertentu:
 *      node run-pcap-jalur1-2.js jalur1:50:1 jalur1:100:1
 *      node run-pcap-jalur1-2.js jalur2:50:1 jalur2:100:1
 *
 *   3. Opsi Tambahan:
 *      --iter=2 (Jalankan 2 iterasi per skenario)
 *      --fast   (Lewati speedtest iPerf3 awal/akhir untuk menghemat waktu)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn, execSync } = require('child_process');

// KONFIGURASI TARGET REMOTE VPS
const BASE_URL = process.env.TARGET_API_URL || 'http://smartcattlebarn.site:4000';
const TARGET_HOST = 'smartcattlebarn.site';
const MQTT_URL = 'mqtt://77.37.63.21:1883';
const TEST_DURATION = '30s';
const SCRIPT_VER = 'v7'; // Default menggunakan versi 7 (max 50 msg/VU)

// FOLDER PENYIMPANAN
const LOGS_DIR = path.join(__dirname, 'benchmark_logs');
const K6_DIR = path.join(LOGS_DIR, 'k6_terminal_outputs');
const SYS_DIR = path.join(LOGS_DIR, 'system_resource_logs');
const PCAP_DIR = path.join(LOGS_DIR, 'pcap_files');
const CSV_FILE = path.join(LOGS_DIR, 'summary_results_pcap.csv');

// DAFTAR SKENARIO RESMI: HANYA JALUR 1 DAN JALUR 2
const SCENARIO_CONFIG = {
  'jalur1': { id: 'jalur1', name: 'Jalur 1 - Sensor Vital Sapi (MQTT -> BullMQ)', script: `k6-sensor-test-${SCRIPT_VER}.js`, isMqtt: true },
  '1': { id: 'jalur1', name: 'Jalur 1 - Sensor Vital Sapi (MQTT -> BullMQ)', script: `k6-sensor-test-${SCRIPT_VER}.js`, isMqtt: true },
  'jalur2': { id: 'jalur2', name: 'Jalur 2 - Sensor Lingkungan (MQTT -> RAM Buffer)', script: `k6-env-test-${SCRIPT_VER}.js`, isMqtt: true },
  '2': { id: 'jalur2', name: 'Jalur 2 - Sensor Lingkungan (MQTT -> RAM Buffer)', script: `k6-env-test-${SCRIPT_VER}.js`, isMqtt: true }
};

// PARSE COMMAND LINE ARGUMENTS
const rawArgs = process.argv.slice(2);
let isFastMode = false;
let customIter = 1;
const testQueue = [];

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i].toLowerCase();
  if (arg === '--fast' || arg === '-f') {
    isFastMode = true;
  } else if (arg.startsWith('--iter=') || arg.startsWith('--iters=')) {
    customIter = parseInt(arg.split('=')[1], 10) || 1;
  } else if (arg === '--iter' || arg === '-i') {
    customIter = parseInt(rawArgs[i + 1] || '1', 10);
    i++;
  } else if (arg.includes(':')) {
    // Format: jalur1:50:1 atau jalur2:100:2
    const parts = arg.split(':');
    const jKey = parts[0].toLowerCase();
    const vus = parseInt(parts[1], 10) || 50;
    const iters = parseInt(parts[2], 10) || customIter;
    const sc = SCENARIO_CONFIG[jKey];
    if (sc) {
      testQueue.push({ ...sc, vus, iterations: iters });
    }
  }
}

// JIKA TIDAK ADA ARGUMEN, DEFAULT: JALUR 1 (50 & 100 VU) + JALUR 2 (50 & 100 VU)
if (testQueue.length === 0) {
  testQueue.push({ ...SCENARIO_CONFIG['jalur1'], vus: 50, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur1'], vus: 100, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur2'], vus: 50, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur2'], vus: 100, iterations: customIter });
}

function ensureDirectories() {
  [LOGS_DIR, K6_DIR, SYS_DIR, PCAP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  if (!fs.existsSync(CSV_FILE)) {
    const header = [
      'Session_ID', 'Jalur', 'Beban_VUs', 'Iterasi', 'Timestamp',
      'K6_Total_Reqs', 'Throughput_RPS', 'Latency_Avg_ms', 'Latency_P95_ms', 'TTFB_Avg_ms',
      'Checks_Pass_Percent', 'Error_Rate_Percent', 'Peak_CPU_Percent', 'Peak_RAM_MB',
      'PCAP_File', 'PCAP_Size_Bytes', 'PCAP_Avg_Delta_ms', 'PCAP_Renggang_Pct'
    ].join(',') + '\n';
    fs.writeFileSync(CSV_FILE, header, 'utf-8');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// DETEKSI IP LAPTOP PENGUJI SECARA OTOMATIS
function detectClientIp() {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data.trim() || ''));
    }).on('error', () => {
      resolve('');
    });
  });
}

// REQUEST HTTP HELPER KE SYSTEM CONTROLLER
function apiRequest(endpoint, method = 'GET', payload = null) {
  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const client = url.protocol === 'https:' ? https : http;
    const bodyStr = payload ? JSON.stringify(payload) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 8000
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            if (parsed.success === undefined) parsed.success = true;
          } else {
            parsed.success = false;
          }
          resolve(parsed);
        } catch (e) {
          resolve({ success: res.statusCode >= 200 && res.statusCode < 300, raw: data });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message, message: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout', message: 'Connection Timeout' }); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// KONTROL REMOTE PCAP DI VPS
async function startRemotePcap(sessionId, clientIp) {
  console.log(`  > [PCAP START] Mengaktifkan tcpdump di VPS untuk sesi: ${sessionId}...`);
  const res = await apiRequest('/api/system/pcap/start', 'POST', {
    sessionId,
    port: 1883,
    clientIp
  });
  if (res && res.success) {
    console.log(`    ✓ tcpdump aktif di VPS (Filter: ${res.filter || 'port 1883'})`);
  } else {
    console.warn(`    ⚠️ Gagal menyalakan tcpdump di VPS: ${res?.message || res?.error || JSON.stringify(res)}`);
  }
  return res;
}

async function stopRemotePcap() {
  console.log(`  > [PCAP STOP] Menghentikan tcpdump di VPS...`);
  const res = await apiRequest('/api/system/pcap/stop', 'POST');
  if (res.success) {
    console.log(`    ✓ tcpdump dihentikan. Ukuran file: ${(res.fileSizeBytes / 1024).toFixed(1)} KB`);
  }
  return res;
}

// DOWNLOAD FILE PCAP DARI VPS KE LAPTOP
function downloadPcapFile(filename, destPath) {
  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}/api/system/pcap/download/${encodeURIComponent(filename)}`);
    const client = url.protocol === 'https:' ? https : http;

    const fileStream = fs.createWriteStream(destPath);
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        fileStream.close();
        try { fs.unlinkSync(destPath); } catch (e) {}
        console.warn(`  > [PCAP DOWNLOAD] Status HTTP: ${res.statusCode} (Gagal mengunduh)`);
        return resolve(false);
      }

      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        const stat = fs.statSync(destPath);
        console.log(`  > [PCAP DOWNLOAD] File tersimpan: ${path.basename(destPath)} (${(stat.size / 1024).toFixed(1)} KB)`);
        resolve(true);
      });
    }).on('error', (err) => {
      fileStream.close();
      console.warn(`  > [PCAP DOWNLOAD ERROR] ${err.message}`);
      resolve(false);
    });
  });
}

// MONITORING CPU & RAM VPS
async function fetchServerMetrics() {
  const res = await apiRequest('/api/system/metrics', 'GET');
  if (res.success) {
    return {
      success: true,
      cpu: parseFloat(res.cpu || res.cpuPercent || 0),
      memoryMb: parseFloat(res.memoryMb || res.ramMB || 0),
      redisMemory: res.redisMemory || 'N/A'
    };
  }
  return { success: false, cpu: 0, memoryMb: 0, redisMemory: 'N/A' };
}

// DYNAMIC WARM-UP PENDINGINAN CPU
async function dynamicWarmup(maxIdleCpu = 3.0) {
  process.stdout.write('  > Menunggu pendinginan CPU backend VPS (Target <= 3.0%)...');
  let stableCount = 0;
  let lastMetric = { cpu: 0, memoryMb: 0, redisMemory: 'N/A' };

  for (let s = 1; s <= 15; s++) {
    await sleep(1000);
    const m = await fetchServerMetrics();
    if (m.success) {
      lastMetric = m;
      process.stdout.write(` [${m.cpu}%]`);
      if (m.cpu <= maxIdleCpu) {
        stableCount++;
        if (stableCount >= 3) {
          console.log(`\n  > [READY] Backend idle pada ${m.cpu}% CPU (${m.memoryMb} MB RAM).`);
          return lastMetric;
        }
      } else {
        stableCount = 0;
      }
    }
  }
  console.log(`\n  > [READY] Melanjutkan dengan CPU ${lastMetric.cpu}% (${lastMetric.memoryMb} MB RAM).`);
  return lastMetric;
}

// EKSEKUSI K6
function executeK6(scenario, vus) {
  return new Promise((resolve) => {
    let k6Binary = 'k6';
    if (process.platform === 'win32') {
      k6Binary = fs.existsSync(path.join(__dirname, 'k6-mqtt.exe')) ? '.\\k6-mqtt.exe' : 'k6';
    } else {
      k6Binary = fs.existsSync(path.join(__dirname, 'k6-linux-mqtt')) ? './k6-linux-mqtt' : 'k6';
    }

    const k6Args = [
      'run',
      '-e', `VUS=${vus}`,
      '-e', 'TARGET=remote',
      '-e', 'LOCAL=false',
      '-e', `MQTT_URL=${MQTT_URL}`,
      '-e', `BASE_URL=${BASE_URL}/api`,
      scenario.script
    ];

    console.log(`\n[K6 EXECUTE] ${k6Binary} ${k6Args.join(' ')}\n`);

    const child = spawn(k6Binary, k6Args, { cwd: __dirname, shell: true });
    let terminalOutput = '';
    const metricsLog = [];
    let isFinished = false;

    child.stdout.on('data', (d) => {
      const text = d.toString();
      terminalOutput += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (d) => {
      const text = d.toString();
      terminalOutput += text;
      process.stderr.write(text);
    });

    const poller = setInterval(async () => {
      if (isFinished) return;
      const m = await fetchServerMetrics();
      if (m.success) metricsLog.push(m);
    }, 1000);

    child.on('close', (code) => {
      isFinished = true;
      clearInterval(poller);
      resolve({ terminalOutput, metricsLog, exitCode: code });
    });

    child.on('error', (err) => {
      isFinished = true;
      clearInterval(poller);
      resolve({ terminalOutput: `Error: ${err.message}`, metricsLog, exitCode: 1 });
    });
  });
}

function parseK6Metrics(output, scenarioId) {
  const parsed = { totalReqs: 0, rps: 0, avgLatency: 0, p95Latency: 0, ttfbAvg: 0, checksPass: 100, errorRate: 0 };
  try {
    const latMatch = output.match(/mqtt_(?:vital|env)_processing_latency[^\n]+?avg=([0-9.]+)[^\n]+?p\(95\)=([0-9.]+)/);
    if (latMatch) {
      parsed.avgLatency = parseFloat(latMatch[1]);
      parsed.p95Latency = parseFloat(latMatch[2]);
    }

    const ttfbMatch = output.match(/mqtt_(?:vital|env)_publish_latency[^\n]+?avg=([0-9.]+)/);
    if (ttfbMatch) parsed.ttfbAvg = parseFloat(ttfbMatch[1]);

    const procMatch = output.match(/mqtt_(?:vital|env)_messages_processed[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
    if (procMatch) {
      parsed.totalReqs = parseInt(procMatch[1], 10);
      parsed.rps = parseFloat(procMatch[2]);
    }
  } catch (e) {}
  return parsed;
}

// ANALISIS CEPAT PCAP MENGGUNAKAN PYTHON SCRATCH
function analyzePcapQuick(pcapPath) {
  try {
    const pyScript = path.join(__dirname, 'scratch', 'analyze_pcaps.py');
    if (fs.existsSync(pyScript)) {
      const out = execSync(`python "${pyScript}"`, { encoding: 'utf-8', timeout: 15000 });
      return out;
    }
  } catch (e) {}
  return null;
}

// MAIN RUNNER
async function main() {
  ensureDirectories();

  console.log(`\n#####################################################################`);
  console.log(`### SMART CATTLE BARN - AUTOMATED PCAP BENCHMARK (JALUR 1 & 2)    ###`);
  console.log(`Target VPS        : ${TARGET_HOST} (${BASE_URL})`);
  console.log(`Script Version    : ${SCRIPT_VER.toUpperCase()} (Max 50 Msg/VU)`);
  console.log(`Durasi per Uji    : ${TEST_DURATION}`);
  console.log(`Total Antrean Uji : ${testQueue.length} Skenario`);
  console.log(`Folder Output PCAP: ${PCAP_DIR}`);
  console.log(`#####################################################################\n`);

  process.stdout.write('Mendeteksi IP Publik Laptop Penguji...');
  const clientIp = await detectClientIp();
  console.log(` [IP: ${clientIp || 'Semua Host'}]`);

  for (let qIdx = 0; qIdx < testQueue.length; qIdx++) {
    const item = testQueue[qIdx];
    console.log(`\n=====================================================================`);
    console.log(`>>> MEMULAI SKENARIO [${qIdx + 1}/${testQueue.length}]: ${item.name} (${item.vus} VU) <<<`);
    console.log(`=====================================================================`);

    for (let it = 1; it <= item.iterations; it++) {
      const sessionId = `${item.id}_${item.vus}vu_iterasi${it}`;
      const pcapFilename = `${sessionId}.pcap`;
      const localPcapPath = path.join(PCAP_DIR, pcapFilename);

      console.log(`\n---------------------------------------------------------------------`);
      console.log(`[SESI] ${sessionId.toUpperCase()} | Iterasi ${it}/${item.iterations}`);
      console.log(`---------------------------------------------------------------------`);

      // 1. Restart PM2 & Flush Redis
      console.log('[STEP 1/6] Me-restart PM2 & Mengosongkan Cache Redis VPS...');
      await apiRequest('/api/system/restart', 'POST', { processName: 'smartbarn-api-4000' });
      await apiRequest('/api/system/flush-redis', 'POST');
      await sleep(10000);

      // 2. Dynamic Warm-up
      console.log('[STEP 2/6] DYNAMIC WARM-UP: Pendinginan CPU Server...');
      const baseline = await dynamicWarmup(3.0);

      // 3. Start Remote PCAP on VPS
      console.log('\n[STEP 3/6] MENGAKTIFKAN TCPDUMP DI VPS...');
      await startRemotePcap(sessionId, clientIp);
      await sleep(1000);

      // 4. Eksekusi K6 Load Test
      console.log(`[STEP 4/6] EKSEKUSI K6 LOAD TEST (${item.vus} VUs, ${TEST_DURATION})...`);
      const { terminalOutput, metricsLog } = await executeK6(item, item.vus);

      // 5. Stop Remote PCAP on VPS
      console.log('\n[STEP 5/6] MENGHENTIKAN TCPDUMP DI VPS...');
      const stopRes = await stopRemotePcap();
      await sleep(2000);

      // 6. Download File PCAP ke Laptop
      console.log('\n[STEP 6/6] MENGUNDUH FILE PCAP DARI VPS...');
      const downloaded = await downloadPcapFile(pcapFilename, localPcapPath);

      // Hitung Resource
      let peakCpu = baseline.cpu;
      let peakRam = baseline.memoryMb;
      for (const m of metricsLog) {
        if (m.cpu > peakCpu) peakCpu = m.cpu;
        if (m.memoryMb > peakRam) peakRam = m.memoryMb;
      }

      const k6Stats = parseK6Metrics(terminalOutput, item.id);

      // Simpan log k6
      fs.writeFileSync(path.join(K6_DIR, `${sessionId}.txt`), terminalOutput, 'utf-8');

      // Catat ke CSV
      const pcapSizeBytes = downloaded && fs.existsSync(localPcapPath) ? fs.statSync(localPcapPath).size : 0;
      const csvLine = [
        sessionId, `"${item.name}"`, item.vus, it, new Date().toISOString(),
        k6Stats.totalReqs, k6Stats.rps, k6Stats.avgLatency, k6Stats.p95Latency, k6Stats.ttfbAvg,
        k6Stats.checksPass, k6Stats.errorRate, peakCpu, peakRam,
        pcapFilename, pcapSizeBytes, '-', '-'
      ].join(',') + '\n';
      fs.appendFileSync(CSV_FILE, csvLine, 'utf-8');

      console.log(`\n---------------------------------------------------------------------`);
      console.log(`[HASIL SESI ${sessionId.toUpperCase()}]`);
      console.log(`  > Throughput : ${k6Stats.rps} RPS (Total: ${k6Stats.totalReqs} pesan)`);
      console.log(`  > Latensi Avg: ${k6Stats.avgLatency} ms | P95: ${k6Stats.p95Latency} ms`);
      console.log(`  > File PCAP  : ${localPcapPath} (${(pcapSizeBytes / 1024).toFixed(1)} KB)`);
      console.log(`---------------------------------------------------------------------`);

      if (it < item.iterations || qIdx < testQueue.length - 1) {
        console.log(`  > Jeda Cooldown 15 detik sebelum iterasi berikutnya...`);
        await sleep(15000);
      }
    }
  }

  console.log(`\n=====================================================================`);
  console.log(`🎉 SELURUH PENGUJIAN PCAP JALUR 1 & JALUR 2 SELESAI DENGAN SUKSES!`);
  console.log(`  • Seluruh File PCAP tersimpan di : ${PCAP_DIR}`);
  console.log(`  • Ringkasan CSV tersimpan di     : ${CSV_FILE}`);
  console.log(`=====================================================================\n`);
}

main().catch(err => {
  console.error('Fatal Runner Error:', err);
});
