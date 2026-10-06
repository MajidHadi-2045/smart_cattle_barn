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
// METRIK V6: HEAD-TO-HEAD CACHE HIT (RAM) VS CACHE MISS (DB) - TANPA RAMP DOWN KE 0
// =========================================================================
// 1. Total Durasi
const cacheHitDuration = new Trend('http_duration_cache_hit');
const cacheMissDuration = new Trend('http_duration_cache_miss');

// 2. Waktu Murni Server (TTFB) untuk membedakan Kecepatan RAM vs Kecepatan DB
const cacheHitTTFB = new Trend('ttfb_cache_hit_ram');         // TTFB saat dilayani RAM Redis (< 5ms)
const cacheMissTTFB = new Trend('ttfb_cache_miss_database');  // TTFB saat eksekusi SQL GROUP BY (~15-50ms)

// 3. Jaringan Internet & Download
const tcpHandshakeTime = new Trend('network_tcp_handshake');
const dataReceivingTime = new Trend('network_data_receiving');

// 4. Penghitung Transaksi
const cacheHitCount = new Counter('total_cache_hits');
const cacheMissCount = new Counter('total_cache_misses');

const targetVUs = parseInt(__ENV.VUS || '100', 10);
const warmupVUs = Math.max(1, Math.floor(targetVUs * 0.4));

export const options = {
  stages: [
    { duration: '5s', target: warmupVUs },   // Tahap 1: Ramp-up bertahap awal (40% beban)
    { duration: '5s', target: targetVUs },   // Tahap 2: Naik ke beban target (10, 50, atau 100 VU)
    { duration: '20s', target: targetVUs },  // Tahap 3: Tahan stabil di beban puncak sampai akhir (tanpa ramp-down ke 0)
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    ttfb_cache_hit_ram: ['p(95)<100'],         // RAM harus sangat cepat
    ttfb_cache_miss_database: ['p(95)<500'],   // DB di bawah 500ms
    http_req_waiting: ['p(95)<500'],
    http_duration_cache_hit: ['p(95)<500'],
    http_duration_cache_miss: ['p(95)<1000'],
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
    const res = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers, timeout: '15s' });

    if (res.status === 200 || res.status === 201) {
      const body = res.json();
      const token = body.accessToken || body.access_token || body.token || '';

      // Warm-up Redis cache
      http.get(`${BASE_URL}/livestock/stats/1`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      return { token };
    }
  } catch (err) {
    console.warn(`[Setup Warning] Gagal setup: ${err.message}`);
  }
  return { token: '' };
}

export default function (data) {
  const authHeaders = {
    'Content-Type': 'application/json',
  };
  if (data && data.token) {
    authHeaders['Authorization'] = 'Bearer ' + data.token;
  }

  const mode = __ENV.MODE || 'both'; // 'hit', 'miss', atau 'both' (default)

  if (mode === 'hit') {
    // Mode Murni Cache HIT (Hanya memanggil Redis RAM)
    const resHit = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
    if (resHit && resHit.status === 200) {
      cacheHitDuration.add(resHit.timings.duration);
      cacheHitTTFB.add(resHit.timings.waiting);
      tcpHandshakeTime.add(resHit.timings.connecting);
      dataReceivingTime.add(resHit.timings.receiving);
      cacheHitCount.add(1);
    }
    check(resHit, { 'Cache HIT OK (Status 200)': (r) => r.status === 200 });
  } else if (mode === 'miss') {
    // Mode Murni Cache MISS (Memaksa Database PostgreSQL GROUP BY)
    const resMiss = http.get(`${BASE_URL}/livestock/stats/1?fresh=true`, { headers: authHeaders });
    if (resMiss && resMiss.status === 200) {
      cacheMissDuration.add(resMiss.timings.duration);
      cacheMissTTFB.add(resMiss.timings.waiting);
      tcpHandshakeTime.add(resMiss.timings.connecting);
      dataReceivingTime.add(resMiss.timings.receiving);
      cacheMissCount.add(1);
    }
    check(resMiss, { 'Cache MISS Database OK (Status 200)': (r) => r.status === 200 });
  } else {
    // Mode PARALEL BOTH (Mengeksekusi keduanya secara bersamaan)
    const responses = http.batch([
      ['GET', `${BASE_URL}/livestock/stats/1`, null, { headers: authHeaders }],               // Cache HIT (Redis RAM)
      ['GET', `${BASE_URL}/livestock/stats/1?fresh=true`, null, { headers: authHeaders }],   // Cache MISS (PostgreSQL DB)
    ]);

    const resHit = responses[0];
    const resMiss = responses[1];

    if (resHit && resHit.status === 200) {
      cacheHitDuration.add(resHit.timings.duration);
      cacheHitTTFB.add(resHit.timings.waiting);
      tcpHandshakeTime.add(resHit.timings.connecting);
      dataReceivingTime.add(resHit.timings.receiving);
      cacheHitCount.add(1);
    }

    if (resMiss && resMiss.status === 200) {
      cacheMissDuration.add(resMiss.timings.duration);
      cacheMissTTFB.add(resMiss.timings.waiting);
      tcpHandshakeTime.add(resMiss.timings.connecting);
      dataReceivingTime.add(resMiss.timings.receiving);
      cacheMissCount.add(1);
    }

    check(resHit, { 'Cache HIT OK (Status 200)': (r) => r.status === 200 });
    check(resMiss, { 'Cache MISS Database OK (Status 200)': (r) => r.status === 200 });
  }

  sleep(1);
}
