import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from './src/context/ToastContext';
import { LogBox } from 'react-native';

// Sembunyikan semua log peringatan/error developer (YellowBox/RedBox) agar tidak mengganggu layar HP
LogBox.ignoreAllLogs();

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </ToastProvider>
    </SafeAreaProvider>
  );
}
