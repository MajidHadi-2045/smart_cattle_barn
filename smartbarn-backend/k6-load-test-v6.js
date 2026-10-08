import http from 'k6/http';
import { Client } from 'k6/x/mqtt';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// KONFIGURASI TARGET & KREDENSIAL
// =========================================================================
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const BASE_URL = __ENV.BASE_URL || (isLocal ? 'http://127.0.0.1:4000/api' : 'http://smartcattlebarn.site:4000/api');
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'goodakun42@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'rahasia1234';

// =========================================================================
// METRIK V6: BEBAN CAMPURAN (VITAL, LINGKUNGAN, WEB) - PURE INGESTION & HTTP
// =========================================================================
// 1. Metrik HTTP Web Dashboard Breakdown
const webHttpTotalDuration = new Trend('mixed_web_http_duration');
const webHttpServerTTFB = new Trend('mixed_web_server_ttfb');         // TTFB Server
const webHttpTcpHandshake = new Trend('mixed_web_tcp_handshake');     // TCP Connect
const webHttpDataReceiving = new Trend('mixed_web_data_receiving');   // Receiving Time

// 2. Metrik MQTT IoT Sensor Breakdown
const mixedMqttVitalLatency = new Trend('mixed_mqtt_vital_latency');  // Latensi Server Ingestion Sensor Vital (MQTT)
const mixedMqttEnvLatency = new Trend('mixed_mqtt_env_latency');      // Latensi Server Ingestion Sensor Lingkungan (MQTT)

// 3. Counter Transaksi
const mixedVitalSent = new Counter('mixed_vital_messages_sent');
const mixedEnvSent = new Counter('mixed_env_messages_sent');
const mixedHttpReqs = new Counter('mixed_web_http_requests');

const targetVUs = parseInt(__ENV.VUS || '100', 10);
const warmupVUs = Math.max(1, Math.floor(targetVUs * 0.4));

export const options = {
  stages: [
    { duration: '5s', target: warmupVUs },   // Tahap 1: Ramp-up bertahap awal (40% beban)
    { duration: '5s', target: targetVUs },   // Tahap 2: Naik ke beban target (10, 50, atau 100 VU)
    { duration: '20s', target: targetVUs },  // Tahap 3: Tahan stabil di beban puncak sampai akhir (tanpa ramp-down ke 0)
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_waiting: ['p(95)<300'],           // Server TTFB < 300ms
    mixed_web_server_ttfb: ['p(95)<300'],
    http_req_connecting: ['p(95)<300'],        // TCP Handshake < 300ms
    mixed_web_tcp_handshake: ['p(95)<300'],
    http_req_receiving: ['p(95)<100'],         // Download Time < 100ms
    mixed_web_data_receiving: ['p(95)<100'],
    mixed_web_http_duration: ['p(95)<800'],
    mixed_mqtt_vital_latency: ['p(95)<1000'],
    mixed_mqtt_env_latency: ['p(95)<1000'],
  },
};

// Setup: Login Web Dashboard untuk mengambil token JWT bagi 30% User Web
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
      return { token: body.accessToken || body.access_token || body.token || '' };
    }
  } catch (err) {
    console.warn(`[Setup Warning] Gagal login: ${err.message}`);
  }
  return { token: '' };
}

function recordHttpTimings(res) {
  if (res && res.timings) {
    webHttpTotalDuration.add(res.timings.duration);
    webHttpServerTTFB.add(res.timings.waiting);
    webHttpTcpHandshake.add(res.timings.connecting);
    webHttpDataReceiving.add(res.timings.receiving);
    mixedHttpReqs.add(1);
  }
}

export default function (data) {
  const vuId = __VU;
  const slot = (vuId - 1) % 10; // Pembagian rasio: 5:2:3 (50% Vital, 20% Env, 30% Web)

  // =========================================================================
  // KELOMPOK 1: 50% VU SEBAGAI SENSOR VITAL SAPI VIA MQTT (Slot 0, 1, 2, 3, 4)
  // =========================================================================
  if (slot < 5) {
    const cattleIds = ['C-302', 'C-304', 'C-500', 'C-576', 'C-904'];
    const cattleId = cattleIds[slot % cattleIds.length];

    const client = new Client();

    client.on('message', (topic, message) => {
      const now = Date.now();
      try {
        const payload = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(message)));
        if (!isLocal && payload.clientTimestamp) {
          // Mode Remote: Gunakan Half-RTT IETF RFC 2681
          const rtt = now - payload.clientTimestamp;
          if (rtt >= 0) mixedMqttVitalLatency.add(parseFloat((rtt / 2).toFixed(2)));
        } else if (typeof payload.pureProcessingLatency === 'number') {
          // Mode Local VPS: Gunakan Pure Server Ingestion Latency langsung
          mixedMqttVitalLatency.add(payload.pureProcessingLatency);
        }
      } catch (err) {}
    });

    client.on('connect', () => {
      client.subscribe(`barn/cow/${cattleId}/vitals/ack`);

      const sendTime = Date.now();
      const payload = JSON.stringify({
        cattleId: cattleId,
        heartRate: Math.floor(65 + Math.random() * 25),
        temp: parseFloat((37.5 + Math.random() * 2.0).toFixed(1)),
        timestamp: new Date().toISOString(),
        clientTimestamp: sendTime,
      });

      const t0 = Date.now();
      client.publish(`barn/cow/${cattleId}/vitals`, payload);
      mixedMqttVitalLatency.add(Date.now() - t0);
      mixedVitalSent.add(1);

      setTimeout(() => client.end(), 850);
    });

    client.connect(MQTT_URL);
    sleep(1);

  // =========================================================================
  // KELOMPOK 2: 20% VU SEBAGAI SENSOR LINGKUNGAN & ANGIN VIA MQTT (Slot 5, 6)
  // =========================================================================
  } else if (slot < 7) {
    const zoneId = 1;
    const client = new Client();
    const isWind = (slot === 6);

    client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(message)));
        if (typeof payload.pureProcessingLatency === 'number') {
          mixedMqttEnvLatency.add(payload.pureProcessingLatency);
        }
      } catch (err) {}
    });

    client.on('connect', () => {
      const sendTime = Date.now();
      if (!isWind) {
        client.subscribe(`barn/zone/${zoneId}/environment/ack`);
        const payload = JSON.stringify({
          zoneId: zoneId,
          type: 'zone_sensor',
          temperature: parseFloat((27.5 + Math.random() * 5.0).toFixed(1)),
          humidity: parseFloat((60.0 + Math.random() * 20.0).toFixed(1)),
          ammonia: parseFloat((8.0 + Math.random() * 8.0).toFixed(1)),
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });

        const t0 = Date.now();
        client.publish(`barn/zone/${zoneId}/environment`, payload);
        mixedMqttEnvLatency.add(Date.now() - t0);
        mixedEnvSent.add(1);
      } else {
        client.subscribe(`barn/zone/${zoneId}/windspeed/ack`);
        const payload = JSON.stringify({
          zoneId: zoneId,
          type: 'wind_sensor',
          windspeed: parseFloat((1.2 + Math.random() * 3.5).toFixed(2)),
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });

        const t0 = Date.now();
        client.publish(`barn/zone/${zoneId}/windspeed`, payload);
        mixedMqttEnvLatency.add(Date.now() - t0);
        mixedEnvSent.add(1);
      }

      setTimeout(() => client.end(), 1800);
    });

    client.connect(MQTT_URL);
    sleep(2);

  // =========================================================================
  // KELOMPOK 3: 30% VU SEBAGAI PENGGUNA WEB DASHBOARD VIA HTTP REST (Slot 7, 8, 9)
  // =========================================================================
  } else {
    const authHeaders = {
      'Content-Type': 'application/json',
    };
    if (data && data.token) {
      authHeaders['Authorization'] = 'Bearer ' + data.token;
    }

    // 1. Dashboard Summary
    const resSum = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
    recordHttpTimings(resSum);
    check(resSum, { 'Web Dashboard Summary OK (200)': (r) => r.status === 200 });

    // 2. Statistik Ternak
    const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
    recordHttpTimings(resStats);
    check(resStats, { 'Web Livestock Stats OK (200)': (r) => r.status === 200 });

    // 3. Daftar Sapi
    const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
    recordHttpTimings(resList);
    check(resList, { 'Web Daftar Sapi Section OK (200)': (r) => r.status === 200 });

    // 4. Live Environment (RAM Cache)
    const resEnvLive = http.get(`${BASE_URL}/environment/live/1`, { headers: authHeaders });
    recordHttpTimings(resEnvLive);
    check(resEnvLive, { 'Web Env Live OK (200)': (r) => r.status === 200 || r.status === 404 });

    // 5. Manajemen Limbah
    const resWaste = http.get(`${BASE_URL}/dashboard/waste?filter=daily`, { headers: authHeaders });
    recordHttpTimings(resWaste);
    check(resWaste, { 'Web Waste Summary OK (200)': (r) => r.status === 200 });

    sleep(1);
  }
}
