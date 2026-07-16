import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 run --vus 100 --duration 60s k6-web-test.js
export default function () {
  const BASE_URL = 'http://localhost:4000/api'; 
  
  const resStats = http.get(`${BASE_URL}/livestock/stats/1`);
  check(resStats, {
    'Web Dashboard Stats (200)': (r) => r.status === 200,
  });

  const resList = http.get(`${BASE_URL}/livestock/section/1`);
  check(resList, {
    'Web Daftar Sapi (200)': (r) => r.status === 200,
  });

  // Jeda 1 detik (waktu membaca user manusia)
  sleep(1);
}
