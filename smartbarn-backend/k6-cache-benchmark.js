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

// Konfigurasi Beban (Dapat diatur dinamis via CLI: --vus 10, --vus 50, --vus 100)
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
      return { token: body.accessToken || body.access_token || body.token || '' };
    }
  } catch (err) {
    console.warn(`[Setup Warning] Gagal login: ${err.message}`);
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

  // =========================================================================
  // FASE 1: CACHE HIT (Membaca Data Live Lingkungan dari RAM Redis)
  // Endpoint: GET /environment/live/1 (Dilayani dari key Redis live:zone:1:environment)
  // =========================================================================
  const tHitStart = Date.now();
  const resHit = http.get(`${BASE_URL}/environment/live/1`, { headers: authHeaders });
  const hitDuration = Date.now() - tHitStart;

  if (resHit.status === 200) {
    cacheHitDuration.add(hitDuration);
    cacheHitCount.add(1);
  }
  check(resHit, {
    'Cache HIT OK (Status 200)': (r) => r.status === 200,
  });

  sleep(0.5);

  // =========================================================================
  // FASE 2: CACHE MISS / DIRECT DB (Membaca Riwayat Data dari PostgreSQL Database)
  // Endpoint: GET /environment/trend/1?range=24h (Memaksa Prisma SELECT ke disk database)
  // =========================================================================
  const tMissStart = Date.now();
  const resMiss = http.get(`${BASE_URL}/environment/trend/1?range=24h`, { headers: authHeaders });
  const missDuration = Date.now() - tMissStart;

  if (resMiss.status === 200) {
    cacheMissDuration.add(missDuration);
    cacheMissCount.add(1);
  }
  check(resMiss, {
    'Cache MISS Database OK (Status 200)': (r) => r.status === 200,
  });

  sleep(0.5);
}
