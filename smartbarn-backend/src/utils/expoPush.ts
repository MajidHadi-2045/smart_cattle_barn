/**
 * Fungsi untuk menembak server Expo agar meneruskan notifikasi ke HP pengguna (Firebase)
 * @param pushToken Token unik HP milik pengguna (misal: ExponentPushToken[xxx])
 * @param title Judul Notifikasi (misal: "BAHAYA SUHU")
 * @param body Pesan Notifikasi (misal: "Suhu Kandang A terlalu panas!")
 */
export async function sendPushNotification(pushToken: string, title: string, body: string) {
  // Verifikasi format token Expo
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.warn(`[Push Notification] Token tidak valid: ${pushToken}`);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: body,
    priority: 'high',            // Wajib 'high' untuk Android agar muncul banner/spanduk saat aplikasi tertutup
    channelId: 'default',        // Wajib 'default' agar sesuai dengan Android Notification Channel
    badge: 1,
    _displayInForeground: true,
    data: { title, body },
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
    
    const result = await response.json();
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log(`[Push Notification] Berhasil dikirim ke: ${pushToken}`, result);
  } catch (error: any) {
    console.error('[Push Notification] Gagal mengirim:', error.message);
  }
}
