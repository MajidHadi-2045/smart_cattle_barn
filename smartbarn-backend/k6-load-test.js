import http from 'k6/http';
import { check, sleep } from 'k6';

// Jalankan perintah terminal: k6 run --vus 100 --duration 60s k6-load-test.js
export default function () {
  const BASE_URL = 'http://localhost:4000/api'; 
  
  // Mengacak aksi: 70% sebagai Sensor, 30% sebagai Pengguna Web
  const isSensor = Math.random() < 0.7;

  if (isSensor) {
    // ========================================================
    // SKENARIO 1: Simulasi Kalung Sensor Sapi (70% Trafik)
    // Menghantam endpoint BullMQ
    // ========================================================
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
    // ========================================================
    // SKENARIO 2: Simulasi Pengguna Buka Web Dashboard (30% Trafik)
    // Menghantam endpoint GET yang mengambil cache Redis
    // ========================================================
    const resStats = http.get(`${BASE_URL}/livestock/stats/1`);
    check(resStats, {
      'Web Dashboard Stats (200)': (r) => r.status === 200,
    });

    const resList = http.get(`${BASE_URL}/livestock/section/1`);
    check(resList, {
      'Web Daftar Sapi (200)': (r) => r.status === 200,
    });
  }

  // Jeda 1 detik agar meniru aktivitas sensor dan klik wajar manusia
  sleep(1);
}
