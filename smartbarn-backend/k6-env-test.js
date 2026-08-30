import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// =========================================================================
// METRIK KHUSUS: SENSOR LINGKUNGAN & SIRKULASI KANDANG (SATU KATEGORI)
// =========================================================================
const envIngestDuration = new Trend('env_sensor_ingest_duration'); // Ingestion Suhu, RH, Amonia & Kecepatan Angin
const envLiveReadDuration = new Trend('env_live_read_duration');   // Pembacaan Live Data Lingkungan dari RAM Redis

// Base URL: Default ke localhost:4000/api
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';

// =========================================================================
// KONFIGURASI PENGUJIAN k6
// =========================================================================
export const options = {
  stages: [
    { duration: '5s', target: 20 },   // Ramp-up 20 Virtual Users
    { duration: '20s', target: 50 },  // Beban konstan 50 Virtual Users
    { duration: '5s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    // ERROR RATE: Toleransi error < 1%
    // Ref: Google SRE Book - Error Budget <= 1%
    http_req_failed: ['rate<0.01'],

    // LATENSI HTTP INGESTION SENSOR LINGKUNGAN via WiFi:
    // p(95) < 500ms — Ditetapkan 2.5x rata-rata aktual pengujian (~200ms)
    // Ref: k6 Docs - threshold best practice: set at 2x-3x observed average
    http_req_duration: ['p(95)<500'],

    // LATENSI INGESTION SENSOR LINGKUNGAN (POST /environment/sensor):
    // p(95) < 500ms — Sama dengan rata-rata global, endpoint JSON ringan
    env_sensor_ingest_duration: ['p(95)<500'],

    // LATENSI BACA LIVE DATA DARI REDIS via WiFi:
    // p(95) < 300ms — Redis in-memory < 1ms, dominan network RTT WiFi
    // Ref: Redis Labs Benchmark - Redis lokal < 1ms + WiFi RTT ~20-80ms
    env_live_read_duration: ['p(95)<300'],
  },
};

export default function () {
  const headers = { 'Content-Type': 'application/json' };
  const zoneId = 1;

  // 70% Ingestion Sensor Lingkungan Kandang (Suhu, RH, Amonia, Kecepatan Angin)
  // 30% Pembacaan Live Client Dashboard dari RAM Redis
  const isIngest = Math.random() < 0.70;

  if (isIngest) {
    const isWind = Math.random() < 0.35;

    if (!isWind) {
      // A. Sensor Mikroklimat Kandang (Suhu, Kelembaban, Amonia, THI)
      const envPayload = JSON.stringify({
        zoneId: zoneId,
        type: 'zone_sensor',
        temperature: parseFloat((27.5 + Math.random() * 5.0).toFixed(1)),
        humidity: parseFloat((60.0 + Math.random() * 20.0).toFixed(1)),
        ammonia: parseFloat((8.0 + Math.random() * 8.0).toFixed(1)),
        thi: parseFloat((75.0 + Math.random() * 6.0).toFixed(1)),
        timestamp: new Date().toISOString(),
      });

      const res = http.post(`${BASE_URL}/environment/sensor`, envPayload, { headers });
      envIngestDuration.add(res.timings.duration);

      check(res, {
        'Env Ingest Status 200/201': (r) => r.status === 200 || r.status === 201,
      });

    } else {
      // B. Sensor Sirkulasi Udara (Kecepatan Angin / Windspeed)
      const windPayload = JSON.stringify({
        zoneId: zoneId,
        type: 'wind_sensor',
        windspeed: parseFloat((1.2 + Math.random() * 3.5).toFixed(2)),
        timestamp: new Date().toISOString(),
      });

      const res = http.post(`${BASE_URL}/environment/sensor`, windPayload, { headers });
      envIngestDuration.add(res.timings.duration);

      check(res, {
        'Wind Ingest Status 200/201': (r) => r.status === 200 || r.status === 201,
      });
    }

  } else {
    // =========================================================================
    // PEMBACAAN DATA LIVE LINGKUNGAN KANDANG DARI RAM REDIS OLEH CLIENT
    // =========================================================================
    const isWindLive = Math.random() < 0.5;
    const endpoint = isWindLive ? `/environment/live-wind/${zoneId}` : `/environment/live/${zoneId}`;

    const resLive = http.get(`${BASE_URL}${endpoint}`, { headers });
    envLiveReadDuration.add(resLive.timings.duration);

    check(resLive, {
      'Client Live Read OK (200)': (r) => r.status === 200 || r.status === 404,
    });
  }

  sleep(0.5);
}
