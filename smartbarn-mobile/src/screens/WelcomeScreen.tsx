import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { LogIn, LineChart } from 'lucide-react-native';

const WelcomeScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          {/* Logo Placeholder (bisa diganti Image jika SVG logoxl sudah jadi PNG) */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={{ width: 80, height: 80, borderRadius: 20 }}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Smart Cattle Barn</Text>
          <Text style={styles.subtitle}>Selamat datang di sistem manajemen pintar peternakan sapi modern.</Text>
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity 
            style={[styles.btn, styles.loginBtn]} 
            onPress={() => navigation.navigate('Login')}
          >
            <LogIn color={COLORS.white} size={24} />
            <Text style={styles.loginBtnText}>Masuk Akun / Login</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btn, styles.publicBtn]} 
            onPress={() => navigation.navigate('PublicDashboard')}
          >
            <LineChart color={COLORS.primary} size={24} />
            <Text style={styles.publicBtnText}>Lihat Dashboard Publik</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 Smart Cattle Barn Project</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
  },
  logoContainer: {
    marginBottom: SPACING.lg,
    padding: SPACING.sm,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    ...SHADOWS.md,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionContainer: {
    gap: SPACING.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
    ...SHADOWS.sm,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  publicBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#bfdbfe',
  },
  publicBtnText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textLight,
    fontSize: 12,
  }
});

export default WelcomeScreen;
