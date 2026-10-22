import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK SENSOR VITAL SAPI V7: PURE SERVER-SIDE INGESTION LATENCY (MAX 50 MSG/VU)
// =========================================================================
const mqttVitalPublishLatency = new Trend('mqtt_vital_publish_latency');       // Waktu transmisi soket TCP lokal ke Broker MQTT
const mqttVitalProcessingLatency = new Trend('mqtt_vital_processing_latency'); // Latensi Ingestion Server NestJS (Timestamp Sensor -> Masuk BullMQ Queue)
const mqttBackendProcLatency = new Trend('mqtt_backend_proc_latency');         // Waktu komputasi murni internal NestJS (performance.now)
const mqttAckInterArrivalLatency = new Trend('mqtt_ack_inter_arrival_latency'); // Waktu jeda antar kedatangan paket ACK (Inter-arrival jitter)
const mqttSubscriberDeliveryLatency = new Trend('mqtt_subscriber_delivery_latency'); // Segmen: Broker -> Socket -> Callback
const mqttVitalSent = new Counter('mqtt_vital_messages_sent');                 // Total pesan dikirim oleh sensor
const mqttVitalProcessed = new Counter('mqtt_vital_messages_processed');       // Total pesan berhasil masuk ke Queue Backend

// Konfigurasi Target: Otomatis mendeteksi Lokal VPS (127.0.0.1) atau Remote Laptop (77.37.63.21)
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');

const targetVUs = parseInt(__ENV.VUS || '100', 10);
const clockOffset = parseInt(__ENV.CLOCK_OFFSET || '0', 10);

// =========================================================================
// OPSI V7: PURE FULL VU DARI DETIK KE-0 (Constant Load Tanpa Ramp-up)
// =========================================================================
export const options = {
  vus: targetVUs,
  duration: '30s',
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

  // VU 1 bertindak sebagai Subscriber Monitoring Utama untuk menangkap ACK latency dari Backend NestJS
  const isMonitor = (vuId === 1);
  let lastAckTime = 0;

  client.on('message', (topic, message) => {
    const now = Date.now();
    if (isMonitor && lastAckTime > 0) {
      const delta = now - lastAckTime;
      if (delta >= 0) {
        mqttAckInterArrivalLatency.add(delta);
      }
    }
    lastAckTime = now;
    try {
      const data = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(message)));
      let latency = -1;

      if (!isLocal && data.clientTimestamp) {
        // Mode Remote (Laptop Internet): Gunakan Standar Half-RTT IETF RFC 2681
        const rtt = now - data.clientTimestamp;
        latency = rtt >= 0 ? parseFloat((rtt / 2).toFixed(2)) : (typeof data.pureProcessingLatency === 'number' ? data.pureProcessingLatency : -1);
      } else if (typeof data.pureProcessingLatency === 'number') {
        // Mode Local VPS: Gunakan Pure Server Ingestion Latency langsung (1 domain jam VPS)
        latency = data.pureProcessingLatency;
      } else if (data.clientTimestamp) {
        const diff = now - data.clientTimestamp;
        latency = diff >= 0 ? diff : -1;
      }

      if (latency >= 0) {
        mqttVitalProcessingLatency.add(latency);
        mqttVitalProcessed.add(1);
      }

      if (typeof data.backendProcMs === 'number') {
        mqttBackendProcLatency.add(data.backendProcMs);
      }

      if (typeof data.ackPublishTs === 'number') {
        const calibratedNow = now - clockOffset;
        const delay = calibratedNow - data.ackPublishTs;
        mqttSubscriberDeliveryLatency.add(delay);
      }
    } catch (e) {}
  });

  client.on('connect', () => {
    if (isMonitor) {
      // Monitor mendaftarkan topik ACK balasan NestJS untuk semua sapi
      cattleIds.forEach((id) => {
        client.subscribe(`barn/cow/${id}/vitals/ack`);
      });
    }

    let count = 0;
    const sendIntervalMs = parseInt(__ENV.INTERVAL_MS || '1000', 10);
    const maxCount = parseInt(__ENV.MAX_COUNT || String(Math.ceil(35000 / sendIntervalMs) + 10), 10);

    const interval = setInterval(() => {
      count++;
      if (count > maxCount) {
        clearInterval(interval);
        client.end();
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
    }, sendIntervalMs);
  });

  client.connect(MQTT_URL);
}
