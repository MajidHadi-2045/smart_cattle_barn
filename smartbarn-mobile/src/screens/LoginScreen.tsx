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
import { LogIn, Lock, User } from 'lucide-react-native';
import apiClient from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }: any) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');
  const [loading, setLoading] = useState(false);

  const ROLES = [
    { label: 'Administrator', value: 'SUPER_ADMIN' },
    { label: 'Petugas Kandang', value: 'STAFF' },
    { label: 'Dokter Hewan', value: 'VETERINER' },
  ];

  const handleLogin = async () => {
    if (!usernameOrEmail || !password) {
      Alert.alert('Error', 'Silakan masukkan Username/Email dan password');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email: usernameOrEmail, password, role });
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
          <View style={styles.logoContainer}>
            <LogIn size={40} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Smart Cattle Barn</Text>
          <Text style={styles.subtitle}>Monitoring peternakan dalam genggaman</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <User size={20} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username atau Email"
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
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
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
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 20,
    marginBottom: SPACING.md,
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
});

export default LoginScreen;
