import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK SENSOR VITAL SAPI (TRANSMISI & PEMROSESAN BACKEND)
// =========================================================================
const mqttVitalPublishLatency = new Trend('mqtt_vital_publish_latency');       // Waktu transmisi ke Broker MQTT
const mqttVitalProcessingLatency = new Trend('mqtt_vital_processing_latency'); // Latensi E2E sampai Backend selesai menerima
const mqttVitalSent = new Counter('mqtt_vital_messages_sent');                 // Total pesan dikirim
const mqttVitalProcessed = new Counter('mqtt_vital_messages_processed');       // Total pesan berhasil diproses

// Konfigurasi Target: Otomatis mendeteksi Lokal VPS (127.0.0.1) atau Remote Laptop (77.37.63.21)
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');

export const options = {
  scenarios: {
    vital_sensor_load: {
      executor: 'per-vu-iterations',
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    mqtt_vital_publish_latency: ['p(95)<100'],
    mqtt_vital_processing_latency: ['p(95)<1000'],
  },
};

export default function () {
  const vuId = __VU;
  const cattleIds = ['C-302', 'C-304', 'C-500', 'C-576', 'C-904'];
  const cattleId = cattleIds[(vuId - 1) % cattleIds.length];

  const client = new Client();

  client.on('message', (topic, message) => {
    const now = Date.now();
    try {
      const data = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(message)));
      if (data.clientTimestamp) {
        const latency = now - data.clientTimestamp;
        if (latency >= 0) {
          mqttVitalProcessingLatency.add(latency);
          mqttVitalProcessed.add(1);
        }
      }
    } catch (e) {}
  });

  client.on('connect', () => {
    client.subscribe(`barn/cow/${cattleId}/vitals`);

    let count = 0;
    const maxCount = 15; // Mengirim 15 data telemetri per VU (1 data/detik)

    const interval = setInterval(() => {
      count++;
      if (count > maxCount) {
        clearInterval(interval);
        setTimeout(() => client.end(), 1000);
        return;
      }

      const sendTime = Date.now();
      const payload = JSON.stringify({
        cattleId: cattleId,
        heartRate: Math.floor(65 + Math.random() * 25),
        temp: parseFloat((37.5 + Math.random() * 2.0).toFixed(1)),
        timestamp: new Date().toISOString(),
        clientTimestamp: sendTime,
      });

      const pubStart = Date.now();
      client.publish(`barn/cow/${cattleId}/vitals`, payload);
      mqttVitalPublishLatency.add(Date.now() - pubStart);
      mqttVitalSent.add(1);
    }, 1000);
  });

  client.connect(MQTT_URL);
}
