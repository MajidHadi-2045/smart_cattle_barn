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
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform
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
  Send,
  Users,
  Key,
  History,
  Eye
} from 'lucide-react-native';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from '../utils/storage';

const UserManagementScreen = ({ navigation }: any) => {
  const [activeTab, setActiveTab] = useState<'list' | 'requests' | 'form' | 'activity'>('list');
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [currentUserRole, setCurrentUserRole] = useState('STAFF');
  const [currentUserName, setCurrentUserName] = useState('');

  // Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'SUPER_ADMIN' | 'STAFF' | 'VETERINER'>('STAFF');
  const [formReason, setFormReason] = useState('');

  const fetchUsersAndRequests = async () => {
    try {
      const currentUser = await getUser();
      const userRole = currentUser?.role || 'STAFF';

      const usersRes = await apiClient.get('/users/staff');
      setUsers(usersRes.data?.filter((u: any) => u.name !== 'John Doe') || []);

      if (userRole === 'SUPER_ADMIN') {
        const pendingRes = await apiClient.get('/users/requests');
        setRequests(pendingRes.data || []);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching users/requests:', error);
      setUsers([]);
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const parsed = await getUser();
      if (parsed) {
        setCurrentUserRole(parsed.role || 'STAFF');
        setCurrentUserName(parsed.name || 'Staf');
        setFormRole(parsed.role === 'VETERINER' ? 'VETERINER' : 'STAFF');
      }
    };
    loadUser();
    fetchUsersAndRequests();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsersAndRequests();
  };

  // 1. Cabut Hak Akses (Delete User)
  const handleDeleteUser = (id: string, name: string) => {
    if (currentUserRole !== 'SUPER_ADMIN') {
      Alert.alert('Akses Ditolak', 'Hanya Super Admin yang dapat mencabut hak akses.');
      return;
    }
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
  const handleResetPassword = (id: string, name: string) => {
    if (currentUserRole !== 'SUPER_ADMIN') {
      Alert.alert('Akses Ditolak', 'Hanya Admin yang dapat mereset password.');
      return;
    }
    Alert.alert(
      'Reset Password?',
      `Apakah Anda yakin ingin me-reset password untuk ${name}? Password barunya akan menjadi "SmartBarn2026!" dan disarankan untuk segera diubah oleh pengguna.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Reset',
          onPress: async () => {
            try {
              const response = await apiClient.patch(`/users/force-reset/${id}`);
              Alert.alert('Sukses', `Berhasil! Password baru: ${response.data.defaultPassword || 'SmartBarn2026!'}`);
            } catch (error) {
              Alert.alert('Error', 'Gagal mereset password pengguna.');
            }
          }
        }
      ]
    );
  };

  const openUserDetail = (user: any) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };
  // 2. Setujui Calon Pendaftar
  const handleApproveRequest = async (id: string, name: string) => {
    if (currentUserRole !== 'SUPER_ADMIN') {
      Alert.alert('Akses Ditolak', 'Hanya Super Admin yang dapat menyetujui pendaftaran.');
      return;
    }
    try {
      await apiClient.patch(`/users/requests/${id}/process`, { action: 'TERIMA' });
      Alert.alert('Sukses', `Pendaftaran ${name} telah disetujui!`);
      setRequests(prev => prev.filter(req => req.id !== id));
      fetchUsersAndRequests();
    } catch (error) {
      Alert.alert('Error', 'Gagal menyetujui pendaftaran.');
    }
  };

  // 3. Tolak Calon Pendaftar
  const handleRejectRequest = (id: string, name: string) => {
    if (currentUserRole !== 'SUPER_ADMIN') {
      Alert.alert('Akses Ditolak', 'Hanya Super Admin yang dapat menolak pendaftaran.');
      return;
    }
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
              await apiClient.patch(`/users/requests/${id}/process`, { action: 'TOLAK' });
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

  // 4. Submit Tambah Staff / Ajukan Request Baru
  const handleFormSubmit = async () => {
    const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';

    if (!formName || !formEmail) {
      Alert.alert('Error', 'Mohon isi nama lengkap dan email.');
      return;
    }

    if (isSuperAdmin && !formPassword) {
      Alert.alert('Error', 'Mohon isi password sementara.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSuperAdmin) {
        await apiClient.post('/users/staff', {
          name: formName,
          email: formEmail,
          phone: formPhone,
          password: formPassword,
          role: formRole.toLowerCase(),
          reason: formReason
        });
        Alert.alert('Sukses', 'Staff baru berhasil terdaftar!');
      } else {
        await apiClient.post('/users/requests', {
          requester: currentUserName,
          calonName: formName,
          calonEmail: formEmail,
          calonPhone: formPhone,
          posisi: formRole,
          alasan: formReason
        });
        Alert.alert('Sukses', 'Permintaan akses berhasil diajukan ke Admin!');
      }

      // Reset Form
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormPassword('');
      setFormRole(currentUserRole === 'VETERINER' ? 'VETERINER' : 'STAFF');
      setFormReason('');
      
      // Kembalikan ke tab list & refresh data
      setActiveTab('list');
      fetchUsersAndRequests();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Gagal mengirim data.');
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
        
        {currentUserRole === 'SUPER_ADMIN' && (
          <View style={styles.userActions}>
            <TouchableOpacity style={styles.actionIconButton} onPress={() => openUserDetail(item)}>
              <Eye size={16} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconButton} onPress={() => handleResetPassword(item.id, item.name)}>
              <Key size={16} color="#f59e0b" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionIconButton} onPress={() => handleDeleteUser(item.id, item.name)}>
              <Trash2 size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}
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
          <Text style={styles.userName}>{item.calonName}</Text>
          <Text style={styles.userEmail}>{item.calonEmail}</Text>
          <View style={styles.roleBadgeContainer}>
            <View style={[
              styles.roleBadge, 
              item.posisi === 'SUPER_ADMIN' ? styles.badgePurple : 
              item.posisi === 'VETERINER' ? styles.badgeBlue : styles.badgeGreen
            ]}>
              <Shield size={10} color={
                item.posisi === 'SUPER_ADMIN' ? '#7c3aed' : 
                item.posisi === 'VETERINER' ? '#2563eb' : '#16a34a'
              } />
              <Text style={[
                styles.roleText,
                { color: 
                  item.posisi === 'SUPER_ADMIN' ? '#7c3aed' : 
                  item.posisi === 'VETERINER' ? '#2563eb' : '#16a34a'
                }
              ]}>
                {item.posisi === 'SUPER_ADMIN' ? 'SUPER ADMIN' : item.posisi === 'VETERINER' ? 'DOKTER HEWAN' : 'OPERATOR'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {item.requester && (
        <View style={{ paddingHorizontal: 4, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: COLORS.textLight }}>
            Diajukan oleh: <Text style={{ fontWeight: 'bold' }}>{item.requester}</Text>
          </Text>
          {item.alasan && (
            <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>
              Alasan: {item.alasan}
            </Text>
          )}
        </View>
      )}

      <View style={styles.actionButtonsRow}>
        <TouchableOpacity 
          style={[styles.actionBtn, styles.btnReject]}
          onPress={() => handleRejectRequest(item.id, item.calonName)}
        >
          <X size={16} color={COLORS.danger} />
          <Text style={styles.btnRejectText}>Tolak</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, styles.btnApprove]}
          onPress={() => handleApproveRequest(item.id, item.calonName)}
        >
          <Check size={16} color={COLORS.white} />
          <Text style={styles.btnApproveText}>Setujui</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
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

        {currentUserRole === 'SUPER_ADMIN' && (
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
        )}

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'form' && styles.tabButtonActive]}
          onPress={() => setActiveTab('form')}
        >
          <Text style={[styles.tabText, activeTab === 'form' && styles.tabTextActive]}>
            {currentUserRole === 'SUPER_ADMIN' ? 'Tambah' : 'Ajukan'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingSpinner message="Memuat Data Pengguna..." />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'list' && (() => {
            const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
            const paginatedUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
            return (
            <FlatList
              data={paginatedUsers}
              renderItem={UserCard}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { handleRefresh(); setCurrentPage(1); }} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Users size={40} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>Tidak ada staff terdaftar.</Text>
                </View>
              }
              ListFooterComponent={
                totalPages > 1 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingHorizontal: 10 }}>
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold' }} onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                      {currentPage > 1 ? 'Mundur' : ''}
                    </Text>
                    <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>{currentPage} / {totalPages}</Text>
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold' }} onPress={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                      {currentPage < totalPages ? 'Lanjut' : ''}
                    </Text>
                  </View>
                ) : null
              }
            />
            );
          })()}

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
              <Text style={styles.sectionHeading}>
                {currentUserRole === 'SUPER_ADMIN' ? 'Undang Staff / Operator Baru' : 'Ajukan Permintaan Akun Baru'}
              </Text>
              
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Nama Lengkap Calon</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nama lengkap calon pengguna"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Email Calon</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@smartcattlebarn.id"
                  value={formEmail}
                  onChangeText={setFormEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Nomor Kontak / HP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0812xxxxxx"
                  value={formPhone}
                  onChangeText={setFormPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {currentUserRole === 'SUPER_ADMIN' && (
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
              )}

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Pilih Peran / Posisi Calon</Text>
                <View style={styles.roleSelectorRow}>
                  <TouchableOpacity 
                    style={[styles.roleSelectBtn, formRole === 'STAFF' && styles.roleSelectBtnActive]}
                    onPress={() => setFormRole('STAFF')}
                  >
                    <Text style={[styles.roleSelectText, formRole === 'STAFF' && styles.roleSelectTextActive]}>Staff (Operator Kandang)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.roleSelectBtn, formRole === 'VETERINER' && styles.roleSelectBtnActive]}
                    onPress={() => setFormRole('VETERINER')}
                  >
                    <Text style={[styles.roleSelectText, formRole === 'VETERINER' && styles.roleSelectTextActive]}>Dokter Hewan (Veteriner)</Text>
                  </TouchableOpacity>

                  {currentUserRole === 'SUPER_ADMIN' && (
                    <TouchableOpacity 
                      style={[styles.roleSelectBtn, formRole === 'SUPER_ADMIN' && styles.roleSelectBtnActive]}
                      onPress={() => setFormRole('SUPER_ADMIN')}
                    >
                      <Text style={[styles.roleSelectText, formRole === 'SUPER_ADMIN' && styles.roleSelectTextActive]}>Super Admin (Manajer)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Alasan / Keterangan</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={currentUserRole === 'SUPER_ADMIN' ? 'Kenapa staf ini ditambahkan?' : 'Jelaskan alasan pengajuan akun baru ini...'}
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
                    <Text style={styles.submitBtnText}>
                      {currentUserRole === 'SUPER_ADMIN' ? 'Kirim Undangan / Tambahkan' : 'Kirim Pengajuan Akun'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}


        </View>
      )}

      {/* MODAL DETAIL USER */}
      <Modal visible={isModalOpen} animationType="slide" transparent={true} onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Pengguna</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  {selectedUser.photo ? (
                    <Image source={{ uri: selectedUser.photo }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                  ) : (
                    <User size={32} color={COLORS.primary} />
                  )}
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 }}>{selectedUser.name}</Text>
                <Text style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 16 }}>{selectedUser.role.replace('_', ' ')}</Text>
                
                <View style={{ width: '100%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 2 }}>Email</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.text }}>{selectedUser.email}</Text>
                </View>

                {selectedUser.username && (
                  <View style={{ width: '100%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 2 }}>Username</Text>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.text }}>{selectedUser.username}</Text>
                  </View>
                )}

                <View style={{ width: '100%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 2 }}>Nomor Telepon</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.text }}>{selectedUser.phone || '-'}</Text>
                </View>

                <View style={{ width: '100%', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 2 }}>Bergabung Sejak</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: COLORS.text }}>
                    {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('id-ID') : '-'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
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
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  actionIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
    alignItems: 'center',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  activityUser: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  activityTime: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  }
});

export default UserManagementScreen;
