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
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

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

  const resSummary = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
  check(resSummary, {
    'Dashboard Summary OK (200)': (r) => r.status === 200,
  });

  const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
  check(resStats, {
    'Dashboard Stats OK (200)': (r) => r.status === 200,
  });

  const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
  check(resList, {
    'Daftar Sapi Section OK (200)': (r) => r.status === 200,
  });

  sleep(1);
}

