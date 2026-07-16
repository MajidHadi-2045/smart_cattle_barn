import * as Notifications from 'expo-notifications';

export const triggerLocalNotification = async (title: string, body: string) => {
  // Meminta izin notifikasi (wajib untuk Android 13+)
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('Izin Notifikasi Ditolak!');
    return;
  }

  // Membunyikan notifikasi langsung secara instan
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      sound: true, // Akan memutar suara dering default HP
      priority: Notifications.AndroidNotificationPriority.HIGH, // Memaksa pop-up muncul di atas layar
    },
    trigger: null, // trigger null = langsung dieksekusi detik ini juga
  });
};
