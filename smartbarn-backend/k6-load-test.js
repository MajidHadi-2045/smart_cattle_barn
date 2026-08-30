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
      email: ADMIN_EMAIL,
      username: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'SUPER_ADMIN',
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

  // Mengacak beban: 50% Sensor Sapi, 20% Sensor Lingkungan & Angin, 30% Web Dashboard
  const rand = Math.random();

  if (rand < 0.50) {
    // =========================================================================
    // SKENARIO 1: Simulasi Kalung Sensor Vital Sapi (50% Trafik)
    // Endpoint Ingestion Telemetri (Redis & BullMQ Queue)
    // =========================================================================
    const cattleIds = ['C-302', 'C-304', 'C-500', 'C-576', 'C-904'];
    const randomCattle = cattleIds[Math.floor(Math.random() * cattleIds.length)];

    const payload = JSON.stringify({
      cattleId: randomCattle,
      heartRate: Math.floor(60 + Math.random() * 30),
      bodyTemperature: parseFloat((37.5 + Math.random() * 2.0).toFixed(1)),
    });

    const res = http.post(`${BASE_URL}/livestock/vital`, payload, { headers: { 'Content-Type': 'application/json' } });
    
    check(res, {
      'Sensor Vital Status 200/201': (r) => r.status === 200 || r.status === 201,
      'Sensor Vital Success Response': (r) => r.body && r.body.includes('success'),
    });

  } else if (rand < 0.70) {
    // =========================================================================
    // SKENARIO 2: Simulasi Sensor Lingkungan & Windspeed Kandang (20% Trafik)
    // Endpoint Ingestion Telemetri Lingkungan (In-Memory Redis + Batch Flush)
    // =========================================================================
    const isWind = Math.random() < 0.5;

    if (!isWind) {
      // A. Sensor Lingkungan (Suhu, RH, Amonia, THI)
      const envPayload = JSON.stringify({
        zoneId: 1,
        type: 'zone_sensor',
        temperature: parseFloat((27.5 + Math.random() * 5.0).toFixed(1)),
        humidity: parseFloat((60.0 + Math.random() * 20.0).toFixed(1)),
        ammonia: parseFloat((8.0 + Math.random() * 8.0).toFixed(1)),
        thi: parseFloat((75.0 + Math.random() * 6.0).toFixed(1)),
        timestamp: new Date().toISOString(),
      });
      const resEnv = http.post(`${BASE_URL}/environment/sensor`, envPayload, { headers: { 'Content-Type': 'application/json' } });
      check(resEnv, {
        'Sensor Lingkungan OK (200/201)': (r) => r.status === 200 || r.status === 201,
      });
    } else {
      // B. Sensor Windspeed (Kecepatan Angin)
      const windPayload = JSON.stringify({
        zoneId: 1,
        type: 'wind_sensor',
        windspeed: parseFloat((1.2 + Math.random() * 3.5).toFixed(2)),
        timestamp: new Date().toISOString(),
      });
      const resWind = http.post(`${BASE_URL}/environment/sensor`, windPayload, { headers: { 'Content-Type': 'application/json' } });
      check(resWind, {
        'Sensor Windspeed OK (200/201)': (r) => r.status === 200 || r.status === 201,
      });
    }

  } else {
    // =========================================================================
    // SKENARIO 3: Simulasi Pengguna Web Dashboard (30% Trafik)
    // =========================================================================
    // 1. Ringkasan Total Sapi
    const resSummary = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
    check(resSummary, {
      'Web Dashboard Summary OK (200)': (r) => r.status === 200,
    });

    // 2. Statistik Populasi per Seksi Kandang
    const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
    check(resStats, {
      'Web Livestock Stats OK (200)': (r) => r.status === 200,
    });

    // 3. Daftar Sapi di Section Kandang
    const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
    check(resList, {
      'Web Daftar Sapi Section OK (200)': (r) => r.status === 200,
    });

    // 4. Sensor Lingkungan Live (Suhu, RH, THI Kandang)
    const resEnvLive = http.get(`${BASE_URL}/environment/live/1`, { headers: authHeaders });
    check(resEnvLive, { 'Web Env Live OK (200)': (r) => r.status === 200 || r.status === 404 });

    // 5. Sensor Windspeed Live (Kecepatan Angin)
    const resWindLive = http.get(`${BASE_URL}/environment/live-wind/1`, { headers: authHeaders });
    check(resWindLive, { 'Web Wind Live OK (200)': (r) => r.status === 200 || r.status === 404 });

    // 6. Manajemen Limbah Harian (Feses & Urine Kandang)
    const resWaste = http.get(`${BASE_URL}/dashboard/waste?filter=daily`, { headers: authHeaders });
    check(resWaste, { 'Web Waste Summary OK (200)': (r) => r.status === 200 });
  }

  // Jeda 1 detik meniru interval sensor & interaksi user
  sleep(1);
}

