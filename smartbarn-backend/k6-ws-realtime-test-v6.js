import ws from 'k6/ws';
import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK REAL-TIME E2E V6: SENSOR MQTT -> REDIS PUBSUB -> WEBSOCKET BROADCAST
// =========================================================================
const wsVitalE2ELatency = new Trend('ws_vital_e2e_latency');       // Latensi E2E Sensor Vital Sapi
const wsEnvE2ELatency = new Trend('ws_env_e2e_latency');           // Latensi E2E Sensor Lingkungan Kandang
const wsHandshakeTime = new Trend('ws_handshake_connecting_time'); // Waktu Handshake WebSocket Socket.io
const mqttSensorSent = new Counter('mqtt_sensor_sent');             // Total paket data sensor terkirim via MQTT
const wsBroadcastReceived = new Counter('ws_broadcast_received');   // Total broadcast diterima via WebSocket

// Konfigurasi Target: Otomatis mendeteksi Lokal VPS (127.0.0.1) atau Remote Laptop (77.37.63.21)
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');
const WS_URL = __ENV.WS_URL || (isLocal ? 'ws://127.0.0.1:4000/socket.io/?EIO=4&transport=websocket' : 'ws://smartcattlebarn.site:4000/socket.io/?EIO=4&transport=websocket');

const targetVUs = parseInt(__ENV.VUS || '100', 10);
const warmupVUs = Math.max(1, Math.floor(targetVUs * 0.4));

export const options = {
  stages: [
    { duration: '5s', target: warmupVUs },   // Tahap 1: Ramp-up bertahap awal (40% beban)
    { duration: '5s', target: targetVUs },   // Tahap 2: Naik ke beban target (10, 50, atau 100 VU)
    { duration: '20s', target: targetVUs },  // Tahap 3: Tahan stabil di beban puncak sampai akhir (tanpa ramp-down ke 0)
  ],
  thresholds: {
    ws_vital_e2e_latency: ['p(95)<1000'],
    ws_env_e2e_latency: ['p(95)<1000'],
    ws_handshake_connecting_time: ['p(95)<500'],
  },
};

export default function () {
  const vuId = __VU;
  const cattleId = `C-${300 + (vuId % 10)}`;
  const zoneId = 1;

  const mqttClient = new Client();

  // 1. KONEKSI MQTT
  mqttClient.on('connect', () => {
    const wsConnectStart = Date.now();

    // 2. KONEKSI WEBSOCKET
    ws.connect(WS_URL, {}, function (socket) {
      socket.on('open', () => {
        wsHandshakeTime.add(Date.now() - wsConnectStart);
        socket.send('40'); // Handshake Socket.IO v4 Connect

        // 3. EKSEKUSI PENGIRIMAN DATA SENSOR VIA MQTT
        const intervalId = socket.setInterval(() => {
          const isVital = Math.random() < 0.50;
          const sendTime = Date.now();

          if (isVital) {
            const payload = JSON.stringify({
              cattleId: cattleId,
              heartRate: Math.floor(65 + Math.random() * 25),
              temp: parseFloat((37.5 + Math.random() * 2.0).toFixed(1)),
              timestamp: new Date().toISOString(),
              clientTimestamp: sendTime,
            });

            mqttClient.publish(`barn/cow/${cattleId}/vitals`, payload);
            mqttSensorSent.add(1);

          } else {
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

              mqttClient.publish(`barn/zone/${zoneId}/environment`, payload);
              mqttSensorSent.add(1);

            } else {
              const payload = JSON.stringify({
                zoneId: zoneId,
                type: 'wind_sensor',
                windspeed: parseFloat((1.5 + Math.random() * 2.5).toFixed(2)),
                timestamp: new Date().toISOString(),
                clientTimestamp: sendTime,
              });

              mqttClient.publish(`barn/zone/${zoneId}/windspeed`, payload);
              mqttSensorSent.add(1);
            }
          }
        }, 3000);

        socket.on('message', (message) => {
          const now = Date.now();
          if (typeof message === 'string' && message.startsWith('42')) {
            try {
              const parsed = JSON.parse(message.substring(2));
              const eventName = parsed[0];
              const payload = parsed[1];

              if (eventName === 'vital-update' && payload && payload.clientTimestamp) {
                const latency = now - payload.clientTimestamp;
                if (latency >= 0) {
                  wsVitalE2ELatency.add(latency);
                  wsBroadcastReceived.add(1);
                }
              } else if (eventName === 'environment' && payload && payload.clientTimestamp) {
                const latency = now - payload.clientTimestamp;
                if (latency >= 0) {
                  wsEnvE2ELatency.add(latency);
                  wsBroadcastReceived.add(1);
                }
              } else if (eventName === 'windspeed' && payload && payload.clientTimestamp) {
                const latency = now - payload.clientTimestamp;
                if (latency >= 0) {
                  wsEnvE2ELatency.add(latency);
                  wsBroadcastReceived.add(1);
                }
              }
            } catch (err) {}
          }
        });

        socket.setTimeout(() => {
          try { socket.close(); } catch (e) {}
          try { mqttClient.end(); } catch (e) {}
        }, 20000);
      });

      socket.on('error', (e) => {
        mqttClient.end();
      });
    });
  });

  mqttClient.connect(MQTT_URL);
}
