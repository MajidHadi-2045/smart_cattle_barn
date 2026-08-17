import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser, saveUser, clearAuthSession } from '../utils/storage';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { User, Mail, Lock, Shield, LogOut, ChevronLeft, Camera, Phone, Edit2, Check, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/client';

const ProfileScreen = ({ navigation }: any) => {
  const [user, setUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // State untuk Edit Profil
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      let parsedUser = await getUser();
      if (parsedUser) {
        setUser(parsedUser);
        
        // Coba ambil data terbaru dari backend
        try {
          const res = await apiClient.get(`/users/profile/${parsedUser.id}`);
          if (res.data) {
            parsedUser = { ...parsedUser, ...res.data };
            setUser(parsedUser);
            await saveUser(parsedUser);
          }
        } catch (e) {
          console.log('Gagal mengambil data profil terbaru', e);
        }

        setEditEmail(parsedUser.email || '');
        setEditPhone(parsedUser.phone || '');
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      "Konfirmasi Keluar",
      "Apakah Anda yakin ingin keluar dari akun?",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Keluar", 
          style: "destructive",
          onPress: async () => {
            await clearAuthSession();
            await AsyncStorage.clear();
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!editEmail) {
      Alert.alert('Error', 'Email tidak boleh kosong');
      return;
    }
    
    setIsSavingProfile(true);
    try {
      const response = await apiClient.patch(`/users/profile/${user.id}/update`, {
        email: editEmail,
        phone: editPhone
      });

      const updatedUser = { ...user, email: editEmail, phone: editPhone };
      setUser(updatedUser);
      await saveUser(updatedUser);
      
      Alert.alert('Sukses', 'Profil berhasil diperbarui!');
      setIsEditingProfile(false);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Gagal', error.response?.data?.message || 'Gagal memperbarui profil');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Harap isi password lama dan password baru');
      return;
    }
    // Implementasi mockup sementara (fitur perubahan password di sisi backend belum tersedia)
    Alert.alert('Sukses', 'Password berhasil diubah (Fitur Demo)');
    setCurrentPassword('');
    setNewPassword('');
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert("Izin Ditolak", "Anda perlu memberikan izin akses galeri untuk mengganti foto profil.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (pickerResult.canceled || !pickerResult.assets || !pickerResult.assets[0].base64) {
        return;
      }

      const asset = pickerResult.assets[0];
      if (!asset.base64) {
        Alert.alert("Gagal", "Tidak dapat membaca file foto.");
        return;
      }
      const estimatedSize = asset.base64.length * 0.75;
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (estimatedSize > maxSize) {
        Alert.alert("Gagal", "Ukuran foto terlalu besar (Maksimal 5MB)");
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const base64String = `data:${mimeType};base64,${asset.base64}`;
      uploadPhoto(base64String);
      
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Gagal membuka galeri");
    }
  };

  const uploadPhoto = async (base64String: string) => {
    setIsUploading(true);
    try {
      await apiClient.patch(`/users/profile/${user.id}/photo`, { photo: base64String });
      
      const updatedUser = { ...user, photo_url: base64String, photo: base64String };
      setUser(updatedUser);
      await saveUser(updatedUser);
      
      Alert.alert('Sukses', 'Foto profil berhasil diperbarui!');
    } catch (error: any) {
      console.error(error);
      Alert.alert("Gagal", error.response?.data?.message || "Koneksi server terputus saat mengunggah foto");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil Pengguna</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={isUploading}
          >
            {user?.photo || user?.photo_url ? (
              <Image 
                source={{ uri: user.photo || user.photo_url }} 
                style={[styles.avatarImage, isUploading && { opacity: 0.5 }]} 
              />
            ) : (
              <User size={40} color={COLORS.primary} />
            )}
            
            <View style={styles.cameraIconContainer}>
              <Camera size={14} color={COLORS.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.name || 'Pengguna'}</Text>
          <Text style={styles.userRole}>
            {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'VETERINER' ? 'Dokter Hewan' : 'Staf Kandang'}
          </Text>
        </View>

        {/* Info Detail */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, marginLeft: 4 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 0 }]}>Informasi Kontak</Text>
          <TouchableOpacity 
            onPress={() => {
              if (isEditingProfile) {
                handleUpdateProfile();
              } else {
                setIsEditingProfile(true);
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}
            disabled={isSavingProfile}
          >
            {isEditingProfile ? (
              <>
                <Check size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.primary }}>
                  {isSavingProfile ? 'Menyimpan...' : 'Simpan'}
                </Text>
              </>
            ) : (
              <>
                <Edit2 size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.primary }}>Edit</Text>
              </>
            )}
          </TouchableOpacity>
          {isEditingProfile && !isSavingProfile && (
             <TouchableOpacity 
               onPress={() => {
                 setIsEditingProfile(false);
                 setEditEmail(user?.email || '');
                 setEditPhone(user?.phone || '');
               }}
               style={{ marginLeft: 8, padding: 4 }}
             >
               <X size={16} color={COLORS.danger} />
             </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Mail size={20} color={COLORS.textLight} />
            {isEditingProfile ? (
              <TextInput 
                style={styles.editInput}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.infoText}>{user?.email || 'email@domain.com'}</Text>
            )}
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Phone size={20} color={COLORS.textLight} />
            {isEditingProfile ? (
              <TextInput 
                style={styles.editInput}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="Contoh: 08123456789"
                placeholderTextColor="#94a3b8"
              />
            ) : (
              <Text style={styles.infoText}>{user?.phone || 'Belum diatur'}</Text>
            )}
          </View>
        </View>

        {/* Form Ganti Password */}
        <Text style={styles.sectionTitle}>Ganti Password</Text>
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password Lama</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Masukkan password saat ini"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password Baru</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Masukkan password baru"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>
          </View>
          <TouchableOpacity style={styles.changeBtn} onPress={handleChangePassword}>
            <Text style={styles.changeBtnText}>Simpan Password Baru</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: 20,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: '#bfdbfe',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 6,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  infoContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: SPACING.sm,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: SPACING.xs,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  editInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: 2,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  changeBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  changeBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: SPACING.xl * 2,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default ProfileScreen;
