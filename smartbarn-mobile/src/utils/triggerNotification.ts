import * as Notifications from 'expo-notifications';

export const triggerLocalNotification = async (title: string, body: string) => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== 'granted') {
      const { status: reqStatus } = await Notifications.requestPermissionsAsync();
      finalStatus = reqStatus;
    }
    if (finalStatus !== 'granted') {
      console.log('Izin Notifikasi Ditolak!');
      return;
    }

    // Membunyikan notifikasi langsung secara instan dengan spanduk banner sistem Android
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (e) {
    console.error('Error triggering local notification:', e);
  }
};
