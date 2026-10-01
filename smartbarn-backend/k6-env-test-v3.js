import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK SENSOR LINGKUNGAN V3 (DINAMIS 100% BEBAS STAGE)
// =========================================================================
const mqttEnvPublishLatency = new Trend('mqtt_env_publish_latency');
const mqttEnvProcessingLatency = new Trend('mqtt_env_processing_latency');
const mqttEnvSent = new Counter('mqtt_env_messages_sent');
const mqttEnvProcessed = new Counter('mqtt_env_messages_processed');

const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');

// V3 OPTIONS: Bebas diatur dari CLI (--vus <N> --duration <T>)
export const options = {
  thresholds: {
    mqtt_env_publish_latency: ['p(95)<100'],
    mqtt_env_processing_latency: ['p(95)<1000'],
  },
};

export default function () {
  const vuId = __VU;
  const zoneId = 1;
  const isWind = (vuId % 3 === 0);

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
    if (!isWind) {
      client.subscribe(`barn/zone/${zoneId}/environment`);
    } else {
      client.subscribe(`barn/zone/${zoneId}/windspeed`);
    }

    let count = 0;
    const maxCount = 15;

    const interval = setInterval(() => {
      count++;
      if (count > maxCount) {
        clearInterval(interval);
        setTimeout(() => client.end(), 800);
        return;
      }

      const sendTime = Date.now();

      if (!isWind) {
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
    }, 1500);
  });

  client.connect(MQTT_URL);
}
