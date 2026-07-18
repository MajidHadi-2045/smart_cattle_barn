import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { Utensils, Zap, Database, Clock, Hourglass } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const { width } = Dimensions.get('window');

const FeedScreen = () => {
  const [silos, setSilos] = useState<any[]>([]);
  const [cows, setCows] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [reports, setReports] = useState<any>({});
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'silo' | 'schedule' | 'report'>('silo');
  const ITEMS_PER_PAGE = 10;
  
  // States untuk Jadwal
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<any>({ id: null, time: '08:00', zoneId: '', feedType: 'Hijauan', siloId: '', status: 'BELUM' });
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const checkUserRole = async () => {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setUserRole(JSON.parse(userStr).role);
      }
    };
    checkUserRole();
  }, []);

  const fetchFeedData = async () => {
    try {
      const [silosRes, cowsRes, schedRes, repRes, zoneRes] = await Promise.all([
        apiClient.get('/feed/silo'),
        apiClient.get('/livestock'),
        apiClient.get('/feed/schedule').catch(() => ({ data: [] })),
        apiClient.get('/feed/report').catch(() => ({ data: {} })),
        apiClient.get('/zones').catch(() => ({ data: [] }))
      ]);
      setSilos(silosRes.data);
      setCows(cowsRes.data);
      setSchedules(schedRes.data || []);
      setReports(repRes.data || {});
      setZones(zoneRes.data || []);
    } catch (error) {
      console.error('Error fetching feed data:', error);
      setSilos([]);
      setCows([]);
      setSchedules([]);
      setReports({});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeedData();
  }, []);

  const handleSaveSchedule = async () => {
    try {
      const finalFeedType = scheduleForm.feedType;

      const payload = {
        time: scheduleForm.time,
        feedType: finalFeedType,
        status: scheduleForm.status,
        zoneId: scheduleForm.zoneId ? parseInt(scheduleForm.zoneId) : null,
      };

      if (scheduleForm.id) {
        await apiClient.patch(`/feed/schedule/${scheduleForm.id}`, payload);
        Alert.alert('Sukses', 'Jadwal berhasil diperbarui');
      } else {
        await apiClient.post('/feed/schedule', payload);
        Alert.alert('Sukses', 'Jadwal berhasil ditambahkan');
      }
      setScheduleModal(false);
      fetchFeedData();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal menyimpan jadwal');
    }
  };

  const handleDeleteSchedule = (id: number) => {
    Alert.alert('Hapus Jadwal', 'Yakin ingin menghapus jadwal ini?', [
      { text: 'Batal', style: 'cancel' },
      { 
        text: 'Hapus', 
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/feed/schedule/${id}`);
            Alert.alert('Sukses', 'Jadwal terhapus');
            fetchFeedData();
          } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Gagal menghapus jadwal';
            Alert.alert('Error', `Gagal menghapus jadwal: ${errorMsg}`);
          }
        }
      }
    ]);
  };

  const handleToggleStatus = async (item: any) => {
    if (userRole !== 'STAFF') return;
    try {
      const newStatus = item.status === 'BELUM' ? 'SUDAH' : 'BELUM';
      await apiClient.patch(`/feed/schedule/${item.id}`, { status: newStatus });
      fetchFeedData();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Gagal update status jadwal');
    }
  };

  const SiloCard = ({ item: silo }: { item: any }) => {
    const percentage = Math.round((silo.currentStock / silo.capacity) * 100);
    const isKritis = silo.status === 'KRITIS' || percentage <= 20;
    const isWarning = percentage > 20 && percentage <= 50 && !isKritis;
    
    let barColor = COLORS.primary; // Hijau
    if (isKritis) {
      barColor = COLORS.danger; // Merah
    } else if (isWarning) {
      barColor = '#f59e0b'; // Kuning (Amber 500)
    }

    // Kalkulasi Estimasi Berdasarkan Data Nutrisi Sapi (As-Fed Sinkron dengan Web)
    const totalWeight = cows.reduce((acc, cow) => acc + (cow.weight || 0), 0);
    const cowCount = cows.length;
    let dailyConsumption = 0;
    
    // Pengenalan Jenis Pakan Cerdas (Mendeteksi nama pakan)
    const typeStr = (silo.feedType || '').toLowerCase();
    const nameStr = (silo.name || '').toLowerCase();
    
    const isHijauan = typeStr.includes('hijauan') || typeStr.includes('silase') || nameStr.includes('silase') || nameStr.includes('rumput') || nameStr.includes('tebon');
    const isKonsentrat = typeStr.includes('konsentrat') || nameStr.includes('konsentrat') || nameStr.includes('dedak') || nameStr.includes('ampas');
    const isVitamin = typeStr.includes('vitamin') || typeStr.includes('suplemen') || nameStr.includes('vitamin');
    const isTmr = typeStr.includes('tmr') || nameStr.includes('tmr');
    
    let calcCategory = 'Umum';

    if (isHijauan || isKonsentrat || isTmr) {
      cows.forEach(cow => {
        const weight = cow.weight || 0;
        if (weight === 0) return;
        
        // Ambil parameter nutrisi sapi atau gunakan default
        const targetBkPercent = cow.targetBkPercent ?? 2.5;
        const bkRequirement = weight * (targetBkPercent / 100);
        
        if (isHijauan) {
          calcCategory = 'Hijauan';
          const forageRatio = cow.forageRatio ?? 60;
          const forageDM = cow.forageDM ?? 20;
          dailyConsumption += (bkRequirement * (forageRatio / 100)) / (forageDM / 100);
        } else if (isKonsentrat) {
          calcCategory = 'Konsentrat';
          const concentrateRatio = cow.concentrateRatio ?? 40;
          const concentrateDM = cow.concentrateDM ?? 86;
          dailyConsumption += (bkRequirement * (concentrateRatio / 100)) / (concentrateDM / 100);
        } else if (isTmr) {
          calcCategory = 'TMR';
          const forageDM = cow.forageDM ?? 50; // Assume average DM for TMR
          dailyConsumption += bkRequirement / (forageDM / 100);
        }
      });
    } else if (isVitamin) {
      calcCategory = 'Vitamin';
      dailyConsumption = cowCount * 0.05; // 50g per cow
    } else {
      calcCategory = 'Default/Lainnya';
      dailyConsumption = totalWeight * 0.02; // Default 2%
    }
    
    let estimatedDays = dailyConsumption > 0 ? Math.floor(silo.currentStock / dailyConsumption) : 0;
    if (estimatedDays === Infinity) estimatedDays = 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Database size={20} color={isKritis ? COLORS.danger : COLORS.primary} />
            <View>
              <Text style={styles.siloName}>{silo.name}</Text>
              <View style={[styles.categoryBadge, { 
                backgroundColor: calcCategory === 'Hijauan' ? '#e2fbe8' : calcCategory === 'Konsentrat' ? '#fef3c7' : calcCategory === 'Vitamin' ? '#f3e8ff' : '#f1f5f9' 
              }]}>
                <Text style={[styles.categoryText, { 
                  color: calcCategory === 'Hijauan' ? '#15803d' : calcCategory === 'Konsentrat' ? '#b45309' : calcCategory === 'Vitamin' ? '#7e22ce' : COLORS.textLight 
                }]}>{calcCategory}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isKritis ? '#fee2e2' : '#dcfce7' }]}>
            <Text style={[styles.statusText, { color: isKritis ? COLORS.danger : COLORS.success }]}>
              {silo.status}
            </Text>
          </View>
        </View>

        <View style={styles.stockContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }]} />
          </View>
          <View style={styles.stockInfo}>
            <Text style={styles.stockValue}>{silo.currentStock} / {silo.capacity} {silo.unit}</Text>
            <Text style={styles.percentageText}>{percentage}%</Text>
          </View>
        </View>

        {/* Info Estimasi Ketahanan (Sinkron dengan Web) */}
        {isVitamin ? (
          <View style={styles.expiryBox}>
            <Text style={styles.expiryLabel}>📅 TANGGAL KADALUARSA</Text>
            <Text style={styles.expiryValue}>
              {silo.expiryDate ? new Date(silo.expiryDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Tidak Kadaluarsa / Belum Diatur'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.estimationBox}>
              <View style={styles.estimationItem}>
                <Hourglass size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                <View>
                  <Text style={styles.estimationLabel}>ESTIMASI TAHAN</Text>
                  <Text style={styles.estimationValue}>
                    {estimatedDays > 0 ? `${estimatedDays} Hari` : 'Habis / Data kurang'}
                  </Text>
                </View>
              </View>
              <View style={styles.estimationDivider} />
              <View style={[styles.estimationItem, { alignItems: 'flex-end', justifyContent: 'center' }]}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.estimationLabel}>KONSUMSI HARIAN</Text>
                  <Text style={styles.estimationValue}>
                    ~{dailyConsumption.toFixed(1)} {silo.unit}/hari
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.realisasiBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', padding: SPACING.md, borderRadius: 12, borderWidth: 1, marginBottom: SPACING.md }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#16a34a' }}>📊 REALISASI KELUAR HARI INI</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#15803d' }}>{silo.estimasiKeluarHariIni ?? 0} {silo.unit}</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.footer}>
          <View style={styles.meta}>
            <Zap size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>{silo.feedType}</Text>
          </View>
          <View style={styles.meta}>
            <Clock size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>Sinkronisasi Aktif</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Utensils size={32} color={COLORS.primary} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Silo Pakan</Text>
          <Text style={styles.subtitle}>Stok Silo & Penjadwalan</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', backgroundColor: COLORS.white, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'silo' && styles.tabBtnActive]} onPress={() => setActiveTab('silo')}>
          <Text style={[styles.tabText, activeTab === 'silo' && styles.tabTextActive]}>Silo Pakan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'schedule' && styles.tabBtnActive]} onPress={() => setActiveTab('schedule')}>
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>Jadwal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'report' && styles.tabBtnActive]} onPress={() => setActiveTab('report')}>
          <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>Laporan</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingSpinner message="Memuat Data Pakan..." />
        </View>
      ) : activeTab === 'silo' ? (() => {
        const totalPages = Math.ceil(silos.length / ITEMS_PER_PAGE);
        const paginatedSilos = silos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
        <FlatList
          data={paginatedSilos}
          renderItem={SiloCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFeedData(); setCurrentPage(1); }} />}
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
      })() : activeTab === 'schedule' ? (
        <View style={{ flex: 1 }}>
          {userRole !== 'STAFF' && (
            <View style={{ padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <TouchableOpacity 
                style={{ backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignItems: 'center' }}
                onPress={() => {
                  setScheduleForm({ id: null, time: '08:00', zoneId: '', feedType: 'Hijauan', siloId: '', status: 'BELUM' });
                  setScheduleModal(true);
                }}
              >
                <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>+ Tambah Jadwal</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
          data={schedules}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFeedData(); }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: COLORS.text, flex: 1, marginRight: 10 }} numberOfLines={2}>{item.feedType}</Text>
                <TouchableOpacity 
                  disabled={userRole !== 'STAFF'}
                  onPress={() => handleToggleStatus(item)}
                  style={[styles.statusBadge, { backgroundColor: item.status === 'SUDAH' ? '#dcfce7' : item.status === 'SUDAH_TELAT' || item.status === 'TELAT' ? '#fee2e2' : '#f1f5f9' }]}
                >
                  <Text style={[styles.statusText, { color: item.status === 'SUDAH' ? COLORS.success : item.status === 'SUDAH_TELAT' || item.status === 'TELAT' ? COLORS.danger : COLORS.textLight }]}>
                    {item.status === 'SUDAH_TELAT' ? 'SUDAH (TELAT)' : item.status}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: COLORS.textLight, fontSize: 14 }}>Waktu: {item.time}</Text>
              <Text style={{ color: COLORS.textLight, fontSize: 14 }}>Kandang: {item.zone ? item.zone.name : 'Semua Kandang'}</Text>
              
              {userRole !== 'STAFF' && (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 }}>
                  <TouchableOpacity onPress={() => {
                    setScheduleForm({
                      id: item.id,
                      time: item.time,
                      feedType: item.feedType,
                      status: item.status,
                      zoneId: item.zoneId ? item.zoneId.toString() : '',
                      siloId: item.siloId ? item.siloId.toString() : ''
                    });
                    setScheduleModal(true);
                  }}>
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 14 }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteSchedule(item.id)}>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 14 }}>Hapus</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: COLORS.textLight }}>Belum ada jadwal.</Text>}
        />
        </View>
      ) : (
        <FlatList
          data={reports.transactions || []}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFeedData(); }} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: COLORS.text }}>{item.silo?.name || 'Silo Terhapus'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: item.type === 'MASUK' ? '#d1fae5' : '#e0e7ff' }]}>
                  <Text style={[styles.statusText, { color: item.type === 'MASUK' ? '#047857' : '#4338ca' }]}>
                    {item.type === 'MASUK' ? '📥 Masuk' : '📤 Keluar'}
                  </Text>
                </View>
              </View>
              <Text style={{ color: COLORS.textLight, fontSize: 14 }}>Jumlah: {item.weightKg} {item.silo?.unit || 'Kg'}</Text>
              <Text style={{ color: COLORS.textLight, fontSize: 14, marginTop: 4 }}>Ket: {item.description || '-'}</Text>
              <Text style={{ color: COLORS.textLight, fontSize: 12, marginTop: 8 }}>{new Date(item.createdAt).toLocaleString('id-ID')}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: COLORS.textLight }}>Belum ada riwayat transaksi pakan.</Text>}
        />
      )}

      {/* MODAL JADWAL PAKAN */}
      <Modal visible={scheduleModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 20, maxHeight: '80%' }}>
            <ScrollView>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.text }}>
                {scheduleForm.id ? 'Edit Jadwal' : 'Tambah Jadwal'}
              </Text>

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Waktu (HH:MM)</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15 }}
                value={scheduleForm.time}
                onChangeText={(t) => setScheduleForm({...scheduleForm, time: t})}
                placeholder="Contoh: 08:00"
              />

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Jenis Pakan</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 }}>
                {['Hijauan', 'Konsentrat', 'Hijauan + Konsentrat', 'TMR'].map(type => (
                  <TouchableOpacity 
                    key={type}
                    onPress={() => setScheduleForm({...scheduleForm, feedType: type})}
                    style={{ 
                      padding: 8, 
                      borderRadius: 6, 
                      backgroundColor: scheduleForm.feedType === type ? COLORS.primary : '#f1f5f9'
                    }}
                  >
                    <Text style={{ color: scheduleForm.feedType === type ? COLORS.white : COLORS.text }}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                {['BELUM', 'SUDAH'].map(st => (
                  <TouchableOpacity 
                    key={st}
                    onPress={() => setScheduleForm({...scheduleForm, status: st})}
                    style={{ 
                      padding: 8, 
                      borderRadius: 6, 
                      backgroundColor: scheduleForm.status === st ? COLORS.primary : '#f1f5f9'
                    }}
                  >
                    <Text style={{ color: scheduleForm.status === st ? COLORS.white : COLORS.text }}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setScheduleModal(false)} style={{ padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveSchedule} style={{ padding: 12, backgroundColor: COLORS.primary, borderRadius: 8 }}>
                  <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { color: COLORS.textLight, fontWeight: 'bold' },
  tabTextActive: { color: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: SPACING.lg, 
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerText: { marginLeft: SPACING.md },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textLight },
  listContent: { padding: SPACING.lg },
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  siloName: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2, alignSelf: 'flex-start' },
  categoryText: { fontSize: 10, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  stockContainer: { marginBottom: SPACING.md },
  progressBarBg: { height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%' },
  stockInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  stockValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  percentageText: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  estimationBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  estimationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  estimationDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#cbd5e1',
    marginHorizontal: SPACING.sm,
  },
  estimationLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },
  estimationValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: SPACING.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textLight },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  expiryBox: {
    backgroundColor: '#faf5ff',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  expiryLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#7e22ce',
    letterSpacing: 0.5,
  },
  expiryValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  realisasiBox: {
    marginBottom: SPACING.md,
  }
});

export default FeedScreen;
