import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';

export const options = {
  stages: [
    { duration: '5s', target: 50 },   // Ramp-up ke 50 VUs
    { duration: '20s', target: 100 }, // Load test 100 VUs sensor
    { duration: '5s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],    // Max 2% error
    http_req_duration: ['p(95)<500'],  // 95% request < 500ms
  },
};

export default function () {
  const cattleIds = ['C-302', 'C-304', 'C-500', 'C-576', 'C-904'];
  const cattleId = cattleIds[Math.floor(Math.random() * cattleIds.length)];

  const payload = JSON.stringify({
    cattleId: cattleId, 
    heartRate: Math.floor(65 + Math.random() * 25),
    bodyTemperature: parseFloat((38.0 + Math.random() * 2.0).toFixed(1)),
  });

  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(`${BASE_URL}/livestock/vital`, payload, params);
  
  check(res, {
    'Sensor Vital berhasil dikirim (200/201)': (r) => r.status === 200 || r.status === 201,
  });

  sleep(0.5); // Pengiriman sensor setiap 0.5s per VU
}

