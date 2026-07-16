import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 run --vus 100 --duration 60s k6-mixed-test.js
export default function () {
  const BASE_URL = 'http://localhost:4000/api'; 
  
  // Mengacak aksi: 70% sebagai Sensor, 30% sebagai Pengguna Web
  const isSensor = Math.random() < 0.7;

  if (isSensor) {
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

  } else {
    const resStats = http.get(`${BASE_URL}/livestock/stats/1`);
    check(resStats, {
      'Web Dashboard Stats (200)': (r) => r.status === 200,
    });

    const resList = http.get(`${BASE_URL}/livestock/section/1`);
    check(resList, {
      'Web Daftar Sapi (200)': (r) => r.status === 200,
    });
  }

  sleep(1);
}
