import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK SENSOR LINGKUNGAN V5: BERTAHAP DENGAN MONITORING MONITOR UNTUK MENCEGAH N^2 FANOUT
// =========================================================================
const mqttEnvPublishLatency = new Trend('mqtt_env_publish_latency');       // Waktu transmisi soket TCP lokal ke Broker MQTT
const mqttEnvProcessingLatency = new Trend('mqtt_env_processing_latency'); // Latensi E2E (Timestamp Kirim -> Diterima Backend/Monitor)
const mqttEnvSent = new Counter('mqtt_env_messages_sent');                 // Total pesan dikirim
const mqttEnvProcessed = new Counter('mqtt_env_messages_processed');       // Total pesan berhasil diproses

// Konfigurasi Target: Otomatis mendeteksi Lokal VPS (127.0.0.1) atau Remote Laptop (77.37.63.21)
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');

const targetVUs = parseInt(__ENV.VUS || '100', 10);
const warmupVUs = Math.max(1, Math.floor(targetVUs * 0.4));

export const options = {
  stages: [
    { duration: '5s', target: warmupVUs },   // Tahap 1: Ramp-up bertahap awal (40% beban)
    { duration: '5s', target: targetVUs },   // Tahap 2: Naik ke beban target (10, 50, atau 100 VU)
    { duration: '20s', target: targetVUs },  // Tahap 3: Tahan stabil di beban puncak (tanpa ramp-down ke 0)
  ],
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
      if (data.clientTimestamp) {
        const latency = now - data.clientTimestamp;
        if (latency >= 0) {
          mqttEnvProcessingLatency.add(latency);
          mqttEnvProcessed.add(1);
        }
      }
    } catch (e) {}
  });

  client.on('connect', () => {
    if (isMonitor) {
      client.subscribe(`barn/zone/${zoneId}/environment`);
      client.subscribe(`barn/zone/${zoneId}/windspeed`);
    } else if (!isWind) {
      client.subscribe(`barn/zone/${zoneId}/environment`);
    } else {
      client.subscribe(`barn/zone/${zoneId}/windspeed`);
    }

    let count = 0;
    const maxCount = 15; // Mengirim data berkala per VU

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
    }, 2000);
  });

  client.connect(MQTT_URL);
}
