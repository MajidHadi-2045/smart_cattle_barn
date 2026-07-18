import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import apiClient from '../api/client';
import { History, Edit, Trash2, X } from 'lucide-react-native';

const HistoryScreen = () => {
  const [recentInputs, setRecentInputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedEditItem, setSelectedEditItem] = useState<any>(null);
  const [editValue1, setEditValue1] = useState('');
  const [editValue2, setEditValue2] = useState('');

  const fetchRecentInputs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/livestock/recent-inputs');
      setRecentInputs(res.data || []);
    } catch (err) {
      console.warn('Error fetching recent inputs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentInputs();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchRecentInputs();
    setRefreshing(false);
  }, []);

  const handleEditItem = (item: any) => {
    setSelectedEditItem(item);
    if (item.type === 'PAKAN') {
      setEditValue1(item.raw?.weightKg?.toString() || '');
    } else if (item.type === 'TIMBANGAN') {
      setEditValue1(item.raw?.weight?.toString() || '');
    } else if (item.type === 'LIMBAH' || item.type === 'LIMBAH_KANDANG') {
      setEditValue1(item.raw?.fecesKg?.toString() || '');
      setEditValue2(item.raw?.urineL?.toString() || '');
    }
    setIsEditModalVisible(true);
  };

  const submitEdit = async () => {
    if (!selectedEditItem) return;
    const { type, id } = selectedEditItem;
    const payload: any = {};

    if (type === 'PAKAN') {
      if (!editValue1) return Alert.alert('Error', 'Berat tidak boleh kosong');
      payload.weightKg = parseFloat(editValue1);
    } else if (type === 'TIMBANGAN') {
      if (!editValue1) return Alert.alert('Error', 'Berat tidak boleh kosong');
      payload.weight = parseFloat(editValue1);
    } else if (type === 'LIMBAH' || type === 'LIMBAH_KANDANG') {
      if (!editValue1 && !editValue2) return Alert.alert('Error', 'Data tidak boleh kosong');
      if (editValue1) payload.fecesKg = parseFloat(editValue1);
      if (editValue2) payload.urineL = parseFloat(editValue2);
    }

    try {
      let endpoint = '';
      if (type === 'PAKAN') endpoint = `/livestock/feed/${id}`;
      else if (type === 'TIMBANGAN') endpoint = `/livestock/weight/${id}`;
      else if (type === 'LIMBAH') endpoint = `/livestock/waste/${id}`;
      else if (type === 'LIMBAH_KANDANG') endpoint = `/livestock/waste/zone/${id}`;

      await apiClient.patch(endpoint, payload);
      Alert.alert('Sukses', 'Koreksi data berhasil disimpan!');
      setIsEditModalVisible(false);
      fetchRecentInputs();
    } catch (err) {
      Alert.alert('Gagal', 'Gagal menyimpan koreksi data.');
    }
  };

  const handleDeleteItem = (item: any) => {
    const targetLabel = item.type === 'LIMBAH_KANDANG' ? item.title : `${item.title} sapi ${item.cattleId}`;
    Alert.alert(
      'Konfirmasi Hapus',
      `Apakah Anda yakin ingin menghapus data ${targetLabel}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const id = item.id;
              if (item.type === 'PAKAN') {
                await apiClient.delete(`/livestock/feed/${id}`);
              } else if (item.type === 'TIMBANGAN') {
                await apiClient.delete(`/livestock/weight/${id}`);
              } else if (item.type === 'LIMBAH') {
                await apiClient.delete(`/livestock/waste/${id}`);
              } else if (item.type === 'LIMBAH_KANDANG') {
                await apiClient.delete(`/livestock/waste/zone/${id}`);
              }
              Alert.alert('Sukses', 'Data berhasil dihapus!');
              fetchRecentInputs();
            } catch (err) {
              Alert.alert('Gagal', 'Gagal menghapus data.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <History color={COLORS.primary} size={28} />
          <View>
            <Text style={styles.headerTitle}>Riwayat & Koreksi</Text>
            <Text style={styles.headerSubtitle}>Kelola input data terbaru</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : recentInputs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <History size={40} color="#cbd5e1" style={{ marginBottom: 8 }} />
            <Text style={{ color: COLORS.textLight, textAlign: 'center' }}>Belum ada data input terbaru.</Text>
          </View>
        ) : (
          recentInputs.map((item, idx) => (
            <View key={`${item.type}-${item.id}-${idx}`} style={styles.historyCard}>
              <View style={styles.historyCardBody}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={[
                    styles.badge,
                    item.type === 'PAKAN' && { backgroundColor: '#e0f2fe' },
                    item.type === 'TIMBANGAN' && { backgroundColor: '#dcfce7' },
                    (item.type === 'LIMBAH' || item.type === 'LIMBAH_KANDANG') && { backgroundColor: '#ffedd5' }
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      item.type === 'PAKAN' && { color: '#0369a1' },
                      item.type === 'TIMBANGAN' && { color: '#15803d' },
                      (item.type === 'LIMBAH' || item.type === 'LIMBAH_KANDANG') && { color: '#c2410c' }
                    ]}>
                      {item.type === 'LIMBAH_KANDANG' ? 'LIMBAH KANDANG' : item.type}
                    </Text>
                  </View>
                  <Text style={styles.historyCattleId}>
                    {item.type === 'LIMBAH_KANDANG' ? `Kandang: ${item.zoneName}` : `Sapi ID: ${item.cattleId}`}
                  </Text>
                </View>
                
                <Text style={styles.historyDetails}>{item.details}</Text>
                <Text style={styles.historyDate}>
                  {new Date(item.date).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' } as any)}
                </Text>
              </View>

              <View style={styles.historyActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.editActionBtn]} 
                  onPress={() => handleEditItem(item)}
                >
                  <Edit size={14} color="#0369a1" />
                  <Text style={[styles.actionBtnText, { color: '#0369a1' }]}>Koreksi</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.deleteActionBtn]} 
                  onPress={() => handleDeleteItem(item)}
                >
                  <Trash2 size={14} color={COLORS.danger} />
                  <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal Edit/Koreksi */}
      <Modal visible={isEditModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Koreksi {selectedEditItem?.type}</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <X size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                {selectedEditItem?.type === 'LIMBAH_KANDANG' ? (
                  `Kandang: ${selectedEditItem?.zoneName}`
                ) : (
                  `Sapi ID: ${selectedEditItem?.cattleId}`
                )} | Masukkan data baru:
              </Text>

              {selectedEditItem?.type === 'PAKAN' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Berat Pakan Baru (Kg)</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    keyboardType="numeric" 
                    value={editValue1} 
                    onChangeText={setEditValue1} 
                    placeholder="Contoh: 15.5" 
                  />
                </View>
              )}
              {selectedEditItem?.type === 'TIMBANGAN' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Berat Sapi Baru (Kg)</Text>
                  <TextInput 
                    style={styles.modalInput} 
                    keyboardType="numeric" 
                    value={editValue1} 
                    onChangeText={setEditValue1} 
                    placeholder="Contoh: 450.5" 
                  />
                </View>
              )}
              {(selectedEditItem?.type === 'LIMBAH' || selectedEditItem?.type === 'LIMBAH_KANDANG') && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Feces Baru (Kg)</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric" 
                      value={editValue1} 
                      onChangeText={setEditValue1} 
                      placeholder="Contoh: 12.4" 
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Urine Baru (Liter)</Text>
                    <TextInput 
                      style={styles.modalInput} 
                      keyboardType="numeric" 
                      value={editValue2} 
                      onChangeText={setEditValue2} 
                      placeholder="Contoh: 8.5" 
                    />
                  </View>
                </>
              )}

              <View style={styles.modalActionButtons}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: '#f1f5f9' }]} 
                  onPress={() => setIsEditModalVisible(false)}
                >
                  <Text style={[styles.modalBtnText, { color: COLORS.text }]}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: COLORS.primary }]} 
                  onPress={submitEdit}
                >
                  <Text style={[styles.modalBtnText, { color: COLORS.white }]}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    ...SHADOWS.sm
  },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  scrollContent: { padding: SPACING.md },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
    ...SHADOWS.sm,
    overflow: 'hidden'
  },
  historyCardBody: { padding: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  historyCattleId: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  historyDetails: { fontSize: 14, color: COLORS.text, marginVertical: 6, fontWeight: '500' },
  historyDate: { fontSize: 12, color: COLORS.textLight },
  historyActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    backgroundColor: '#f8fafc'
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6
  },
  editActionBtn: { borderRightWidth: 1, borderRightColor: '#f1f5f9' },
  deleteActionBtn: {},
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    overflow: 'hidden',
    ...SHADOWS.md
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  modalBody: { padding: 20 },
  modalSubtitle: { fontSize: 13, color: COLORS.textLight, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, marginBottom: 8 },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text
  },
  modalActionButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  modalBtnText: { fontSize: 14, fontWeight: 'bold' }
});

export default HistoryScreen;
