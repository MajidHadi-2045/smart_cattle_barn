import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK KHUSUS MQTT → BACKEND → REDIS PUB/SUB → WEBSOCKET (E2E)
// =========================================================================
const mqttPublishLatency = new Trend('mqtt_publish_latency');       // Waktu publish MQTT
const mqttVitalE2ELatency = new Trend('mqtt_vital_e2e_latency');   // E2E: MQTT → Backend → Redis → WS (Vital)
const mqttEnvE2ELatency = new Trend('mqtt_env_e2e_latency');       // E2E: MQTT → Backend → Redis → WS (Environment)
const mqttMessagesPublished = new Counter('mqtt_messages_published'); // Total pesan MQTT terkirim
const mqttMessagesReceived = new Counter('mqtt_messages_received');   // Total pesan diterima via subscribe

// MQTT Broker URL
const MQTT_URL = __ENV.MQTT_URL || 'mqtt://smartcattlebarn.site:1883';

// =========================================================================
// KONFIGURASI PENGUJIAN k6 (MQTT)
// =========================================================================
export const options = {
  scenarios: {
    mqtt_load: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    // LATENSI E2E MQTT - SENSOR VITAL SAPI:
    // p(95) < 1000ms — Standar ITU-T Y.1541 & MQTT OASIS untuk telemetri IoT interaktif
    mqtt_vital_e2e_latency: ['p(95)<1000'],

    // LATENSI E2E MQTT - SENSOR LINGKUNGAN KANDANG:
    mqtt_env_e2e_latency: ['p(95)<1000'],
  },
};

export default function () {
  const vuId = __VU;
  const cattleId = `C-${300 + vuId}`;
  const zoneId = 1;

  const client = new Client();

  // =====================================================================
  // EVENT: CONNECTED — Mulai publish data sensor via MQTT
  // =====================================================================
  client.on('connect', () => {
    console.log(`[VU ${vuId}] Connected to MQTT Broker`);

    // Subscribe ke topic yang akan menerima broadcast balik dari backend
    // (Backend mempublish kembali data melalui Redis Pub/Sub)
    client.subscribe(`barn/cow/${cattleId}/vitals`);
    client.subscribe(`barn/zone/${zoneId}/environment`);
    client.subscribe(`barn/zone/${zoneId}/windspeed`);

    let messageCount = 0;
    const maxMessages = 8; // Kirim 8 pesan per VU (~ 24 detik dengan interval 3 detik)

    // Kirim data sensor setiap 3 detik (simulasi ESP32)
    const interval = setInterval(() => {
      messageCount++;

      if (messageCount > maxMessages) {
        clearInterval(interval);
        // Tunggu sebentar untuk menerima pesan terakhir, lalu tutup koneksi
        setTimeout(() => {
          client.end();
        }, 2000);
        return;
      }

      const isVital = Math.random() < 0.50;
      const sendTime = Date.now();

      if (isVital) {
        // =================================================================
        // KATEGORI 1: SENSOR VITAL SAPI (Suhu Tubuh & Detak Jantung)
        // Topic: barn/cow/{cattleId}/vitals
        // =================================================================
        const payload = JSON.stringify({
          cattleId: cattleId,
          heartRate: Math.floor(65 + Math.random() * 25),
          temp: parseFloat((37.5 + Math.random() * 2.0).toFixed(1)),
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });

        const pubStart = Date.now();
        client.publish(`barn/cow/${cattleId}/vitals`, payload);
        mqttPublishLatency.add(Date.now() - pubStart);
        mqttMessagesPublished.add(1);

        console.log(`[VU ${vuId}] Published vital #${messageCount} to barn/cow/${cattleId}/vitals`);

      } else {
        // =================================================================
        // KATEGORI 2: SENSOR LINGKUNGAN KANDANG (Suhu, RH, Amonia, & Angin)
        // Topic: barn/zone/{zoneId}/environment ATAU barn/zone/{zoneId}/windspeed
        // =================================================================
        const isWind = Math.random() < 0.35;

        if (!isWind) {
          const payload = JSON.stringify({
            zoneId: zoneId,
            type: 'zone_sensor',
            temperature: parseFloat((28.0 + Math.random() * 4.0).toFixed(1)),
            humidity: parseFloat((65.0 + Math.random() * 15.0).toFixed(1)),
            ammonia: parseFloat((10.0 + Math.random() * 5.0).toFixed(1)),
            timestamp: new Date().toISOString(),
            clientTimestamp: sendTime,
          });

          const pubStart = Date.now();
          client.publish(`barn/zone/${zoneId}/environment`, payload);
          mqttPublishLatency.add(Date.now() - pubStart);
          mqttMessagesPublished.add(1);

          console.log(`[VU ${vuId}] Published env #${messageCount} to barn/zone/${zoneId}/environment`);

        } else {
          const payload = JSON.stringify({
            zoneId: zoneId,
            type: 'wind_sensor',
            windspeed: parseFloat((1.5 + Math.random() * 2.5).toFixed(2)),
            timestamp: new Date().toISOString(),
            clientTimestamp: sendTime,
          });

          const pubStart = Date.now();
          client.publish(`barn/zone/${zoneId}/windspeed`, payload);
          mqttPublishLatency.add(Date.now() - pubStart);
          mqttMessagesPublished.add(1);

          console.log(`[VU ${vuId}] Published wind #${messageCount} to barn/zone/${zoneId}/windspeed`);
        }
      }
    }, 3000);
  });

  // =====================================================================
  // EVENT: MESSAGE — Menerima pesan kembali (mengukur E2E Latency)
  // =====================================================================
  client.on('message', (topic, message) => {
    const now = Date.now();
    mqttMessagesReceived.add(1);

    try {
      const str = String.fromCharCode.apply(null, new Uint8Array(message));
      const data = JSON.parse(str);

      if (data.clientTimestamp) {
        const latency = now - data.clientTimestamp;
        if (latency >= 0) {
          if (topic.includes('vitals')) {
            mqttVitalE2ELatency.add(latency);
          } else if (topic.includes('environment') || topic.includes('windspeed')) {
            mqttEnvE2ELatency.add(latency);
          }
        }
      }
    } catch (e) {
      // Ignored
    }
  });

  // =====================================================================
  // EVENT: END — Koneksi ditutup secara bersih
  // =====================================================================
  client.on('end', () => {
    console.log(`[VU ${vuId}] Disconnected from MQTT Broker`);
  });

  // Mulai koneksi ke MQTT Broker
  client.connect(MQTT_URL);
}