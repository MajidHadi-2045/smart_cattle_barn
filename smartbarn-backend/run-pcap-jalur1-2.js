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
const { measureIperf3Benchmark } = require('./benchmark-network-utils');

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
let isResumeMode = false;
let customIter = 1;
const testQueue = [];

function parseIterations(str, defaultIter = 1) {
  if (!str) return { start: 1, end: defaultIter, count: defaultIter };
  const s = String(str).trim();
  if (s.includes('..')) {
    const p = s.split('..');
    const start = parseInt(p[0], 10) || 1;
    const end = parseInt(p[1], 10) || start;
    return { start: Math.min(start, end), end: Math.max(start, end), count: Math.abs(end - start) + 1 };
  }
  if (s.includes('-')) {
    const p = s.split('-');
    const start = parseInt(p[0], 10) || 1;
    const end = parseInt(p[1], 10) || start;
    return { start: Math.min(start, end), end: Math.max(start, end), count: Math.abs(end - start) + 1 };
  }
  const count = parseInt(s, 10) || defaultIter;
  return { start: 1, end: count, count };
}

let include200 = false;

// First pass: extract global flags like --iter, --fast, --resume, --200
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i].toLowerCase();
  if (arg === '--fast' || arg === '-f') {
    isFastMode = true;
  } else if (arg === '--resume' || arg === '-r') {
    isResumeMode = true;
  } else if (arg === '--200' || arg === '--include-200') {
    include200 = true;
  } else if (arg.startsWith('--iter=') || arg.startsWith('--iters=')) {
    customIter = parseInt(arg.split('=')[1], 10) || 1;
  } else if (arg === '--iter' || arg === '-i') {
    customIter = parseInt(rawArgs[i + 1] || '1', 10);
    i++;
  }
}

// Second pass: extract target scenarios
for (let i = 0; i < rawArgs.length; i++) {
  const rawArg = rawArgs[i];
  if (rawArg.startsWith('--') || rawArg.startsWith('-')) continue;

  const subArgs = rawArg.split(',').map(s => s.trim()).filter(Boolean);
  for (const arg of subArgs) {
    const low = arg.toLowerCase();
    if (low.includes(':')) {
      // Format: jalur1:50:6, jalur2:100:1-6, atau jalur1:50 (menggunakan default / customIter)
      const parts = low.split(':');
      const jKey = parts[0];
      const vus = parseInt(parts[1], 10) || 50;
      const itObj = parseIterations(parts[2], customIter);
      const sc = SCENARIO_CONFIG[jKey];
      if (sc) {
        testQueue.push({ ...sc, vus, startIter: itObj.start, endIter: itObj.end, iterations: itObj.count });
      }
    } else {
      // Format tanpa titik dua: misal 'jalur1'
      const sc = SCENARIO_CONFIG[low];
      if (sc) {
        testQueue.push({ ...sc, vus: 50, startIter: 1, endIter: customIter, iterations: customIter });
        testQueue.push({ ...sc, vus: 100, startIter: 1, endIter: customIter, iterations: customIter });
      }
    }
  }
}

// JIKA TIDAK ADA SKENARIO DITENTUKAN, DEFAULT: JALUR 1 (10, 50, 100 VU) + JALUR 2 (10, 50, 100 VU)
if (testQueue.length === 0) {
  testQueue.push({ ...SCENARIO_CONFIG['jalur1'], vus: 10, startIter: 1, endIter: customIter, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur1'], vus: 50, startIter: 1, endIter: customIter, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur1'], vus: 100, startIter: 1, endIter: customIter, iterations: customIter });
  if (include200) testQueue.push({ ...SCENARIO_CONFIG['jalur1'], vus: 200, startIter: 1, endIter: customIter, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur2'], vus: 10, startIter: 1, endIter: customIter, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur2'], vus: 50, startIter: 1, endIter: customIter, iterations: customIter });
  testQueue.push({ ...SCENARIO_CONFIG['jalur2'], vus: 100, startIter: 1, endIter: customIter, iterations: customIter });
  if (include200) testQueue.push({ ...SCENARIO_CONFIG['jalur2'], vus: 200, startIter: 1, endIter: customIter, iterations: customIter });
}

function ensureDirectories() {
  [LOGS_DIR, K6_DIR, SYS_DIR, PCAP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  if (!fs.existsSync(CSV_FILE)) {
    const header = [
      'Session_ID', 'Jalur', 'Beban_VUs', 'Iterasi', 'Timestamp',
      'Pre_Ping_Avg_ms', 'Pre_Jitter_ms', 'Pre_Loss_Percent', 'Pre_Down_Mbps', 'Pre_Up_Mbps',
      'Baseline_CPU_Percent', 'Baseline_RAM_MB', 'Baseline_RAM_Redis',
      'K6_Total_Reqs', 'Throughput_RPS',
      'Latency_Min_ms', 'Latency_Med_ms', 'Latency_Avg_ms', 'Latency_P90_ms', 'Latency_P95_ms', 'Latency_Max_ms',
      'TTFB_Avg_ms', 'Checks_Pass_Percent', 'Error_Rate_Percent',
      'Peak_CPU_Percent', 'Peak_RAM_MB', 'Peak_RAM_Redis',
      'Post_Ping_Avg_ms', 'Post_Jitter_ms', 'Post_Loss_Percent', 'Post_Down_Mbps', 'Post_Up_Mbps',
      'PCAP_File', 'PCAP_Size_Bytes'
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
      '-e', 'FULL_VU=true',
      '-e', 'INTERVAL_MS=1000',
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
  const parsed = {
    totalReqs: 0,
    rps: 0,
    minLatency: 0,
    medLatency: 0,
    avgLatency: 0,
    p90Latency: 0,
    p95Latency: 0,
    maxLatency: 0,
    ttfbAvg: 0,
    checksPass: 100,
    errorRate: 0
  };
  try {
    const latMatch = output.match(/mqtt_(?:vital|env)_processing_latency[^\n]+?avg=([0-9.]+)[^\n]+?min=([0-9.]+)[^\n]+?med=([0-9.]+)[^\n]+?max=([0-9.]+)[^\n]+?p\(90\)=([0-9.]+)[^\n]+?p\(95\)=([0-9.]+)/);
    if (latMatch) {
      parsed.avgLatency = parseFloat(latMatch[1]);
      parsed.minLatency = parseFloat(latMatch[2]);
      parsed.medLatency = parseFloat(latMatch[3]);
      parsed.maxLatency = parseFloat(latMatch[4]);
      parsed.p90Latency = parseFloat(latMatch[5]);
      parsed.p95Latency = parseFloat(latMatch[6]);
    } else {
      const avgM = output.match(/mqtt_(?:vital|env)_processing_latency[^\n]+?avg=([0-9.]+)/);
      if (avgM) parsed.avgLatency = parseFloat(avgM[1]);
      const p95M = output.match(/p\(95\)=([0-9.]+)/);
      if (p95M) parsed.p95Latency = parseFloat(p95M[1]);
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

  console.log(`DAFTAR ANTREAN PENGUJIAN:`);
  testQueue.forEach((t, idx) => {
    const iterLabel = t.startIter === t.endIter ? `Iterasi ${t.startIter}` : `Iterasi ${t.startIter}-${t.endIter} (${t.iterations} Iterasi)`;
    console.log(`  [${idx + 1}/${testQueue.length}] ${t.name} -> ${t.vus} VU (${iterLabel})`);
  });
  console.log(`---------------------------------------------------------------------\n`);

  process.stdout.write('Mendeteksi IP Publik Laptop Penguji...');
  const clientIp = await detectClientIp();
  console.log(` [IP: ${clientIp || 'Semua Host'}]`);

  const allSessionStats = [];

  for (let qIdx = 0; qIdx < testQueue.length; qIdx++) {

    const item = testQueue[qIdx];
    console.log(`\n=====================================================================`);
    console.log(`>>> MEMULAI SKENARIO [${qIdx + 1}/${testQueue.length}]: ${item.name} (${item.vus} VU) <<<`);
    console.log(`=====================================================================`);

    for (let it = item.startIter; it <= item.endIter; it++) {
      const sessionId = `${item.id}_${item.vus}vu_iterasi${it}`;
      const pcapFilename = `${sessionId}.pcap`;
      const localPcapPath = path.join(PCAP_DIR, pcapFilename);
      const k6LogPath = path.join(K6_DIR, `${sessionId}.txt`);

      // Cek apakah sesi sudah selesai & valid jika mode resume aktif (--resume)
      if (isResumeMode && fs.existsSync(localPcapPath) && fs.statSync(localPcapPath).size > 1000 && fs.existsSync(k6LogPath)) {
        console.log(`\n---------------------------------------------------------------------`);
        console.log(`[RESUME SKIP] Sesi ${sessionId.toUpperCase()} sudah selesai & file PCAP valid. [DILEWATI]`);
        console.log(`---------------------------------------------------------------------`);
        continue;
      }

      console.log(`\n---------------------------------------------------------------------`);
      console.log(`[SESI] ${sessionId.toUpperCase()} | Iterasi ${it}/${item.endIter}`);
      console.log(`---------------------------------------------------------------------`);

      // 1. Restart PM2 & Flush Redis
      console.log('\n[STEP 1/7] Me-restart PM2 & Mengosongkan Cache Redis VPS...');
      await apiRequest('/api/system/restart', 'POST', { processName: 'smartbarn-api-4000' });
      await apiRequest('/api/system/flush-redis', 'POST');
      await sleep(isFastMode ? 5000 : 10000);

      // 2. Pre-Test Network Benchmark
      console.log('\n[STEP 2/7] PRE-TEST JARINGAN (iPerf3 & ICMP): Mengukur Ping, Jitter, Loss & Bandwidth...');
      const iperfDur = isFastMode ? 1 : 2;
      const preNet = await measureIperf3Benchmark(TARGET_HOST, { duration: iperfDur, udpBitrate: '10M' });
      console.log(`  > Pre-Network : Ping=${preNet.pingAvgMs} ms | Jitter=${preNet.jitterMs} ms | Loss=${preNet.packetLossPercent}% | Down=${preNet.downloadMbps} Mbps | Up=${preNet.uploadMbps} Mbps`);
      await sleep(isFastMode ? 2000 : 5000);

      // 3. Dynamic Warm-up
      console.log('\n[STEP 3/7] DYNAMIC WARM-UP: Pendinginan CPU Server...');
      const baseline = await dynamicWarmup(3.0);

      // 4. Start Remote PCAP on VPS
      console.log('\n[STEP 4/7] MENGAKTIFKAN TCPDUMP DI VPS...');
      await startRemotePcap(sessionId);
      await sleep(1000);

      // 5. Eksekusi K6 Load Test
      console.log(`\n[STEP 5/7] EKSEKUSI K6 LOAD TEST (${item.vus} VUs, ${TEST_DURATION})...`);
      const { terminalOutput, metricsLog } = await executeK6(item, item.vus);

      // 6. Stop Remote PCAP on VPS & Download File PCAP
      console.log('\n[STEP 6/7] MENGHENTIKAN TCPDUMP DI VPS & MENGUNDUH PCAP...');
      const stopRes = await stopRemotePcap();
      await sleep(1000);
      const downloaded = await downloadPcapFile(pcapFilename, localPcapPath);

      // 7. Post-Test Network Benchmark
      console.log('\n[STEP 7/7] POST-TEST JARINGAN (iPerf3 & ICMP): Mengukur Ping, Jitter, Loss & Bandwidth...');
      const postNet = await measureIperf3Benchmark(TARGET_HOST, { duration: iperfDur, udpBitrate: '10M' });
      console.log(`  > Post-Network: Ping=${postNet.pingAvgMs} ms | Jitter=${postNet.jitterMs} ms | Loss=${postNet.packetLossPercent}% | Down=${postNet.downloadMbps} Mbps | Up=${postNet.uploadMbps} Mbps`);

      // Hitung Peak Resource
      let peakCpu = baseline.cpu;
      let peakRam = baseline.memoryMb;
      let peakRedis = baseline.redisMemory;
      for (const m of metricsLog) {
        if (m.cpu > peakCpu) peakCpu = m.cpu;
        if (m.memoryMb > peakRam) peakRam = m.memoryMb;
        if (m.redisMemory && m.redisMemory !== 'N/A') peakRedis = m.redisMemory;
      }

      const k6Stats = parseK6Metrics(terminalOutput, item.id);

      // Simpan log k6
      fs.writeFileSync(k6LogPath, terminalOutput, 'utf-8');

      // Simpan log Resource System per detik
      const sysLogFile = path.join(SYS_DIR, `system_${sessionId}.log`);
      const sysLogContent = [
        `=====================================================================`,
        `LOG RESOURCE SERVER - ${sessionId.toUpperCase()}`,
        `Scenario: ${item.name} | VUs: ${item.vus} | Iterasi: ${it}`,
        `Timestamp: ${new Date().toISOString()}`,
        `---------------------------------------------------------------------`,
        `PRE-NETWORK:  Ping=${preNet.pingAvgMs}ms | Jitter=${preNet.jitterMs}ms | Loss=${preNet.packetLossPercent}% | Down=${preNet.downloadMbps} Mbps | Up=${preNet.uploadMbps} Mbps`,
        `BASELINE:     CPU=${baseline.cpu}% | RAM=${baseline.memoryMb} MB | Redis=${baseline.redisMemory}`,
        `PEAK:         CPU=${peakCpu}% | RAM=${peakRam} MB | Redis=${peakRedis}`,
        `POST-NETWORK: Ping=${postNet.pingAvgMs}ms | Jitter=${postNet.jitterMs}ms | Loss=${postNet.packetLossPercent}% | Down=${postNet.downloadMbps} Mbps | Up=${postNet.uploadMbps} Mbps`,
        `---------------------------------------------------------------------`,
        `DETIL METRIK PER DETIK:`,
        ...metricsLog.map(m => `CPU: ${m.cpu}% | RAM: ${m.memoryMb} MB | Redis: ${m.redisMemory}`),
        `=====================================================================`
      ].join('\n');
      fs.writeFileSync(sysLogFile, sysLogContent, 'utf-8');

      // Catat ke CSV (Lengkap dengan Metrik Jaringan Pre & Post)
      const pcapSizeBytes = downloaded && fs.existsSync(localPcapPath) ? fs.statSync(localPcapPath).size : 0;
      const csvLine = [
        sessionId, `"${item.name}"`, item.vus, it, `"${new Date().toISOString()}"`,
        preNet.pingAvgMs, preNet.jitterMs, preNet.packetLossPercent, preNet.downloadMbps, preNet.uploadMbps,
        baseline.cpu, baseline.memoryMb, `"${baseline.redisMemory}"`,
        k6Stats.totalReqs, k6Stats.rps,
        k6Stats.minLatency, k6Stats.medLatency, k6Stats.avgLatency, k6Stats.p90Latency, k6Stats.p95Latency, k6Stats.maxLatency,
        k6Stats.ttfbAvg, k6Stats.checksPass, k6Stats.errorRate,
        peakCpu, peakRam, `"${peakRedis}"`,
        postNet.pingAvgMs, postNet.jitterMs, postNet.packetLossPercent, postNet.downloadMbps, postNet.uploadMbps,
        pcapFilename, pcapSizeBytes
      ].join(',') + '\n';
      fs.appendFileSync(CSV_FILE, csvLine, 'utf-8');

      console.log(`\n---------------------------------------------------------------------`);
      console.log(`[HASIL SESI ${sessionId.toUpperCase()}]`);
      console.log(`  > Pre-Network : Ping ${preNet.pingAvgMs} ms, Jitter ${preNet.jitterMs} ms, Loss ${preNet.packetLossPercent}%`);
      console.log(`  > Throughput  : ${k6Stats.rps} RPS (Total: ${k6Stats.totalReqs} pesan)`);
      console.log(`  > Latensi Min : ${k6Stats.minLatency} ms | Med: ${k6Stats.medLatency} ms | Avg: ${k6Stats.avgLatency} ms`);
      console.log(`  > Latensi P95 : ${k6Stats.p95Latency} ms | Max: ${k6Stats.maxLatency} ms`);
      console.log(`  > Post-Network: Ping ${postNet.pingAvgMs} ms, Jitter ${postNet.jitterMs} ms, Loss ${postNet.packetLossPercent}%`);
      console.log(`  > File PCAP   : ${localPcapPath} (${(pcapSizeBytes / 1024).toFixed(1)} KB)`);
      console.log(`---------------------------------------------------------------------`);

      allSessionStats.push({
        scenario: item.name,
        vus: item.vus,
        iteration: it,
        rps: k6Stats.rps,
        totalReqs: k6Stats.totalReqs,
        min: k6Stats.minLatency,
        med: k6Stats.medLatency,
        avg: k6Stats.avgLatency,
        p90: k6Stats.p90Latency,
        p95: k6Stats.p95Latency,
        max: k6Stats.maxLatency,
        prePing: preNet.pingAvgMs,
        postPing: postNet.pingAvgMs
      });

      if (it < item.endIter || qIdx < testQueue.length - 1) {
        const cooldownWait = isFastMode ? 5000 : 15000;
        console.log(`  > Jeda Cooldown ${cooldownWait / 1000} detik sebelum iterasi berikutnya...`);
        await sleep(cooldownWait);
      }
    }
  }

  // AGREGASI STATISTIK PER SKENARIO
  const groups = {};
  allSessionStats.forEach(s => {
    const key = `${s.scenario} (${s.vus} VU)`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  let aggText = `\n========================================================================================================\n` +
    `📊 RANGKUMAN AGREGASI HASIL PENGUJIAN FULL VU + PCAP (${customIter} ITERASI)\n` +
    `========================================================================================================\n` +
    `| Skenario Pengujian                 | Beban  | Throughput (RPS) | Latensi Med | Latensi Avg (±Std) | Latensi P95 | Latensi Max |\n` +
    `| :--------------------------------- | :----: | :--------------: | :---------: | :----------------: | :---------: | :---------: |\n`;

  Object.keys(groups).forEach(key => {
    const arr = groups[key];
    const vus = arr[0].vus;
    const meanRps = arr.reduce((acc, x) => acc + x.rps, 0) / arr.length;
    const meanMed = arr.reduce((acc, x) => acc + x.med, 0) / arr.length;
    const meanAvg = arr.reduce((acc, x) => acc + x.avg, 0) / arr.length;
    const meanP95 = arr.reduce((acc, x) => acc + x.p95, 0) / arr.length;
    const meanMax = arr.reduce((acc, x) => acc + x.max, 0) / arr.length;
    const stdAvg = arr.length > 1
      ? Math.sqrt(arr.reduce((acc, x) => acc + Math.pow(x.avg - meanAvg, 2), 0) / (arr.length - 1))
      : 0;

    const stdStr = arr.length > 1 ? ` (±${stdAvg.toFixed(1)})` : '';
    aggText += `| ${arr[0].scenario.padEnd(35, ' ')} | ${String(vus).padStart(4)} VU | ${meanRps.toFixed(1).padStart(12)} msg/s | ${meanMed.toFixed(1).padStart(9)} ms | ${(meanAvg.toFixed(2) + stdStr).padStart(16)} ms | ${meanP95.toFixed(1).padStart(9)} ms | ${meanMax.toFixed(1).padStart(9)} ms |\n`;
  });
  aggText += `========================================================================================================\n`;

  console.log(aggText);
  try {
    fs.writeFileSync(path.join(LOGS_DIR, 'summary_results_pcap_aggregated.txt'), aggText, 'utf-8');
  } catch (e) {}

  console.log(`\n=====================================================================`);
  console.log(`🎉 SELURUH PENGUJIAN PCAP JALUR 1 & JALUR 2 SELESAI DENGAN SUKSES!`);
  console.log(`  • Seluruh File PCAP tersimpan di : ${PCAP_DIR}`);
  console.log(`  • Detail Tiap Sesi (CSV)         : ${CSV_FILE}`);
  console.log(`  • Rangkuman Agregasi (TXT)       : ${path.join(LOGS_DIR, 'summary_results_pcap_aggregated.txt')}`);
  console.log(`=====================================================================\n`);
}

main().catch(err => {
  console.error('Fatal Runner Error:', err);
});

