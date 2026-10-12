const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'benchmark_logs', 'summary_results_quick.csv');
const logsDir = path.join(__dirname, 'benchmark_logs', 'k6_terminal_outputs');

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
      if (procMatch) { parsed.totalReqs = parseInt(procMatch[1], 10); parsed.rps = parseFloat(procMatch[2]); }
      else if (sentMatch) { parsed.totalReqs = parseInt(sentMatch[1], 10); parsed.rps = parseFloat(sentMatch[2]); }
      const lat = extractK6Trend(output, 'mqtt_vital_processing_latency');
      parsed.avgLatency = lat.avg; parsed.p95Latency = lat.p95;
      const pubLat = extractK6Trend(output, 'mqtt_vital_publish_latency');
      parsed.ttfbAvg = pubLat.avg;
    } else if (scenarioId.startsWith('jalur2')) {
      const procMatch = output.match(/mqtt_env_messages_processed[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      const sentMatch = output.match(/mqtt_env_messages_sent[^\n]+?:\s*(\d+)\s+([\d.]+)\/s/);
      if (procMatch) { parsed.totalReqs = parseInt(procMatch[1], 10); parsed.rps = parseFloat(procMatch[2]); }
      else if (sentMatch) { parsed.totalReqs = parseInt(sentMatch[1], 10); parsed.rps = parseFloat(sentMatch[2]); }
      const lat = extractK6Trend(output, 'mqtt_env_processing_latency');
      parsed.avgLatency = lat.avg; parsed.p95Latency = lat.p95;
      const pubLat = extractK6Trend(output, 'mqtt_env_publish_latency');
      parsed.ttfbAvg = pubLat.avg;
    }
  } catch (e) {}
  return parsed;
}

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
const header = lines[0];
const updatedRows = [header];

const summaryTable = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const cols = parseCSVLine(line);
  const sessionId = cols[0];
  const txtFile = path.join(logsDir, sessionId + '.txt');
  
  if (fs.existsSync(txtFile)) {
    const content = fs.readFileSync(txtFile, 'utf8');
    const m = parseK6Metrics(content, sessionId);
    
    cols[13] = m.totalReqs;
    cols[14] = m.rps;
    cols[15] = m.avgLatency;
    cols[16] = m.p95Latency;
    cols[17] = m.ttfbAvg;
    cols[18] = m.checksPass;
    cols[19] = m.errorRate;

    summaryTable.push({
      Sesi: sessionId,
      Total: m.totalReqs,
      RPS: m.rps,
      'Avg(ms)': m.avgLatency,
      'P95(ms)': m.p95Latency,
      'TTFB(ms)': m.ttfbAvg,
      'Err(%)': m.errorRate + '%',
      'CPU Peak': cols[20] + '%',
      'RAM Peak': cols[21] + ' MB'
    });
  }
  updatedRows.push(cols.join(','));
}

try {
  fs.writeFileSync(csvPath, updatedRows.join('\n') + '\n', 'utf8');
  console.log('SUCCESS: summary_results_quick.csv updated!');
} catch (err) {
  if (err.code === 'EBUSY') {
    const backupPath = path.join(__dirname, 'benchmark_logs', 'summary_results_quick_fixed.csv');
    fs.writeFileSync(backupPath, updatedRows.join('\n') + '\n', 'utf8');
    console.log(`[PERINGATAN] File 'summary_results_quick.csv' sedang dibuka di Excel atau aplikasi lain.`);
    console.log(`Hasil yang sudah diperbaiki disimpan ke: ${backupPath}`);
  } else {
    throw err;
  }
}
console.table(summaryTable);
