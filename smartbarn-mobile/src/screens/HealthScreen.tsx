import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { HeartPulse, User, Calendar, ClipboardList, Plus, X, Edit, Trash2 } from 'lucide-react-native';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from '../utils/storage';

const HealthScreen = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [userRole, setUserRole] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;
  
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [examType, setExamType] = useState('INDIVIDU'); // INDIVIDU | MASSAL
  const [formData, setFormData] = useState({
    cattleId: '',
    diagnosa: '',
    penanganan: '',
    status: 'SAKIT',
    pemeriksa: ''
  });
  
  const [livestock, setLivestock] = useState<any[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(true);
  const [selectedCattleIds, setSelectedCattleIds] = useState<string[]>([]);
  const [cattleSearchQuery, setCattleSearchQuery] = useState('');

  const fetchRecords = async () => {
    try {
      // Endpoint yang sesuai di backend
      const response = await apiClient.get('/health');
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching health records:', error);
      // Fallback data if API not ready
      setRecords([
        { id: 1, cattleId: 'C-301', diagnosa: 'Kelelahan', penanganan: 'Istirahat & Vitamin', pemeriksa: 'Dr. Ahmad', status: 'SEMBUH', createdAt: new Date().toISOString() },
        { id: 2, cattleId: 'C-305', diagnosa: 'Infeksi Kulit', penanganan: 'Salep Antibiotik', pemeriksa: 'Dr. Susi', status: 'DALAM_PERAWATAN', createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const getRole = async () => {
      const userObj = await getUser();
      if (userObj) {
        setUserRole(userObj.role);
        setFormData(prev => ({ ...prev, pemeriksa: userObj.name || '' }));
      }
    };
    const fetchLivestock = async () => {
      try {
        const response = await apiClient.get('/livestock');
        setLivestock(response.data || []);
      } catch (error) {
        console.error('Error fetching livestock:', error);
      }
    };
    getRole();
    fetchRecords();
    fetchLivestock();
  }, []);

  // Buka modal untuk menambah rekam medis baru
  const handleOpenAddForm = () => {
    setIsEditing(false);
    setSelectedRecordId(null);
    setFormData(prev => ({ ...prev, cattleId: '', diagnosa: '', penanganan: '', status: 'SAKIT' }));
    setExamType('INDIVIDU');
    setIsSelectAll(true);
    setSelectedCattleIds([]);
    setCattleSearchQuery('');
    setModalVisible(true);
  };

  // Buka modal untuk mengedit rekam medis yang sudah ada
  const handleOpenEditForm = (item: any) => {
    setIsEditing(true);
    setSelectedRecordId(item.id);
    setFormData({
      cattleId: item.cattleId,
      diagnosa: item.diagnosa,
      penanganan: item.penanganan,
      status: item.status,
      pemeriksa: item.pemeriksa || formData.pemeriksa
    });
    setModalVisible(true);
  };

  // Hapus catatan rekam medis dari sistem
  const handleDelete = (id: number) => {
    Alert.alert(
      'Konfirmasi Hapus',
      'Yakin ingin menghapus rekam medis ini?',
      [
        { text: 'Batal', style: 'cancel' },
        { 
          text: 'Hapus', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.delete(`/health/${id}`);
              Alert.alert('Sukses', 'Rekam medis berhasil dihapus!');
              fetchRecords();
            } catch (err) {
              Alert.alert('Gagal', 'Terjadi kesalahan saat menghapus data.');
            }
          }
        }
      ]
    );
  };

  const handleSubmit = async () => {
    if (examType === 'INDIVIDU' && !formData.cattleId) {
      Alert.alert('Error', 'ID Sapi wajib diisi!');
      return;
    }
    if (examType === 'MASSAL' && !isSelectAll && selectedCattleIds.length === 0) {
      Alert.alert('Error', 'Silakan pilih minimal 1 sapi!');
      return;
    }
    if (!formData.diagnosa || !formData.penanganan) {
      Alert.alert('Error', 'Diagnosis/Vaksin dan Detail Penanganan wajib diisi!');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (isEditing && selectedRecordId) {
        await apiClient.patch(`/health/${selectedRecordId}`, formData);
        Alert.alert('Sukses', 'Catatan pemeriksaan berhasil diperbarui!');
      } else if (examType === 'MASSAL') {
        await apiClient.post('/health/bulk', {
          cattleIds: isSelectAll ? [] : selectedCattleIds,
          diagnosis: formData.diagnosa,
          treatment: formData.penanganan,
          status: formData.status === 'SAKIT' ? 'Sakit' : 
                  formData.status === 'DALAM_PERAWATAN' ? 'Dalam Perawatan' : 
                  formData.status === 'SEMBUH' ? 'Sembuh' : 
                  formData.status === 'KRITIS' ? 'Kritis' : 'Mati',
          vet: formData.pemeriksa
        });
        Alert.alert('Sukses', 'Catatan pemeriksaan massal berhasil disimpan!');
      } else {
        await apiClient.post('/health', formData);
        Alert.alert('Sukses', 'Catatan pemeriksaan berhasil ditambahkan!');
      }
      setModalVisible(false);
      setIsEditing(false);
      setSelectedRecordId(null);
      setFormData(prev => ({ ...prev, cattleId: '', diagnosa: '', penanganan: '', status: 'SAKIT' }));
      setIsSelectAll(true);
      setSelectedCattleIds([]);
      setCattleSearchQuery('');
      fetchRecords(); // Refresh data
    } catch (error) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan data.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SEMBUH': return COLORS.success;
      case 'SAKIT': return COLORS.danger;
      case 'DALAM_PERAWATAN': return COLORS.warning;
      case 'KRITIS': return COLORS.danger;
      case 'MATI': return '#64748b';
      default: return COLORS.textLight;
    }
  };

  const HealthCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.idBadge}>
          <Text style={styles.idText}>{item.cattleId}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.recordContent}>
        <View style={styles.row}>
          <ClipboardList size={16} color={COLORS.primary} />
          <Text style={styles.diagnosa}>{item.diagnosa}</Text>
        </View>
        <Text style={styles.penanganan}>{item.penanganan}</Text>
        
        <View style={styles.footer}>
          <View style={styles.meta}>
            <User size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>{item.pemeriksa}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.meta}>
              <Calendar size={14} color={COLORS.textLight} />
              <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleDateString('id-ID')}</Text>
            </View>
            {userRole === 'VETERINER' && (
              <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8, borderLeftWidth: 1, borderLeftColor: '#e2e8f0', paddingLeft: 8 }}>
                <TouchableOpacity onPress={() => handleOpenEditForm(item)}>
                  <Edit size={16} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Trash2 size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <HeartPulse size={32} color={COLORS.primary} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Rekam Medis</Text>
            <Text style={styles.subtitle}>Riwayat kesehatan ternak</Text>
          </View>
        </View>
        {userRole === 'VETERINER' && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={handleOpenAddForm}
          >
            <Plus size={20} color={COLORS.white} />
            <Text style={styles.addButtonText}>Baru</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingSpinner message="Memuat Rekam Medis..." />
        </View>
      ) : (() => {
        const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
        const paginatedRecords = records.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
        <FlatList
          data={paginatedRecords}
          renderItem={HealthCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecords(); setCurrentPage(1); }} />}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Tidak ada riwayat kesehatan</Text>
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

      {/* Modal Form Tambah Rekam Medis */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Catatan Pemeriksaan' : 'Catatan Pemeriksaan Baru'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              
              {!isEditing && (
                <View style={styles.tabContainer}>
                  <TouchableOpacity 
                    style={[styles.tabBtn, examType === 'INDIVIDU' && styles.tabBtnActive]}
                    onPress={() => setExamType('INDIVIDU')}
                  >
                    <Text style={[styles.tabBtnText, examType === 'INDIVIDU' && styles.tabBtnTextActive]}>Pemeriksaan Individu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.tabBtn, examType === 'MASSAL' && styles.tabBtnActive]}
                    onPress={() => setExamType('MASSAL')}
                  >
                    <Text style={[styles.tabBtnText, examType === 'MASSAL' && styles.tabBtnTextActive]}>Vaksinasi / Massal</Text>
                  </TouchableOpacity>
                </View>
              )}

              {examType === 'INDIVIDU' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ID Sapi *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Cth: C-302"
                    placeholderTextColor="#94a3b8"
                    value={formData.cattleId}
                    onChangeText={(text) => setFormData({ ...formData, cattleId: text })}
                  />
                  {/* Suggestions list (max 5) */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {livestock
                      .filter(cow => {
                        const term = (formData.cattleId || '').toLowerCase();
                        return term === '' || (cow.cattleId || '').toLowerCase().includes(term);
                      })
                      .slice(0, 5)
                      .map(cow => (
                        <TouchableOpacity
                          key={cow.cattleId}
                          style={{
                            backgroundColor: '#eff6ff',
                            borderColor: COLORS.primary,
                            borderWidth: 1,
                            borderRadius: 6,
                            paddingHorizontal: 10,
                            paddingVertical: 5
                          }}
                          onPress={() => setFormData({ ...formData, cattleId: cow.cattleId })}
                        >
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.primary }}>
                            {cow.cattleId}
                          </Text>
                        </TouchableOpacity>
                      ))
                    }
                  </View>
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.inputLabel}>Pilih Target Sapi *</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: isSelectAll ? COLORS.primary : '#f1f5f9'
                        }}
                        onPress={() => setIsSelectAll(true)}
                      >
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: isSelectAll ? COLORS.white : COLORS.text }}>
                          Semua Sapi
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: !isSelectAll ? COLORS.primary : '#f1f5f9'
                        }}
                        onPress={() => setIsSelectAll(false)}
                      >
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: !isSelectAll ? COLORS.white : COLORS.text }}>
                          Sapi Pilihan
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {isSelectAll ? (
                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}>
                        Semua sapi ({livestock.length} ekor) yang terdaftar di peternakan akan dicatat rekam medis kesehatannya sekaligus.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      <TextInput
                        style={[styles.input, { height: 40, fontSize: 14 }]}
                        placeholder="Cari ID Sapi..."
                        placeholderTextColor="#94a3b8"
                        value={cattleSearchQuery}
                        onChangeText={setCattleSearchQuery}
                      />
                      <View style={{
                        maxHeight: 150,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        borderRadius: 8,
                        padding: 8,
                        backgroundColor: '#f8fafc'
                      }}>
                        <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {livestock
                              .filter(cow => (cow.cattleId || '').toLowerCase().includes(cattleSearchQuery.toLowerCase()))
                              .map(cow => {
                                const isChecked = selectedCattleIds.includes(cow.cattleId);
                                return (
                                  <TouchableOpacity
                                    key={cow.cattleId}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      paddingHorizontal: 8,
                                      paddingVertical: 6,
                                      borderRadius: 6,
                                      borderWidth: 1,
                                      borderColor: isChecked ? COLORS.primary : '#e2e8f0',
                                      backgroundColor: isChecked ? '#eff6ff' : COLORS.white,
                                      gap: 4
                                    }}
                                    onPress={() => {
                                      if (isChecked) {
                                        setSelectedCattleIds(prev => prev.filter(id => id !== cow.cattleId));
                                      } else {
                                        setSelectedCattleIds(prev => [...prev, cow.cattleId]);
                                      }
                                    }}
                                  >
                                    <View style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: 3,
                                      borderWidth: 1.5,
                                      borderColor: isChecked ? COLORS.primary : '#94a3b8',
                                      backgroundColor: isChecked ? COLORS.primary : 'transparent',
                                      justifyContent: 'center',
                                      alignItems: 'center'
                                    }}>
                                      {isChecked && <Text style={{ color: COLORS.white, fontSize: 8, fontWeight: 'bold' }}>✓</Text>}
                                    </View>
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text }}>{cow.cattleId}</Text>
                                  </TouchableOpacity>
                                );
                              })
                            }
                          </View>
                        </ScrollView>
                      </View>
                      <Text style={{ fontSize: 11, color: COLORS.textLight }}>
                        Terpilih: <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{selectedCattleIds.length}</Text> dari {livestock.length} sapi
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status Pasca Periksa</Text>
                <View style={styles.statusGroup}>
                  {['SAKIT', 'DALAM_PERAWATAN', 'SEMBUH', 'KRITIS', 'MATI'].map((status) => {
                    const statusLabel = status === 'DALAM_PERAWATAN' ? 'Dalam Perawatan' : 
                                        status === 'SAKIT' ? 'Sakit' : 
                                        status === 'SEMBUH' ? 'Sembuh' : 
                                        status === 'KRITIS' ? 'Kritis' : 'Mati';
                    return (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusOption,
                          formData.status === status && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                        ]}
                        onPress={() => setFormData({ ...formData, status })}
                      >
                        <Text style={[
                          styles.statusOptionText,
                          formData.status === status && { color: COLORS.white }
                        ]}>
                          {statusLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{examType === 'MASSAL' ? 'Nama Vaksin / Diagnosis *' : 'Diagnosis Penyakit *'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={examType === 'MASSAL' ? 'Vaksinasi' : 'Cth: Flu Bovine'}
                  placeholderTextColor="#94a3b8"
                  value={formData.diagnosa}
                  onChangeText={(text) => setFormData({ ...formData, diagnosa: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{examType === 'MASSAL' ? 'Detail Vaksinasi / Penanganan *' : 'Penanganan / Obat *'}</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  placeholder={examType === 'MASSAL' ? 'Vaksin PMK Dosis 1' : 'Cth: Injeksi Vitamin C'}
                  placeholderTextColor="#94a3b8"
                  multiline
                  value={formData.penanganan}
                  onChangeText={(text) => setFormData({ ...formData, penanganan: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Petugas / Dokter Hewan Bertugas</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nama Pemeriksa / Petugas"
                  placeholderTextColor="#94a3b8"
                  value={formData.pemeriksa}
                  onChangeText={(text) => setFormData({ ...formData, pemeriksa: text })}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.btn, styles.btnCancel]} 
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, styles.btnSubmit]} 
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.btnSubmitText}>Simpan Data</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: SPACING.lg, 
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14
  },
  headerText: { marginLeft: SPACING.md },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textLight },
  listContent: { padding: SPACING.lg },
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
    overflow: 'hidden'
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  idBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  idText: { color: COLORS.white, fontWeight: 'bold', fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  recordContent: { padding: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  diagnosa: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  penanganan: { fontSize: 14, color: COLORS.textLight, marginBottom: SPACING.md, marginLeft: 24 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: SPACING.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textLight },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyText: { color: COLORS.textLight, fontSize: 16 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  modalBody: { padding: SPACING.lg, paddingBottom: 40 },
  inputGroup: { marginBottom: SPACING.md },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.text },
  statusGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: COLORS.white },
  statusOptionText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  modalFooter: { flexDirection: 'row', padding: SPACING.lg, gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  btn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnCancelText: { color: COLORS.text, fontWeight: 'bold', fontSize: 16 },
  btnSubmit: { backgroundColor: '#0284c7' }, // Adjusted to match the web's blue color
  btnSubmitText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  
  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, padding: 4, marginBottom: SPACING.lg },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabBtnActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabBtnText: { color: COLORS.textLight, fontWeight: '600', fontSize: 14 },
  tabBtnTextActive: { color: '#0284c7', fontWeight: 'bold' },
  
  // Info Box
  infoBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12 },
  infoText: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic' },
});

export default HealthScreen;
