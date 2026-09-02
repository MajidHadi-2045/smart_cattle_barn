import http from 'k6/http';
import { Client } from 'k6/x/mqtt';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// KONFIGURASI ENDPOINT & KREDENSIAL VPS
// =========================================================================
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const BASE_URL = __ENV.BASE_URL || (isLocal ? 'http://127.0.0.1:4000/api' : 'http://smartcattlebarn.site:4000/api');
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'goodakun42@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'rahasia1234';

// =========================================================================
// METRIK KHUSUS BEBAN CAMPURAN 3 TIPE TRAFIK (VITAL, LINGKUNGAN, WEB)
// =========================================================================
const mixedHttpDuration = new Trend('mixed_web_http_duration');          // Latensi Web Dashboard (HTTP)
const mixedMqttVitalLatency = new Trend('mixed_mqtt_vital_latency');      // Latensi Sensor Vital Sapi (MQTT)
const mixedMqttEnvLatency = new Trend('mixed_mqtt_env_latency');          // Latensi Sensor Lingkungan & Angin (MQTT)
const mixedVitalSent = new Counter('mixed_vital_messages_sent');
const mixedEnvSent = new Counter('mixed_env_messages_sent');
const mixedHttpReqs = new Counter('mixed_web_http_requests');

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
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
    const res = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers, timeout: '5s' });

    if (res.status === 200 || res.status === 201) {
      const body = res.json();
      return { token: body.accessToken || body.access_token || body.token || '' };
    }
  } catch (err) {
    console.warn(`[Setup Warning] Gagal login: ${err.message}`);
  }
  return { token: '' };
}

export default function (data) {
  const vuId = __VU;
  const slot = (vuId - 1) % 10; // Pembagian rasio: 5:2:3 (50% Vital, 20% Env, 30% Web)
  const sendTime = Date.now();

  // =========================================================================
  // KELOMPOK 1: 50% VU SEBAGAI SENSOR VITAL SAPI VIA PROTOKOL MQTT (Slot 0, 1, 2, 3, 4)
  // =========================================================================
  if (slot < 5) {
    const cattleIds = ['C-302', 'C-304', 'C-500', 'C-576', 'C-904'];
    const cattleId = cattleIds[slot % cattleIds.length];

    const client = new Client();

    client.on('message', (topic, message) => {
      const now = Date.now();
      try {
        const d = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(message)));
        if (d.clientTimestamp) {
          const lat = now - d.clientTimestamp;
          if (lat >= 0) mixedMqttVitalLatency.add(lat);
        }
      } catch (e) {}
    });

    client.on('connect', () => {
      client.subscribe(`barn/cow/${cattleId}/vitals`);

      const payload = JSON.stringify({
        cattleId: cattleId,
        heartRate: Math.floor(65 + Math.random() * 25),
        temp: parseFloat((37.5 + Math.random() * 2.0).toFixed(1)),
        timestamp: new Date().toISOString(),
        clientTimestamp: sendTime,
      });

      client.publish(`barn/cow/${cattleId}/vitals`, payload);
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
      const now = Date.now();
      try {
        const d = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(message)));
        if (d.clientTimestamp) {
          const lat = now - d.clientTimestamp;
          if (lat >= 0) mixedMqttEnvLatency.add(lat);
        }
      } catch (e) {}
    });

    client.on('connect', () => {
      if (!isWind) {
        client.subscribe(`barn/zone/${zoneId}/environment`);
        const payload = JSON.stringify({
          zoneId: zoneId,
          type: 'zone_sensor',
          temperature: parseFloat((27.5 + Math.random() * 5.0).toFixed(1)),
          humidity: parseFloat((60.0 + Math.random() * 20.0).toFixed(1)),
          ammonia: parseFloat((8.0 + Math.random() * 8.0).toFixed(1)),
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });
        client.publish(`barn/zone/${zoneId}/environment`, payload);
        mixedEnvSent.add(1);
      } else {
        client.subscribe(`barn/zone/${zoneId}/windspeed`);
        const payload = JSON.stringify({
          zoneId: zoneId,
          type: 'wind_sensor',
          windspeed: parseFloat((1.2 + Math.random() * 3.5).toFixed(2)),
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });
        client.publish(`barn/zone/${zoneId}/windspeed`, payload);
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
    const t0 = Date.now();
    const resSum = http.get(`${BASE_URL}/dashboard/summary`, { headers: authHeaders });
    mixedHttpDuration.add(Date.now() - t0);
    mixedHttpReqs.add(1);
    check(resSum, { 'Web Dashboard Summary OK (200)': (r) => r.status === 200 });

    // 2. Statistik Ternak
    const t1 = Date.now();
    const resStats = http.get(`${BASE_URL}/livestock/stats/1`, { headers: authHeaders });
    mixedHttpDuration.add(Date.now() - t1);
    mixedHttpReqs.add(1);
    check(resStats, { 'Web Livestock Stats OK (200)': (r) => r.status === 200 });

    // 3. Daftar Sapi
    const t2 = Date.now();
    const resList = http.get(`${BASE_URL}/livestock/section/1`, { headers: authHeaders });
    mixedHttpDuration.add(Date.now() - t2);
    mixedHttpReqs.add(1);
    check(resList, { 'Web Daftar Sapi Section OK (200)': (r) => r.status === 200 });

    // 4. Live Environment (RAM Cache)
    const t3 = Date.now();
    const resEnvLive = http.get(`${BASE_URL}/environment/live/1`, { headers: authHeaders });
    mixedHttpDuration.add(Date.now() - t3);
    mixedHttpReqs.add(1);
    check(resEnvLive, { 'Web Env Live OK (200)': (r) => r.status === 200 || r.status === 404 });

    // 5. Manajemen Limbah
    const t4 = Date.now();
    const resWaste = http.get(`${BASE_URL}/dashboard/waste?filter=daily`, { headers: authHeaders });
    mixedHttpDuration.add(Date.now() - t4);
    mixedHttpReqs.add(1);
    check(resWaste, { 'Web Waste Summary OK (200)': (r) => r.status === 200 });

    sleep(1);
  }
}
