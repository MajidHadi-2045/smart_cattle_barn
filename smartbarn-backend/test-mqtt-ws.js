import ws from 'k6/ws';
import { Client } from 'k6/x/mqtt';
import { Trend } from 'k6/metrics';

const wsVitalE2ELatency = new Trend('ws_vital_e2e_latency');
const WS_URL = 'ws://smartcattlebarn.site:4000/socket.io/?EIO=4&transport=websocket';
const MQTT_URL = 'mqtt://smartcattlebarn.site:1883';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const mqttClient = new Client();

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to Broker');

    // Hubungkan ke WebSocket Dashboard
    ws.connect(WS_URL, {}, function (socket) {
      socket.on('open', () => {
        socket.send('40'); // Handshake Socket.IO v4
        console.log('[WS] Connected to Gateway');

        // Kirim data sensor via MQTT
        const sendTime = Date.now();
        const payload = JSON.stringify({
          cattleId: 'C-302',
          heartRate: 75,
          temp: 38.5,
          timestamp: new Date().toISOString(),
          clientTimestamp: sendTime,
        });

        mqttClient.publish('barn/cow/C-302/vitals', payload);
        console.log('[MQTT] Vital Data Published to barn/cow/C-302/vitals');
      });

      socket.on('message', (msg) => {
        const now = Date.now();
        if (msg.startsWith('42')) {
          try {
            const raw = msg.substring(2);
            const parsed = JSON.parse(raw);
            const eventName = parsed[0];
            const eventData = parsed[1];

            console.log('[WS] Received Event:', eventName);

            if ((eventName === 'vital-update' || eventName === 'websocket:vital-update') && eventData.clientTimestamp) {
              const latency = now - eventData.clientTimestamp;
              console.log(`[E2E LATENCY] Sensor (MQTT) -> Backend -> Redis -> WebSocket (Client): ${latency}ms`);
              wsVitalE2ELatency.add(latency);

              socket.close();
              mqttClient.end();
            }
          } catch (e) {}
        }
      });

      socket.setTimeout(() => {
        socket.close();
        mqttClient.end();
      }, 5000);
    });
  });

  mqttClient.on('end', () => {
    console.log('[MQTT] Disconnected');
  });

  mqttClient.connect(MQTT_URL);
}
