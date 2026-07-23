import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { LogIn, Lock, User, Beef, Eye, EyeOff } from 'lucide-react-native';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerForPushNotificationsAsync } from '../utils/registerForPushNotificationsAsync';

const LoginScreen = ({ navigation }: any) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('STAFF');
  const [loading, setLoading] = useState(false);

  const ROLES = [
    { label: 'Super Admin (Manajer)', value: 'SUPER_ADMIN' },
    { label: 'Staff (Operator Kandang)', value: 'STAFF' },
    { label: 'Dokter Hewan (Veteriner)', value: 'VETERINER' },
  ];

  const handleLogin = async () => {
    if (!usernameOrEmail || !password) {
      Alert.alert('Error', 'Silakan masukkan Username/Email dan password');
      return;
    }

    setLoading(true);
    try {
      // Meminta token unik HP dari Expo/Firebase
      const pushToken = await registerForPushNotificationsAsync();
      
      // Kirim token tersebut bersamaan dengan email & password
      const response = await apiClient.post('/auth/login', { 
        email: usernameOrEmail, 
        password, 
        role,
        pushToken // <-- Ditambahkan ke backend
      });
      const { access_token, user } = response.data;
      
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      navigation.replace('Dashboard');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login Gagal', error.response?.data?.message || 'Terjadi kesalahan saat login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.logoContainer} 
            onPress={() => navigation.navigate('Welcome')}
          >
            <Image 
              source={require('../../assets/icon.png')} 
              style={{ width: 80, height: 80, borderRadius: 20 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.title}>Smart Cattle Barn</Text>
          <Text style={styles.subtitle}>Monitoring peternakan dalam genggaman</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <User size={20} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username atau Email"
              placeholderTextColor={COLORS.textLight}
              value={usernameOrEmail}
              onChangeText={(text) => setUsernameOrEmail(text.replace(/\s/g, ''))}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
              {showPassword ? <EyeOff size={20} color={COLORS.textLight} /> : <Eye size={20} color={COLORS.textLight} />}
            </TouchableOpacity>
          </View>

          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>Pilih Peran Anda:</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity 
                  key={r.value}
                  style={[
                    styles.roleItem, 
                    role === r.value && styles.roleItemActive
                  ]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={[
                    styles.roleText,
                    role === r.value && styles.roleTextActive
                  ]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginButtonText}>Login Sekarang</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ marginTop: SPACING.md, alignItems: 'center' }}
            onPress={async () => {
              if (!usernameOrEmail) {
                Alert.alert('Perhatian', 'Silakan ketik Email Anda terlebih dahulu di kolom input, lalu tekan Lupa Password lagi.');
                return;
              }
              try {
                setLoading(true);
                const res = await apiClient.post('/auth/forgot-password', { email: usernameOrEmail });
                Alert.alert('Berhasil', res.data.message || 'Link reset password telah dikirim ke email Anda.');
              } catch (error: any) {
                Alert.alert('Gagal', error.response?.data?.message || 'Gagal mengirim email reset.');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Text style={{ color: COLORS.primary, fontWeight: '600', fontSize: 14 }}>Lupa Password?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Full-Screen Loading Overlay */}
      {loading && (
        <View style={styles.fullScreenLoading}>
          <View style={styles.logoBox}>
            <Beef size={64} color="#ffffff" />
          </View>
          <Text style={styles.splashTitle}>Smart Cattle Barn</Text>
          <Text style={styles.splashSubtitle}>Memverifikasi Akun...</Text>
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
          <Text style={styles.loadingText}>Mohon Tunggu</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoContainer: {
    marginBottom: SPACING.lg,
    padding: SPACING.sm,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    ...SHADOWS.md,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  form: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 16,
    ...SHADOWS.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: COLORS.text,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  roleContainer: {
    marginBottom: SPACING.lg,
  },
  roleLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleItemActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  roleTextActive: {
    color: COLORS.white,
  },
  fullScreenLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  logoBox: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  splashSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '500',
  }
});

export default LoginScreen;
