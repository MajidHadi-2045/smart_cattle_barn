const mqtt = require('mqtt');

// const MQTT_URL = 'mqtt://localhost:1883';
const MQTT_URL = 'mqtt://smartcattlebarn.site:1883';
const client = mqtt.connect(MQTT_URL);

// --- Simulasi Data sensor IOT SMARTCATTLEBARN ---
const SIMULATE_PACKET_LOSS = true;
const PACKET_LOSS_RATE = 0.05; // 5% packet loss pada data vitals (High Velocity)
const RESOLUTION_BITS = 10;     // Resolusi ADC 10-bit

// Koordinat Virtual Gateway di Kandang (0, 0)
const GATEWAY_X = 0;
const GATEWAY_Y = 0;

// Posisi awal sapi C-302 (dalam meter)
let cowX = 15; 
let cowY = 20;

// Status baterai awal pada tag sensor sapi
let batteryVoltage = 3.28; // Volt (Baterai penuh sekitar 3.3V)

// Generator Derau Gaussian (Normal Distribution) menggunakan Box-Muller Transform
function randomGaussian(mean = 0, stdDev = 0.1) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); 
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}

// Simulasi Kuantisasi ADC (Analog-to-Digital Converter)
function simulateADC(realValue, minRange, maxRange, resolutionBits = 10) {
    const totalSteps = Math.pow(2, resolutionBits) - 1; // 1023 langkah untuk 10-bit
    
    // Normalisasi nilai ke range [0, 1]
    let normalized = (realValue - minRange) / (maxRange - minRange);
    normalized = Math.max(0, Math.min(1, normalized)); // Pembatasan batas (clamping)
    
    // Konversi ke langkah diskrit ADC
    const adcStep = Math.round(normalized * totalSteps);
    
    // Konversi kembali dari langkah diskrit ke nilai fisik terukur
    const measuredValue = minRange + (adcStep / totalSteps) * (maxRange - minRange);
    return parseFloat(measuredValue.toFixed(2));
}

// Model Path Loss Log-Distance untuk RSSI (Kekuatan Sinyal Radio dalam dBm)
function calculateRSSI(x, y) {
    const distance = Math.sqrt(Math.pow(x - GATEWAY_X, 2) + Math.pow(y - GATEWAY_Y, 2)) || 1;
    const P0 = -30; // RSSI pada jarak 1 meter (dBm)
    const pathLossExponent = 2.4; // Faktor redaman kandang (obstacle sedang)
    
    // Shadowing Fading (Derau Gaussian pada redaman sinyal)
    const fading = randomGaussian(0, 3.0); // StdDev = 3 dB
    
    const rssi = P0 - (10 * pathLossExponent * Math.log10(distance)) + fading;
    return parseFloat(Math.min(-30, Math.max(-110, rssi)).toFixed(1));
}

client.on('connect', () => {
    console.log('\n===============================================================');
    console.log('  SIMULATOR DATA SENSOR IOT SMARTCATTLEBARN');
    console.log('===============================================================');
    console.log(`Connected to MQTT Broker: ${MQTT_URL}`);
    console.log(`Parameter Simulasi:`);
    console.log(`- ADC Resolution : ${RESOLUTION_BITS}-bit`);
    console.log(`- Packet Loss     : ${SIMULATE_PACKET_LOSS ? `${PACKET_LOSS_RATE * 100}%` : 'Disabled'}`);
    console.log(`- RF Model        : Log-Distance Path Loss + Gaussian Fading`);
    console.log('---------------------------------------------------------------\n');

    // Mulai simulasi
    simulateHighVelocity();
    simulateLowVelocity();
});

// Alur 1: High Velocity Data (Vitals Sapi C-302)
let lastTemp = 38.5; // Titik awal suhu sapi (Normal)
let currentHeartRate = 72; // Titik awal detak jantung (BPM)

function simulateHighVelocity() {
    // A. Model Sinyal Suhu Tubuh Sapi (Suhu biologis bergerak lambat + noise kecil)
    setInterval(() => {
        // Drift biologis perlahan
        const drift = randomGaussian(0, 0.05);
        lastTemp += drift;
        
        // Batasan suhu hidup sapi (normal 37.5 - 39.8 C)
        if (lastTemp < 37.5) lastTemp = 37.5;
        if (lastTemp > 39.8) lastTemp = 39.8;
    }, 10000); // Update tren suhu setiap 10 detik

    // B. Model Sinyal Detak Jantung (Random Walk / Drift kontinu + Kuantisasi ADC)
    setInterval(() => {
        // Sapi bergeser posisi di dalam kandang (pergerakan acak)
        cowX += randomGaussian(0, 0.5);
        cowY += randomGaussian(0, 0.5);
        
        // Batasi sapi agar tetap dalam jangkauan kandang (50m x 50m)
        cowX = Math.max(-25, Math.min(25, cowX));
        cowY = Math.max(-25, Math.min(25, cowY));

        // Detak jantung mengalami drift kontinu (Random Walk)
        const heartDrift = randomGaussian(0, 1.5);
        currentHeartRate += heartDrift;
        
        // Batas biologis detak jantung sapi
        if (currentHeartRate < 55) currentHeartRate = 55;
        if (currentHeartRate > 95) currentHeartRate = 95;

        // Terapkan Kuantisasi ADC 10-bit pada sensor detak jantung (Range sensor: 0 - 150 BPM)
        const quantizedHR = simulateADC(currentHeartRate, 0, 150, RESOLUTION_BITS);
        // Terapkan Kuantisasi ADC 10-bit pada sensor suhu tubuh (Range sensor: 30 - 45 C)
        const quantizedTemp = simulateADC(lastTemp, 30, 45, RESOLUTION_BITS);

        // Simulasi Pelepasan Baterai (Discharge) - berkurang saat transmisi aktif
        batteryVoltage -= 0.00002;
        if (batteryVoltage < 2.5) batteryVoltage = 3.28; // Reset jika habis

        // Hitung RSSI berdasarkan posisi sapi dari gateway
        const rssi = calculateRSSI(cowX, cowY);

        const payload = {
            cattleId: 'C-302',
            heartRate: Math.round(quantizedHR),
            temp: quantizedTemp,
            batteryVoltage: parseFloat(batteryVoltage.toFixed(4)),
            rssi: rssi,
            timestamp: Date.now() // Unix timestamp untuk perhitungan latensi end-to-end
        };

        const topic = `barn/cow/C-302/vitals`;

        // Simulasi Packet Loss pada media transmisi nirkabel
        if (SIMULATE_PACKET_LOSS && Math.random() < PACKET_LOSS_RATE) {
            console.log(`[High Velocity] ❌ Packet DROPPED (Loss) on ${topic} - RSSI: ${rssi} dBm`);
            return;
        }

        // Publish ke MQTT Broker dengan QoS 1 (At least once) untuk menjamin pengiriman data vital
        client.publish(topic, JSON.stringify(payload), { qos: 1 });
        console.log(`[High Velocity] Published to ${topic}: ${payload.heartRate} BPM, ${payload.temp}C | RSSI: ${rssi} dBm, Batt: ${payload.batteryVoltage}V`);

    }, 1000); // Kirim data setiap 1 detik
}

// Alur 2: Low Velocity Data (Suhu Lingkungan Barn & Kecepatan Angin)
let simulatedMinutes = 360; // Mulai jam 06:00 pagi (360 menit dari tengah malam)

function simulateLowVelocity() {
    const publishData = () => {
        simulatedMinutes += 10; // Waktu simulasi berjalan lebih cepat
        if (simulatedMinutes >= 1440) simulatedMinutes = 0; 

        // A. Pembangkitan Sinyal Suhu Lingkungan (Gelombang Sinusoidal Diurnal + Derau Gaussian)
        // Suhu dingin saat subuh (24C), panas siang hari (32C)
        const meanTemp = 28.0;
        const amplitude = 4.0;
        const phaseShift = -Math.PI / 2; // Mengatur suhu terendah pukul 04:00 - 05:00 subuh
        const angle = (2 * Math.PI * simulatedMinutes) / 1440 + phaseShift;
        const idealTemp = meanTemp + amplitude * Math.sin(angle);
        const noiseTemp = idealTemp + randomGaussian(0, 0.3); // Noise Gaussian kecil
        const quantizedEnvTemp = simulateADC(noiseTemp, 0, 50, RESOLUTION_BITS); // ADC 10-bit range 0-50 C

        // B. Sinyal Kelembapan Lingkungan (Berkorelasi terbalik dengan suhu)
        const idealHumidity = 80 - (amplitude * 3 * Math.sin(angle));
        const noiseHum = idealHumidity + randomGaussian(0, 1.5);
        const quantizedHumidity = Math.round(simulateADC(noiseHum, 0, 100, RESOLUTION_BITS));

        // C. Sinyal Gas Amonia
        const rawAmmonia = 8.5 + randomGaussian(0, 0.8);
        const quantizedAmmonia = simulateADC(rawAmmonia, 0, 50, RESOLUTION_BITS);

        const envPayload = {
            temperature: quantizedEnvTemp,
            humidity: quantizedHumidity,
            ammonia: quantizedAmmonia,
            timestamp: Date.now()
        };
        const envTopic = `barn/section/1/environment`;
        client.publish(envTopic, JSON.stringify(envPayload), { qos: 0 }); // Lingkungan cukup QoS 0 (tidak kritis)
        console.log(`[Low Velocity] Published Environment to ${envTopic}: ${quantizedEnvTemp}C, ${quantizedHumidity}%, ${quantizedAmmonia}ppm (SimTime: ${Math.floor(simulatedMinutes/60)}:${simulatedMinutes%60})`);

        // D. Sinyal Kecepatan Angin (Windspeed)
        const rawWindspeed = 5.0 + randomGaussian(0, 1.2);
        const quantizedWind = simulateADC(rawWindspeed, 0, 20, RESOLUTION_BITS);

        const windPayload = {
            windspeed: quantizedWind,
            timestamp: Date.now()
        };
        const windTopic = `barn/zone/1/windspeed`;
        client.publish(windTopic, JSON.stringify(windPayload), { qos: 0 });
        console.log(`[Low Velocity] Published Windspeed to ${windTopic}: ${quantizedWind} m/s`);
    };

    publishData(); // Eksekusi langsung saat pertama jalan
    setInterval(publishData, 60000); // Kirim data setiap 1 menit sekali
}

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
