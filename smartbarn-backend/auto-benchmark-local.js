/**
 * SMART CATTLE BARN - AUTOMATED BENCHMARK SUITE (LOCAL VPS MODE)
 * Menjalankan Seluruh Jalur Pengujian x 3 Beban (10, 50, 100 VUs) x 3 Iterasi
 * Jalur 6 dibagi 3: 6A (Simultan Hit & Miss), 6B (Isolasi Cache HIT), 6C (Isolasi Cache MISS)
 * Fitur: Local PM2 Restart, Dynamic CPU Warm-up, Local Network Ping/Speedtest, Resource Monitoring, Checkpoint & Resume.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { measurePingAndJitter, measureSpeedtest } = require('./benchmark-network-utils');

// KONFIGURASI TARGET LOCAL VPS
const BASE_URL = process.env.TARGET_API_URL || 'http://localhost:4000';
const TARGET_HOST = '127.0.0.1';
const TEST_DURATION = '30s';
const COOLDOWN_SECONDS = 120; // 2 Menit

// DIRECTORY LOGS
const LOGS_DIR = path.join(__dirname, 'benchmark_logs');
const K6_DIR = path.join(LOGS_DIR, 'k6_terminal_outputs');
const SYS_DIR = path.join(LOGS_DIR, 'system_resource_logs');
const CHECKPOINT_FILE = path.join(LOGS_DIR, 'checkpoint.json');
const CSV_SUMMARY_FILE = path.join(LOGS_DIR, 'summary_results.csv');

// DAFTAR LENGKAP JALUR PENGUJIAN (MENGGUNAKAN SKRIP V2 BERTAHAP / STAGES)
const SCENARIOS = [
  { id: 'jalur1', name: 'Jalur 1 - Sensor Vital Sapi (MQTT)', script: 'k6-sensor-test-v2.js', isMqtt: true, env: {} },
  { id: 'jalur2', name: 'Jalur 2 - Sensor Lingkungan (MQTT)', script: 'k6-env-test-v2.js', isMqtt: true, env: {} },
  { id: 'jalur3', name: 'Jalur 3 - WebSocket Real-Time', script: 'k6-ws-realtime-test-v2.js', isMqtt: false, env: {} },
  { id: 'jalur4', name: 'Jalur 4 - Web Dashboard 5-API', script: 'k6-web-test-v2.js', isMqtt: false, env: {} },
  { id: 'jalur5', name: 'Jalur 5 - Mixed Workload (50:20:30)', script: 'k6-load-test-v2.js', isMqtt: true, env: {} },
  { id: 'jalur6_simultan', name: 'Jalur 6A - Redis Cache Simultan (Hit & Miss)', script: 'k6-cache-benchmark-v2.js', isMqtt: false, env: { MODE: 'both' } },
  { id: 'jalur6_hit', name: 'Jalur 6B - Redis Cache Isolasi HIT (RAM)', script: 'k6-cache-benchmark-v2.js', isMqtt: false, env: { MODE: 'hit' } },
  { id: 'jalur6_miss', name: 'Jalur 6C - Redis Cache Isolasi MISS (DB)', script: 'k6-cache-benchmark-v2.js', isMqtt: false, env: { MODE: 'miss' } },
];

const VU_LEVELS = [10, 50, 100];
const ITERATIONS = [1, 2, 3];

function ensureDirectories() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  if (!fs.existsSync(K6_DIR)) fs.mkdirSync(K6_DIR, { recursive: true });
  if (!fs.existsSync(SYS_DIR)) fs.mkdirSync(SYS_DIR, { recursive: true });

  if (!fs.existsSync(CSV_SUMMARY_FILE)) {
    const csvHeader = [
      'Session_ID', 'Jalur', 'Beban_VUs', 'Iterasi', 'Timestamp',
      'Pre_Ping_Avg_ms', 'Pre_Jitter_ms', 'Pre_Down_Mbps', 'Pre_Up_Mbps',
      'Baseline_CPU_Percent', 'Baseline_RAM_MB', 'Baseline_RAM_Redis',
      'K6_Total_Reqs', 'Throughput_RPS', 'Latency_Avg_ms', 'Latency_P95_ms', 'TTFB_Avg_ms', 'Checks_Pass_Percent', 'Error_Rate_Percent',
      'Peak_CPU_Percent', 'Peak_RAM_MB', 'Peak_RAM_Redis',
      'Post_Ping_Avg_ms', 'Post_Jitter_ms', 'Post_Down_Mbps', 'Post_Up_Mbps'
    ].join(',') + '\n';
    fs.writeFileSync(CSV_SUMMARY_FILE, csvHeader, 'utf-8');
  }
}

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
    } catch (e) {
      return { completed: [] };
    }
  }
  return { completed: [] };
}

function saveCheckpoint(checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch metrics dari backend lokal
function fetchServerMetrics() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/system/metrics`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, cpu: 0, memoryMb: 0, redisMemory: 'N/A' });
        }
      });
    });
    req.on('error', () => resolve({ success: false, cpu: 0, memoryMb: 0, redisMemory: 'N/A' }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ success: false, cpu: 0, memoryMb: 0, redisMemory: 'N/A' }); });
  });
}

// Local PM2 Restart
function restartLocalPm2() {
  try {
    execSync('pm2 restart smartbarn-api-4000 || npx pm2 restart all', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// Dynamic Warm-up: Tunggu CPU backend <= 1.0%
async function dynamicWarmup() {
  console.log('\n[WARM-UP] Menunggu inisialisasi backend & CPU stabil <= 1.0%...');
  const start = Date.now();
  let stableCount = 0;
  let lastMetric = { cpu: 0, memoryMb: 0, redisMemory: 'N/A' };

  while ((Date.now() - start) < 35000) {
    await sleep(1500);
    const m = await fetchServerMetrics();
    if (m.success) {
      lastMetric = m;
      process.stdout.write(`\r  > Current CPU: ${m.cpu}% | RAM: ${m.memoryMb} MB | Redis: ${m.redisMemory}`);
      if (m.cpu <= 1.5) {
        stableCount++;
        if (stableCount >= 2) {
          console.log(`\n[WARM-UP READY] Backend idle dan stabil (${m.cpu}% CPU).`);
          return lastMetric;
        }
      } else {
        stableCount = 0;
      }
    }
  }
  console.log(`\n[WARM-UP TIMEOUT] Batas warm-up 35s tercapai. Melanjutkan pengujian.`);
  return lastMetric;
}

// Eksekusi K6 & Polling Resource
function executeK6WithMonitoring(scriptName, vus, duration, isMqtt, envVars = {}) {
  return new Promise((resolve) => {
    const k6Binary = isMqtt && process.platform === 'win32'
      ? (fs.existsSync(path.join(__dirname, 'k6-mqtt.exe')) ? '.\\k6-mqtt.exe' : 'k6')
      : 'k6';

    const args = ['run', '-e', `VUS=${vus}`];
    
    // Tambahkan environment variable khusus k6
    for (const [k, v] of Object.entries(envVars)) {
      args.push('-e', `${k}=${v}`);
    }

    args.push(scriptName);
    console.log(`\n[K6 EXECUTE] Menjalankan: ${k6Binary} ${args.join(' ')}`);

    const child = spawn(k6Binary, args, { cwd: __dirname, shell: true });
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

    // Polling System Metrics setiap 1 detik saat K6 berjalan
    const poller = setInterval(async () => {
      if (isFinished) return;
      const m = await fetchServerMetrics();
      if (m.success) {
        metricsLog.push({
          time: new Date().toISOString(),
          cpu: m.cpu,
          memoryMb: m.memoryMb,
          redisMemory: m.redisMemory
        });
      }
    }, 1000);

    child.on('close', (code) => {
      isFinished = true;
      clearInterval(poller);
      resolve({ terminalOutput, metricsLog, exitCode: code });
    });

    child.on('error', (err) => {
      isFinished = true;
      clearInterval(poller);
      resolve({ terminalOutput: `Error executing K6: ${err.message}`, metricsLog, exitCode: 1 });
    });
  });
}

function parseK6Metrics(output) {
  const parsed = {
    totalReqs: 0,
    rps: 0,
    avgLatency: 0,
    p95Latency: 0,
    ttfbAvg: 0,
    checksPass: 100,
    errorRate: 0
  };

  try {
    const reqsMatch = output.match(/http_reqs\.+:\s*(\d+)\s+([\d.]+)\/s/);
    if (reqsMatch) {
      parsed.totalReqs = parseInt(reqsMatch[1], 10);
      parsed.rps = parseFloat(reqsMatch[2]);
    } else {
      const iterMatch = output.match(/iterations\.+:\s*(\d+)\s+([\d.]+)\/s/);
      if (iterMatch) {
        parsed.totalReqs = parseInt(iterMatch[1], 10);
        parsed.rps = parseFloat(iterMatch[2]);
      }
    }

    const durMatch = output.match(/http_req_duration\.+avg=([\d.]+)ms.+p\(95\)=([\d.]+)ms/);
    if (durMatch) {
      parsed.avgLatency = parseFloat(durMatch[1]);
      parsed.p95Latency = parseFloat(durMatch[2]);
    }

    const ttfbMatch = output.match(/http_req_waiting\.+avg=([\d.]+)ms/);
    if (ttfbMatch) {
      parsed.ttfbAvg = parseFloat(ttfbMatch[1]);
    }

    const checkMatch = output.match(/checks_succeeded\.+:\s*([\d.]+)%/);
    if (checkMatch) {
      parsed.checksPass = parseFloat(checkMatch[1]);
    }

    const failedMatch = output.match(/http_req_failed\.+:\s*([\d.]+)%/);
    if (failedMatch) {
      parsed.errorRate = parseFloat(failedMatch[1]);
    }
  } catch (e) {}

  return parsed;
}

// Countdown Cooldown
async function runCooldown(seconds) {
  console.log(`\n=====================================================================`);
  console.log(`[COOLDOWN] Menunggu pendinginan CPU & sistem (${seconds}s / ${seconds/60} Menit)...`);
  for (let rem = seconds; rem > 0; rem--) {
    const min = Math.floor(rem / 60);
    const sec = rem % 60;
    process.stdout.write(`\r  > Cooldown tersisa: ${min}m ${sec}s... `);
    await sleep(1000);
  }
  console.log(`\n[COOLDOWN SELESAI] Memulai sesi pengujian berikutnya.`);
  console.log(`=====================================================================\n`);
}

async function main() {
  ensureDirectories();
  const checkpoint = loadCheckpoint();
  const totalSessions = SCENARIOS.length * VU_LEVELS.length * ITERATIONS.length;

  console.log('=====================================================================');
  console.log('SMART CATTLE BARN - AUTOMATED BENCHMARK ENGINE (LOCAL VPS MODE)');
  console.log(`Target Host: ${BASE_URL} | Durasi per Uji: ${TEST_DURATION} | Cooldown: ${COOLDOWN_SECONDS}s`);
  console.log(`Total: ${SCENARIOS.length} Skenario x 3 Beban (10, 50, 100 VUs) x 3 Iterasi = ${totalSessions} Sesi Uji`);
  console.log(`Sesi selesai sebelumnya: ${checkpoint.completed.length} / ${totalSessions}`);
  console.log('=====================================================================\n');

  let sessionIndex = 0;

  for (const scenario of SCENARIOS) {
    for (const vus of VU_LEVELS) {
      for (const iter of ITERATIONS) {
        sessionIndex++;
        const sessionId = `${scenario.id}_${vus}vu_iterasi${iter}`;

        console.log(`\n---------------------------------------------------------------------`);
        console.log(`[SESI ${sessionIndex}/${totalSessions}] ${scenario.name} | Beban: ${vus} VUs | Iterasi: ${iter}`);
        console.log(`Session ID: ${sessionId}`);
        console.log(`---------------------------------------------------------------------`);

        if (checkpoint.completed.includes(sessionId)) {
          console.log(`[CHECKPOINT] Sesi ${sessionId} sudah selesai sebelumnya. [DILEWATI]`);
          continue;
        }

        // 1. Local PM2 Restart
        console.log('[STEP 1/6] Me-restart PM2 Lokal (smartbarn-api-4000)...');
        restartLocalPm2();
        await sleep(3000); // Jeda transisi restart

        // 2. Dynamic Warm-up
        const baselineMetrics = await dynamicWarmup();

        // 3. Pre-Test Network Benchmark
        console.log('\n[STEP 2/6] PRE-TEST JARINGAN: Mengukur Ping RTT, Jitter & Speedtest...');
        const prePing = measurePingAndJitter(TARGET_HOST, 10);
        console.log(`  > Pre-Ping: Avg=${prePing.avgRtt}ms | Jitter=${prePing.jitter}ms | Min/Max=${prePing.minRtt}/${prePing.maxRtt}ms`);
        const preSpeed = await measureSpeedtest(BASE_URL, 3);
        console.log(`  > Pre-Speedtest: Download=${preSpeed.downloadMbps} Mbps | Upload=${preSpeed.uploadMbps} Mbps`);

        // 4. Eksekusi K6 Test + Resource Polling
        console.log(`\n[STEP 3/6] EKSEKUSI K6 LOAD TEST (${vus} VUs, ${TEST_DURATION})...`);
        const { terminalOutput, metricsLog } = await executeK6WithMonitoring(scenario.script, vus, TEST_DURATION, scenario.isMqtt, scenario.env);

        // 5. Post-Test Network Benchmark
        console.log('\n[STEP 4/6] POST-TEST JARINGAN: Mengukur Ping RTT, Jitter & Speedtest...');
        const postPing = measurePingAndJitter(TARGET_HOST, 10);
        console.log(`  > Post-Ping: Avg=${postPing.avgRtt}ms | Jitter=${postPing.jitter}ms | Min/Max=${postPing.minRtt}/${postPing.maxRtt}ms`);
        const postSpeed = await measureSpeedtest(BASE_URL, 3);
        console.log(`  > Post-Speedtest: Download=${postSpeed.downloadMbps} Mbps | Upload=${postSpeed.uploadMbps} Mbps`);

        // Hitung Peak Resource
        let peakCpu = baselineMetrics.cpu;
        let peakRam = baselineMetrics.memoryMb;
        let peakRedis = baselineMetrics.redisMemory;

        for (const m of metricsLog) {
          if (m.cpu > peakCpu) peakCpu = m.cpu;
          if (m.memoryMb > peakRam) peakRam = m.memoryMb;
          if (m.redisMemory !== 'N/A') peakRedis = m.redisMemory;
        }

        const k6Stats = parseK6Metrics(terminalOutput);

        // 6. Simpan Seluruh Hasil (Terminal txt, System log, CSV, Checkpoint)
        console.log('\n[STEP 5/6] MENYIMPAN LOG & REKAP DATA...');

        // Simpan Terminal Output K6 Asli
        const terminalFile = path.join(K6_DIR, `${sessionId}.txt`);
        fs.writeFileSync(terminalFile, terminalOutput, 'utf-8');

        // Simpan Log Resource System per detik
        const sysLogFile = path.join(SYS_DIR, `system_${sessionId}.log`);
        const sysLogContent = [
          `=====================================================================`,
          `LOG RESOURCE SERVER - ${sessionId.toUpperCase()}`,
          `Scenario: ${scenario.name} | VUs: ${vus} | Iterasi: ${iter}`,
          `Timestamp: ${new Date().toISOString()}`,
          `---------------------------------------------------------------------`,
          `BASELINE: CPU=${baselineMetrics.cpu}% | RAM=${baselineMetrics.memoryMb} MB | Redis=${baselineMetrics.redisMemory}`,
          `PEAK:     CPU=${peakCpu}% | RAM=${peakRam} MB | Redis=${peakRedis}`,
          `---------------------------------------------------------------------`,
          `DETIL METRIK PER DETIK:`,
          ...metricsLog.map(m => `[${m.time}] CPU: ${m.cpu}% | RAM: ${m.memoryMb} MB | Redis: ${m.redisMemory}`),
          `=====================================================================`
        ].join('\n');
        fs.writeFileSync(sysLogFile, sysLogContent, 'utf-8');

        // Append ke CSV Summary
        const csvRow = [
          sessionId, `"${scenario.name}"`, vus, iter, `"${new Date().toISOString()}"`,
          prePing.avgRtt, prePing.jitter, preSpeed.downloadMbps, preSpeed.uploadMbps,
          baselineMetrics.cpu, baselineMetrics.memoryMb, `"${baselineMetrics.redisMemory}"`,
          k6Stats.totalReqs, k6Stats.rps, k6Stats.avgLatency, k6Stats.p95Latency, k6Stats.ttfbAvg, k6Stats.checksPass, k6Stats.errorRate,
          peakCpu, peakRam, `"${peakRedis}"`,
          postPing.avgRtt, postPing.jitter, postSpeed.downloadMbps, postSpeed.uploadMbps
        ].join(',') + '\n';
        fs.appendFileSync(CSV_SUMMARY_FILE, csvRow, 'utf-8');

        // Update Checkpoint
        checkpoint.completed.push(sessionId);
        checkpoint.lastUpdated = new Date().toISOString();
        saveCheckpoint(checkpoint);

        console.log(`[BERHASIL DISIMPAN] Data Sesi ${sessionId} tersimpan ke CSV dan Folder Log.`);

        // 7. Jeda Cooldown 2 Menit (Kecuali jika ini sesi terakhir)
        if (sessionIndex < totalSessions) {
          console.log('\n[STEP 6/6] MEMULAI JEDA COOLDOWN...');
          await runCooldown(COOLDOWN_SECONDS);
        }
      }
    }
  }

  console.log('\n=====================================================================');
  console.log('SELURUH PENGUJIAN OTOMATIS BERHASIL DISELESAIKAN DENGAN SEMPURNA!');
  console.log(`File Rekap Utama: ${CSV_SUMMARY_FILE}`);
  console.log(`Folder Terminal K6: ${K6_DIR}`);
  console.log(`Folder System Logs: ${SYS_DIR}`);
  console.log('=====================================================================\n');
}

main().catch(err => {
  console.error('\n[FATAL ERROR]', err);
});
