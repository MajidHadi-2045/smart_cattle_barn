import http from 'k6/http';
import { check, sleep } from 'k6';

// Base URL: Menggunakan environment variable BASE_URL jika ada, default ke localhost:4000/api
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'majid123@example.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'rahasia123';

// Konfigurasi Pengujian k6 (Threshold & Stages)
export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Ramp-up ke 20 Virtual Users
    { duration: '30s', target: 50 },  // Beban konstan 50 Virtual Users
    { duration: '10s', target: 0 },   // Ramp-down ke 0 Users
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],   // Toleransi error < 5%
    http_req_duration: ['p(95)<1000'], // 95% request harus selesai di bawah 1 detik (1000ms)
  },
};

// Setup: Mendapatkan JWT Token untuk request yang membutuhkan autentikasi
export function setup() {
  try {
    const loginPayload = JSON.stringify({
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    const headers = { 'Content-Type': 'application/json' };
    const res = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers, timeout: '5s' });

    if (res.status === 200 || res.status === 201) {
      const body = res.json();
      return { token: body.accessToken || body.access_token || body.token || '' };
    }
  } catch (err) {
    console.warn(`[Setup Warning] Gagal login ke ${BASE_URL}/auth/login: ${err.message}`);
  }
  return { token: '' };
}

export default function (data) {
  const authHeaders = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // Mengacak beban: 70% simulasi data sensor IoT, 30% aktivitas Web Dashboard
  const isSensor = Math.random() < 0.7;

  if (isSensor) {
    // ========================================================
    // SKENARIO 1: Simulasi Kalung Sensor Sapi (70% Trafik)
    // endpoint Ingestion Telemetri (Redis & BullMQ Queue)
    // ========================================================
    const cattleIds = ['C-302', 'C-304', 'C-500', 'C-576', 'C-904'];
    const randomCattle = cattleIds[Math.floor(Math.random() * cattleIds.length)];

    const payload = JSON.stringify({
      cattleId: randomCattle,
      heartRate: Math.floor(60 + Math.random() * 30),
      bodyTemperature: parseFloat((37.5 + Math.random() * 2.5).toFixed(1)),
    });

    const res = http.post(`${BASE_URL}/livestock/vital`, payload, { headers: { 'Content-Type': 'application/json' } });
    
    check(res, {
      'Sensor Vital Status 200/201': (r) => r.status === 200 || r.status === 201,
      'Response memuat status success': (r) => r.body && r.body.includes('success'),
    });

  } else {
    // ========================================================
    // SKENARIO 2: Simulasi Pengguna Web Dashboard (30% Trafik)
    // endpoint pemantauan utama
    // ========================================================
    const resSummary = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
    check(resSummary, {
      'Web Dashboard Summary OK (200)': (r) => r.status === 200,
    });

    const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
    check(resStats, {
      'Web Livestock Stats OK (200)': (r) => r.status === 200,
    });

    const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
    check(resList, {
      'Web Daftar Sapi Section OK (200)': (r) => r.status === 200,
    });
  }

  // Jeda 1 detik meniru jeda antar interval sensor & klik user
  sleep(1);
}

