import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 run --vus 100 --duration 60s k6-sensor-test.js
export default function () {
  const BASE_URL = 'http://localhost:4000/api'; 
  
  const payload = JSON.stringify({
    cattleId: "C-302", 
    heartRate: 70 + Math.random() * 10,
    bodyTemperature: 38 + Math.random() * 2
  });

  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(`${BASE_URL}/livestock/vital`, payload, params);
  
  check(res, {
    'Sensor berhasil dikirim (201)': (r) => r.status === 201,
  });

  sleep(1);
}
