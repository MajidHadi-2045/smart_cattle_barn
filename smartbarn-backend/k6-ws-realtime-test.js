import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// =========================================================================
// METRIK KHUSUS REAL-TIME WEBSOCKET E2E (2 KATEGORI UTAMA)
// =========================================================================
const wsVitalE2ELatency = new Trend('ws_vital_e2e_latency'); // Latensi E2E Sensor Vital Sapi (Suhu & Detak Jantung)
const wsEnvE2ELatency = new Trend('ws_env_e2e_latency');     // Latensi E2E Sensor Lingkungan Kandang (Suhu, RH, Amonia, & Angin)

// URL Backend (HTTP & WebSocket)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';
const WS_URL = __ENV.WS_URL || 'ws://localhost:4000/socket.io/?EIO=4&transport=websocket';

// =========================================================================
// KONFIGURASI TAHAPAN PENGUJIAN k6
// =========================================================================
export const options = {
  stages: [
    { duration: '5s', target: 10 },   // Ramp-up 10 VUs
    { duration: '20s', target: 30 },  // 30 Virtual Users simultan (WebSocket + Sensor)
    { duration: '5s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    // ERROR RATE HTTP: < 1%
    // Ref: Google SRE Book - Error Budget <= 1%
    http_req_failed: ['rate<0.01'],

    // LATENSI E2E WEBSOCKET - SENSOR VITAL SAPI via WiFi:
    // p(95) < 300ms — Ditetapkan 1.5x rata-rata aktual (~200ms)
    // WebSocket lebih cepat dari HTTP karena koneksi persistent (tanpa TCP/TLS handshake ulang)
    // Ref: WebRTC W3C Spec — Interactive real-time < 300ms ideal untuk monitoring langsung
    ws_vital_e2e_latency: ['p(95)<300'],

    // LATENSI E2E WEBSOCKET - SENSOR LINGKUNGAN KANDANG via WiFi:
    // p(95) < 300ms — Sama dengan vital, lingkungan juga dikirim via persistent WebSocket
    // Ref: IEEE 802.11 (WiFi Standard) — RTT tipikal WiFi 10-80ms, WS overhead minimal
    ws_env_e2e_latency: ['p(95)<300'],
  },
};

export default function () {
  const headers = { 'Content-Type': 'application/json' };
  const cattleId = 'C-302';
  const zoneId = 1;

  // 1. Membuka Koneksi Real-Time WebSocket (Bertindak sebagai Client Dashboard)
  const res = ws.connect(WS_URL, {}, function (socket) {
    socket.on('open', function () {
      // Handshake Socket.IO v4 Engine Connect
      socket.send('40');

      // 2. Eksekusi Pengiriman Sensor & Pengukuran Real-Time
      socket.setInterval(function () {
        const isVital = Math.random() < 0.50;

        if (isVital) {
          // =================================================================
          // KATEGORI 1: SENSOR VITAL SAPI (Suhu Tubuh & Detak Jantung)
          // =================================================================
          const sendTime = Date.now();
          const payload = JSON.stringify({
            cattleId: cattleId,
            heartRate: Math.floor(65 + Math.random() * 25),
            bodyTemperature: parseFloat((37.5 + Math.random() * 2.0).toFixed(1)),
            clientTimestamp: sendTime,
          });

          const postRes = http.post(`${BASE_URL}/livestock/vital`, payload, { headers });
          check(postRes, { 'POST Vital OK (200/201)': (r) => r.status === 200 || r.status === 201 });

        } else {
          // =================================================================
          // KATEGORI 2: SENSOR LINGKUNGAN KANDANG (Suhu, RH, Amonia, & Angin)
          // =================================================================
          const isWind = Math.random() < 0.35;
          const sendTime = Date.now();

          let envPayload;
          if (!isWind) {
            envPayload = JSON.stringify({
              zoneId: zoneId,
              type: 'zone_sensor',
              temperature: parseFloat((28.0 + Math.random() * 4.0).toFixed(1)),
              humidity: parseFloat((65.0 + Math.random() * 15.0).toFixed(1)),
              ammonia: parseFloat((10.0 + Math.random() * 5.0).toFixed(1)),
              thi: parseFloat((78.0 + Math.random() * 4.0).toFixed(1)),
              clientTimestamp: sendTime,
            });
          } else {
            envPayload = JSON.stringify({
              zoneId: zoneId,
              type: 'wind_sensor',
              windspeed: parseFloat((1.5 + Math.random() * 2.5).toFixed(2)),
              clientTimestamp: sendTime,
            });
          }

          const postRes = http.post(`${BASE_URL}/environment/sensor`, envPayload, { headers });
          check(postRes, { 'POST Env OK (200/201)': (r) => r.status === 200 || r.status === 201 });
        }
      }, 1000); // Interval kirim setiap 1 detik

      // 3. Menangani Pesan Broadcast yang Diterima via WebSocket
      socket.on('message', function (msg) {
        const now = Date.now();

        // Socket.IO message framing format: 42["eventName", payload]
        if (msg.startsWith('42')) {
          try {
            const raw = msg.substring(2);
            const parsed = JSON.parse(raw);
            const eventName = parsed[0];
            const eventData = parsed[1];

            if (eventName.includes('vital-update') && eventData.clientTimestamp) {
              const latency = now - eventData.clientTimestamp;
              if (latency >= 0) wsVitalE2ELatency.add(latency);
            } else if ((eventName === 'websocket:environment' || eventName === 'websocket:windspeed') && eventData.clientTimestamp) {
              const latency = now - eventData.clientTimestamp;
              if (latency >= 0) wsEnvE2ELatency.add(latency);
            }
          } catch (e) {
            // Ignored format
          }
        }
      });

      // Socket timeout / durasi per iterasi
      socket.setTimeout(function () {
        socket.close();
      }, 25000);
    });

    socket.on('error', function (e) {
      // Handle socket error silently
    });
  });

  check(res, { 'WebSocket Handshake Connected': (r) => r && r.status === 101 });
  sleep(1);
}
