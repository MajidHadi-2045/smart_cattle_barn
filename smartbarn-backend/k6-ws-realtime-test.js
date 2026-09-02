import ws from 'k6/ws';
import { Client } from 'k6/x/mqtt';
import { Trend, Counter } from 'k6/metrics';

// =========================================================================
// METRIK REAL-TIME E2E: SENSOR (MQTT) -> BACKEND -> REDIS -> WEBSOCKET (CLIENT)
// =========================================================================
const wsVitalE2ELatency = new Trend('ws_vital_e2e_latency'); // Latensi E2E Sensor Vital Sapi
const wsEnvE2ELatency = new Trend('ws_env_e2e_latency');     // Latensi E2E Sensor Lingkungan Kandang
const mqttSensorSent = new Counter('mqtt_sensor_sent');       // Total paket data sensor terkirim via MQTT
const wsBroadcastReceived = new Counter('ws_broadcast_received'); // Total broadcast diterima via WebSocket

// Konfigurasi Target: Otomatis mendeteksi Lokal VPS (127.0.0.1) atau Remote Laptop (77.37.63.21)
const isLocal = __ENV.LOCAL === 'true' || __ENV.TARGET === 'local';
const MQTT_URL = __ENV.MQTT_URL || (isLocal ? 'mqtt://127.0.0.1:1883' : 'mqtt://77.37.63.21:1883');
const WS_URL = __ENV.WS_URL || (isLocal ? 'ws://127.0.0.1:4000/socket.io/?EIO=4&transport=websocket' : 'ws://smartcattlebarn.site:4000/socket.io/?EIO=4&transport=websocket');

// =========================================================================
// KONFIGURASI TAHAPAN PENGUJIAN k6
// =========================================================================
export const options = {
  stages: [
    { duration: '5s', target: 10 },   // Ramp-up 10 VUs
    { duration: '20s', target: 30 },  // 30 Virtual Users simultan (Sensor MQTT + Client WebSocket)
    { duration: '5s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    // LATENSI E2E: SENSOR (MQTT) -> BACKEND -> WEBSOCKET (CLIENT) < 1000ms
    // Standar ITU-T Y.1541 & MQTT OASIS untuk sistem telemetri IoT interaktif
    ws_vital_e2e_latency: ['p(95)<1000'],
    ws_env_e2e_latency: ['p(95)<1000'],
  },
};

export default function () {
  const vuId = __VU;
  const cattleId = `C-${300 + (vuId % 10)}`;
  const zoneId = 1;

  const mqttClient = new Client();

  // 1. KONEKSI MQTT (Bertindak sebagai Mikrokontroler / Sensor ESP32)
  mqttClient.on('connect', () => {
    // 2. KONEKSI WEBSOCKET (Bertindak sebagai Client Web Dashboard Pemantau)
    ws.connect(WS_URL, {}, function (socket) {
      socket.on('open', () => {
        socket.send('40'); // Handshake Socket.IO v4 Connect

        // 3. EKSEKUSI PENGIRIMAN DATA SENSOR VIA MQTT SETIAP 3 DETIK
        const intervalId = socket.setInterval(() => {
          const isVital = Math.random() < 0.50;
          const sendTime = Date.now();

          if (isVital) {
            // =================================================================
            // KATEGORI 1: SENSOR VITAL SAPI VIA MQTT
            // Topic: barn/cow/{cattleId}/vitals
            // =================================================================
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
            // =================================================================
            // KATEGORI 2: SENSOR LINGKUNGAN KANDANG VIA MQTT
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
        }, 3000); // Interval 3 detik (standar telemetri mikrokontroler IoT)

        // 4. PENERIMAAN BROADCAST VIA WEBSOCKET DARI BACKEND
        socket.on('message', (msg) => {
          const now = Date.now();
          if (msg.startsWith('42')) {
            try {
              const raw = msg.substring(2);
              const parsed = JSON.parse(raw);
              const eventName = parsed[0];
              const eventData = parsed[1];

              wsBroadcastReceived.add(1);

              if (eventName === 'vital-update' || eventName.startsWith('vital-update')) {
                const sendTime = eventData.clientTimestamp || (eventData.timestamp ? new Date(eventData.timestamp).getTime() : null);
                if (sendTime) {
                  const latency = now - sendTime;
                  if (latency >= 0 && latency < 10000) wsVitalE2ELatency.add(latency);
                }
              } else if (eventName === 'websocket:environment' || eventName === 'websocket:windspeed') {
                const sendTime = eventData.clientTimestamp || (eventData.timestamp ? new Date(eventData.timestamp).getTime() : null);
                if (sendTime) {
                  const latency = now - sendTime;
                  if (latency >= 0 && latency < 10000) wsEnvE2ELatency.add(latency);
                }
              }
            } catch (e) {}
          }
        });

        // 5. TIMEOUT PEMBERSIHAN KONEKSI
        socket.setTimeout(() => {
          clearInterval(intervalId);
          socket.close();
          mqttClient.end();
        }, 25000);
      });

      socket.on('error', () => {
        mqttClient.end();
      });
    });
  });

  mqttClient.connect(MQTT_URL);
}
