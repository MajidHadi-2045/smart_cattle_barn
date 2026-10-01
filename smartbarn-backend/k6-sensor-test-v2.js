import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK SENSOR VITAL SAPI V2: BREAKDOWN WAKTU TRANSMISI & PEMROSESAN
// =========================================================================
const mqttVitalPublishLatency = new Trend('mqtt_vital_publish_latency');       // Waktu transmisi soket TCP ke Broker MQTT
const mqttVitalProcessingLatency = new Trend('mqtt_vital_processing_latency'); // Latensi E2E sampai Backend selesai menerima
const mqttVitalSent = new Counter('mqtt_vital_messages_sent');                 // Total pesan dikirim
const mqttVitalProcessed = new Counter('mqtt_vital_messages_processed');       // Total pesan berhasil diproses

// Konfigurasi Target: Otomatis mendeteksi Lokal VPS (127.0.0.1) atau Remote Laptop (77.37.63.21)
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');

const targetVUs = parseInt(__ENV.VUS || '100', 10);
const warmupVUs = Math.max(1, Math.floor(targetVUs * 0.4));

export const options = {
  stages: [
    { duration: '5s', target: warmupVUs },   // Tahap 1: Ramp-up bertahap awal (40% beban)
    { duration: '5s', target: targetVUs },   // Tahap 2: Naik ke beban target (10, 50, atau 100 VU)
    { duration: '15s', target: targetVUs },  // Tahap 3: Tahan stabil di beban puncak
    { duration: '5s', target: 0 },           // Tahap 4: Ramp-down pendinginan ke 0 VU
  ],
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
