import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK SENSOR VITAL SAPI V3 (DINAMIS 100% BEBAS STAGE)
// =========================================================================
const mqttVitalPublishLatency = new Trend('mqtt_vital_publish_latency');
const mqttVitalProcessingLatency = new Trend('mqtt_vital_processing_latency');
const mqttVitalSent = new Counter('mqtt_vital_messages_sent');
const mqttVitalProcessed = new Counter('mqtt_vital_messages_processed');

const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');

// V3 OPTIONS: Bebas diatur dari CLI (--vus <N> --duration <T>)
export const options = {
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
    const maxCount = 20;

    const interval = setInterval(() => {
      count++;
      if (count > maxCount) {
        clearInterval(interval);
        setTimeout(() => client.end(), 800);
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
