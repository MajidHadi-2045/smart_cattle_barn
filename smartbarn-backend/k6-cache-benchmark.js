import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// KONFIGURASI ENDPOINT & KREDENSIAL
// =========================================================================
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const BASE_URL = __ENV.BASE_URL || (isLocal ? 'http://127.0.0.1:4000/api' : 'http://smartcattlebarn.site:4000/api');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'goodakun42@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'rahasia1234';

// =========================================================================
// METRIK HEAD-TO-HEAD: CACHE HIT (REDIS RAM) VS CACHE MISS (POSTGRESQL DB)
// =========================================================================
const cacheHitDuration = new Trend('http_duration_cache_hit');     // Waktu respons saat dilayani dari Redis RAM
const cacheMissDuration = new Trend('http_duration_cache_miss');   // Waktu respons saat dipaksa query ke Database PostgreSQL
const cacheHitCount = new Counter('total_cache_hits');
const cacheMissCount = new Counter('total_cache_misses');

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_duration_cache_hit: ['p(95)<500'],
    http_duration_cache_miss: ['p(95)<1000'],
  },
};

// Setup: Login untuk mendapatkan Bearer JWT Token
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
      const token = body.accessToken || body.access_token || body.token || '';

      // WARM-UP REDIS CACHE: Panggil 1 kali agar data statistik tersimpan di Redis RAM (TTL 300s)
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

  // =========================================================================
  // EKSEKUSI PENGUJIAN HEAD-TO-HEAD STATISTIK:
  // - Request HIT  : Mengambil ringkasan agregasi yang sudah di-cache di Redis RAM
  // - Request MISS : Memaksa PostgreSQL melakukan komputasi GROUP BY & COUNT real-time
  // =========================================================================
  if (mode === 'hit') {
    // Mode Murni Cache HIT (Hanya memanggil Redis RAM)
    const resHit = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
    if (resHit && resHit.status === 200) {
      cacheHitDuration.add(resHit.timings.duration);
      cacheHitCount.add(1);
    }
    check(resHit, { 'Cache HIT OK (Status 200)': (r) => r.status === 200 });
  } else if (mode === 'miss') {
    // Mode Murni Cache MISS (Hanya memanggil Database PostgreSQL GROUP BY)
    const resMiss = http.get(`${BASE_URL}/livestock/stats/1?fresh=true`, { headers: authHeaders });
    if (resMiss && resMiss.status === 200) {
      cacheMissDuration.add(resMiss.timings.duration);
      cacheMissCount.add(1);
    }
    check(resMiss, { 'Cache MISS Database OK (Status 200)': (r) => r.status === 200 });
  } else {
    // Mode PARALEL BOTH (Mengeksekusi keduanya secara bersamaan)
    const responses = http.batch([
      ['GET', `${BASE_URL}/livestock/stats/1`, null, { headers: authHeaders }],               // Cache HIT (Redis RAM)
      ['GET', `${BASE_URL}/livestock/stats/1?fresh=true`, null, { headers: authHeaders }],   // Cache MISS (PostgreSQL GROUP BY)
    ]);

    const resHit = responses[0];
    const resMiss = responses[1];

    if (resHit && resHit.status === 200) {
      cacheHitDuration.add(resHit.timings.duration);
      cacheHitCount.add(1);
    }

    if (resMiss && resMiss.status === 200) {
      cacheMissDuration.add(resMiss.timings.duration);
      cacheMissCount.add(1);
    }

    check(resHit, { 'Cache HIT OK (Status 200)': (r) => r.status === 200 });
    check(resMiss, { 'Cache MISS Database OK (Status 200)': (r) => r.status === 200 });
  }

  sleep(1);
}
