const mqtt = require('mqtt');

const MQTT_URL = 'mqtt://localhost:1883';
const client = mqtt.connect(MQTT_URL);

client.on('connect', () => {
    console.log('Simulator Connected to MQTT Broker');

    // Mulai simulasi
    simulateHighVelocity();
    simulateLowVelocity();
});

// Alur 1: High Velocity Data (Vitals)
let lastTemp = 38.5; 
function simulateHighVelocity() {
    // Update Suhu setiap 1 menit sekali
    setInterval(() => {
        lastTemp = parseFloat((Math.random() * (39 - 37) + 37).toFixed(1));
    }, 60000);

    // Kirim data (Detak Jantung per detik, Suhu pake nilai terakhir)
    setInterval(() => {
        const heartRate = Math.floor(Math.random() * (90 - 60 + 1)) + 60; 
        
        const payload = {
            cattleId: 'C-302',
            heartRate: heartRate,
            temp: lastTemp, 
            timestamp: new Date().toISOString()
        };
        const topic = `barn/cow/C-302/vitals`;
        
        client.publish(topic, JSON.stringify(payload));
        console.log(`[High Velocity] Published to ${topic}: ${heartRate} BPM, ${lastTemp}C`);
    }, 1000); 
}

// Alur 2: Low Velocity Data (Environment) - 1 menit sekali
function simulateLowVelocity() {
    setInterval(() => {
        // Lingkungan Section 1 (ID 1)
        const envPayload = {
            temperature: (Math.random() * (35 - 25) + 25).toFixed(1), // 25-35 C
            humidity: Math.floor(Math.random() * (80 - 50 + 1)) + 50, // 50-80 %
            ammonia: (Math.random() * (15 - 5) + 5).toFixed(1), // 5-15 ppm
            timestamp: new Date().toISOString()
        };
        const envTopic = `barn/section/1/environment`;
        client.publish(envTopic, JSON.stringify(envPayload));
        console.log(`[Low Velocity] Published Environment to ${envTopic}: ${envPayload.temperature}C, ${envPayload.ammonia}ppm`);

        // Simulasi Windspeed untuk Zone 1 (ID 1)
        const windPayload = {
            windspeed: (Math.random() * (12 - 2) + 2).toFixed(2), // 2-12 m/s
            timestamp: new Date().toISOString()
        };
        const windTopic = `barn/zone/1/windspeed`;
        client.publish(windTopic, JSON.stringify(windPayload));
        console.log(`[Low Velocity] Published Windspeed to ${windTopic}: ${windPayload.windspeed} m/s`);

    }, 60000); // 1 menit sekali (sesuai interval asli)
}

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
