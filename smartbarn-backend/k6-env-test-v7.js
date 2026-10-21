import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK SENSOR LINGKUNGAN V7: PURE SERVER-SIDE INGESTION LATENCY (MAX 50 MSG/VU)
// =========================================================================
const mqttEnvPublishLatency = new Trend('mqtt_env_publish_latency');       // Waktu transmisi soket TCP lokal ke Broker MQTT
const mqttEnvProcessingLatency = new Trend('mqtt_env_processing_latency'); // Latensi Ingestion Server NestJS (Timestamp Sensor -> Masuk RAM/Redis Buffer)
const mqttEnvBackendProcLatency = new Trend('mqtt_env_backend_proc_latency'); // Waktu komputasi murni internal NestJS (performance.now)
const mqttEnvSent = new Counter('mqtt_env_messages_sent');                 // Total pesan dikirim
const mqttEnvProcessed = new Counter('mqtt_env_messages_processed');       // Total pesan berhasil diproses

// Konfigurasi Target: Otomatis mendeteksi Lokal VPS (127.0.0.1) atau Remote Laptop (77.37.63.21)
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');

const targetVUs = parseInt(__ENV.VUS || '100', 10);

// =========================================================================
// OPSI V7: PURE FULL VU DARI DETIK KE-0 (Constant Load Tanpa Ramp-up)
// =========================================================================
export const options = {
  vus: targetVUs,
  duration: '30s',
  thresholds: {
    mqtt_env_publish_latency: ['p(95)<100'],
    mqtt_env_processing_latency: ['p(95)<1000'],
  },
};


export default function () {
  const vuId = __VU;
  const zoneId = 1;
  const isWind = (vuId % 3 === 0); // Rasio: 1/3 Anemometer, 2/3 Mikroklimat
  const isMonitor = (vuId === 1);  // VU 1 bertindak sebagai Monitor Utama

  const client = new Client();

  client.on('message', (topic, message) => {
    const now = Date.now();
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
        mqttEnvProcessingLatency.add(latency);
        mqttEnvProcessed.add(1);
      }

      if (typeof data.backendProcMs === 'number') {
        mqttEnvBackendProcLatency.add(data.backendProcMs);
      }
    } catch (e) {}
  });

  client.on('connect', () => {
    if (isMonitor) {
      client.subscribe(`barn/zone/${zoneId}/environment/ack`);
      client.subscribe(`barn/zone/${zoneId}/windspeed/ack`);
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

      if (!isWind) {
        // A. Sensor Mikroklimat Kandang (Suhu, Kelembaban, Amonia)
        const payload = JSON.stringify({
          zoneId: zoneId,
          type: 'zone_sensor',
          temperature: parseFloat((27.5 + Math.random() * 5.0).toFixed(1)),
          humidity: parseFloat((60.0 + Math.random() * 20.0).toFixed(1)),
          ammonia: parseFloat((8.0 + Math.random() * 8.0).toFixed(1)),
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });

        const pubStart = Date.now();
        client.publish(`barn/zone/${zoneId}/environment`, payload);
        mqttEnvPublishLatency.add(Date.now() - pubStart);
        mqttEnvSent.add(1);

      } else {
        // B. Sensor Kecepatan Angin (Windspeed)
        const payload = JSON.stringify({
          zoneId: zoneId,
          type: 'wind_sensor',
          windspeed: parseFloat((1.2 + Math.random() * 3.5).toFixed(2)),
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });

        const pubStart = Date.now();
        client.publish(`barn/zone/${zoneId}/windspeed`, payload);
        mqttEnvPublishLatency.add(Date.now() - pubStart);
        mqttEnvSent.add(1);
      }
    }, sendIntervalMs);

  });

  client.connect(MQTT_URL);
}
