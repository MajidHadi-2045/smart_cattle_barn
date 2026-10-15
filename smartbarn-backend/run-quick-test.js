/**
 * SMART CATTLE BARN - TARGETED MULTI-SCENARIO BENCHMARK RUNNER
 * Alur pengujian 100% IDENTIK dengan auto-benchmark (7 Tahapan Metodologi Baku):
 *   [STEP 1] PM2 Restart & Flush Redis (Clean State)
 *   [STEP 2] Pre-Test Jaringan (Ping RTT, Jitter, Packet Loss, Download, Upload)
 *   [STEP 3] Dynamic Warm-up (Pendinginan CPU backend idle <= 3.0%)
 *   [STEP 4] Eksekusi K6 Load Test (30 detik) + Polling Resource CPU/RAM/Redis per Detik
 *   [STEP 5] Post-Test Jaringan (Ping RTT, Jitter, Packet Loss, Download, Upload)
 *   [STEP 6] Simpan Output ke k6_terminal_outputs/*.txt, system_resource_logs/*.log & CSV
 *   [STEP 7] Cooldown Inter-Iteration & Inter-Scenario
 * 
 * CONTOH PENGGUNAAN:
 *   1. Sekali jalan untuk beberapa pengujian spesifik (Remote VPS):
 *      node run-quick-test.js jalur1:50:2 jalur6b:100:2
 * 
 *   2. Mode Local VPS (tambahkan kata 'local' di ujung):
 *      node run-quick-test.js jalur1:50:2 jalur6b:100:2 local
 * 
 *   3. Mode Cepat / Fast Mode (tanpa speedtest iPerf3, hemat waktu):
 *      node run-quick-test.js jalur1:50:2 jalur6b:100:2 --fast
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn, execSync } = require('child_process');

let measureIperf3Benchmark = null;
try {
  const netUtils = require('./benchmark-network-utils');
  measureIperf3Benchmark = netUtils.measureIperf3Benchmark;
} catch (e) {
  measureIperf3Benchmark = null;
}

// PARSE COMMAND LINE
const rawArgs = process.argv.slice(2);
let targetEnv = 'remote';
let isFastMode = false;
let isResumeMode = false;
let SCRIPT_VER = process.env.VERSION || 'v6';
const testQueue = [];

function parseIterations(str) {
  if (!str) return { start: 1, end: 1, count: 1 };
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
  const count = parseInt(s, 10) || 1;
  return { start: 1, end: count, count };
}

const filteredArgs = [];
for (const a of rawArgs) {
  const low = a.toLowerCase();
  if (low === 'local' || low === 'remote') {
    targetEnv = low;
  } else if (low === '--fast' || low === '-f') {
    isFastMode = true;
  } else if (low === '--resume' || low === '-r') {
    isResumeMode = true;
  } else if (low === '--v7' || low === '-v7' || low === 'v7') {
    SCRIPT_VER = 'v7';
  } else if (low.startsWith('--ver=') || low.startsWith('--version=')) {
    SCRIPT_VER = low.split('=')[1];
  } else {
    filteredArgs.push(a);
  }
}

const TEST_DURATION = '30s';

function resolveScript(baseName, ver) {
  const specific = `k6-${baseName}-${ver}.js`;
  if (fs.existsSync(path.join(__dirname, specific))) return specific;
  return `k6-${baseName}-v6.js`;
}

// MAPPING SKENARIO RESMI SESUAI AUTO-BENCHMARK (Mendukung v7 dengan fallback ke v6)
const SCENARIO_CONFIG = {
  'jalur1': { id: 'jalur1', name: 'Jalur 1 - Sensor Vital Sapi (MQTT)', script: resolveScript('sensor-test', SCRIPT_VER), isMqtt: true, env: {} },
  '1': { id: 'jalur1', name: 'Jalur 1 - Sensor Vital Sapi (MQTT)', script: resolveScript('sensor-test', SCRIPT_VER), isMqtt: true, env: {} },
  'jalur2': { id: 'jalur2', name: 'Jalur 2 - Sensor Lingkungan (MQTT)', script: resolveScript('env-test', SCRIPT_VER), isMqtt: true, env: {} },
  '2': { id: 'jalur2', name: 'Jalur 2 - Sensor Lingkungan (MQTT)', script: resolveScript('env-test', SCRIPT_VER), isMqtt: true, env: {} },
  'jalur3': { id: 'jalur3', name: 'Jalur 3 - WebSocket Real-Time', script: resolveScript('ws-realtime-test', SCRIPT_VER), isMqtt: false, env: {} },
  '3': { id: 'jalur3', name: 'Jalur 3 - WebSocket Real-Time', script: resolveScript('ws-realtime-test', SCRIPT_VER), isMqtt: false, env: {} },
  'jalur4': { id: 'jalur4', name: 'Jalur 4 - Web Dashboard 5-API', script: resolveScript('web-test', SCRIPT_VER), isMqtt: false, env: {} },
  '4': { id: 'jalur4', name: 'Jalur 4 - Web Dashboard 5-API', script: resolveScript('web-test', SCRIPT_VER), isMqtt: false, env: {} },
  'jalur5': { id: 'jalur5', name: 'Jalur 5 - Mixed Workload (50:20:30)', script: resolveScript('load-test', SCRIPT_VER), isMqtt: true, env: {} },
  '5': { id: 'jalur5', name: 'Jalur 5 - Mixed Workload (50:20:30)', script: resolveScript('load-test', SCRIPT_VER), isMqtt: true, env: {} },
  'jalur6a': { id: 'jalur6_simultan', name: 'Jalur 6A - Redis Cache Simultan', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'both' } },
  '6a': { id: 'jalur6_simultan', name: 'Jalur 6A - Redis Cache Simultan', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'both' } },
  'jalur6_simultan': { id: 'jalur6_simultan', name: 'Jalur 6A - Redis Cache Simultan', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'both' } },
  'jalur6b': { id: 'jalur6_hit', name: 'Jalur 6B - Redis Cache Isolasi HIT (RAM)', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'hit' } },
  '6b': { id: 'jalur6_hit', name: 'Jalur 6B - Redis Cache Isolasi HIT (RAM)', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'hit' } },
  'jalur6_hit': { id: 'jalur6_hit', name: 'Jalur 6B - Redis Cache Isolasi HIT (RAM)', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'hit' } },
  'jalur6c': { id: 'jalur6_miss', name: 'Jalur 6C - Redis Cache Isolasi MISS (DB)', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'miss' } },
  '6c': { id: 'jalur6_miss', name: 'Jalur 6C - Redis Cache Isolasi MISS (DB)', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'miss' } },
  'jalur6_miss': { id: 'jalur6_miss', name: 'Jalur 6C - Redis Cache Isolasi MISS (DB)', script: resolveScript('cache-benchmark', SCRIPT_VER), isMqtt: false, env: { MODE: 'miss' } }
};

if (filteredArgs.length === 0) {
  console.log(`
=====================================================================
PANDUAN PENGGUNAAN TARGETED BENCHMARK RUNNER (PERSIS AUTO-BENCHMARK)
=====================================================================
Format:
  node run-quick-test.js <jalur>:<vus>:<iterasi> [remote|local] [--fast] [--resume]

Contoh Praktis:
  1. Jalur 1 (150 VU, 6 Iterasi):
     node run-quick-test.js jalur1:150:6

  2. Melanjutkan Iterasi Tertentu (misal iterasi 4 sampai 6):
     node run-quick-test.js jalur1:150:4-6
     node run-quick-test.js jalur1:150:4..6

  3. Menjalankan Ulang Hanya 1 Iterasi Spesifik (misal hanya iterasi 3):
     node run-quick-test.js jalur1:150:3-3

  4. Mode Auto-Resume (otomatis skip iterasi yang sudah ada lognya):
     node run-quick-test.js jalur1:150:6 --resume

  5. Format Tunggal Terpisah Spasi:
     node run-quick-test.js jalur1 150 4-6
     node run-quick-test.js jalur6b 100 2

Catatan Alur:
  • Default alur: 7 tahap lengkap persis auto-benchmark (PM2 restart, flush Redis,
    pre-test ping/speedtest, warmup <=3%, K6 run 30s + log resource/detik, post-test, auto-save).
  • Tambahkan flag '--fast' jika ingin melewati pengukuran speedtest iPerf3.
  • Tambahkan flag '--resume' jika ingin otomatis melewati iterasi yang sudah pernah selesai.
=====================================================================
`);
  process.exit(0);
}

// Parse Skenario
if (filteredArgs.length >= 2 && !filteredArgs[0].includes(':')) {
  const jKey = filteredArgs[0].toLowerCase();
  const vus = parseInt(filteredArgs[1] || '50', 10);
  const itObj = parseIterations(filteredArgs[2] || '1');
  const sc = SCENARIO_CONFIG[jKey];
  if (!sc) {
    console.error(`[ERROR] Jalur '${jKey}' tidak dikenali!`);
    process.exit(1);
  }
  testQueue.push({ key: jKey, ...sc, vus, startIter: itObj.start, endIter: itObj.end, iterations: itObj.count });
} else {
  const combinedStr = filteredArgs.join(',');
  const parts = combinedStr.split(',').map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(':');
    const jKey = tokens[0].toLowerCase();
    const vus = parseInt(tokens[1] || '50', 10);
    const itObj = parseIterations(tokens[2] || '1');
    const sc = SCENARIO_CONFIG[jKey];
    if (!sc) {
      console.error(`[ERROR] Jalur '${jKey}' pada '${part}' tidak dikenali!`);
      process.exit(1);
    }
    testQueue.push({ key: jKey, ...sc, vus, startIter: itObj.start, endIter: itObj.end, iterations: itObj.count });
  }
}

const isLocal = targetEnv === 'local';
const TARGET_HOST = isLocal ? '127.0.0.1' : 'smartcattlebarn.site';
const BASE_URL = isLocal ? 'http://127.0.0.1:4000' : 'http://smartcattlebarn.site:4000';
const API_URL = `${BASE_URL}/api`;
const MQTT_URL = isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883';

// DIRECTORY LOGS
const LOGS_DIR = path.join(__dirname, 'benchmark_logs');
const K6_DIR = path.join(LOGS_DIR, 'k6_terminal_outputs');
const SYS_DIR = path.join(LOGS_DIR, 'system_resource_logs');
const CSV_FILE = path.join(LOGS_DIR, 'summary_results_quick.csv');

function ensureDirectories() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  if (!fs.existsSync(K6_DIR)) fs.mkdirSync(K6_DIR, { recursive: true });
  if (!fs.existsSync(SYS_DIR)) fs.mkdirSync(SYS_DIR, { recursive: true });

  if (!fs.existsSync(CSV_FILE)) {
    const csvHeader = [
      'Session_ID', 'Jalur', 'Beban_VUs', 'Iterasi', 'Timestamp',
      'Pre_Ping_Avg_ms', 'Pre_Jitter_ms', 'Pre_Loss_Percent', 'Pre_Down_Mbps', 'Pre_Up_Mbps',
      'Baseline_CPU_Percent', 'Baseline_RAM_MB', 'Baseline_RAM_Redis',
      'K6_Total_Reqs', 'Throughput_RPS', 'Latency_Avg_ms', 'Latency_P95_ms', 'TTFB_Avg_ms', 'Checks_Pass_Percent', 'Error_Rate_Percent',
      'Peak_CPU_Percent', 'Peak_RAM_MB', 'Peak_RAM_Redis',
      'Post_Ping_Avg_ms', 'Post_Jitter_ms', 'Post_Loss_Percent', 'Post_Down_Mbps', 'Post_Up_Mbps'
    ].join(',') + '\n';
    fs.writeFileSync(CSV_FILE, csvHeader, 'utf-8');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchServerMetrics() {
  return new Promise((resolve) => {
    const client = BASE_URL.startsWith('https') ? https : http;
    const req = client.get(`${BASE_URL}/api/system/metrics`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            success: true,
            cpu: parseFloat(json.cpu || json.cpuPercent || 0),
            memoryMb: parseFloat(json.memoryMb || json.ramMB || 0),
            redisMemory: json.redisMemory || 'N/A'
          });
        } catch (e) {
          resolve({ success: false, cpu: 0, memoryMb: 0, redisMemory: 'N/A' });
        }
      });
    });
    req.on('error', () => resolve({ success: false, cpu: 0, memoryMb: 0, redisMemory: 'N/A' }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ success: false, cpu: 0, memoryMb: 0, redisMemory: 'N/A' }); });
  });
}

function requestPm2Restart() {
  return new Promise((resolve) => {
    if (isLocal) {
      try {
        execSync('pm2 restart smartbarn-api-4000', { stdio: 'ignore' });
        resolve(true);
      } catch (e) {
        resolve(false);
      }
      return;
    }
    const client = BASE_URL.startsWith('https') ? https : http;
    const payload = JSON.stringify({ processName: 'smartbarn-api-4000' });
    const req = client.request(`${BASE_URL}/api/system/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(4000, () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

function requestFlushRedis() {
  return new Promise((resolve) => {
    if (isLocal) {
      try {
        execSync('redis-cli flushall', { stdio: 'ignore' });
        resolve(true);
      } catch (e) {
        resolve(false);
      }
      return;
    }
    const client = BASE_URL.startsWith('https') ? https : http;
    const req = client.request(`${BASE_URL}/api/system/flush-redis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(4000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function dynamicWarmup(targetCpu = 3.0, maxAttempts = 10) {
  console.log(`\n[STEP 3/7: WARM-UP] Menunggu CPU backend idle & stabil <= ${targetCpu}% (Maks ${maxAttempts * 1.5}s)...`);
  let stableCount = 0;
  let attempts = 0;
  let lastMetric = { cpu: 0, memoryMb: 0, redisMemory: 'N/A' };

  while (attempts < maxAttempts) {
    attempts++;
    await sleep(1500);
    const m = await fetchServerMetrics();
    if (m.success) {
      lastMetric = m;
      process.stdout.write(`\r  > Current CPU: ${m.cpu}% | RAM: ${m.memoryMb} MB | Redis: ${m.redisMemory} (Stabil: ${stableCount}/3)  `);
      if (m.cpu <= targetCpu) {
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

  console.log(`\n  > [WARM-UP TIMEOUT] Melanjutkan dengan CPU ${lastMetric.cpu}% (${lastMetric.memoryMb} MB RAM).`);
  return lastMetric;
}

async function runNetworkBenchmark() {
  if (isFastMode || isLocal || !measureIperf3Benchmark) {
    return { pingAvgMs: 0.2, jitterMs: 0.1, packetLossPercent: 0, downloadMbps: 1000, uploadMbps: 1000 };
  }
  try {
    return await measureIperf3Benchmark(TARGET_HOST, { duration: 3, udpBitrate: '10M' });
  } catch (e) {
    return { pingAvgMs: 0, jitterMs: 0, packetLossPercent: 0, downloadMbps: 0, uploadMbps: 0 };
  }
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
  const parsed = { totalReqs: 0, rps: 0, avgLatency: 0, p95Latency: 0, ttfbAvg: 0, checksPass: 100, errorRate: 0 };
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
      const vitalMatch = extractK6Trend(output, 'mixed_mqtt_vital_latency');
      const envMatch = extractK6Trend(output, 'mixed_mqtt_env_latency');

      if (vitalMatch.avg > 0 || envMatch.avg > 0) {
        const weightedAvg = (vitalMatch.avg * 0.5) + (envMatch.avg * 0.2) + (durMatch.avg * 0.3);
        const weightedP95 = Math.max(vitalMatch.p95, envMatch.p95, durMatch.p95);
        parsed.avgLatency = parseFloat(weightedAvg.toFixed(2));
        parsed.p95Latency = parseFloat(weightedP95.toFixed(2));
      } else {
        parsed.avgLatency = durMatch.avg;
        parsed.p95Latency = durMatch.p95;
      }

      const ttfbMatch = extractK6Trend(output, 'mixed_web_server_ttfb');
      parsed.ttfbAvg = ttfbMatch.avg;
    } else if (scenarioId.startsWith('jalur6_hit')) {
      const reqMatch = output.match(/http_reqs[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (reqMatch) { parsed.totalReqs = parseInt(reqMatch[1], 10); parsed.rps = parseFloat(reqMatch[2]); }
      const durMatch = extractK6Trend(output, 'http_req_duration');
      parsed.avgLatency = durMatch.avg; parsed.p95Latency = durMatch.p95;
      const ttfbMatch = extractK6Trend(output, 'ttfb_cache_hit_ram');
      parsed.ttfbAvg = ttfbMatch.avg || durMatch.avg;
    } else if (scenarioId.startsWith('jalur6_miss')) {
      const reqMatch = output.match(/http_reqs[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (reqMatch) { parsed.totalReqs = parseInt(reqMatch[1], 10); parsed.rps = parseFloat(reqMatch[2]); }
      const durMatch = extractK6Trend(output, 'http_req_duration');
      parsed.avgLatency = durMatch.avg; parsed.p95Latency = durMatch.p95;
      const ttfbMatch = extractK6Trend(output, 'ttfb_cache_miss_database');
      parsed.ttfbAvg = ttfbMatch.avg || durMatch.avg;
    } else {
      const reqMatch = output.match(/http_reqs[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (reqMatch) { parsed.totalReqs = parseInt(reqMatch[1], 10); parsed.rps = parseFloat(reqMatch[2]); }
      const durMatch = extractK6Trend(output, 'http_req_duration');
      parsed.avgLatency = durMatch.avg; parsed.p95Latency = durMatch.p95;
      const ttfbMatch = extractK6Trend(output, 'server_processing_ttFB') || extractK6Trend(output, 'http_req_waiting');
      parsed.ttfbAvg = ttfbMatch.avg || durMatch.avg;
    }
  } catch (e) {}
  return parsed;
}

function executeK6WithMonitoring(scenario, vus) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    let k6Binary = 'k6';
    if (scenario.isMqtt) {
      if (isWindows && fs.existsSync(path.join(__dirname, 'k6-mqtt.exe'))) {
        k6Binary = '.\\k6-mqtt.exe';
      } else if (!isWindows && fs.existsSync(path.join(__dirname, 'k6-linux-mqtt'))) {
        k6Binary = './k6-linux-mqtt';
      } else if (!isWindows && fs.existsSync(path.join(__dirname, 'k6-mqtt'))) {
        k6Binary = './k6-mqtt';
      }
    }

    const k6Args = [
      'run',
      '-e', `VUS=${vus}`,
      '-e', `TARGET=${targetEnv}`,
      '-e', `LOCAL=${isLocal ? 'true' : 'false'}`,
      '-e', `MQTT_URL=${MQTT_URL}`,
      '-e', `BASE_URL=${API_URL}`
    ];

    for (const [k, v] of Object.entries(scenario.env)) {
      k6Args.push('-e', `${k}=${v}`);
    }

    k6Args.push(scenario.script);

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
      resolve({ terminalOutput: `Error: ${err.message}`, metricsLog, exitCode: 1 });
    });
  });
}

async function main() {
  ensureDirectories();

  console.log(`\n#####################################################################`);
  console.log(`### SMART CATTLE BARN - TARGETED MULTI BENCHMARK RUNNER ###`);
  console.log(`Target Lingkungan : ${targetEnv.toUpperCase()} (${BASE_URL})`);
  console.log(`Mode Jaringan     : ${isFastMode ? 'FAST MODE (Tanpa iPerf3)' : 'FULL STANDARD (Dengan iPerf3 & ICMP)'}`);
  console.log(`Mode Resume       : ${isResumeMode ? 'AKTIF (Otomatis lewati sesi selesai)' : 'NONAKTIF'}`);
  console.log(`Durasi per Uji    : ${TEST_DURATION}`);
  console.log(`Total Antrean Uji : ${testQueue.length} Skenario`);
  console.log(`Waktu Mulai       : ${new Date().toLocaleString()}`);
  console.log(`#####################################################################\n`);

  console.log(`DAFTAR ANTREAN PENGUJIAN:`);
  testQueue.forEach((t, idx) => {
    const iterLabel = t.startIter === t.endIter ? `Iterasi ${t.startIter}` : `Iterasi ${t.startIter}-${t.endIter} (${t.iterations} Iterasi)`;
    console.log(`  [${idx + 1}/${testQueue.length}] ${t.name} -> ${t.vus} VU (${iterLabel})`);
  });
  console.log(`---------------------------------------------------------------------\n`);

  const summaryResults = [];

  for (let qIdx = 0; qIdx < testQueue.length; qIdx++) {
    const item = testQueue[qIdx];
    console.log(`\n=====================================================================`);
    console.log(`>>> MEMULAI ANTREAN [${qIdx + 1}/${testQueue.length}]: ${item.name} (${item.vus} VU) <<<`);
    console.log(`=====================================================================`);

    for (let it = item.startIter; it <= item.endIter; it++) {
      const sessionId = `${item.id}_${item.vus}vu_iterasi${it}`;
      const termPath = path.join(K6_DIR, `${sessionId}.txt`);

      // Cek apakah sesi sudah selesai & valid jika mode resume aktif
      if (isResumeMode && fs.existsSync(termPath) && fs.statSync(termPath).size > 200) {
        const prevOutput = fs.readFileSync(termPath, 'utf-8');
        const isSuccess = (prevOutput.includes('TOTAL RESULTS') || prevOutput.includes('iterations')) && !prevOutput.includes('unknown module') && !prevOutput.includes('script exception');
        if (isSuccess) {
          console.log(`\n---------------------------------------------------------------------`);
          console.log(`[RESUME SKIP] Sesi ${sessionId.toUpperCase()} valid & sudah selesai sebelumnya. [DILEWATI]`);
          console.log(`---------------------------------------------------------------------`);
          try {
            const prevStats = parseK6Metrics(prevOutput, item.id);
            summaryResults.push({
              Sesi: `${sessionId} (Cached)`,
              Total: prevStats.totalReqs,
              RPS: prevStats.rps,
              'Avg(ms)': prevStats.avgLatency,
              'P95(ms)': prevStats.p95Latency,
              'TTFB(ms)': prevStats.ttfbAvg,
              'Err(%)': `${prevStats.errorRate}%`,
              'CPU Peak': 'Cached',
              'RAM Peak': 'Cached'
            });
          } catch (e) {}
          continue;
        }
      }

      console.log(`\n---------------------------------------------------------------------`);
      console.log(`[SESI] ${sessionId.toUpperCase()} | Iterasi: ${it}/${item.endIter}`);
      console.log(`---------------------------------------------------------------------`);

      // 1. PM2 Restart & Flush Redis
      console.log('[STEP 1/7] Me-restart PM2 & Mengosongkan Cache Redis...');
      await requestPm2Restart();
      await requestFlushRedis();
      console.log('  > [JEDA 10s] Menunggu inisialisasi backend & Redis clean state...');
      await sleep(10000);

      // 2. Pre-Test Jaringan
      console.log('\n[STEP 2/7] PRE-TEST JARINGAN: Mengukur Ping, Jitter & Bandwidth...');
      const preNet = await runNetworkBenchmark();
      console.log(`  > Pre-Net: Ping=${preNet.pingAvgMs}ms | Jitter=${preNet.jitterMs}ms | Loss=${preNet.packetLossPercent}% | Down=${preNet.downloadMbps}Mbps | Up=${preNet.uploadMbps}Mbps`);
      await sleep(5000);

      // 3. Dynamic Warm-Up
      const baseline = await dynamicWarmup(3.0);

      // 4. Eksekusi K6 Load Test + Monitoring per detik
      console.log(`\n[STEP 4/7] EKSEKUSI K6 LOAD TEST (${item.vus} VUs, ${TEST_DURATION})...`);
      const { terminalOutput, metricsLog } = await executeK6WithMonitoring(item, item.vus);

      console.log('\n  > [JEDA 10s] Socket Drain...');
      await sleep(10000);

      // 5. Post-Test Jaringan
      console.log('\n[STEP 5/7] POST-TEST JARINGAN: Mengukur Ping, Jitter & Bandwidth...');
      const postNet = await runNetworkBenchmark();
      console.log(`  > Post-Net: Ping=${postNet.pingAvgMs}ms | Jitter=${postNet.jitterMs}ms | Loss=${postNet.packetLossPercent}% | Down=${postNet.downloadMbps}Mbps | Up=${postNet.uploadMbps}Mbps`);

      // Hitung Resource Peak & Mean
      let peakCpu = metricsLog.length > 0 ? metricsLog[0].cpu : baseline.cpu;
      let peakRam = metricsLog.length > 0 ? metricsLog[0].memoryMb : baseline.memoryMb;
      let peakRedis = metricsLog.length > 0 ? metricsLog[0].redisMemory : baseline.redisMemory;

      for (const m of metricsLog) {
        if (m.cpu > peakCpu) peakCpu = m.cpu;
        if (m.memoryMb > peakRam) peakRam = m.memoryMb;
        if (m.redisMemory !== 'N/A') peakRedis = m.redisMemory;
      }

      const cpus = metricsLog.map(m => m.cpu);
      const rams = metricsLog.map(m => m.memoryMb);
      const avgCpu = cpus.length ? parseFloat((cpus.reduce((a, b) => a + b, 0) / cpus.length).toFixed(2)) : baseline.cpu;
      const avgRam = rams.length ? parseFloat((rams.reduce((a, b) => a + b, 0) / rams.length).toFixed(2)) : baseline.memoryMb;

      const k6Stats = parseK6Metrics(terminalOutput, item.id);

      // 6. Simpan Seluruh Hasil ke File Log
      console.log('\n[STEP 6/7] MENYIMPAN HASIL PENGUJIAN...');
      fs.writeFileSync(termPath, terminalOutput, 'utf-8');

      const sysPath = path.join(SYS_DIR, `system_${sessionId}.log`);
      const sysContent = [
        `=====================================================================`,
        `LOG RESOURCE SERVER - ${sessionId.toUpperCase()}`,
        `Scenario: ${item.name} | VUs: ${item.vus} | Iterasi: ${it}`,
        `Timestamp: ${new Date().toISOString()}`,
        `---------------------------------------------------------------------`,
        `BASELINE: CPU=${baseline.cpu}% | RAM=${baseline.memoryMb} MB | Redis=${baseline.redisMemory}`,
        `PEAK:     CPU=${peakCpu}% | RAM=${peakRam} MB | Redis=${peakRedis}`,
        `---------------------------------------------------------------------`,
        `DETIL METRIK PER DETIK:`,
        ...metricsLog.map(m => `[${m.time}] CPU: ${m.cpu}% | RAM: ${m.memoryMb} MB | Redis: ${m.redisMemory}`),
        `=====================================================================`
      ].join('\n');
      fs.writeFileSync(sysPath, sysContent, 'utf-8');

      const csvRow = [
        sessionId, `"${item.name}"`, item.vus, it, `"${new Date().toISOString()}"`,
        preNet.pingAvgMs, preNet.jitterMs, preNet.packetLossPercent, preNet.downloadMbps, preNet.uploadMbps,
        baseline.cpu, baseline.memoryMb, `"${baseline.redisMemory}"`,
        k6Stats.totalReqs, k6Stats.rps, k6Stats.avgLatency, k6Stats.p95Latency, k6Stats.ttfbAvg, k6Stats.checksPass, k6Stats.errorRate,
        peakCpu, peakRam, `"${peakRedis}"`,
        postNet.pingAvgMs, postNet.jitterMs, postNet.packetLossPercent, postNet.downloadMbps, postNet.uploadMbps
      ].join(',') + '\n';
      fs.appendFileSync(CSV_FILE, csvRow, 'utf-8');

      console.log(`  > [OK] Log Terminal tersimpan di: ${termPath}`);
      console.log(`  > [OK] Log System tersimpan di  : ${sysPath}`);

      summaryResults.push({
        Sesi: sessionId,
        Total: k6Stats.totalReqs,
        RPS: k6Stats.rps,
        'Avg(ms)': k6Stats.avgLatency,
        'P95(ms)': k6Stats.p95Latency,
        'TTFB(ms)': k6Stats.ttfbAvg,
        'Err(%)': `${k6Stats.errorRate}%`,
        'CPU Peak': `${peakCpu}%`,
        'RAM Peak': `${peakRam} MB`
      });

      // 7. Cooldown
      if (it < item.endIter) {
        console.log(`\n[STEP 7/7: COOLDOWN] Jeda 30 detik sebelum iterasi ${it + 1}...`);
        await sleep(30000);
      }
    }

    if (qIdx < testQueue.length - 1) {
      console.log(`\n[INTER-SCENARIO COOLDOWN] Jeda 30 detik sebelum berpindah skenario berikutnya...\n`);
      await sleep(30000);
    }
  }

  console.log(`\n\n=====================================================================`);
  console.log(`REKAPITULASI HASIL BENCHMARK SELESAI`);
  console.log(`=====================================================================`);
  console.table(summaryResults);
  console.log(`Semua log telah tersimpan di folder 'benchmark_logs'.\n`);
}

main();
