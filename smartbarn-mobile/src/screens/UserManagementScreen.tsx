import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { 
  ChevronLeft, 
  User, 
  Phone, 
  Mail, 
  Shield, 
  Check, 
  X, 
  Trash2, 
  PlusCircle, 
  Lock, 
  Send,
  Users
} from 'lucide-react-native';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const UserManagementScreen = ({ navigation }: any) => {
  const [activeTab, setActiveTab] = useState<'list' | 'requests' | 'form'>('list');
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'SUPER_ADMIN' | 'STAFF' | 'VETERINER'>('STAFF');
  const [formReason, setFormReason] = useState('');

  const fetchUsersAndRequests = async () => {
    try {
      // Mengambil daftar staff aktif dan user pending secara paralel
      const [usersRes, pendingRes] = await Promise.all([
        apiClient.get('/users/staff'),
        apiClient.get('/users/pending')
      ]);
      
      setUsers(usersRes.data || []);
      setRequests(pendingRes.data || []);
    } catch (error) {
      console.error('Error fetching users/requests:', error);
      // Fallback lokal jika server offline
      setUsers([
        { id: 'SUPER_001', name: 'Majid Developer', email: 'dev@agritekno.com', role: 'SUPER_ADMIN', status: 'AKTIF', phone: '08123456789' },
        { id: 'STF_001', name: 'Budi Santoso', email: 'budi@smartcattlebarn.id', role: 'STAFF', status: 'AKTIF', phone: '08567891234' },
      ]);
      setRequests([
        { id: 'TEMP_001', name: 'Dr. Andi', email: 'andi@smartcattlebarn.id', role: 'VETERINER', createdAt: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRequests();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsersAndRequests();
  };

  // 1. Cabut Hak Akses (Delete User)
  const handleDeleteUser = (id: string, name: string) => {
    Alert.alert(
      'Cabut Hak Akses?',
      `Apakah Anda yakin ingin mencabut akses untuk ${name}? Akun ini tidak akan dapat login lagi ke sistem.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Cabut',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/users/${id}`);
              Alert.alert('Sukses', `Hak akses ${name} telah dicabut.`);
              setUsers(prev => prev.filter(u => u.id !== id));
            } catch (error) {
              Alert.alert('Error', 'Gagal mencabut hak akses pengguna.');
            }
          }
        }
      ]
    );
  };

  // 2. Setujui Calon Pendaftar
  const handleApproveRequest = async (id: string, name: string) => {
    try {
      await apiClient.patch(`/users/approve/${id}`);
      Alert.alert('Sukses', `Pendaftaran ${name} telah disetujui!`);
      // Update state lokal
      setRequests(prev => prev.filter(req => req.id !== id));
      fetchUsersAndRequests();
    } catch (error) {
      Alert.alert('Error', 'Gagal menyetujui pendaftaran.');
    }
  };

  // 3. Tolak Calon Pendaftar
  const handleRejectRequest = (id: string, name: string) => {
    Alert.alert(
      'Tolak Permintaan?',
      `Hapus permintaan pendaftaran dari ${name}? Calon pengguna harus mendaftar ulang jika ingin masuk.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tolak',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/users/reject/${id}`);
              Alert.alert('Sukses', 'Permintaan pendaftaran telah ditolak.');
              setRequests(prev => prev.filter(req => req.id !== id));
            } catch (error) {
              Alert.alert('Error', 'Gagal menolak permintaan.');
            }
          }
        }
      ]
    );
  };

  // 4. Submit Tambah Staff Baru
  const handleFormSubmit = async () => {
    if (!formName || !formEmail || !formPassword) {
      Alert.alert('Error', 'Mohon isi nama lengkap, email, dan password.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/users/staff', {
        name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        reason: formReason
      });

      Alert.alert('Sukses', 'Staff baru berhasil terdaftar!');
      // Reset Form
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      setFormRole('STAFF');
      setFormReason('');
      
      // Kembalikan ke tab list & refresh data
      setActiveTab('list');
      fetchUsersAndRequests();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Gagal menambahkan staf baru.');
    } finally {
      setSubmitting(false);
    }
  };

  const UserCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.avatarImg} />
          ) : (
            <User size={26} color={COLORS.primary} />
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <View style={styles.roleBadgeContainer}>
            <View style={[
              styles.roleBadge, 
              item.role === 'SUPER_ADMIN' ? styles.badgePurple : 
              item.role === 'VETERINER' ? styles.badgeBlue : styles.badgeGreen
            ]}>
              <Shield size={10} color={
                item.role === 'SUPER_ADMIN' ? '#7c3aed' : 
                item.role === 'VETERINER' ? '#2563eb' : '#16a34a'
              } />
              <Text style={[
                styles.roleText,
                { color: 
                  item.role === 'SUPER_ADMIN' ? '#7c3aed' : 
                  item.role === 'VETERINER' ? '#2563eb' : '#16a34a'
                }
              ]}>
                {item.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : item.role === 'VETERINER' ? 'DOKTER HEWAN' : 'OPERATOR'}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Tombol Cabut Akses (Hapus) */}
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDeleteUser(item.id, item.name)}
        >
          <Trash2 size={18} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.contactItem}>
          <Mail size={14} color={COLORS.textLight} />
          <Text style={styles.contactText}>{item.email}</Text>
        </View>
        <View style={styles.contactItem}>
          <Phone size={14} color={COLORS.textLight} />
          <Text style={styles.contactText}>{item.phone || '-'}</Text>
        </View>
      </View>
    </View>
  );

  const RequestCard = ({ item }: { item: any }) => (
    <View style={[styles.card, styles.requestCard]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: '#fef3c7' }]}>
          <User size={26} color="#d97706" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.roleBadgeContainer}>
            <View style={[
              styles.roleBadge, 
              item.role === 'SUPER_ADMIN' ? styles.badgePurple : 
              item.role === 'VETERINER' ? styles.badgeBlue : styles.badgeGreen
            ]}>
              <Shield size={10} color={
                item.role === 'SUPER_ADMIN' ? '#7c3aed' : 
                item.role === 'VETERINER' ? '#2563eb' : '#16a34a'
              } />
              <Text style={[
                styles.roleText,
                { color: 
                  item.role === 'SUPER_ADMIN' ? '#7c3aed' : 
                  item.role === 'VETERINER' ? '#2563eb' : '#16a34a'
                }
              ]}>
                {item.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : item.role === 'VETERINER' ? 'DOKTER HEWAN' : 'OPERATOR'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.btnReject]}
          onPress={() => handleRejectRequest(item.id, item.name)}
        >
          <X size={16} color={COLORS.danger} />
          <Text style={styles.btnRejectText}>Tolak</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, styles.btnApprove]}
          onPress={() => handleApproveRequest(item.id, item.name)}
        >
          <Check size={16} color={COLORS.white} />
          <Text style={styles.btnApproveText}>Setujui</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengguna</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'list' && styles.tabButtonActive]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>Daftar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'requests' && styles.tabButtonActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Antrian
          </Text>
          {requests.length > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{requests.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'form' && styles.tabButtonActive]}
          onPress={() => setActiveTab('form')}
        >
          <Text style={[styles.tabText, activeTab === 'form' && styles.tabTextActive]}>Tambah</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingSpinner message="Memuat Data Pengguna..." />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'list' && (
            <FlatList
              data={users}
              renderItem={UserCard}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Users size={40} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>Tidak ada staff terdaftar.</Text>
                </View>
              }
            />
          )}

          {activeTab === 'requests' && (
            <FlatList
              data={requests}
              renderItem={RequestCard}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <CheckCircle2 size={40} color={COLORS.success} />
                  <Text style={styles.emptyText}>Tidak ada antrian pendaftaran baru.</Text>
                </View>
              }
            />
          )}

          {activeTab === 'form' && (
            <ScrollView contentContainerStyle={styles.formContainer}>
              <Text style={styles.sectionHeading}>Undang Staff / Operator Baru</Text>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Nama Lengkap</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nama lengkap staff"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Email Utama</Text>
                <TextInput
                  style={styles.input}
                  placeholder="staff@smartcattlebarn.id"
                  value={formEmail}
                  onChangeText={setFormEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Password Sementara</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Minimal 6 karakter"
                  value={formPassword}
                  onChangeText={setFormPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Pilih Hak Akses / Peran</Text>
                <View style={styles.roleSelectorRow}>
                  <TouchableOpacity 
                    style={[styles.roleSelectBtn, formRole === 'STAFF' && styles.roleSelectBtnActive]}
                    onPress={() => setFormRole('STAFF')}
                  >
                    <Text style={[styles.roleSelectText, formRole === 'STAFF' && styles.roleSelectTextActive]}>Staff Kandang</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.roleSelectBtn, formRole === 'VETERINER' && styles.roleSelectBtnActive]}
                    onPress={() => setFormRole('VETERINER')}
                  >
                    <Text style={[styles.roleSelectText, formRole === 'VETERINER' && styles.roleSelectTextActive]}>Dokter Hewan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.roleSelectBtn, formRole === 'SUPER_ADMIN' && styles.roleSelectBtnActive]}
                    onPress={() => setFormRole('SUPER_ADMIN')}
                  >
                    <Text style={[styles.roleSelectText, formRole === 'SUPER_ADMIN' && styles.roleSelectTextActive]}>Super Admin</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Alasan Penambahan</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Kenapa staf ini ditambahkan?"
                  multiline
                  numberOfLines={4}
                  value={formReason}
                  onChangeText={setFormReason}
                />
              </View>

              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleFormSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Send size={18} color={COLORS.white} />
                    <Text style={styles.submitBtnText}>Kirim Undangan / Tambahkan</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

// Fallback jika CheckCircle2 belum diimport
const CheckCircle2 = ({ size, color }: any) => (
  <View style={{ width: size, height: size, borderRadius: size/2, borderWidth: 2, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
    <Check size={size * 0.6} color={color} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: SPACING.lg, 
    backgroundColor: COLORS.white,
    ...SHADOWS.sm 
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  badgeCount: {
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  badgeCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white
  },

  listContent: { padding: SPACING.lg },
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    padding: SPACING.md, 
    marginBottom: SPACING.md,
    ...SHADOWS.sm 
  },
  requestCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  
  roleBadgeContainer: { flexDirection: 'row', marginTop: 4 },
  roleBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6,
    borderWidth: 1,
  },
  badgePurple: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  badgeBlue: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  badgeGreen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  roleText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  
  deleteButton: { padding: 8, borderRadius: 8, backgroundColor: '#fee2e2' },
  cardBody: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: SPACING.sm, gap: 6 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { fontSize: 13, color: COLORS.textLight },
  
  // Request card action buttons
  actionButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: SPACING.md
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  btnReject: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  btnRejectText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.danger
  },
  btnApprove: {
    backgroundColor: COLORS.primary
  },
  btnApproveText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.white
  },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { 
    height: 250, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 12 
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500'
  },

  // Form styles
  formContainer: { padding: SPACING.lg },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.lg
  },
  formField: {
    marginBottom: SPACING.md
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
  },
  textArea: {
    height: 100,
    paddingTop: SPACING.sm,
    textAlignVertical: 'top'
  },
  roleSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  roleSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  roleSelectBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: COLORS.primary,
  },
  roleSelectText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textLight
  },
  roleSelectTextActive: {
    color: COLORS.primary
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    height: 55,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    ...SHADOWS.md
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default UserManagementScreen;
