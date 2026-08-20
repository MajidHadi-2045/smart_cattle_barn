import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from '../utils/storage';
import { COLORS, SPACING, SHADOWS, RADIUS, FONT_SIZE, FONT_WEIGHT, TYPOGRAPHY } from '../theme';
import { 
  ChevronLeft, 
  Heart, 
  Thermometer, 
  Activity, 
  MapPin, 
  Calendar, 
  Beef, 
  Edit2, 
  Trash2, 
  Droplets, 
  HeartPulse, 
  Plus,
  Scale,
  Settings,
  X
} from 'lucide-react-native';
import apiClient from '../api/client';
import { useSocket } from '../hooks/useSocket';
import Svg, { Path } from 'react-native-svg';
import LivestockFormModal from '../components/LivestockFormModal';
import CustomModal from '../components/CustomModal';

const { width } = Dimensions.get('window');

const LivestockDetailScreen = ({ route, navigation }: any) => {
  const { id } = route.params;
  const [item, setItem] = useState<any>(null);
  const [feedNeeds, setFeedNeeds] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [heartRateData, setHeartRateData] = useState<number[]>([]);
  const [tempData, setTempData] = useState<number[]>([]);
  const [vitalModalVisible, setVitalModalVisible] = useState(false);
  const [vitalModalType, setVitalModalType] = useState<'heartRate'|'temp'>('heartRate');
  const [editVisible, setEditVisible] = useState(false);
  const [wasteVisible, setWasteVisible] = useState(false);
  const [wasteForm, setWasteForm] = useState({ fecesKg: '', urineL: '' });
  const [feedWeightVisible, setFeedWeightVisible] = useState(false);
  const [feedForm, setFeedForm] = useState({ feedType: 'Hijauan', weightKg: '', siloId: '' });
  const [silos, setSilos] = useState<any[]>([]);
  const [weightForm, setWeightForm] = useState({ weightKg: '' });
  const [modalConfig, setModalConfig] = useState<any>({ visible: false, type: 'success', title: '', message: '' });
  const [userRole, setUserRole] = useState<string | null>(null);

  // Variabel state untuk menyimpan data riwayat medis sapi
  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const [isHistoryExtended, setIsHistoryExtended] = useState(false);

  // State management khusus untuk Modal Konfigurasi Nutrisi
  const [nutritionModalVisible, setNutritionModalVisible] = useState(false);
  const [feedingMethod, setFeedingMethod] = useState('CAMPURAN'); // CAMPURAN, HIJAUAN_SAJA, KONSENTRAT_SAJA, TMR
  const [nutritionForm, setNutritionForm] = useState({
    targetBkPercent: '2.5',
    forageRatio: '60',
    concentrateRatio: '40',
    forageDM: '20',
    concentrateDM: '86'
  });
  
  const [lastVitalTimestamp, setLastVitalTimestamp] = useState<number>(Date.now());
  
  // Listen ke data vital sapi spesifik ini (Gunakan cattleId RFID untuk sinkronisasi sensor)
  const { data: socketData } = useSocket(item ? [`vital-update-${item.cattleId}`] : []);
  const lastTempChartUpdate = useRef<number>(Date.now());

  useEffect(() => {
    fetchDetail();
    checkUserRole();
  }, [id]);

  // Handle autoOpenNutrition parameter from LivestockScreen
  useEffect(() => {
    if (item && route.params?.autoOpenNutrition) {
      // Small timeout to allow the UI to render the detail page first
      const timer = setTimeout(() => {
        openNutritionConfigModal();
        navigation.setParams({ autoOpenNutrition: undefined });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [item, route.params?.autoOpenNutrition]);

  const checkUserRole = async () => {
    const user = await getUser();
    if (user) {
      setUserRole(user.role);
    }
  };

  useEffect(() => {
    const vitalData = item ? socketData[`vital-update-${item.cattleId}`] : null;
    if (vitalData) {
      setLastVitalTimestamp(Date.now());
      setItem((prev: any) => ({
        ...prev,
        lastHeartRate: vitalData.heartRate,
        lastTemp: vitalData.bodyTemperature
      }));

      // Update grafik detak jantung (setiap detik)
      if (vitalData.heartRate) {
        setHeartRateData(prev => [...prev.slice(1), vitalData.heartRate]);
      }
      
      // Update grafik suhu tubuh HANYA 1 menit sekali sesuai permintaan
      const now = Date.now();
      if (vitalData.bodyTemperature && (now - lastTempChartUpdate.current >= 60000)) {
        setTempData(prev => [...prev.slice(1), vitalData.bodyTemperature]);
        lastTempChartUpdate.current = now;
      }
    }
  }, [socketData]);

  // Efek interval untuk mendeteksi data sensor mati (stale) setelah 5 menit (300.000 ms)
  useEffect(() => {
    const checkStale = setInterval(() => {
      if (Date.now() - lastVitalTimestamp > 300000) {
        setItem((prev: any) => {
          if (!prev) return prev;
          // Hanya hapus jika nilainya saat ini bukan null untuk mencegah looping render yang tidak perlu
          if (prev.lastHeartRate === null && prev.lastTemp === null) return prev;
          return {
            ...prev,
            lastHeartRate: null,
            lastTemp: null
          };
        });
      }
    }, 10000);

    return () => clearInterval(checkStale);
  }, [lastVitalTimestamp]);

  const fetchDetail = async () => {
    try {
      const response = await apiClient.get(`/livestock/${id}`);
      const latestHr = response.data.vitals?.find((v: any) => v.heartRate !== null && v.heartRate > 0)?.heartRate || null;
      const latestTm = response.data.vitals?.find((v: any) => v.bodyTemperature !== null && v.bodyTemperature > 0)?.bodyTemperature || null;
      setItem({
        ...response.data,
        lastHeartRate: latestHr,
        lastTemp: latestTm
      });

      // Fetch live calculated nutrition feed needs from backend
      try {
        const feedNeedsRes = await apiClient.get(`/livestock/feed-needs/${response.data.cattleId}`);
        setFeedNeeds(feedNeedsRes.data);
      } catch (err) {
        console.log("Failed to load feed needs on mobile detail", err);
      }

      // Fetch health history records for this cattle
      try {
        const healthRes = await apiClient.get('/health');
        if (healthRes.data) {
          const filtered = healthRes.data.filter((h: any) => h.cattleId === response.data.cattleId);
          // Sort descending by date/id
          filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setHealthHistory(filtered);
        }
      } catch (err) {
        console.log("Failed to load medical history on mobile detail", err);
      }

      // Fetch silos
      try {
        const siloRes = await apiClient.get('/feed/silo');
        setSilos(siloRes.data);
      } catch (err) {}

      try {
        const vitalsRes = await apiClient.get(`/livestock/vital/history/${response.data.cattleId}`);
        if (vitalsRes.data && vitalsRes.data.length > 0) {
          const hrData = vitalsRes.data.filter((v: any) => v.heartRate !== null).map((v: any) => v.heartRate).slice(-20);
          const tmData = vitalsRes.data.filter((v: any) => v.bodyTemperature !== null).map((v: any) => v.bodyTemperature).slice(-20);
          
          if (hrData.length > 0) {
            const paddedHr = [...new Array(Math.max(0, 20 - hrData.length)).fill(hrData[0]), ...hrData];
            setHeartRateData(paddedHr);
          }
          if (tmData.length > 0) {
            const paddedTm = [...new Array(Math.max(0, 20 - tmData.length)).fill(tmData[0]), ...tmData];
            setTempData(paddedTm);
          }
        }
      } catch (err) {
        console.log("Failed to load historical vitals on mobile detail", err);
      }
    } catch (error) {
      console.error('Error fetching detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: any) => {
    setLoading(true);
    try {
      await apiClient.patch(`/livestock/${id}`, data);
      setEditVisible(false);
      setModalConfig({
        visible: true,
        type: 'success',
        title: 'Berhasil Update',
        message: 'Data sapi berhasil diperbarui.',
        onConfirm: () => { setModalConfig({ ...modalConfig, visible: false }); fetchDetail(); }
      });
    } catch (error: any) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Update Gagal',
        message: error.response?.data?.message || 'Terjadi kesalahan saat menyimpan perubahan.',
        onConfirm: () => setModalConfig({ ...modalConfig, visible: false })
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await apiClient.delete(`/livestock/${item.cattleId}`);
      setModalConfig({
        visible: true,
        type: 'success',
        title: 'Terhapus',
        message: 'Sapi berhasil dihapus dari sistem.',
        onConfirm: () => { setModalConfig({ ...modalConfig, visible: false }); navigation.goBack(); }
      });
    } catch (error: any) {
      setModalConfig({
        visible: true,
        type: 'error',
        title: 'Gagal Hapus',
        message: error.response?.data?.message || 'Terjadi kesalahan saat menghapus data.',
        onConfirm: () => setModalConfig({ ...modalConfig, visible: false })
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = () => {
    setModalConfig({
      visible: true,
      type: 'warning',
      title: 'Hapus Sapi?',
      message: 'Apakah Anda yakin ingin menghapus data sapi ini? Tindakan ini tidak bisa dibatalkan.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      onConfirm: handleDelete,
      onCancel: () => setModalConfig({ ...modalConfig, visible: false })
    });
  };

  const openNutritionConfigModal = () => {
    if (!item) return;

    if (item.concentrateRatio === 999) {
      setFeedingMethod('TMR');
    } else if (item.concentrateRatio === 0) {
      setFeedingMethod('HIJAUAN_SAJA');
    } else if (item.forageRatio === 0) {
      setFeedingMethod('KONSENTRAT_SAJA');
    } else {
      setFeedingMethod('CAMPURAN');
    }

    setNutritionForm({
      targetBkPercent: (item.targetBkPercent ?? 2.5).toString(),
      forageRatio: (item.forageRatio ?? 60).toString(),
      concentrateRatio: (item.concentrateRatio ?? 40).toString(),
      forageDM: (item.forageDM ?? 20).toString(),
      concentrateDM: (item.concentrateDM ?? 86).toString()
    });

    setNutritionModalVisible(true);
  };

  const handleSaveNutrition = async () => {
    let finalPrefs = {
      targetBkPercent: parseFloat(nutritionForm.targetBkPercent || '2.5'),
      forageRatio: parseFloat(nutritionForm.forageRatio || '60'),
      concentrateRatio: parseFloat(nutritionForm.concentrateRatio || '40'),
      forageDM: parseFloat(nutritionForm.forageDM || '20'),
      concentrateDM: parseFloat(nutritionForm.concentrateDM || '86')
    };

    if (feedingMethod === 'HIJAUAN_SAJA') {
      finalPrefs.forageRatio = 100;
      finalPrefs.concentrateRatio = 0;
    } else if (feedingMethod === 'KONSENTRAT_SAJA') {
      finalPrefs.forageRatio = 0;
      finalPrefs.concentrateRatio = 100;
    } else if (feedingMethod === 'TMR') {
      finalPrefs.forageRatio = 100;
      finalPrefs.concentrateRatio = 999;
    } else {
      if (finalPrefs.forageRatio + finalPrefs.concentrateRatio !== 100) {
        Alert.alert('Error', 'Rasio Hijauan + Konsentrat harus berjumlah 100%');
        return;
      }
    }

    setLoading(true);
    try {
      await apiClient.patch(`/livestock/${item.dbId || item.id}`, finalPrefs);
      setNutritionModalVisible(false);
      
      setModalConfig({
        visible: true,
        type: 'success',
        title: 'Berhasil',
        message: 'Konfigurasi target nutrisi berhasil diperbarui!',
        onConfirm: () => { 
          setModalConfig({ ...modalConfig, visible: false }); 
          fetchDetail(); 
        }
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Gagal menyimpan target nutrisi');
    } finally {
      setLoading(false);
    }
  };

  const generatePath = (type: 'heartRate' | 'temp') => {
    const data = type === 'heartRate' ? heartRateData : tempData;
    let minVal = type === 'heartRate' ? 40 : 35;
    let maxVal = type === 'heartRate' ? 120 : 42;
    
    if (data.length > 0) {
      const dataMin = Math.min(...data);
      const dataMax = Math.max(...data);
      if (type === 'temp') {
        minVal = dataMin - 0.5;
        maxVal = dataMax + 0.5;
      } else {
        minVal = Math.max(0, dataMin - 10);
        maxVal = dataMax + 10;
      }
    }

    const step = (width - 80) / Math.max(1, data.length - 1);
    
    return data.map((val, i) => {
      const x = i * step;
      const clampedVal = Math.max(minVal, Math.min(val, maxVal));
      const range = maxVal - minVal || 1;
      const y = 100 - ((clampedVal - minVal) / range) * 80;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  if (loading && !item) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detail Sapi</Text>
        <View style={styles.headerActions}>
          {/* Ikon Edit dan Hapus telah dihilangkan sesuai permintaan UI */}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Info Card Utama */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Beef size={40} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.idText}>ID: {item.cattleId}</Text>
            </View>
          </View>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Activity size={18} color={COLORS.textLight} />
              <Text style={styles.infoLabel}>Status: </Text>
              <Text style={[styles.infoValue, { color: item.healthStatus === 'SEHAT' ? COLORS.success : item.healthStatus === 'SAKIT' ? COLORS.danger : item.healthStatus === 'DALAM_PERAWATAN' ? '#3b82f6' : item.healthStatus === 'KRITIS' ? '#f97316' : item.healthStatus === 'MATI' ? '#64748b' : COLORS.danger }]}>{item.healthStatus ? item.healthStatus.replace('_', ' ') : 'N/A'}</Text>
            </View>
            <View style={styles.infoItem}>
              <MapPin size={18} color={COLORS.textLight} />
              <Text style={styles.infoLabel}>Lokasi: </Text>
              <Text style={styles.infoValue}>{item.section?.zone?.name || 'Kandang A'} / {item.section?.name || 'Section'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Calendar size={18} color={COLORS.textLight} />
              <Text style={styles.infoLabel}>Breed: </Text>
              <Text style={styles.infoValue}>{item.breed || 'Lokal'}</Text>
            </View>
          </View>

          {userRole === 'STAFF' && (
            <View style={styles.actionGrid}>
              <TouchableOpacity 
                style={[styles.actionGridItem, { backgroundColor: '#fdf2f2' }]}
                onPress={() => setWasteVisible(true)}
              >
                <Droplets size={18} color={COLORS.danger} />
                <Text style={styles.actionGridText}>Catat Limbah</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionGridItem, { backgroundColor: '#fef3c7' }]}
                onPress={() => setFeedWeightVisible(true)}
              >
                <Scale size={18} color="#d97706" />
                <Text style={styles.actionGridText}>Timbang & Pakan</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionGridItem, { backgroundColor: '#f0fdf4' }]}
                onPress={() => {
                  setModalConfig({
                    visible: true,
                    type: 'info',
                    title: 'Rekam Medis',
                    message: 'Fitur input diagnosa baru sedang dalam pengembangan.',
                    onConfirm: () => setModalConfig({...modalConfig, visible: false})
                  });
                }}
              >
                <HeartPulse size={18} color={COLORS.success} />
                <Text style={styles.actionGridText}>Tambah Medik</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* --- KARTU INFORMASI TARGET DAN KEBUTUHAN NUTRISI PREMIUM --- */}
        <View style={styles.nutritionCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.nutritionCardTitle}>Target & Kebutuhan Nutrisi</Text>
            {userRole === 'STAFF' && (
              <TouchableOpacity 
                style={styles.editConfigBtn}
                onPress={openNutritionConfigModal}
              >
                <Settings size={14} color={COLORS.primary} />
                <Text style={styles.editConfigBtnText}>Atur Manual</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.nutritionStatsGrid}>
            <View style={styles.nutritionStatItem}>
              <Text style={styles.nutritionStatLabel}>Berat Sapi</Text>
              <Text style={styles.nutritionStatValue}>{item.weight || item.initialWeight || 0} kg</Text>
            </View>
            <View style={styles.nutritionStatItem}>
              <Text style={styles.nutritionStatLabel}>Kebutuhan BK / Hari</Text>
              <Text style={[styles.nutritionStatValue, { color: '#6366f1' }]}>
                {feedNeeds ? feedNeeds.bkRequirement.toFixed(2) : ((item.weight || 0) * (item.targetBkPercent || 2.5) / 100).toFixed(2)} kg
              </Text>
            </View>
          </View>

          <View style={styles.nutritionDivider} />

          {/* Metode Pakan */}
          <View style={styles.nutritionInfoRow}>
            <Text style={styles.nutritionInfoLabel}>Metode Pemberian:</Text>
            <Text style={styles.nutritionInfoValue}>
              {item.concentrateRatio === 999 
                ? 'TMR (Total Mixed Ration)' 
                : item.concentrateRatio === 0 
                ? 'Hanya Hijauan Saja' 
                : item.forageRatio === 0 
                ? 'Hanya Konsentrat Saja' 
                : `Campuran (${item.forageRatio || 60}% H / ${item.concentrateRatio || 40}% K)`}
            </Text>
          </View>

          <View style={styles.nutritionInfoRow}>
            <Text style={styles.nutritionInfoLabel}>Target BK Sapi:</Text>
            <Text style={styles.nutritionInfoValue}>{item.targetBkPercent ?? 2.5}% Bobot</Text>
          </View>

          <View style={styles.nutritionInfoRow}>
            <Text style={styles.nutritionInfoLabel}>Frekuensi Makan:</Text>
            <Text style={styles.nutritionInfoValue}>{item.feedingFrequency ?? 2} Kali / Hari</Text>
          </View>

          <View style={styles.nutritionInfoRow}>
            <Text style={styles.nutritionInfoLabel}>Realisasi Hari Ini:</Text>
            <Text style={[styles.nutritionInfoValue, { color: (item.fedCountToday ?? 0) >= (item.feedingFrequency ?? 2) ? '#16a34a' : '#4f46e5', fontWeight: 'bold' }]}>
              {item.fedCountToday ?? 0} / {item.feedingFrequency ?? 2} Kali {(item.fedCountToday ?? 0) >= (item.feedingFrequency ?? 2) ? '✅ Selesai' : ''}
            </Text>
          </View>

          {/* Rincian As-Fed */}
          <View style={styles.asFedBox}>
            <Text style={styles.asFedHeader}>Rekomendasi Pakan As-Fed:</Text>
            
            {item.concentrateRatio === 999 ? (
              <View style={styles.asFedItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.asFedItemLabel}>🌾 TMR (@{item.forageDM || 50}% BK)</Text>
                  <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Total Harian: {feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '0.00'} kg</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.asFedItemValue}>{feedNeeds ? (feedNeeds.suggestedForageAsFed / (item.feedingFrequency || 1)).toFixed(2) : '0.00'} kg</Text>
                  <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>Porsi 1x ({item.feedingFrequency || 1}x/hari)</Text>
                </View>
              </View>
            ) : item.concentrateRatio === 0 ? (
              <View style={styles.asFedItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.asFedItemLabel}>🌿 Hijauan (@{item.forageDM || 20}% BK)</Text>
                  <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Total Harian: {feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '0.00'} kg</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.asFedItemValue}>{feedNeeds ? (feedNeeds.suggestedForageAsFed / (item.feedingFrequency || 1)).toFixed(2) : '0.00'} kg</Text>
                  <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>Porsi 1x ({item.feedingFrequency || 1}x/hari)</Text>
                </View>
              </View>
            ) : item.forageRatio === 0 ? (
              <View style={styles.asFedItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.asFedItemLabel}>🌾 Konsentrat (@{item.concentrateDM || 86}% BK)</Text>
                  <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Total Harian: {feedNeeds ? feedNeeds.suggestedConcentrateAsFed.toFixed(2) : '0.00'} kg</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.asFedItemValue}>{feedNeeds ? (feedNeeds.suggestedConcentrateAsFed / (item.feedingFrequency || 1)).toFixed(2) : '0.00'} kg</Text>
                  <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>Porsi 1x ({item.feedingFrequency || 1}x/hari)</Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.asFedItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.asFedItemLabel}>🌿 Hijauan ({item.forageRatio || 60}% Rasio @{item.forageDM || 20}% BK)</Text>
                    <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Total Harian: {feedNeeds ? feedNeeds.suggestedForageAsFed.toFixed(2) : '0.00'} kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.asFedItemValue}>{feedNeeds ? (feedNeeds.suggestedForageAsFed / (item.feedingFrequency || 1)).toFixed(2) : '0.00'} kg</Text>
                    <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>Porsi 1x</Text>
                  </View>
                </View>
                
                <View style={styles.asFedItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.asFedItemLabel}>🌾 Konsentrat ({item.concentrateRatio || 40}% Rasio @{item.concentrateDM || 86}% BK)</Text>
                    <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Total Harian: {feedNeeds ? feedNeeds.suggestedConcentrateAsFed.toFixed(2) : '0.00'} kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.asFedItemValue}>{feedNeeds ? (feedNeeds.suggestedConcentrateAsFed / (item.feedingFrequency || 1)).toFixed(2) : '0.00'} kg</Text>
                    <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>Porsi 1x</Text>
                  </View>
                </View>

                <View style={[styles.asFedItem, { borderTopWidth: 1, borderTopColor: '#fef3c7', paddingTop: 6, marginTop: 6 }]}>
                  <Text style={[styles.asFedItemLabel, { fontWeight: 'bold' }]}>Total Campuran Harian</Text>
                  <Text style={[styles.asFedItemValue, { fontWeight: 'bold', color: '#b45309' }]}>
                    {feedNeeds ? (feedNeeds.suggestedForageAsFed + feedNeeds.suggestedConcentrateAsFed).toFixed(2) : '0.00'} kg
                  </Text>
                </View>
              </>
            )}

            {/* Porsi 1x Pemberian Pakan jika target harian > 1 */}
            {item.feedingFrequency > 1 && (
              <View style={[styles.asFedItem, { borderTopWidth: 1, borderTopColor: '#d1fae5', paddingTop: 8, marginTop: 8, alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.asFedItemLabel, { fontWeight: 'bold', color: '#047857' }]}>🎯 Total Porsi 1x Pemberian</Text>
                  <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Campuran Harian dibagi {item.feedingFrequency}x pakan</Text>
                </View>
                <Text style={[styles.asFedItemValue, { fontWeight: 'bold', color: '#047857', fontSize: 16 }]}>
                  {((feedNeeds ? (feedNeeds.suggestedForageAsFed + feedNeeds.suggestedConcentrateAsFed) : 0) / item.feedingFrequency).toFixed(2)} kg
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bagian Monitoring Vital Sign secara Real-time */}
        <Text style={styles.sectionTitle}>Monitoring Real-time</Text>
        
        <View style={styles.monitoringRow}>
          <TouchableOpacity 
            style={[styles.vitalCard, { backgroundColor: '#fee2e2' }]}
            onPress={() => { setVitalModalType('heartRate'); setVitalModalVisible(true); }}
          >
            <Heart size={24} color="#ef4444" />
            <Text style={styles.vitalValue}>{item?.lastHeartRate && item.lastHeartRate > 0 ? item.lastHeartRate : '--'}</Text>
            <Text style={styles.vitalUnit}>{item?.lastHeartRate && item.lastHeartRate > 0 ? 'BPM' : '--'}</Text>
            <Text style={styles.vitalLabel}>Detak Jantung</Text>
            <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 4 }}>
              {item?.lastHeartRate && item.lastHeartRate > 0 ? new Date(lastVitalTimestamp).toLocaleTimeString('id-ID') : '--:--'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.vitalCard, { backgroundColor: '#dcfce7' }]}
            onPress={() => { setVitalModalType('temp'); setVitalModalVisible(true); }}
          >
            <Thermometer size={24} color="#10b981" />
            <Text style={styles.vitalValue}>{item?.lastTemp && item.lastTemp > 0 ? item.lastTemp : '--'}</Text>
            <Text style={styles.vitalUnit}>{item?.lastTemp && item.lastTemp > 0 ? '°C' : '--'}</Text>
            <Text style={styles.vitalLabel}>Suhu Tubuh</Text>
            <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 4 }}>
              {item?.lastTemp && item.lastTemp > 0 ? new Date(lastVitalTimestamp).toLocaleTimeString('id-ID') : '--:--'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Riwayat Kesehatan (Rekam Medis) */}
        <View style={[styles.graphCard, { marginTop: SPACING.lg, marginBottom: SPACING.md }]}>
          <View style={styles.graphHeader}>
            <HeartPulse size={18} color={COLORS.primary} />
            <Text style={styles.graphTitle}>Riwayat Kesehatan (Rekam Medis)</Text>
          </View>

          {healthHistory.length === 0 ? (
            <View style={styles.emptyHistoryContainer}>
              <Text style={styles.emptyHistoryText}>Sapi ini tidak memiliki riwayat pemeriksaan medis harian.</Text>
            </View>
          ) : (
            <View style={styles.historyTimeline}>
              {(isHistoryExtended ? healthHistory.slice(0, 10) : healthHistory.slice(0, 5)).map((record, index) => {
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
                
                return (
                  <View key={record.id || index} style={styles.historyTimelineItem}>
                    {/* Left node decoration */}
                    <View style={styles.timelineNodeContainer}>
                      <View style={[styles.timelineNode, { backgroundColor: getStatusColor(record.status) }]} />
                      {index < (isHistoryExtended ? healthHistory.slice(0, 10) : healthHistory.slice(0, 5)).length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>

                    {/* Right content */}
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineContentHeader}>
                        <Text style={styles.timelineDiagnosa}>{record.diagnosa || record.disease || 'Pemeriksaan Rutin'}</Text>
                        <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(record.status) + '15' }]}>
                          <Text style={[styles.statusTextSmall, { color: getStatusColor(record.status) }]}>{record.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.timelinePenanganan}>Penanganan: {record.penanganan || record.treatment || 'Diberi vitamin & istirahat'}</Text>
                      
                      <View style={styles.timelineMeta}>
                        <Text style={styles.timelineMetaText}>Pemeriksa: {record.pemeriksa || record.vet || 'Vet Bertugas'}</Text>
                        <Text style={styles.timelineMetaText}>{new Date(record.createdAt).toLocaleDateString('id-ID')}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {healthHistory.length > 5 && (
                <TouchableOpacity
                  style={styles.historyExpandBtn}
                  onPress={() => setIsHistoryExtended(!isHistoryExtended)}
                >
                  <Text style={styles.historyExpandBtnText}>
                    {isHistoryExtended ? 'Tampilkan Lebih Sedikit' : `Tampilkan Lebih Banyak (${healthHistory.length - 5}+)`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal Input Limbah */}
       <Modal visible={wasteVisible} transparent animationType="fade">
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>Catat Limbah Kandang</Text>
             <Text style={styles.modalSubtitle}>Kandang: {item.section?.zone?.name || 'Kandang'}</Text>
             
             <View style={styles.inputGroup}>
               <Text style={styles.label}>Feses (Kg / Kandang)</Text>
               <TextInput 
                 style={styles.input}
                 placeholder="0"
                 keyboardType="numeric"
                 value={wasteForm.fecesKg}
                 onChangeText={(txt) => setWasteForm({...wasteForm, fecesKg: txt})}
               />
             </View>
 
             <View style={styles.inputGroup}>
               <Text style={styles.label}>Urine (Liter / Kandang)</Text>
               <TextInput 
                 style={styles.input}
                 placeholder="0"
                 keyboardType="numeric"
                 value={wasteForm.urineL}
                 onChangeText={(txt) => setWasteForm({...wasteForm, urineL: txt})}
               />
             </View>
 
             <View style={styles.modalButtons}>
               <TouchableOpacity 
                 style={[styles.modalButton, styles.cancelBtn]}
                 onPress={() => setWasteVisible(false)}
               >
                 <Text style={styles.cancelBtnText}>Batal</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 style={[styles.modalButton, styles.submitBtn]}
                 onPress={async () => {
                   try {
                     const zoneId = item.section?.zoneId || item.section?.zone?.id || 1;
                     await apiClient.post('/livestock/waste/zone', {
                       zoneId: parseInt(zoneId),
                       fecesKg: parseFloat(wasteForm.fecesKg || '0'),
                       urineL: parseFloat(wasteForm.urineL || '0')
                     });
                     setWasteVisible(false);
                     setModalConfig({
                       visible: true,
                       type: 'success',
                       title: 'Berhasil',
                       message: `Data limbah kandang ${item.section?.zone?.name || ''} berhasil dicatat.`,
                       onConfirm: () => setModalConfig({...modalConfig, visible: false})
                     });
                   } catch (err) {
                     alert('Gagal mencatat limbah kandang');
                   }
                 }}
               >
                 <Text style={styles.submitBtnText}>Simpan</Text>
               </TouchableOpacity>
             </View>
           </View>
        </View>
      </Modal>

      {/* Modal Timbang & Pakan */}
      <Modal visible={feedWeightVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚖️ Timbang & Pakan</Text>
              <Text style={styles.modalSubtitle}>Sapi: {item.name} ({item.cattleId})</Text>
              
              {/* Bagian 1: Timbang Berat Badan */}
              <View style={styles.sectionDividerMobile} />
              <Text style={styles.modalSectionHeader}>1. Catat Berat Sapi</Text>
              <View style={styles.inputRow}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Masukkan Berat (Kg)"
                  keyboardType="numeric"
                  value={weightForm.weightKg}
                  onChangeText={(txt) => setWeightForm({ weightKg: txt })}
                />
                <TouchableOpacity 
                  style={[styles.smallSubmitBtn, { backgroundColor: '#d97706' }]}
                  onPress={async () => {
                    if (!weightForm.weightKg) {
                      alert('Isi berat badan sapi dahulu');
                      return;
                    }
                    try {
                      await apiClient.post('/livestock/weight', {
                        cattleId: item.cattleId,
                        weight: parseFloat(weightForm.weightKg)
                      });
                      setWeightForm({ weightKg: '' });
                      setItem((prev: any) => ({ ...prev, weight: parseFloat(weightForm.weightKg) }));
                      setModalConfig({
                        visible: true,
                        type: 'success',
                        title: 'Berhasil',
                        message: 'Berat badan sapi berhasil dicatat!',
                        onConfirm: () => { setModalConfig({...modalConfig, visible: false}); fetchDetail(); }
                      });
                    } catch (err) {
                      alert('Gagal mencatat berat sapi');
                    }
                  }}
                >
                  <Text style={styles.smallSubmitBtnText}>Simpan</Text>
                </TouchableOpacity>
              </View>

              {/* Bagian 2: Catat Pakan As-Fed */}
              <View style={styles.sectionDividerMobile} />
              <Text style={styles.modalSectionHeader}>2. Catat Pakan As-Fed</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Jenis Pakan</Text>
                <View style={styles.feedTypeButtons}>
                  {['Hijauan', 'Konsentrat', 'TMR'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.feedTypeBtn,
                        feedForm.feedType === type && styles.feedTypeBtnActive
                      ]}
                      onPress={() => setFeedForm({ ...feedForm, feedType: type })}
                    >
                      <Text style={[
                        styles.feedTypeBtnText,
                        feedForm.feedType === type && styles.feedTypeBtnTextActive
                      ]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pilih Silo (Opsional)</Text>
                <View style={{ gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.pickerFakeItem, !feedForm.siloId && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                    onPress={() => setFeedForm({ ...feedForm, siloId: '' })}
                  >
                    <Text style={[styles.pickerFakeText, !feedForm.siloId && styles.pickerFakeTextActive]}>
                      -- Pilih Silo (Otomatis) --
                    </Text>
                  </TouchableOpacity>
                  {(silos || [])
                    .filter((s: any) => {
                      const fType = feedForm.feedType.toLowerCase();
                      const sType = (s.feedType || '').toLowerCase();
                      const sName = (s.name || '').toLowerCase();
                      if (fType.includes('konsentrat+hijauan')) {
                        return sType.includes('hijauan') || sType.includes('konsentrat') || sName.includes('hijauan') || sName.includes('konsentrat');
                      }
                      return sType.includes(fType) || sName.includes(fType);
                    })
                    .map((s: any) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.pickerFakeItem, feedForm.siloId === s.id.toString() && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                        onPress={() => setFeedForm({ ...feedForm, siloId: s.id.toString() })}
                      >
                        <Text style={[styles.pickerFakeText, feedForm.siloId === s.id.toString() && styles.pickerFakeTextActive]}>
                          {s.name} - Sisa {s.currentStock} {s.unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Berat Pakan Diberikan (Kg)</Text>
                <View style={styles.inputRow}>
                  <TextInput 
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="0.0"
                    keyboardType="numeric"
                    value={feedForm.weightKg}
                    onChangeText={(txt) => setFeedForm({ ...feedForm, weightKg: txt })}
                  />
                  <TouchableOpacity 
                    style={[styles.smallSubmitBtn, { backgroundColor: COLORS.primary }]}
                    onPress={async () => {
                      if (!feedForm.weightKg) {
                        alert('Isi berat pakan dahulu');
                        return;
                      }
                      try {
                        let computedBkPercent = 50;
                        if (feedForm.feedType === 'Hijauan') {
                          computedBkPercent = item.forageDM || 20;
                        } else if (feedForm.feedType === 'Konsentrat') {
                          computedBkPercent = item.concentrateDM || 86;
                        } else if (feedForm.feedType === 'TMR') {
                          computedBkPercent = item.forageDM || 50;
                        }
                        
                        await apiClient.post('/livestock/feed', {
                          cattleId: item.cattleId,
                          feedType: feedForm.feedType,
                          weightKg: parseFloat(feedForm.weightKg),
                          bkPercent: computedBkPercent,
                          siloId: feedForm.siloId ? parseInt(feedForm.siloId) : undefined
                        });
                        setFeedForm({ ...feedForm, weightKg: '', siloId: '' });
                        setModalConfig({
                          visible: true,
                          type: 'success',
                          title: 'Berhasil',
                          message: 'Pencatatan pakan berhasil disimpan!',
                          onConfirm: () => { setModalConfig({...modalConfig, visible: false}); fetchDetail(); }
                        });
                      } catch (err: any) {
                        alert(err.response?.data?.message || 'Gagal menyimpan catatan pakan');
                      }
                    }}
                  >
                    <Text style={styles.smallSubmitBtnText}>Simpan</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelBtn, { marginTop: 12 }]}
                  onPress={() => setFeedWeightVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Tutup Modal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* --- MODAL INPUT 3: ATUR TARGET NUTRISI MANUAL (PARITY WEB) --- */}
      <Modal visible={nutritionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Parameter Nutrisi</Text>
              <Text style={styles.modalSubtitle}>Sapi: {item.name} ({item.cattleId})</Text>

              {/* Feeding Method selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Metode Pemberian Pakan</Text>
                <View style={styles.pickerFakeContainer}>
                  {[
                    { id: 'CAMPURAN', label: 'Campuran' },
                    { id: 'HIJAUAN_SAJA', label: 'Hanya Hijauan' },
                    { id: 'KONSENTRAT_SAJA', label: 'Hanya Konsentrat' },
                    { id: 'TMR', label: 'TMR' }
                  ].map(method => (
                    <TouchableOpacity
                      key={method.id}
                      style={[styles.pickerFakeItem, feedingMethod === method.id && styles.pickerFakeItemActive]}
                      onPress={() => setFeedingMethod(method.id)}
                    >
                      <Text style={[styles.pickerFakeText, feedingMethod === method.id && styles.pickerFakeTextActive]}>
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Target BK */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Target Bahan Kering (BK) (% dari Bobot)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: 2.5"
                  keyboardType="numeric"
                  value={nutritionForm.targetBkPercent}
                  onChangeText={txt => setNutritionForm({...nutritionForm, targetBkPercent: txt})}
                />
              </View>

              {/* Campuran Ratios */}
              {feedingMethod === 'CAMPURAN' && (
                <View style={styles.inputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Rasio Hijauan (%)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="60"
                      keyboardType="numeric"
                      value={nutritionForm.forageRatio}
                      onChangeText={txt => setNutritionForm({...nutritionForm, forageRatio: txt})}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Rasio Konsentrat (%)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="40"
                      keyboardType="numeric"
                      value={nutritionForm.concentrateRatio}
                      onChangeText={txt => setNutritionForm({...nutritionForm, concentrateRatio: txt})}
                    />
                  </View>
                </View>
              )}

              {/* Dry Matter values */}
              <View style={styles.inputRow}>
                {feedingMethod !== 'KONSENTRAT_SAJA' && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{feedingMethod === 'TMR' ? 'BK TMR (%)' : 'BK Hijauan (%)'}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={feedingMethod === 'TMR' ? '50' : '20'}
                      keyboardType="numeric"
                      value={nutritionForm.forageDM}
                      onChangeText={txt => setNutritionForm({...nutritionForm, forageDM: txt})}
                    />
                  </View>
                )}
                {feedingMethod !== 'HIJAUAN_SAJA' && feedingMethod !== 'TMR' && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>BK Konsentrat (%)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="86"
                      keyboardType="numeric"
                      value={nutritionForm.concentrateDM}
                      onChangeText={txt => setNutritionForm({...nutritionForm, concentrateDM: txt})}
                    />
                  </View>
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelBtn]}
                  onPress={() => setNutritionModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.submitBtn, { backgroundColor: COLORS.primary }]}
                  onPress={handleSaveNutrition}
                >
                  <Text style={styles.submitBtnText}>Simpan Target</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <LivestockFormModal 
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSubmit={handleUpdate}
        initialData={item}
        loading={loading}
      />

      <CustomModal 
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />

      {/* MODAL GRAFIK VITAL */}
      <Modal visible={vitalModalVisible} animationType="fade" transparent={true} onRequestClose={() => setVitalModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {vitalModalType === 'heartRate' ? 'Grafik Detak Jantung' : 'Grafik Suhu Tubuh'}
              </Text>
              <TouchableOpacity onPress={() => setVitalModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {(vitalModalType === 'heartRate' ? heartRateData : tempData).length > 0 ? (
              <View style={[styles.svgContainer, { padding: 0 }]}>
                <Svg height="120" width={width - 80}>
                  <Path
                    d={generatePath(vitalModalType)}
                    fill="none"
                    stroke={vitalModalType === 'heartRate' ? '#ef4444' : '#10b981'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            ) : (
              <View style={{ paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: 'center' }}>
                  ⚠️ Belum ada data sensor {vitalModalType === 'heartRate' ? 'detak jantung' : 'suhu tubuh'} yang masuk untuk sapi ini.
                </Text>
              </View>
            )}
            <Text style={[styles.graphFooter, { textAlign: 'center', marginTop: 12 }]}>
              {(vitalModalType === 'heartRate' ? heartRateData : tempData).length > 0
                ? 'Sinkronisasi data otomatis via WebSocket'
                : 'Status: Menunggu Sinyal Sensor'}
            </Text>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  idText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  infoGrid: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: SPACING.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  monitoringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  vitalCard: {
    width: '48%',
    padding: SPACING.lg,
    borderRadius: 20,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  vitalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  vitalUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  vitalLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  graphCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  svgContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  graphFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: SPACING.md,
  },
  actionGridItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  actionGridText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    ...SHADOWS.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
  },
  cancelBtnText: {
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  submitBtnText: {
    fontWeight: 'bold',
    color: COLORS.white,
  },
  sectionDividerMobile: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 16,
  },
  modalSectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  smallSubmitBtn: {
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallSubmitBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  feedTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  feedTypeBtn: {
    minWidth: '30%',
    paddingHorizontal: 8,
    height: 40,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  feedTypeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  feedTypeBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  feedTypeBtnTextActive: {
    color: COLORS.white,
  },

  // Premium Nutrition Card styles
  nutritionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  nutritionCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  editConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editConfigBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  nutritionStatsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  nutritionStatItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  nutritionStatLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  nutritionStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  nutritionDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: SPACING.md,
  },
  nutritionInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nutritionInfoLabel: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  nutritionInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  asFedBox: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginTop: SPACING.md,
  },
  asFedHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#b45309',
    marginBottom: 8,
  },
  asFedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  asFedItemLabel: {
    fontSize: 12,
    color: '#d97706',
  },
  asFedItemValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#b45309',
  },

  // Picker fake styles
  pickerFakeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pickerFakeItem: {
    width: '48%',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerFakeItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: COLORS.primary,
  },
  pickerFakeText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  pickerFakeTextActive: {
    color: COLORS.primary,
  },
  
  // Health History styles
  emptyHistoryContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: 'center',
  },
  historyTimeline: {
    marginTop: 10,
  },
  historyTimelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineNodeContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 2,
    marginTop: 4,
  },
  timelineLine: {
    position: 'absolute',
    top: 16,
    bottom: -20,
    width: 2,
    backgroundColor: '#e2e8f0',
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  timelineContentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timelineDiagnosa: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusTextSmall: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  timelinePenanganan: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  timelineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  timelineMetaText: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  historyExpandBtn: {
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  historyExpandBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default LivestockDetailScreen;
