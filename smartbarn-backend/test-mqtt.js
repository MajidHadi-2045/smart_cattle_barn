import mqtt from 'k6/x/mqtt';
export default function() {
  const client = new mqtt.Client({
    servers: ["tcp://77.37.63.21:1883"],
    clientId: "test"
  });
  try {
    client.connect({ timeout: 2000, clean_session: true });
    console.log("Connected!");
    client.end();
  } catch(e) {
    console.log("Error:", e);
  }
}
