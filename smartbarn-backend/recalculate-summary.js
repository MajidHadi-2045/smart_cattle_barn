const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, 'benchmark_logs');
const K6_DIR = path.join(LOGS_DIR, 'k6_terminal_outputs');
const CSV_FILE = path.join(LOGS_DIR, 'summary_results.csv');
const CSV_FILE_V2 = path.join(LOGS_DIR, 'summary_results_v2.csv');

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

      const ttfbMatch = extractK6Trend(output, 'http_req_waiting');
      parsed.ttfbAvg = ttfbMatch.avg;
    }
  } catch (e) {}

  return parsed;
}

// Baca CSV saat ini
if (fs.existsSync(CSV_FILE)) {
  const content = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0];
  const updatedRows = [header];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV row
    const cols = line.split(',');
    const sessionId = cols[0];
    const txtFile = path.join(K6_DIR, `${sessionId}.txt`);

    if (fs.existsSync(txtFile)) {
      const rawTxt = fs.readFileSync(txtFile, 'utf-8');
      const stats = parseK6Metrics(rawTxt, sessionId);

      // Kolom 12: K6_Total_Reqs
      cols[12] = stats.totalReqs;
      // Kolom 13: Throughput_RPS
      cols[13] = stats.rps;
      // Kolom 14: Latency_Avg_ms
      cols[14] = stats.avgLatency;
      // Kolom 15: Latency_P95_ms
      cols[15] = stats.p95Latency;
      // Kolom 16: TTFB_Avg_ms
      cols[16] = stats.ttfbAvg;
      // Kolom 17: Checks_Pass_Percent
      cols[17] = stats.checksPass;
      // Kolom 18: Error_Rate_Percent
      cols[18] = stats.errorRate;

      updatedRows.push(cols.join(','));
    } else {
      updatedRows.push(line);
    }
  }

  const finalCsvData = updatedRows.join('\n') + '\n';
  fs.writeFileSync(CSV_FILE_V2, finalCsvData, 'utf-8');
  console.log(`[BERHASIL] File ${CSV_FILE_V2} telah dibuat dengan Throughput & Latensi protokol spesifik!`);

  try {
    fs.writeFileSync(CSV_FILE, finalCsvData, 'utf-8');
    console.log(`[BERHASIL] File ${CSV_FILE} juga berhasil diperbarui!`);
  } catch (e) {
    console.log(`[NOTE] File summary_results.csv sedang dibuka di aplikasi lain, silakan gunakan summary_results_v2.csv.`);
  }
} else {
  console.log('[INFO] CSV file belum ada.');
}
