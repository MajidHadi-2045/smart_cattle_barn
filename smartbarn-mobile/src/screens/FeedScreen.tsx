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
import { getUser } from '../utils/storage';
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
  const [reportPage, setReportPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'silo' | 'schedule' | 'report'>('silo');
  const ITEMS_PER_PAGE = 10;
  
  // States untuk Jadwal
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<any>({ id: null, time: '08:00', zoneId: '', feedType: 'Hijauan', siloId: '', status: 'BELUM' });
  const [userRole, setUserRole] = useState<string | null>(null);

  // States untuk Silo & Transaksi Pakan
  const [siloModalVisible, setSiloModalVisible] = useState(false);
  const [siloForm, setSiloForm] = useState({ id: null as number | null, name: '', feedType: 'Hijauan', capacity: '100', currentStock: '0', unit: 'Kg', expiryDate: '' });
  
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [selectedSiloForTx, setSelectedSiloForTx] = useState<any>(null);
  const [txForm, setTxForm] = useState({ type: 'MASUK' as 'MASUK' | 'KELUAR', weightKg: '', description: '', expiryDate: '' });

  // Simpan data silo baru atau perbarui silo yang ada
  const handleSaveSilo = async () => {
    if (!siloForm.name) return Alert.alert('Error', 'Nama silo tidak boleh kosong');
    const payload = {
      name: siloForm.name,
      feedType: siloForm.feedType,
      capacity: parseFloat(siloForm.capacity || '0'),
      currentStock: parseFloat(siloForm.currentStock || '0'),
      unit: siloForm.unit,
      expiryDate: siloForm.expiryDate || null
    };
    try {
      if (siloForm.id) {
        await apiClient.patch(`/feed/silo/${siloForm.id}`, payload);
        Alert.alert('Sukses', 'Silo berhasil diperbarui');
      } else {
        await apiClient.post('/feed/silo', payload);
        Alert.alert('Sukses', 'Silo berhasil ditambahkan');
      }
      setSiloModalVisible(false);
      fetchFeedData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menyimpan silo';
      Alert.alert('Error', errorMsg);
    }
  };

  // Hapus data silo dari sistem
  const handleDeleteSilo = (id: number) => {
    Alert.alert('Hapus Silo', 'Yakin ingin menghapus silo ini?', [
      { text: 'Batal', style: 'cancel' },
      { 
        text: 'Hapus', 
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/feed/silo/${id}`);
            Alert.alert('Sukses', 'Silo terhapus');
            fetchFeedData();
          } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Gagal menghapus silo';
            Alert.alert('Error', errorMsg);
          }
        }
      }
    ]);
  };

  // Catat transaksi pakan masuk atau keluar dari silo
  const handleSaveTransaction = async () => {
    if (!selectedSiloForTx) return;
    if (!txForm.weightKg) return Alert.alert('Error', 'Jumlah tidak boleh kosong');
    const payload = {
      type: txForm.type,
      weightKg: parseFloat(txForm.weightKg),
      description: txForm.description,
      expiryDate: txForm.expiryDate || null
    };
    try {
      await apiClient.post(`/feed/silo/${selectedSiloForTx.id}/transaction`, payload);
      Alert.alert('Sukses', 'Transaksi berhasil disimpan');
      setTxModalVisible(false);
      fetchFeedData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Gagal menyimpan transaksi';
      Alert.alert('Error', errorMsg);
    }
  };

  useEffect(() => {
    const checkUserRole = async () => {
      const storedUser = await getUser();
      if (storedUser) {
        setUserRole(storedUser.role);
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
    Alert.alert('Info', 'Status jadwal pakan kini diperbarui otomatis (menjadi SUDAH, TELAT, atau LEBIH AWAL) saat Anda mencatat pakan pada form "Beri Pakan Massal".');
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
    const isKonsentrat = typeStr.includes('konsentrat') || nameStr.includes('konsentrat') || nameStr.includes('kosentrat') || nameStr.includes('dedak') || nameStr.includes('ampas');
    const isVitamin = typeStr.includes('vitamin') || typeStr.includes('suplemen') || nameStr.includes('vitamin');
    const isTmr = typeStr.includes('tmr') || nameStr.includes('tmr');
    
    let calcCategory = 'Umum';

    if (isHijauan || isKonsentrat || isTmr) {
      cows.forEach(cow => {
        const weight = cow.weight || 0;
        if (weight === 0) return;
        
        // Ambil parameter nutrisi sapi atau gunakan default
        const targetBkPercent = (cow.targetBkPercent && cow.targetBkPercent > 0) ? cow.targetBkPercent : 2.5;
        const bkRequirement = weight * (targetBkPercent / 100);
        
        if (isHijauan) {
          calcCategory = 'Hijauan';
          const forageDM = (cow.forageDM && cow.forageDM > 0) ? cow.forageDM : 20;
          dailyConsumption += bkRequirement / (forageDM / 100);
        } else if (isKonsentrat) {
          calcCategory = 'Konsentrat';
          const concentrateDM = (cow.concentrateDM && cow.concentrateDM > 0) ? cow.concentrateDM : 86;
          dailyConsumption += bkRequirement / (concentrateDM / 100);
        } else if (isTmr) {
          calcCategory = 'TMR';
          const tmrDM = (cow.forageDM && cow.forageDM > 0) ? cow.forageDM : 50; 
          dailyConsumption += bkRequirement / (tmrDM / 100);
        }
      });

      if (dailyConsumption === 0 && totalWeight > 0) {
        if (isHijauan) dailyConsumption = (totalWeight * 0.025) / 0.20;
        else if (isKonsentrat) dailyConsumption = (totalWeight * 0.025) / 0.86;
        else if (isTmr) dailyConsumption = (totalWeight * 0.025) / 0.50;
      }
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {userRole === 'STAFF' && (
              <View style={{ flexDirection: 'row', gap: 6, marginRight: 4 }}>
                <TouchableOpacity onPress={() => {
                  setSiloForm({
                    id: silo.id,
                    name: silo.name,
                    feedType: silo.feedType || 'Hijauan',
                    capacity: silo.capacity.toString(),
                    currentStock: silo.currentStock.toString(),
                    unit: silo.unit,
                    expiryDate: silo.expiryDate ? silo.expiryDate.split('T')[0] : ''
                  });
                  setSiloModalVisible(true);
                }}>
                  <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
                <Text style={{ color: '#cbd5e1', fontSize: 12 }}>|</Text>
                <TouchableOpacity onPress={() => handleDeleteSilo(silo.id)}>
                  <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 12 }}>Hapus</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: isKritis ? '#fee2e2' : '#dcfce7' }]}>
              <Text style={[styles.statusText, { color: isKritis ? COLORS.danger : COLORS.success }]}>
                {silo.status}
              </Text>
            </View>
          </View>
        </View>
 
        <View style={styles.stockContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }]} />
          </View>
          <View style={styles.stockInfo}>
            <Text style={styles.stockValue}>{parseFloat(Number(silo.currentStock).toFixed(2))} / {silo.capacity} {silo.unit}</Text>
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
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#15803d' }}>{parseFloat(Number(silo.estimasiKeluarHariIni ?? 0).toFixed(2))} {silo.unit}</Text>
              </View>
            </View>
          </>
        )}

        {userRole === 'STAFF' && (
          <TouchableOpacity 
            style={{ 
              backgroundColor: '#eff6ff', 
              borderColor: '#bfdbfe', 
              borderWidth: 1, 
              paddingVertical: 8, 
              borderRadius: 8, 
              alignItems: 'center', 
              marginBottom: SPACING.md 
            }}
            onPress={() => {
              setSelectedSiloForTx(silo);
              setTxForm({
                type: 'MASUK',
                weightKg: '',
                description: '',
                expiryDate: silo.expiryDate ? silo.expiryDate.split('T')[0] : ''
              });
              setTxModalVisible(true);
            }}
          >
            <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 12 }}>🔄 Catat Transaksi (Pakan Masuk/Keluar)</Text>
          </TouchableOpacity>
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
        const canManageSilos = userRole === 'STAFF';
        return (
          <View style={{ flex: 1 }}>
            {canManageSilos && (
              <View style={{ padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <TouchableOpacity 
                  style={{ backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => {
                    setSiloForm({ id: null, name: '', feedType: 'Hijauan', capacity: '100', currentStock: '0', unit: 'Kg', expiryDate: '' });
                    setSiloModalVisible(true);
                  }}
                >
                  <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>+ Tambah Silo</Text>
                </TouchableOpacity>
              </View>
            )}
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
          </View>
        );
      })() : activeTab === 'schedule' ? (
        <View style={{ flex: 1 }}>
          {userRole === 'STAFF' && (
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
                  onPress={() => handleToggleStatus(item)}
                  style={[styles.statusBadge, { 
                    backgroundColor: item.status === 'SUDAH' ? '#dcfce7' : 
                                     item.status === 'SUDAH_TELAT' ? '#fef3c7' : 
                                     item.status === 'LEBIH_AWAL' ? '#e0f2fe' : 
                                     item.status === 'TELAT' ? '#fee2e2' : '#f1f5f9' 
                  }]}
                >
                  <Text style={[styles.statusText, { 
                    color: item.status === 'SUDAH' ? COLORS.success : 
                           item.status === 'SUDAH_TELAT' ? '#d97706' : 
                           item.status === 'LEBIH_AWAL' ? '#0369a1' : 
                           item.status === 'TELAT' ? COLORS.danger : COLORS.textLight 
                  }]}>
                    {item.status === 'LEBIH_AWAL' ? 'LEBIH AWAL' : item.status === 'SUDAH_TELAT' ? 'SUDAH (TELAT)' : item.status}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: COLORS.textLight, fontSize: 14 }}>Waktu: {item.time}</Text>
              <Text style={{ color: COLORS.textLight, fontSize: 14 }}>Kandang: {item.zone ? item.zone.name : 'Semua Kandang'}</Text>
              
              {userRole === 'STAFF' && (
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
        /* TAB LAPORAN PAKAN & STATISTIK SAPI */
        <ScrollView 
          contentContainerStyle={{ padding: SPACING.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFeedData(); setReportPage(1); }} />}
        >
          {/* BANNER STATISTIK POPULASI TERNAK */}
          <View style={styles.populationBanner}>
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.populationBannerTitle}>Statistik Populasi Ternak</Text>
              <Text style={styles.populationBannerSubtitle}>Rangkuman jenis dan total sapi yang dikelola</Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <View style={styles.totalPopCard}>
                <Text style={styles.totalPopLabel}>TOTAL POPULASI</Text>
                <Text style={styles.totalPopValue}>{reports.cows?.total ?? cows.length ?? 0} Ekor</Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                {reports.cows?.breeds && reports.cows.breeds.length > 0 ? (
                  reports.cows.breeds.map((b: any, idx: number) => (
                    <View key={idx} style={styles.breedPill}>
                      <Text style={styles.breedPillText}>🐄 {b.breed}: {b.count} ekor</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.breedPill}>
                    <Text style={styles.breedPillText}>🐄 Total Registered: {cows.length} ekor</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* TABEL RIWAYAT TRANSAKSI PAKAN SAMA SEPERTI DI WEB */}
          <View style={styles.tableCardContainer}>
            <View style={{ padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.text }}>Riwayat Catatan Stok Pakan Masuk & Keluar</Text>
              <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>Geser ke kanan untuk melihat kolom lengkap tabel</Text>
            </View>

            {(() => {
              const allTx = reports.transactions || [];
              const totalReportPages = Math.ceil(allTx.length / ITEMS_PER_PAGE) || 1;
              const paginatedTx = allTx.slice((reportPage - 1) * ITEMS_PER_PAGE, reportPage * ITEMS_PER_PAGE);

              if (allTx.length === 0) {
                return (
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <Text style={{ color: COLORS.textLight }}>Belum ada catatan aliran stok pakan masuk atau keluar.</Text>
                  </View>
                );
              }

              return (
                <View>
                  {/* SLIDEABLE HORIZONTAL TABLE */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                      {/* HEADER TABEL */}
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableColHeader, { width: 140 }]}>WAKTU</Text>
                        <Text style={[styles.tableColHeader, { width: 130 }]}>SILO / STOK</Text>
                        <Text style={[styles.tableColHeader, { width: 100 }]}>KATEGORI</Text>
                        <Text style={[styles.tableColHeader, { width: 90, textAlign: 'center' }]}>TIPE</Text>
                        <Text style={[styles.tableColHeader, { width: 100, textAlign: 'right' }]}>JUMLAH</Text>
                        <Text style={[styles.tableColHeader, { width: 130 }]}>KADALUARSA</Text>
                        <Text style={[styles.tableColHeader, { width: 100 }]}>PENGINPUT</Text>
                        <Text style={[styles.tableColHeader, { width: 160 }]}>KETERANGAN</Text>
                      </View>

                      {/* ISI BARIS TABEL */}
                      {paginatedTx.map((tx: any, i: number) => {
                        const isMasuk = tx.type === 'MASUK';
                        return (
                          <View key={tx.id || i} style={[styles.tableBodyRow, i % 2 === 1 && { backgroundColor: '#f8fafc' }]}>
                            <Text style={[styles.tableCellText, { width: 140, color: COLORS.textLight }]}>
                              {new Date(tx.createdAt).toLocaleString('id-ID', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </Text>
                            <Text style={[styles.tableCellText, { width: 130, fontWeight: 'bold', color: COLORS.text }]}>
                              {tx.silo?.name ?? 'Silo Terhapus'}
                            </Text>
                            <View style={{ width: 100, justifyContent: 'center' }}>
                              <View style={styles.categoryTagSmall}>
                                <Text style={styles.categoryTagSmallText}>{tx.silo?.feedType ?? 'Umum'}</Text>
                              </View>
                            </View>
                            <View style={{ width: 90, alignItems: 'center', justifyContent: 'center' }}>
                              <View style={[styles.typeBadge, { backgroundColor: isMasuk ? '#dcfce7' : '#e0e7ff' }]}>
                                <Text style={[styles.typeBadgeText, { color: isMasuk ? '#15803d' : '#4338ca' }]}>
                                  {isMasuk ? '📥 Masuk' : '📤 Keluar'}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.tableCellText, { width: 100, textAlign: 'right', fontWeight: 'bold', color: isMasuk ? '#16a34a' : '#4f46e5' }]}>
                              {isMasuk ? '+' : '-'}{tx.weightKg} {tx.silo?.unit ?? 'Kg'}
                            </Text>
                            <Text style={[styles.tableCellText, { width: 130, color: COLORS.textLight }]}>
                              {tx.expiryDate ? new Date(tx.expiryDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                            </Text>
                            <Text style={[styles.tableCellText, { width: 100, fontWeight: '500', color: COLORS.text }]}>
                              {tx.creator || 'Admin'}
                            </Text>
                            <Text style={[styles.tableCellText, { width: 160, color: COLORS.textLight }]} numberOfLines={2}>
                              {tx.description || '-'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>

                  {/* NAVIGASI PAGINATION BERBAGAI NOMOR (1, 2, 3 ... >) SEPERTI DI WEB */}
                  {totalReportPages >= 1 && (
                    <View style={styles.paginationContainer}>
                      <Text style={styles.paginationCounterText}>
                        Menampilkan {(reportPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(reportPage * ITEMS_PER_PAGE, allTx.length)} dari {allTx.length} data
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {/* Tombol Mundur (<) */}
                        <TouchableOpacity
                          disabled={reportPage === 1}
                          onPress={() => setReportPage(prev => Math.max(prev - 1, 1))}
                          style={[styles.pageBtn, reportPage === 1 && styles.pageBtnDisabled]}
                        >
                          <Text style={[styles.pageBtnText, reportPage === 1 && styles.pageBtnTextDisabled]}>&lt; Mundur</Text>
                        </TouchableOpacity>

                        {/* Tombol Nomor Halaman [1] [2] [3]... */}
                        {Array.from({ length: totalReportPages }, (_, idx) => idx + 1).map((pNum) => {
                          const isActive = pNum === reportPage;
                          return (
                            <TouchableOpacity
                              key={pNum}
                              onPress={() => setReportPage(pNum)}
                              style={[styles.pageNumberBtn, isActive && styles.pageNumberBtnActive]}
                            >
                              <Text style={[styles.pageNumberText, isActive && styles.pageNumberTextActive]}>
                                {pNum}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}

                        {/* Tombol Lanjut (>) */}
                        <TouchableOpacity
                          disabled={reportPage === totalReportPages}
                          onPress={() => setReportPage(prev => Math.min(prev + 1, totalReportPages))}
                          style={[styles.pageBtn, reportPage === totalReportPages && styles.pageBtnDisabled]}
                        >
                          <Text style={[styles.pageBtnText, reportPage === totalReportPages && styles.pageBtnTextDisabled]}>Lanjut &gt;</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </ScrollView>
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
                {silos.map(s => (
                  <TouchableOpacity 
                    key={s.id}
                    onPress={() => setScheduleForm({...scheduleForm, feedType: s.name})}
                    style={{ 
                      padding: 8, 
                      borderRadius: 6, 
                      backgroundColor: scheduleForm.feedType === s.name ? COLORS.primary : '#f1f5f9'
                    }}
                  >
                    <Text style={{ color: scheduleForm.feedType === s.name ? COLORS.white : COLORS.text }}>{s.name} ({s.feedType})</Text>
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

      {/* MODAL TAMBAH/EDIT SILO */}
      <Modal visible={siloModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 20, maxHeight: '85%' }}>
            <ScrollView>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.text }}>
                {siloForm.id ? 'Edit Silo' : 'Tambah Silo'}
              </Text>

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Nama Silo</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15, color: COLORS.text }}
                value={siloForm.name}
                onChangeText={(t) => setSiloForm({...siloForm, name: t})}
                placeholder="Contoh: Silo Utama A"
              />

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Jenis Pakan</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 }}>
                {['Hijauan', 'Konsentrat', 'Vitamin', 'TMR'].map(type => (
                  <TouchableOpacity 
                    key={type}
                    onPress={() => setSiloForm({...siloForm, feedType: type})}
                    style={{ 
                      padding: 8, 
                      borderRadius: 6, 
                      backgroundColor: siloForm.feedType === type ? COLORS.primary : '#f1f5f9'
                    }}
                  >
                    <Text style={{ color: siloForm.feedType === type ? COLORS.white : COLORS.text }}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Kapasitas Maksimal (Kg)</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15, color: COLORS.text }}
                value={siloForm.capacity}
                onChangeText={(t) => setSiloForm({...siloForm, capacity: t})}
                keyboardType="numeric"
                placeholder="Contoh: 1000"
              />

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Stok Sekarang (Kg)</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15, color: COLORS.text }}
                value={siloForm.currentStock}
                onChangeText={(t) => setSiloForm({...siloForm, currentStock: t})}
                keyboardType="numeric"
                placeholder="Contoh: 500"
              />

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Satuan</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15, color: COLORS.text }}
                value={siloForm.unit}
                onChangeText={(t) => setSiloForm({...siloForm, unit: t})}
                placeholder="Contoh: Kg"
              />

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Tanggal Kadaluarsa (Khusus Vitamin, YYYY-MM-DD)</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15, color: COLORS.text }}
                value={siloForm.expiryDate}
                onChangeText={(t) => setSiloForm({...siloForm, expiryDate: t})}
                placeholder="Contoh: 2026-12-31"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setSiloModalVisible(false)} style={{ padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveSilo} style={{ padding: 12, backgroundColor: COLORS.primary, borderRadius: 8 }}>
                  <Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL TRANSAKSI SILO */}
      <Modal visible={txModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.white, borderRadius: 12, padding: 20, maxHeight: '80%' }}>
            <ScrollView>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.text }}>
                Transaksi Silo: {selectedSiloForTx?.name}
              </Text>

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Tipe Transaksi</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                {['MASUK', 'KELUAR'].map(st => (
                  <TouchableOpacity 
                    key={st}
                    onPress={() => setTxForm({...txForm, type: st as 'MASUK' | 'KELUAR'})}
                    style={{ 
                      padding: 8, 
                      borderRadius: 6, 
                      backgroundColor: txForm.type === st ? COLORS.primary : '#f1f5f9',
                      flex: 1,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: txForm.type === st ? COLORS.white : COLORS.text, fontWeight: 'bold' }}>
                      {st === 'MASUK' ? '📥 Pakan Masuk' : '📤 Pakan Keluar'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Jumlah (Kg)</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15, color: COLORS.text }}
                value={txForm.weightKg}
                onChangeText={(t) => setTxForm({...txForm, weightKg: t})}
                keyboardType="numeric"
                placeholder="Contoh: 100"
              />

              <Text style={{ fontWeight: 'bold', marginBottom: 5, color: COLORS.textLight }}>Keterangan / Deskripsi</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 15, color: COLORS.text }}
                value={txForm.description}
                onChangeText={(t) => setTxForm({...txForm, description: t})}
                placeholder="Contoh: Restock pakan baru"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setTxModalVisible(false)} style={{ padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8 }}>
                  <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveTransaction} style={{ padding: 12, backgroundColor: COLORS.primary, borderRadius: 8 }}>
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
  },

  // Population Banner
  populationBanner: {
    backgroundColor: '#059669',
    padding: SPACING.lg,
    borderRadius: 16,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  populationBannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  populationBannerSubtitle: {
    fontSize: 12,
    color: '#a7f3d0',
    marginTop: 2,
  },
  totalPopCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  totalPopLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#a7f3d0',
    letterSpacing: 0.5,
  },
  totalPopValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 2,
  },
  breedPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  breedPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  // Table Card Container
  tableCardContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...SHADOWS.sm,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableColHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableCellText: {
    fontSize: 12,
  },
  categoryTagSmall: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  categoryTagSmallText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Pagination Controls
  paginationContainer: {
    padding: SPACING.md,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
    gap: 10,
  },
  paginationCounterText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  pageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pageBtnTextDisabled: {
    color: COLORS.textLight,
  },
  pageNumberBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumberBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pageNumberTextActive: {
    color: COLORS.white,
  }
});

export default FeedScreen;
