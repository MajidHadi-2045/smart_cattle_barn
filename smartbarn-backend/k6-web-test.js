import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'majid123@example.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'rahasia123';

export const options = {
  stages: [
    { duration: '5s', target: 20 },
    { duration: '20s', target: 50 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    // ERROR RATE: Toleransi error < 1%
    // Ref: Google SRE Book - Error Budget <= 1%
    http_req_failed: ['rate<0.01'],

    // LATENSI HTTP WEB DASHBOARD via WiFi:
    // p(95) < 800ms — Tiap iterasi VU memanggil 5 endpoint GET berurutan
    // Rata-rata per-request ~200ms, threshold 800ms = ruang wajar untuk request terberat
    // Ref: k6 Docs - threshold best practice: set at 2x-3x observed average per request
    // Ref: W3C Web Performance WG - halaman dashboard data < 1000ms acceptable
    http_req_duration: ['p(95)<800'],
  },
};

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

  // =========================================================================
  // ENDPOINT 1 (WAJIB): Memanggil Kartu Ringkasan Sapi (Total, Sehat, Sakit, Hamil)
  // =========================================================================
  const resSummary = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
  check(resSummary, {
    'Dashboard Summary OK (200)': (r) => r.status === 200,
  });

  // =========================================================================
  // ENDPOINT 2 (WAJIB): Memanggil Grafik Statistik Populasi per Seksi Kandang
  // =========================================================================
  const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
  check(resStats, {
    'Dashboard Stats OK (200)': (r) => r.status === 200,
  });

  // =========================================================================
  // ENDPOINT 3 (WAJIB): Memanggil Baris Tabel Daftar Sapi di Section Kandang
  // =========================================================================
  const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
  check(resList, {
    'Daftar Sapi Section OK (200)': (r) => r.status === 200,
  });

  // =========================================================================
  // ENDPOINT 4 (OPSIONAL): Sensor Lingkungan Live (Suhu, RH, THI Kandang)
  // Keterangan: Mengambil data suhu & kelembaban live dari RAM Redis (< 1ms).
  // Hapus tanda // di bawah dua baris di bawah ini jika ingin mengaktifkannya:
  // =========================================================================
  const resEnvLive = http.get(`${BASE_URL}/environment/live/1`, { headers: authHeaders });
  check(resEnvLive, { 'Dashboard Env Live OK (200)': (r) => r.status === 200 || r.status === 404 });

  // =========================================================================
  // ENDPOINT 5 (OPSIONAL): Manajemen Limbah Harian (Feses & Urine Kandang)
  // Keterangan: Mengambil akumulasi limbah harian dari PostgreSQL.
  // Hapus tanda // di bawah dua baris di bawah ini jika ingin mengaktifkannya:
  // =========================================================================
  const resWaste = http.get(`${BASE_URL}/dashboard/waste?filter=daily`, { headers: authHeaders });
  check(resWaste, { 'Dashboard Waste Summary OK (200)': (r) => r.status === 200 });

  sleep(1);
}

