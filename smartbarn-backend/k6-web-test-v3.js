import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// KONFIGURASI TARGET & KREDENSIAL (V3: DINAMIS 100% BEBAS STAGE)
// =========================================================================
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const BASE_URL = __ENV.BASE_URL || (isLocal ? 'http://127.0.0.1:4000/api' : 'http://smartcattlebarn.site:4000/api');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'goodakun42@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'rahasia1234';

// =========================================================================
// METRIK V3: PEMISAHAN KOMPUTASI SERVER VS JARINGAN INTERNET
// =========================================================================
const serverProcessingTTFB = new Trend('server_processing_ttfb');     // TTFB murni NestJS + Redis RAM + PostgreSQL
const networkTcpHandshake = new Trend('network_tcp_handshake');       // Waktu TCP Handshake
const networkTlsHandshake = new Trend('network_tls_handshake');       // Waktu TLS/SSL Handshake
const networkDataReceiving = new Trend('network_data_receiving');     // Waktu unduh paket data
const totalHttpDuration = new Trend('total_http_duration');           // Total Round-Trip Time
const totalDashboardRequests = new Counter('total_dashboard_requests');

// V3 OPTIONS: TANPA STAGES (User bebas menentukan --vus dan --duration dari CLI)
export const options = {
  thresholds: {
    // 1. Error Rate < 1% (Standar Google SRE)
    http_req_failed: ['rate<0.01'],

    // 2. Waktu Murni Server (TTFB): Target < 200ms
    http_req_waiting: ['p(95)<200'],
    server_processing_ttfb: ['p(95)<200'],

    // 3. Negosiasi Jaringan TCP: Target < 300ms
    http_req_connecting: ['p(95)<300'],
    network_tcp_handshake: ['p(95)<300'],

    // 4. Transfer Download Data: Target < 100ms
    http_req_receiving: ['p(95)<100'],
    network_data_receiving: ['p(95)<100'],

    // 5. Total Round-Trip Duration: Target p(95) < 800ms
    http_req_duration: ['p(95)<800'],
    total_http_duration: ['p(95)<800'],
  },
};

// Setup: Login untuk mengambil token JWT Super Admin
export function setup() {
  try {
    const loginPayload = JSON.stringify({
      email: ADMIN_EMAIL,
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'SUPER_ADMIN',
    });

    const headers = { 'Content-Type': 'application/json' };
    const res = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers, timeout: '15s' });

    if (res.status === 200 || res.status === 201) {
      const body = res.json();
      return { token: body.accessToken || body.access_token || body.token || '' };
    }
  } catch (err) {
    console.warn(`[Setup Warning] Gagal login ke ${BASE_URL}/auth/login: ${err.message}`);
  }
  return { token: '' };
}

function recordTimings(res) {
  if (res && res.timings) {
    serverProcessingTTFB.add(res.timings.waiting);
    networkTcpHandshake.add(res.timings.connecting);
    networkTlsHandshake.add(res.timings.tls_handshaking);
    networkDataReceiving.add(res.timings.receiving);
    totalHttpDuration.add(res.timings.duration);
    totalDashboardRequests.add(1);
  }
}

export default function (data) {
  const authHeaders = {
    'Content-Type': 'application/json',
  };
  if (data && data.token) {
    authHeaders['Authorization'] = 'Bearer ' + data.token;
  }

  // 1. Dashboard Summary
  const resSummary = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
  recordTimings(resSummary);
  check(resSummary, { 'Dashboard Summary OK (200)': (r) => r.status === 200 });

  // 2. Statistik Ternak
  const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
  recordTimings(resStats);
  check(resStats, { 'Dashboard Stats OK (200)': (r) => r.status === 200 });

  // 3. Daftar Sapi di Seksi Kandang
  const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
  recordTimings(resList);
  check(resList, { 'Daftar Sapi Section OK (200)': (r) => r.status === 200 });

  // 4. Sensor Lingkungan Live (RAM Redis)
  const resEnvLive = http.get(`${BASE_URL}/environment/live/1`, { headers: authHeaders });
  recordTimings(resEnvLive);
  check(resEnvLive, { 'Dashboard Env Live OK (200)': (r) => r.status === 200 || r.status === 404 });

  // 5. Manajemen Limbah Harian
  const resWaste = http.get(`${BASE_URL}/dashboard/waste?filter=daily`, { headers: authHeaders });
  recordTimings(resWaste);
  check(resWaste, { 'Dashboard Waste Summary OK (200)': (r) => r.status === 200 });

  sleep(1);
}
