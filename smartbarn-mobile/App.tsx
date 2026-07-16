import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from './src/context/ToastContext';
import { ReadingModeProvider } from './src/context/ReadingModeContext';
import { LogBox } from 'react-native';
import * as Notifications from 'expo-notifications';

// Konfigurasi agar notifikasi muncul dari atas layar (heads-up) dan berdering
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
// Sembunyikan semua log peringatan/error developer (YellowBox/RedBox) agar tidak mengganggu layar HP
LogBox.ignoreAllLogs();

export default function App() {
  return (
    <SafeAreaProvider>
      <ReadingModeProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </ToastProvider>
      </ReadingModeProvider>
    </SafeAreaProvider>
  );
}
