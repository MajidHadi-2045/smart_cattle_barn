import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// KONFIGURASI TARGET & KREDENSIAL
// =========================================================================
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const BASE_URL = __ENV.BASE_URL || (isLocal ? 'http://127.0.0.1:4000/api' : 'http://smartcattlebarn.site:4000/api');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'goodakun42@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'rahasia1234';

// =========================================================================
// METRIK V2: PEMISAHAN KOMPUTASI SERVER VS JARINGAN INTERNET
// =========================================================================
// 1. TTFB (Time To First Byte): Waktu murni komputasi NestJS + Redis RAM + PostgreSQL
const serverProcessingTTFB = new Trend('server_processing_ttfb');
// 2. TCP Handshake Time: Waktu negosiasi socket TCP antara klien dan server
const networkTcpHandshake = new Trend('network_tcp_handshake');
// 3. TLS Handshake Time: Waktu negosiasi enkripsi HTTPS/SSL
const networkTlsHandshake = new Trend('network_tls_handshake');
// 4. Data Receiving Time: Waktu transfer unduh paket data dari server ke klien
const networkDataReceiving = new Trend('network_data_receiving');
// 5. Total Response Duration: Total waktu bolak-balik (Round-Trip Time)
const totalHttpDuration = new Trend('total_http_duration');
// 6. Request Counter
const totalDashboardRequests = new Counter('total_dashboard_requests');

const targetVUs = parseInt(__ENV.VUS || '100', 10);
const warmupVUs = Math.max(1, Math.floor(targetVUs * 0.4));

export const options = {
  stages: [
    { duration: '5s', target: warmupVUs },   // Tahap 1: Ramp-up bertahap awal (40% beban)
    { duration: '5s', target: targetVUs },   // Tahap 2: Naik ke beban target (10, 50, atau 100 VU)
    { duration: '15s', target: targetVUs },  // Tahap 3: Tahan stabil di beban puncak
    { duration: '5s', target: 0 },           // Tahap 4: Ramp-down pendinginan ke 0 VU
  ],
  thresholds: {
    // 1. Error Rate < 1% (Standar Google SRE)
    http_req_failed: ['rate<0.01'],

    // 2. Waktu Murni Server (TTFB): Target < 200ms
    // Menunjukkan komputasi NestJS + Redis RAM sangat cepat (< 20ms di lokal, < 50ms di VPS)
    http_req_waiting: ['p(95)<200'],
    server_processing_ttfb: ['p(95)<200'],

    // 3. Negosiasi Jaringan TCP: Target < 300ms (toleransi latency Wi-Fi/Internet)
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

// Helper untuk mencatat rincian metrik latency v2
function recordTimings(res) {
  if (res && res.timings) {
    serverProcessingTTFB.add(res.timings.waiting);       // Waktu murni server
    networkTcpHandshake.add(res.timings.connecting);    // Waktu TCP Handshake
    networkTlsHandshake.add(res.timings.tls_handshaking); // Waktu TLS/SSL Handshake
    networkDataReceiving.add(res.timings.receiving);    // Waktu transfer download
    totalHttpDuration.add(res.timings.duration);         // Total durasi request
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

  // =========================================================================
  // ENDPOINT 1 (WAJIB): Memanggil Kartu Ringkasan Sapi (Total, Sehat, Sakit, Hamil)
  // =========================================================================
  const resSummary = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
  recordTimings(resSummary);
  check(resSummary, {
    'Dashboard Summary OK (200)': (r) => r.status === 200,
  });

  // =========================================================================
  // ENDPOINT 2 (WAJIB): Memanggil Grafik Statistik Populasi per Seksi Kandang
  // =========================================================================
  const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
  recordTimings(resStats);
  check(resStats, {
    'Dashboard Stats OK (200)': (r) => r.status === 200,
  });

  // =========================================================================
  // ENDPOINT 3 (WAJIB): Memanggil Baris Tabel Daftar Sapi di Section Kandang
  // =========================================================================
  const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
  recordTimings(resList);
  check(resList, {
    'Daftar Sapi Section OK (200)': (r) => r.status === 200,
  });

  // =========================================================================
  // ENDPOINT 4 (OPSIONAL): Sensor Lingkungan Live (Suhu, RH, THI Kandang)
  // =========================================================================
  const resEnvLive = http.get(`${BASE_URL}/environment/live/1`, { headers: authHeaders });
  recordTimings(resEnvLive);
  check(resEnvLive, { 'Dashboard Env Live OK (200)': (r) => r.status === 200 || r.status === 404 });

  // =========================================================================
  // ENDPOINT 5 (OPSIONAL): Manajemen Limbah Harian (Feses & Urine Kandang)
  // =========================================================================
  const resWaste = http.get(`${BASE_URL}/dashboard/waste?filter=daily`, { headers: authHeaders });
  recordTimings(resWaste);
  check(resWaste, { 'Dashboard Waste Summary OK (200)': (r) => r.status === 200 });

  sleep(1);
}
