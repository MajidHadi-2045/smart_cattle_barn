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
// METRIK V3: HEAD-TO-HEAD CACHE HIT (RAM) VS CACHE MISS (DATABASE) + TTFB
// =========================================================================
const cacheHitDuration = new Trend('http_duration_cache_hit');
const cacheMissDuration = new Trend('http_duration_cache_miss');

const cacheHitTTFB = new Trend('ttfb_cache_hit_ram');         // TTFB saat dilayani RAM Redis (< 5ms)
const cacheMissTTFB = new Trend('ttfb_cache_miss_database');  // TTFB saat eksekusi SQL GROUP BY (~15-50ms)

const tcpHandshakeTime = new Trend('network_tcp_handshake');
const dataReceivingTime = new Trend('network_data_receiving');

const cacheHitCount = new Counter('total_cache_hits');
const cacheMissCount = new Counter('total_cache_misses');

// V3 OPTIONS: TANPA STAGES (User bebas menentukan --vus dan --duration dari CLI)
export const options = {
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
    const responses = http.batch([
      ['GET', `${BASE_URL}/livestock/stats/1`, null, { headers: authHeaders }],
      ['GET', `${BASE_URL}/livestock/stats/1?fresh=true`, null, { headers: authHeaders }],
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
