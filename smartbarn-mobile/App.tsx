import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from './src/context/ToastContext';
import { ReadingModeProvider } from './src/context/ReadingModeContext';
import { LogBox, TextInput } from 'react-native';
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

// Set global placeholder text color to slate grey
if ((TextInput as any).defaultProps == null) {
  (TextInput as any).defaultProps = {};
}
(TextInput as any).defaultProps.placeholderTextColor = '#94a3b8';

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
