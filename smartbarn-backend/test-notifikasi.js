require('dotenv').config();
const nodemailer = require('nodemailer');

const testEmail = async (targetEmail) => {
    console.log(`\n📧 Menguji Pengiriman Email ke: ${targetEmail}`);
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('❌ Konfigurasi EMAIL_USER atau EMAIL_PASS belum diatur di file .env');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: targetEmail,
        subject: 'Smart Cattle Barn - Notifikasi Testing',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 10px;">
                <h2 style="color: #059669;">Pesan Uji Coba Berhasil! 🎉</h2>
                <p>Halo,</p>
                <p>Sistem pengiriman email (Nodemailer) untuk aplikasi <b>Smart Cattle Barn</b> Anda berfungsi dengan baik.</p>
                <p>Abaikan pesan ini karena ini hanya hasil dari pengujian sistem.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #64748b;">Smart Cattle Barn System &copy; 2026</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Sukses mengirim email!`);
        console.log(`   Message ID: ${info.messageId}`);
    } catch (err) {
        console.error(`❌ Gagal mengirim email. Error:\n   ${err.message}`);
    }
};

const testPush = async (pushToken) => {
    console.log(`\n📱 Menguji Pengiriman Push Notification ke Token: ${pushToken}`);
    if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
        console.log('❌ Token tidak valid. Harusnya berawalan "ExponentPushToken[xxxx]".');
        return;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title: '🔔 Uji Coba Smart Barn',
        body: 'Halo! Push notification dari Smart Cattle Barn bekerja dengan baik.',
        priority: 'high',
        channelId: 'default',
        badge: 1,
        _displayInForeground: true,
        data: { title: '🔔 Uji Coba Smart Barn', body: 'Push notification bekerja dengan baik.' }
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });
        
        if (response.ok) {
            console.log(`✅ Sukses mengirim Push Notification! Silakan cek HP Anda.`);
        } else {
            console.log(`❌ Gagal mengirim Push Notification. HTTP Status: ${response.status}`);
        }
    } catch (err) {
        console.error(`❌ Gagal memanggil API Expo:\n   ${err.message}`);
    }
};

const testWeb = async () => {
    console.log(`\n💻 Menguji Pengiriman Web Notification (WebSocket) via Redis...`);
    
    // Import ioredis secara dinamis agar tidak error jika tidak dipakai
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: 1 });
    
    const payload = {
        title: "Peringatan Percobaan!",
        message: "Notifikasi Web dari test-notifikasi.js berhasil diterima secara Real-Time!",
        type: "warning",
        timestamp: new Date().toISOString()
    };

    try {
        await redis.publish('websocket:alert', JSON.stringify(payload));
        console.log(`✅ Sukses mengirim Web Notification! Cek layar Dashboard web Anda (kanan atas).`);
    } catch (err) {
        console.error(`❌ Gagal mengirim ke Redis:\n   ${err.message}`);
    } finally {
        redis.quit(); // Tutup koneksi redis
    }
};

const run = async () => {
    console.log('=============================================');
    console.log('   TEST NOTIFIKASI SMART CATTLE BARN');
    console.log('=============================================');
    
    const args = process.argv.slice(2);
    
    const emailArg = args.find(a => a.includes('@'));
    const tokenArg = args.find(a => a.startsWith('ExponentPushToken'));
    const webArg = args.find(a => a === 'web');

    if (!emailArg && !tokenArg && !webArg) {
        console.log('\nCara Penggunaan:');
        console.log('  node test-notifikasi.js [email] [expo_token] [web]\n');
        console.log('1. Test Email saja:');
        console.log('   node test-notifikasi.js emailanda@gmail.com\n');
        console.log('2. Test Push Notif HP saja:');
        console.log('   node test-notifikasi.js ExponentPushToken[xxxxxx]\n');
        console.log('3. Test Notifikasi Web (Toast di Dashboard) saja:');
        console.log('   node test-notifikasi.js web\n');
        console.log('4. Test Semuanya sekaligus:');
        console.log('   node test-notifikasi.js emailanda@gmail.com ExponentPushToken[xxxxxx] web\n');
        process.exit(1);
    }

    if (emailArg) await testEmail(emailArg);
    if (tokenArg) await testPush(tokenArg);
    if (webArg) await testWeb();
};

run();
