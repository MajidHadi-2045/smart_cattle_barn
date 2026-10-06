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
const { measureIperf3Benchmark } = require('./benchmark-network-utils');

// KONFIGURASI TARGET LOCAL VPS
const BASE_URL = process.env.TARGET_API_URL || 'http://localhost:4000';
const TARGET_HOST = '127.0.0.1';
const TEST_DURATION = '30s';
const COOLDOWN_SECONDS = 60; // 1 Menit

// DIRECTORY LOGS
const LOGS_DIR = path.join(__dirname, 'benchmark_logs');
const K6_DIR = path.join(LOGS_DIR, 'k6_terminal_outputs');
const SYS_DIR = path.join(LOGS_DIR, 'system_resource_logs');
const CHECKPOINT_FILE = path.join(LOGS_DIR, 'checkpoint.json');
const CSV_SUMMARY_FILE = path.join(LOGS_DIR, 'summary_results.csv');

// DAFTAR LENGKAP JALUR PENGUJIAN (DEFAULT MENGGUNAKAN VERSI 6 INGESTION LATENCY)
const SCRIPT_VER = process.env.VERSION || 'v6';
const SCENARIOS = [
  { id: 'jalur1', name: 'Jalur 1 - Sensor Vital Sapi (MQTT)', script: `k6-sensor-test-${SCRIPT_VER}.js`, isMqtt: true, env: {} },
  { id: 'jalur2', name: 'Jalur 2 - Sensor Lingkungan (MQTT)', script: `k6-env-test-${SCRIPT_VER}.js`, isMqtt: true, env: {} },
  { id: 'jalur3', name: 'Jalur 3 - WebSocket Real-Time', script: `k6-ws-realtime-test-${SCRIPT_VER}.js`, isMqtt: false, env: {} },
  { id: 'jalur4', name: 'Jalur 4 - Web Dashboard 5-API', script: `k6-web-test-${SCRIPT_VER}.js`, isMqtt: false, env: {} },
  { id: 'jalur5', name: 'Jalur 5 - Mixed Workload (50:20:30)', script: `k6-load-test-${SCRIPT_VER}.js`, isMqtt: true, env: {} },
  { id: 'jalur6_simultan', name: 'Jalur 6A - Redis Cache Simultan (Hit & Miss)', script: `k6-cache-benchmark-${SCRIPT_VER}.js`, isMqtt: false, env: { MODE: 'both' } },
  { id: 'jalur6_hit', name: 'Jalur 6B - Redis Cache Isolasi HIT (RAM)', script: `k6-cache-benchmark-${SCRIPT_VER}.js`, isMqtt: false, env: { MODE: 'hit' } },
  { id: 'jalur6_miss', name: 'Jalur 6C - Redis Cache Isolasi MISS (DB)', script: `k6-cache-benchmark-${SCRIPT_VER}.js`, isMqtt: false, env: { MODE: 'miss' } },
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
      'Pre_Ping_Avg_ms', 'Pre_Jitter_ms', 'Pre_Loss_Percent', 'Pre_Down_Mbps', 'Pre_Up_Mbps',
      'Baseline_CPU_Percent', 'Baseline_RAM_MB', 'Baseline_RAM_Redis',
      'K6_Total_Reqs', 'Throughput_RPS', 'Latency_Avg_ms', 'Latency_P95_ms', 'TTFB_Avg_ms', 'Checks_Pass_Percent', 'Error_Rate_Percent',
      'Peak_CPU_Percent', 'Peak_RAM_MB', 'Peak_RAM_Redis',
      'Post_Ping_Avg_ms', 'Post_Jitter_ms', 'Post_Loss_Percent', 'Post_Down_Mbps', 'Post_Up_Mbps'
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

// Dynamic Warm-up: Tunggu CPU backend benar-benar mendingin & stabil <= 1.0%
async function dynamicWarmup(targetCpu = 2.0, maxAttempts = 10) {
  console.log(`\n[WARM-UP] Menunggu pendinginan CPU backend stabil <= ${targetCpu}% (Maks ${maxAttempts * 1.5}s)...`);
  let stableCount = 0;
  let attempts = 0;
  let lastMetric = { cpu: 0, memoryMb: 0, redisMemory: 'N/A' };

  while (attempts < maxAttempts) {
    attempts++;
    await sleep(1500);
    const m = await fetchServerMetrics();
    if (m.success) {
      lastMetric = m;
      process.stdout.write(`\r  > Current CPU: ${m.cpu}% | RAM: ${m.memoryMb} MB | Redis: ${m.redisMemory} (Stabil <= ${targetCpu}%: ${stableCount}/3, Attempt ${attempts}/${maxAttempts})  `);
      if (m.cpu <= targetCpu) {
        stableCount++;
        if (stableCount >= 3) {
          console.log(`\n[WARM-UP READY] Backend idle & stabil pada ${m.cpu}% CPU (${m.memoryMb} MB RAM). Pengujian dimulai.`);
          return lastMetric;
        }
      } else {
        stableCount = 0;
      }
    }
  }

  console.log(`\n[WARM-UP TIMEOUT] Batas waktu pendinginan (15s) tercapai. Melanjutkan dengan CPU ${lastMetric.cpu}% (${lastMetric.memoryMb} MB RAM).`);
  return lastMetric;
}

// Eksekusi K6 & Polling Resource
function executeK6WithMonitoring(scriptName, vus, duration, isMqtt, envVars = {}) {
  return new Promise((resolve) => {
    let k6Binary = 'k6';
    if (process.platform === 'win32') {
      k6Binary = fs.existsSync(path.join(__dirname, 'k6-mqtt.exe')) ? '.\\k6-mqtt.exe' : 'k6';
    } else {
      if (fs.existsSync(path.join(__dirname, 'k6-linux-mqtt'))) {
        k6Binary = './k6-linux-mqtt';
      } else if (fs.existsSync(path.join(__dirname, 'k6-mqtt'))) {
        k6Binary = './k6-mqtt';
      } else {
        k6Binary = 'k6';
      }
    }

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

function extractK6Trend(output, metricName) {
  const lineRegex = new RegExp(metricName + '[^\\n]+', 'i');
  const lineMatch = output.match(lineRegex);
  if (!lineMatch) return { avg: 0, p95: 0 };

  const line = lineMatch[0];
  const avgMatch = line.match(/avg=([0-9.]+)(?:ms|s)?/);
  const p95Match = line.match(/p\(95\)=([0-9.]+)(?:ms|s)?/);

  return {
    avg: avgMatch ? parseFloat(avgMatch[1]) : 0,
    p95: p95Match ? parseFloat(p95Match[1]) : 0
  };
}

function parseK6Metrics(output, scenarioId = '') {
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
    const checkMatch = output.match(/checks_succeeded[^\n]+?:\s*([\d.]+)%/);
    if (checkMatch) parsed.checksPass = parseFloat(checkMatch[1]);

    const failedMatch = output.match(/http_req_failed[^\n]+?:\s*([\d.]+)%/);
    if (failedMatch) parsed.errorRate = parseFloat(failedMatch[1]);

    if (scenarioId.startsWith('jalur1')) {
      const procMatch = output.match(/mqtt_vital_messages_processed[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      const sentMatch = output.match(/mqtt_vital_messages_sent[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (procMatch) {
        parsed.totalReqs = parseInt(procMatch[1], 10);
        parsed.rps = parseFloat(procMatch[2]);
      } else if (sentMatch) {
        parsed.totalReqs = parseInt(sentMatch[1], 10);
        parsed.rps = parseFloat(sentMatch[2]);
      }
      const lat = extractK6Trend(output, 'mqtt_vital_processing_latency');
      parsed.avgLatency = lat.avg;
      parsed.p95Latency = lat.p95;

      const pubLat = extractK6Trend(output, 'mqtt_vital_publish_latency');
      parsed.ttfbAvg = pubLat.avg;
    } else if (scenarioId.startsWith('jalur2')) {
      const procMatch = output.match(/mqtt_env_messages_processed[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      const sentMatch = output.match(/mqtt_env_messages_sent[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (procMatch) {
        parsed.totalReqs = parseInt(procMatch[1], 10);
        parsed.rps = parseFloat(procMatch[2]);
      } else if (sentMatch) {
        parsed.totalReqs = parseInt(sentMatch[1], 10);
        parsed.rps = parseFloat(sentMatch[2]);
      }
      const lat = extractK6Trend(output, 'mqtt_env_processing_latency');
      parsed.avgLatency = lat.avg;
      parsed.p95Latency = lat.p95;

      const pubLat = extractK6Trend(output, 'mqtt_env_publish_latency');
      parsed.ttfbAvg = pubLat.avg;
    } else if (scenarioId.startsWith('jalur3')) {
      const bcMatch = output.match(/ws_broadcast_received[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      const msgsMatch = output.match(/ws_msgs_received[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (bcMatch) {
        parsed.totalReqs = parseInt(bcMatch[1], 10);
        parsed.rps = parseFloat(bcMatch[2]);
      } else if (msgsMatch) {
        parsed.totalReqs = parseInt(msgsMatch[1], 10);
        parsed.rps = parseFloat(msgsMatch[2]);
      }
      const lat = extractK6Trend(output, 'ws_vital_e2e_latency');
      parsed.avgLatency = lat.avg;
      parsed.p95Latency = lat.p95;

      const connLat = extractK6Trend(output, 'ws_handshake_connecting_time');
      parsed.ttfbAvg = connLat.avg;
    } else if (scenarioId.startsWith('jalur5')) {
      let httpRps = 0;
      let mqttRps = 0;
      let total = 0;

      const httpMatch = output.match(/mixed_web_http_requests[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (httpMatch) {
        total += parseInt(httpMatch[1], 10);
        httpRps = parseFloat(httpMatch[2]);
      }

      const mqttMatch = output.match(/mqtt_messages_sent[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (mqttMatch) {
        total += parseInt(mqttMatch[1], 10);
        mqttRps = parseFloat(mqttMatch[2]);
      }

      parsed.totalReqs = total;
      parsed.rps = parseFloat((httpRps + mqttRps).toFixed(2));

      const durMatch = extractK6Trend(output, 'mixed_web_http_duration');
      parsed.avgLatency = durMatch.avg;
      parsed.p95Latency = durMatch.p95;

      const ttfbMatch = extractK6Trend(output, 'mixed_web_server_ttfb');
      parsed.ttfbAvg = ttfbMatch.avg;
    } else {
      const reqsMatch = output.match(/http_reqs[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (reqsMatch) {
        parsed.totalReqs = parseInt(reqsMatch[1], 10);
        parsed.rps = parseFloat(reqsMatch[2]);
      }

      const durMatch = extractK6Trend(output, 'http_req_duration');
      parsed.avgLatency = durMatch.avg;
      parsed.p95Latency = durMatch.p95;

      const ttfbMatch = extractK6Trend(output, 'server_processing_ttFB') || extractK6Trend(output, 'ttfb_cache_hit_ram') || extractK6Trend(output, 'http_req_waiting');
      parsed.ttfbAvg = ttfbMatch.avg || durMatch.avg;
    }
  } catch (e) {}

  return parsed;
}

// Countdown Cooldown
async function runCooldown(seconds) {
  console.log(`\n=====================================================================`);
  console.log(`[COOLDOWN] Menunggu pendinginan CPU & sistem (${seconds}s / ${seconds / 60} Menit)...`);
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

        // 1. Local PM2 Restart & Flush Redis
        console.log('[STEP 1/6] Me-restart PM2 & Mengosongkan Cache Redis Lokal...');
        restartLocalPm2();
        try { execSync('redis-cli flushall', { stdio: 'ignore' }); } catch (e) {}
        console.log('  > [JEDA 15s] Menunggu 15 detik inisialisasi backend & Redis clean state...');
        await sleep(15000);

        // 2. Pre-Test Network Benchmark (iPerf3: Ping, Jitter, Packet Loss, Download, Upload)
        console.log('\n[STEP 2/6] PRE-TEST JARINGAN (iPerf3 & ICMP): Mengukur Ping, Jitter, Loss & Bandwidth...');
        const preNet = await measureIperf3Benchmark(TARGET_HOST, { duration: 3, udpBitrate: '10M' });
        console.log(`  > Pre-Network: Ping=${preNet.pingAvgMs}ms | Jitter=${preNet.jitterMs}ms | Loss=${preNet.packetLossPercent}% | Down=${preNet.downloadMbps} Mbps | Up=${preNet.uploadMbps} Mbps`);
        
        console.log('  > [JEDA 15s] Menunggu 15 detik stabilisasi jaringan sebelum Baseline Warm-Up...');
        await sleep(15000);

        // 3. Strict Warm-Up (Tunggu sampai CPU backend mendingin & stabil <= 3.0%)
        console.log('\n[STEP 3/6] PENDINGINAN & STABILISASI (WARM-UP BASELINE)...');
        const baselineMetrics = await dynamicWarmup(3.0);

        // 4. Eksekusi K6 Test + Resource Polling per Detik
        console.log(`\n[STEP 4/6] EKSEKUSI K6 LOAD TEST (${vus} VUs, ${TEST_DURATION})...`);
        const { terminalOutput, metricsLog } = await executeK6WithMonitoring(scenario.script, vus, TEST_DURATION, scenario.isMqtt, scenario.env);

        console.log('\n  > [JEDA 15s] Menunggu 15 detik bagi server untuk melepaskan sisa soket K6 (Socket Drain)...');
        await sleep(15000);

        // 5. Post-Test Network Benchmark (iPerf3: Ping, Jitter, Packet Loss, Download, Upload)
        console.log('\n[STEP 5/6] POST-TEST JARINGAN (iPerf3 & ICMP): Mengukur Ping, Jitter, Loss & Bandwidth...');
        const postNet = await measureIperf3Benchmark(TARGET_HOST, { duration: 3, udpBitrate: '10M' });
        console.log(`  > Post-Network: Ping=${postNet.pingAvgMs}ms | Jitter=${postNet.jitterMs}ms | Loss=${postNet.packetLossPercent}% | Down=${postNet.downloadMbps} Mbps | Up=${postNet.uploadMbps} Mbps`);

        // Hitung Peak Resource 100% murni dari nilai tertinggi selama K6 berjalan
        let peakCpu = metricsLog.length > 0 ? metricsLog[0].cpu : baselineMetrics.cpu;
        let peakRam = metricsLog.length > 0 ? metricsLog[0].memoryMb : baselineMetrics.memoryMb;
        let peakRedis = metricsLog.length > 0 ? metricsLog[0].redisMemory : baselineMetrics.redisMemory;

        for (const m of metricsLog) {
          if (m.cpu > peakCpu) peakCpu = m.cpu;
          if (m.memoryMb > peakRam) peakRam = m.memoryMb;
          if (m.redisMemory !== 'N/A') peakRedis = m.redisMemory;
        }

        const k6Stats = parseK6Metrics(terminalOutput, scenario.id);

        // 6. Simpan Seluruh Hasil (Terminal txt, System log, CSV, Checkpoint)
        console.log('\n[STEP 6/6] MENYIMPAN LOG & REKAP DATA...');

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
          preNet.pingAvgMs, preNet.jitterMs, preNet.packetLossPercent, preNet.downloadMbps, preNet.uploadMbps,
          baselineMetrics.cpu, baselineMetrics.memoryMb, `"${baselineMetrics.redisMemory}"`,
          k6Stats.totalReqs, k6Stats.rps, k6Stats.avgLatency, k6Stats.p95Latency, k6Stats.ttfbAvg, k6Stats.checksPass, k6Stats.errorRate,
          peakCpu, peakRam, `"${peakRedis}"`,
          postNet.pingAvgMs, postNet.jitterMs, postNet.packetLossPercent, postNet.downloadMbps, postNet.uploadMbps
        ].join(',') + '\n';
        fs.appendFileSync(CSV_SUMMARY_FILE, csvRow, 'utf-8');

        // Update Checkpoint
        checkpoint.completed.push(sessionId);
        checkpoint.lastUpdated = new Date().toISOString();
        saveCheckpoint(checkpoint);

        console.log(`[BERHASIL DISIMPAN] Data Sesi ${sessionId} tersimpan ke CSV dan Folder Log.`);

        // 7. Jeda Cooldown 1 Menit (Kecuali jika ini sesi terakhir)
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
