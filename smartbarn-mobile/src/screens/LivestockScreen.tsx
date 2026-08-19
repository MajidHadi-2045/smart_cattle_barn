import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { 
  Search, 
  ChevronRight, 
  Beef, 
  Heart, 
  Thermometer, 
  Plus, 
  Settings, 
  Scale, 
  Trash2, 
  Check, 
  Info,
  Calendar,
  Home,
  Activity
} from 'lucide-react-native';
import apiClient from '../api/client';
import useSWR from 'swr';
import LivestockFormModal from '../components/LivestockFormModal';
import CustomModal from '../components/CustomModal';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUser } from '../utils/storage';
import { useSocket } from '../hooks/useSocket';

const fetcherMulti = async () => {
  const [liveRes, checklistRes, zonesRes, siloRes] = await Promise.all([
    apiClient.get('/livestock'),
    apiClient.get('/dashboard/daily-checklist').catch(() => null),
    apiClient.get('/zones').catch(() => ({ data: [] })),
    apiClient.get('/feed/silo').catch(() => ({ data: [] }))
  ]);
  return {
    livestock: liveRes.data,
    checklist: checklistRes?.data?.config,
    zones: zonesRes.data || [],
    silos: siloRes.data || []
  };
};

const LivestockScreen = ({ navigation }: any) => {
  const { data: swrData, isLoading: swrLoading, mutate: mutateLivestock } = useSWR('/livestock-bundle', fetcherMulti);
  const insets = useSafeAreaInsets();

  const [livestock, setLivestock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [formVisible, setFormVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({ visible: false, type: 'success', title: '', message: '' });
  const { showToast } = useToast();

  // Collective Waste Recording States
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [groupFecesKg, setGroupFecesKg] = useState('');
  const [groupUrineL, setGroupUrineL] = useState('');
  const [zones, setZones] = useState<any[]>([]);
  const [selectedWasteZoneId, setSelectedWasteZoneId] = useState<string>('');

  // Collective Feed & Weight Recording States (Separated)
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [feedModalVisible, setFeedModalVisible] = useState(false);
  const [groupWeight, setGroupWeight] = useState('');
  const [groupFeedType, setGroupFeedType] = useState('Hijauan');
  const [groupFeedWeight, setGroupFeedWeight] = useState('');
  const [groupSiloId, setGroupSiloId] = useState('');
  const [groupSiloId2, setGroupSiloId2] = useState('');
  const [silos, setSilos] = useState<any[]>([]);
  const [selectedFeedWeightCows, setSelectedFeedWeightCows] = useState<string[]>([]);
  const [selectFeedWeightAll, setSelectFeedWeightAll] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalZoneFilter, setModalZoneFilter] = useState('ALL');
  const [feedGoal, setFeedGoal] = useState(1);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const u = await getUser();
        if (u) {
          setUserRole(u.role);
        }
      } catch (err) {}
    };
    fetchUser();
  }, []);

  const { data: socketData } = useSocket(['websocket:vital-update']);

  useEffect(() => {
    if (swrData) {
      const now = Date.now();
      const mappedLivestock = (swrData.livestock || []).map((item: any) => ({
        ...item,
        lastVitalTimestamp: item.lastHeartRate || item.lastTemp ? now : null
      }));
      setLivestock(mappedLivestock);
      setZones(swrData.zones);
      setSilos(swrData.silos);
      if (swrData.checklist) {
        setFeedGoal(swrData.checklist.feedGoal || 1);
      }
      setLoading(false);
      setRefreshing(false);
    }
  }, [swrData]);

  // Listener data vitals real-time via WebSocket
  useEffect(() => {
    const vitalPayload = socketData['websocket:vital-update'] || socketData['vital-update'];
    if (vitalPayload && vitalPayload.cattleId) {
      const now = Date.now();
      setLivestock((prev: any[]) => prev.map((item: any) => {
        if (item.cattleId === vitalPayload.cattleId) {
          return {
            ...item,
            lastHeartRate: vitalPayload.heartRate !== undefined && vitalPayload.heartRate > 0 ? vitalPayload.heartRate : item.lastHeartRate,
            lastTemp: vitalPayload.temp !== undefined && vitalPayload.temp > 0 ? vitalPayload.temp : item.lastTemp,
            lastVitalTimestamp: now,
          };
        }
        return item;
      }));
    }
  }, [socketData]);

  // Efek staleness check: jika sensor mati > 5 menit (300.000 ms), reset nilai ke null agar otomatis tampil '--'
  useEffect(() => {
    const stalenessInterval = setInterval(() => {
      const now = Date.now();
      setLivestock((prev: any[]) => {
        let hasChanged = false;
        const nextList = prev.map((item: any) => {
          if (item.lastVitalTimestamp && now - item.lastVitalTimestamp > 300000) {
            if (item.lastHeartRate !== null || item.lastTemp !== null) {
              hasChanged = true;
              return {
                ...item,
                lastHeartRate: null,
                lastTemp: null,
              };
            }
          }
          return item;
        });
        return hasChanged ? nextList : prev;
      });
    }, 5000);

    return () => clearInterval(stalenessInterval);
  }, []);

  useEffect(() => {
    setLoading(swrLoading);
  }, [swrLoading]);

  const fetchLivestock = async () => {
    await mutateLivestock();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLivestock();
  };

  const handleAdd = async (data: any) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        sectionId: parseInt(data.sectionId),
        initialWeight: parseFloat(data.weight),
        weight: parseFloat(data.weight),
        currentWeight: parseFloat(data.weight)
      };
      await apiClient.post('/livestock', payload);
      setFormVisible(false);
      showToast(`Sapi ${data.cattleId} berhasil ditambahkan`, 'success');
      fetchLivestock();
    } catch (error: any) {
      // Error otomatis ditangani oleh interceptor global toast
    } finally {
      setLoading(false);
    }
  };

  const filteredLivestock = livestock.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.cattleId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredModalLivestock = livestock.filter(item => {
    const searchMatch = item.name?.toLowerCase().includes(modalSearch.toLowerCase()) || 
                        item.cattleId?.toLowerCase().includes(modalSearch.toLowerCase());
    const zoneMatch = modalZoneFilter === 'ALL' || item.zoneId === modalZoneFilter;
    return searchMatch && zoneMatch;
  });

  const totalPages = Math.ceil(filteredLivestock.length / ITEMS_PER_PAGE);
  const paginatedLivestock = filteredLivestock.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sehat': return COLORS.success;
      case 'sakit': return COLORS.danger;
      case 'dalam_perawatan': return '#3b82f6';
      case 'kritis': return '#f97316';
      case 'mati': return '#64748b';
      default: return COLORS.textLight;
    }
  };

  const getAsFedTarget = (item: any) => {
    const weight = item.weight || item.currentWeight || item.initialWeight || 0;
    const targetBkPercent = item.targetBkPercent ?? 2.5;
    const bkRequirement = weight * (targetBkPercent / 100);
    
    const forageRatio = item.forageRatio ?? 60;
    const concentrateRatio = item.concentrateRatio ?? 40;
    const forageDM = item.forageDM ?? 20;
    const concentrateDM = item.concentrateDM ?? 86;
    
    if (concentrateRatio === 999) {
      return (bkRequirement / (forageDM / 100)).toFixed(2);
    } else if (concentrateRatio === 0) {
      return (bkRequirement / (forageDM / 100)).toFixed(2);
    } else if (forageRatio === 0) {
      return (bkRequirement / (concentrateDM / 100)).toFixed(2);
    } else {
      const forageAsFed = (bkRequirement * (forageRatio / 100)) / (forageDM / 100);
      const concentrateAsFed = (bkRequirement * (concentrateRatio / 100)) / (concentrateDM / 100);
      return (forageAsFed + concentrateAsFed).toFixed(2);
    }
  };

  // Toggle selection for a single cow (Feed & Weight)
  const toggleSelectFeedWeightCattle = (cattleId: string) => {
    if (selectedFeedWeightCows.includes(cattleId)) {
      setSelectedFeedWeightCows(prev => prev.filter(id => id !== cattleId));
      setSelectFeedWeightAll(false);
    } else {
      setSelectedFeedWeightCows(prev => [...prev, cattleId]);
    }
  };

  // Toggle selection for all cows (Feed & Weight)
  const toggleSelectFeedWeightAll = () => {
    if (selectFeedWeightAll) {
      setSelectedFeedWeightCows([]);
      setSelectFeedWeightAll(false);
    } else {
      setSelectedFeedWeightCows(livestock.map(cow => cow.cattleId));
      setSelectFeedWeightAll(true);
    }
  };

  // Submit collective waste records per kandang
  const submitGroupWaste = async () => {
    if (!selectedWasteZoneId) {
      Alert.alert('Error', 'Silakan pilih kandang terlebih dahulu.');
      return;
    }

    if (!groupFecesKg && !groupUrineL) {
      Alert.alert('Error', 'Isi jumlah limbah padat (feces) atau cair (urine).');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/livestock/waste/zone', {
        zoneId: parseInt(selectedWasteZoneId),
        fecesKg: parseFloat(groupFecesKg || '0'),
        urineL: parseFloat(groupUrineL || '0')
      });

      const selectedZoneName = zones.find(z => z.id.toString() === selectedWasteZoneId.toString())?.name || 'Kandang';
      showToast(`Berhasil mencatat limbah untuk ${selectedZoneName}!`, 'success');
      
      setWasteModalVisible(false);
      setGroupFecesKg('');
      setGroupUrineL('');
      setSelectedWasteZoneId('');
    } catch (error) {
      Alert.alert('Error', 'Gagal mencatat limbah kandang.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate group nutritional recommendations mass-based
  const calculateGroupRecommendations = () => {
    let totalBk = 0;
    let totalForageAsFed = 0;
    let totalConcentrateAsFed = 0;
    let totalTmrAsFed = 0;

    const targetIds = selectFeedWeightAll ? livestock.map(cow => cow.cattleId) : selectedFeedWeightCows;

    targetIds.forEach(cowId => {
      const cow = livestock.find(c => c.cattleId === cowId);
      if (!cow) return;

      const weight = cow.weight || cow.currentWeight || cow.initialWeight || 300;
      const targetBkPercent = cow.targetBkPercent ?? 2.5;
      const bkReq = weight * (targetBkPercent / 100);
      totalBk += bkReq;

      const forageRatio = cow.forageRatio ?? 60;
      const concentrateRatio = cow.concentrateRatio ?? 40;
      const forageDM = cow.forageDM ?? 20;
      const concentrateDM = cow.concentrateDM ?? 86;

      // Selalu hitung semua kemungkinan agar UI dinamis jika pengguna mengubah tipe pakan
      const tmrDM = forageDM ?? 50; 
      totalTmrAsFed += bkReq / (tmrDM / 100);

      if (concentrateRatio !== 999) {
        if (forageRatio > 0) {
          totalForageAsFed += (bkReq * (forageRatio / 100)) / (forageDM / 100);
        }
        if (concentrateRatio > 0) {
          totalConcentrateAsFed += (bkReq * (concentrateRatio / 100)) / (concentrateDM / 100);
        }
      } else {
        totalForageAsFed += bkReq / (tmrDM / 100);
      }
    });

    return {
      totalBk,
      totalForageAsFed,
      totalConcentrateAsFed,
      totalTmrAsFed
    };
  };

  // Submit collective weight records
  const submitGroupWeight = async () => {
    const targetIds = selectFeedWeightAll ? livestock.map(cow => cow.cattleId) : selectedFeedWeightCows;

    if (targetIds.length === 0) {
      Alert.alert('Error', 'Silakan pilih minimal 1 ekor sapi.');
      return;
    }

    if (!groupWeight) {
      Alert.alert('Error', 'Isi berat badan yang ditimbang.');
      return;
    }

    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      const todayStr = new Date().toISOString().split('T')[0];

      targetIds.forEach(cowId => {
        promises.push(
          apiClient.post('/livestock/weight', {
            cattleId: cowId,
            weight: parseFloat(groupWeight),
            date: todayStr
          })
        );
      });

      await Promise.all(promises);
      showToast(`Berhasil mencatat berat badan untuk ${targetIds.length} ekor sapi!`, 'success');
      
      setWeightModalVisible(false);
      setGroupWeight('');
      setSelectedFeedWeightCows([]);
      setSelectFeedWeightAll(false);
      fetchLivestock();
    } catch (error) {
      Alert.alert('Error', 'Gagal mencatat berat badan kelompok.');
    } finally {
      setLoading(false);
    }
  };

  // Submit collective feed records
  const submitGroupFeed = async () => {
    const targetIds = selectFeedWeightAll ? livestock.map(cow => cow.cattleId) : selectedFeedWeightCows;

    if (targetIds.length === 0) {
      Alert.alert('Error', 'Silakan pilih minimal 1 ekor sapi.');
      return;
    }

    if (!groupFeedWeight) {
      Alert.alert('Error', 'Isi berat pakan yang diberikan.');
      return;
    }

    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      let computedBkPercent = 50;
      switch (groupFeedType) {
        case 'Hijauan': computedBkPercent = 20; break;
        case 'Konsentrat': computedBkPercent = 86; break;
        case 'Konsentrat+hijauan': computedBkPercent = 53; break;
        case 'Tmr': computedBkPercent = 50; break;
      }

      let payload: any = {
        cattleIds: targetIds,
        feedType: groupFeedType,
        weightKg: parseFloat(groupFeedWeight),
        bkPercent: computedBkPercent,
      };

      if (groupFeedType.toLowerCase().includes('konsentrat+hijauan') || groupFeedType.toLowerCase() === 'tmr') {
        payload.siloForageId = groupSiloId ? parseInt(groupSiloId) : undefined;
        payload.siloConcentrateId = groupSiloId2 ? parseInt(groupSiloId2) : undefined;
      } else {
        payload.siloForageId = groupSiloId ? parseInt(groupSiloId) : undefined;
      }

      await apiClient.post('/livestock/feed-bulk', payload);
      showToast(`Berhasil mencatat pemberian pakan untuk ${targetIds.length} ekor sapi!`, 'success');
      
      setFeedModalVisible(false);
      setGroupFeedWeight('');
      setGroupSiloId('');
      setGroupSiloId2('');
      setSelectedFeedWeightCows([]);
      setSelectFeedWeightAll(false);
      fetchLivestock();
    } catch (error) {
      Alert.alert('Error', 'Gagal mencatat pemberian pakan kelompok.');
    } finally {
      setLoading(false);
    }
  };

  const LivestockCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('LivestockDetail', { id: item.dbId || item.id || item.cattleId })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.idContainer}>
          <Beef size={18} color={COLORS.primary} />
          <Text style={styles.cattleId}>{item.cattleId}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.healthStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.healthStatus) }]}>
            {item.healthStatus ? item.healthStatus.replace('_', ' ') : 'N/A'}
          </Text>
        </View>
      </View>

      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.breed}>{item.breed || 'Local Breed'}</Text>

      {/* Target Nutrisi Ringkas */}
      <View style={styles.nutritionBox}>
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>Target BK:</Text>
          <Text style={styles.nutritionValue}>
            {((item.weight || item.currentWeight || item.initialWeight || 0) * ((item.targetBkPercent ?? 2.5) / 100)).toFixed(2)} kg
          </Text>
        </View>
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>As-Fed:</Text>
          <Text style={styles.nutritionValue}>
            {getAsFedTarget(item)} kg
          </Text>
        </View>
        <View style={[styles.nutritionRow, { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6, marginTop: 4 }]}>
          <Text style={styles.nutritionLabel}>Pemberian Pakan:</Text>
          <Text style={[styles.nutritionValue, { color: (item.fedCountToday ?? 0) >= (item.feedingFrequency ?? 2) ? '#16a34a' : '#4f46e5', fontWeight: 'bold' }]}>
            {item.fedCountToday ?? 0} / {item.feedingFrequency ?? 2} Kali {(item.fedCountToday ?? 0) >= (item.feedingFrequency ?? 2) ? '✅' : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.actionButtons, { flexDirection: 'row', gap: 8 }]}>
        <TouchableOpacity 
          style={[styles.actionBtnOutlineFull, { flex: 1 }]}
          onPress={() => navigation.navigate('LivestockDetail', { id: item.dbId || item.id || item.cattleId })}
        >
          <Beef size={14} color={COLORS.primary} />
          <Text style={[styles.actionBtnText, {color: COLORS.primary}]}>Detail</Text>
        </TouchableOpacity>

        {userRole === 'STAFF' && (
          <TouchableOpacity 
            style={[styles.actionBtnOutlineFull, { flex: 1, borderColor: '#d97706', backgroundColor: '#fffbeb' }]}
            onPress={() => navigation.navigate('LivestockDetail', { id: item.dbId || item.id || item.cattleId, autoOpenNutrition: true })}
          >
            <Settings size={14} color="#d97706" />
            <Text style={[styles.actionBtnText, {color: '#d97706'}]}>Atur Nutrisi</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.vitals}>
          <View style={styles.vitalItem}>
            <Heart size={14} color={COLORS.danger} />
            <Text style={styles.vitalText}>{item.lastHeartRate ? `${item.lastHeartRate} bpm` : '--'}</Text>
          </View>
          <View style={styles.vitalItem}>
            <Thermometer size={14} color={COLORS.primary} />
            <Text style={styles.vitalText}>{item.lastTemp ? `${item.lastTemp}°C` : '--'}</Text>
          </View>
        </View>
        <ChevronRight size={20} color={COLORS.textLight} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Data Ternak</Text>
        <Text style={styles.subtitle}>{livestock.length} Ekor Sapi Terdaftar</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari Sapi (ID atau Nama)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>



      {loading && !refreshing ? (
        <View style={{ paddingHorizontal: SPACING.lg }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Skeleton width={100} height={20} />
                <Skeleton width={60} height={20} borderRadius={10} />
              </View>
              <Skeleton width="60%" height={25} style={{ marginBottom: 8 }} />
              <Skeleton width="40%" height={15} style={{ marginBottom: 15 }} />
              <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }}>
                <Skeleton width={120} height={15} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={paginatedLivestock}
          renderItem={LivestockCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Tidak ada data sapi ditemukan</Text>
            </View>
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingHorizontal: 10 }}>
                <TouchableOpacity 
                  disabled={currentPage === 1}
                  onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ paddingVertical: 8, paddingHorizontal: 15, backgroundColor: currentPage === 1 ? '#e2e8f0' : COLORS.primary, borderRadius: 8 }}
                >
                  <Text style={{ color: currentPage === 1 ? '#94a3b8' : COLORS.white, fontWeight: 'bold' }}>Mundur</Text>
                </TouchableOpacity>
                <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>{currentPage} / {totalPages}</Text>
                <TouchableOpacity 
                  disabled={currentPage === totalPages}
                  onPress={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ paddingVertical: 8, paddingHorizontal: 15, backgroundColor: currentPage === totalPages ? '#e2e8f0' : COLORS.primary, borderRadius: 8 }}
                >
                  <Text style={{ color: currentPage === totalPages ? '#94a3b8' : COLORS.white, fontWeight: 'bold' }}>Lanjut</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}



      {/* MODAL 1: COLLECTIVE WASTE LOGGING */}
      <Modal
        visible={wasteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWasteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Catat Limbah Kandang</Text>
                <TouchableOpacity onPress={() => setWasteModalVisible(false)}>
                  <Text style={styles.closeBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <View style={styles.infoAlert}>
                  <Info size={16} color="#0284c7" />
                  <Text style={styles.infoAlertText}>
                    Catat volume limbah padat & cair kolektif untuk seluruh kandang terpilih sekaligus.
                  </Text>
                </View>

                <View style={styles.inputRow}>
                  <View style={styles.inputField}>
                    <Text style={styles.inputLabel}>Limbah Padat (Feces)</Text>
                    <TextInput
                       style={styles.textInput}
                       placeholder="Contoh: 15"
                       keyboardType="numeric"
                       value={groupFecesKg}
                       onChangeText={setGroupFecesKg}
                    />
                    <Text style={styles.unitLabel}>Kg / Kandang</Text>
                  </View>

                  <View style={styles.inputField}>
                    <Text style={styles.inputLabel}>Limbah Cair (Urine)</Text>
                    <TextInput
                       style={styles.textInput}
                       placeholder="Contoh: 8"
                       keyboardType="numeric"
                       value={groupUrineL}
                       onChangeText={setGroupUrineL}
                    />
                    <Text style={styles.unitLabel}>Liter / Kandang</Text>
                  </View>
                </View>

                <View style={styles.selectorSection}>
                  <View style={styles.selectorHeader}>
                    <Text style={styles.selectorTitle}>Pilih Kandang</Text>
                  </View>

                  <View style={styles.cowSelectGrid}>
                    {zones.map(zone => {
                      const isSelected = selectedWasteZoneId === zone.id.toString();
                      return (
                        <TouchableOpacity 
                          key={zone.id} 
                          style={[styles.cowSelectCard, isSelected && styles.cowSelectCardActive]}
                          onPress={() => setSelectedWasteZoneId(zone.id.toString())}
                        >
                          <Beef size={16} color={isSelected ? COLORS.primary : COLORS.textLight} />
                          <Text style={[styles.cowSelectId, isSelected && styles.cowSelectIdActive]}>
                            {zone.name}
                          </Text>
                          {isSelected && (
                            <View style={styles.checkIcon}>
                              <Check size={10} color={COLORS.white} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity style={styles.submitGroupBtn} onPress={submitGroupWaste}>
                  <Text style={styles.submitGroupBtnText}>Simpan Limbah Kandang</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: COLLECTIVE WEIGHT LOGGING */}
      <Modal
        visible={weightModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWeightModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Timbang Berat</Text>
                <TouchableOpacity onPress={() => setWeightModalVisible(false)}>
                  <Text style={styles.closeBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <View style={[styles.infoAlert, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                  <Info size={16} color="#2563eb" />
                  <Text style={[styles.infoAlertText, { color: '#1e40af' }]}>
                    Pencatatan berat badan (timbang) secara massal untuk sapi terpilih.
                  </Text>
                </View>

                {/* Timbang Section */}
                <View style={styles.formSectionBox}>
                  <Text style={styles.sectionBoxTitle}>⚖️ Berat Badan Sapi</Text>
                  <View style={styles.inputField}>
                    <Text style={styles.inputLabel}>Timbang Berat Badan Baru</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Masukkan berat badan baru (Kg)"
                      keyboardType="numeric"
                      value={groupWeight}
                      onChangeText={setGroupWeight}
                    />
                  </View>
                </View>

                {/* Cow Selector Grid */}
                <View style={styles.selectorSection}>
                  <View style={styles.selectorHeader}>
                    <Text style={styles.selectorTitle}>Pilih Sapi Penerima</Text>
                    <TouchableOpacity 
                      style={[styles.selectAllBtn, selectFeedWeightAll && styles.selectAllBtnActive]} 
                      onPress={toggleSelectFeedWeightAll}
                    >
                      <Text style={[styles.selectAllText, selectFeedWeightAll && styles.selectAllTextActive]}>
                        {selectFeedWeightAll ? 'Batal Pilih Semua' : 'Pilih Semua'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* MODAL SEARCH & FILTER */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={[styles.searchContainer, { flex: 1, margin: 0, height: 40 }]}>
                      <Search color={COLORS.textLight} size={18} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Cari ID/Nama Sapi..."
                        value={modalSearch}
                        onChangeText={setModalSearch}
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                      <TouchableOpacity 
                        style={[styles.pickerFakeItem, { width: 'auto', marginBottom: 0, paddingVertical: 8, marginRight: 8 }, modalZoneFilter === 'ALL' && styles.pickerFakeItemActive]}
                        onPress={() => setModalZoneFilter('ALL')}
                      ><Text style={[styles.pickerFakeText, modalZoneFilter === 'ALL' && styles.pickerFakeTextActive]}>Semua</Text></TouchableOpacity>
                      {zones.map(z => (
                        <TouchableOpacity 
                          key={z.id}
                          style={[styles.pickerFakeItem, { width: 'auto', marginBottom: 0, paddingVertical: 8, marginRight: 8 }, modalZoneFilter === z.id && styles.pickerFakeItemActive]}
                          onPress={() => setModalZoneFilter(z.id)}
                        ><Text style={[styles.pickerFakeText, modalZoneFilter === z.id && styles.pickerFakeTextActive]}>{z.name}</Text></TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.cowSelectGrid}>
                    {filteredModalLivestock.map(cow => {
                      const isSelected = selectedFeedWeightCows.includes(cow.cattleId) || selectFeedWeightAll;
                      return (
                        <TouchableOpacity 
                          key={cow.id} 
                          style={[styles.cowSelectCard, isSelected && styles.cowSelectCardActive]}
                          onPress={() => toggleSelectFeedWeightCattle(cow.cattleId)}
                        >
                          <Beef size={16} color={isSelected ? COLORS.primary : COLORS.textLight} />
                          <Text style={[styles.cowSelectId, isSelected && styles.cowSelectIdActive]}>
                            {cow.cattleId}
                          </Text>
                          {isSelected && (
                            <View style={styles.checkIcon}>
                              <Check size={10} color={COLORS.white} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.submitGroupBtn, { backgroundColor: '#2563eb' }]} 
                  onPress={submitGroupWeight}
                >
                  <Text style={styles.submitGroupBtnText}>Simpan Timbang Berat</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 3: COLLECTIVE FEED LOGGING */}
      <Modal
        visible={feedModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFeedModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pemberian Pakan</Text>
                <TouchableOpacity onPress={() => setFeedModalVisible(false)}>
                  <Text style={styles.closeBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                <View style={[styles.infoAlert, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Info size={16} color="#059669" />
                  <Text style={[styles.infoAlertText, { color: '#047857' }]}>
                    Pencatatan pemberian pakan secara massal untuk sapi terpilih.
                  </Text>
                </View>

                {/* Feed Section */}
                <View style={[styles.formSectionBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Text style={[styles.sectionBoxTitle, { color: '#166534' }]}>🌾 Detail Pakan</Text>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.inputLabel}>Jenis Pakan</Text>
                    <View style={styles.pickerFakeContainer}>
                      {['Hijauan', 'Konsentrat', 'Konsentrat+hijauan', 'Tmr'].map(type => (
                        <TouchableOpacity
                          key={type}
                          style={[styles.pickerFakeItem, groupFeedType === type && styles.pickerFakeItemActive]}
                          onPress={() => setGroupFeedType(type)}
                        >
                          <Text style={[styles.pickerFakeText, groupFeedType === type && styles.pickerFakeTextActive]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    { groupFeedType.toLowerCase().includes('konsentrat+hijauan') ? (
                      <View style={{ gap: 12 }}>
                        <View>
                          <Text style={styles.inputLabel}>Pilih Silo 1 (Hijauan)</Text>
                          <View style={{ gap: 8, marginTop: 4 }}>
                            <TouchableOpacity
                              style={[styles.pickerFakeItem, !groupSiloId && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                              onPress={() => setGroupSiloId('')}
                            >
                              <Text style={[styles.pickerFakeText, !groupSiloId && styles.pickerFakeTextActive]}>-- Otomatis --</Text>
                            </TouchableOpacity>
                            {(silos || []).filter(s => (s.feedType || '').toLowerCase().includes('hijauan') || (s.name || '').toLowerCase().includes('hijauan')).map(s => (
                              <TouchableOpacity
                                key={s.id}
                                style={[styles.pickerFakeItem, groupSiloId === s.id.toString() && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                                onPress={() => setGroupSiloId(s.id.toString())}
                              >
                                <Text style={[styles.pickerFakeText, groupSiloId === s.id.toString() && styles.pickerFakeTextActive]}>{s.name} - Sisa {s.currentStock} {s.unit}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View>
                          <Text style={styles.inputLabel}>Pilih Silo 2 (Konsentrat)</Text>
                          <View style={{ gap: 8, marginTop: 4 }}>
                            <TouchableOpacity
                              style={[styles.pickerFakeItem, !groupSiloId2 && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                              onPress={() => setGroupSiloId2('')}
                            >
                              <Text style={[styles.pickerFakeText, !groupSiloId2 && styles.pickerFakeTextActive]}>-- Otomatis --</Text>
                            </TouchableOpacity>
                            {(silos || []).filter(s => (s.feedType || '').toLowerCase().includes('konsentrat') || (s.name || '').toLowerCase().includes('konsentrat')).map(s => (
                              <TouchableOpacity
                                key={s.id}
                                style={[styles.pickerFakeItem, groupSiloId2 === s.id.toString() && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                                onPress={() => setGroupSiloId2(s.id.toString())}
                              >
                                <Text style={[styles.pickerFakeText, groupSiloId2 === s.id.toString() && styles.pickerFakeTextActive]}>{s.name} - Sisa {s.currentStock} {s.unit}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.inputLabel}>Pilih Silo (Opsional)</Text>
                        <View style={{ gap: 8, marginTop: 4 }}>
                          <TouchableOpacity
                            style={[styles.pickerFakeItem, !groupSiloId && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                            onPress={() => setGroupSiloId('')}
                          >
                            <Text style={[styles.pickerFakeText, !groupSiloId && styles.pickerFakeTextActive]}>-- Otomatis --</Text>
                          </TouchableOpacity>
                          {(silos || []).filter(s => {
                            const fType = groupFeedType.toLowerCase();
                            return (s.feedType || '').toLowerCase().includes(fType) || (s.name || '').toLowerCase().includes(fType);
                          }).map(s => (
                            <TouchableOpacity
                              key={s.id}
                              style={[styles.pickerFakeItem, groupSiloId === s.id.toString() && styles.pickerFakeItemActive, { padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }]}
                              onPress={() => setGroupSiloId(s.id.toString())}
                            >
                              <Text style={[styles.pickerFakeText, groupSiloId === s.id.toString() && styles.pickerFakeTextActive]}>{s.name} - Sisa {s.currentStock} {s.unit}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={{ marginBottom: 4 }}>
                    <Text style={styles.inputLabel}>{(selectFeedWeightAll ? livestock.length : selectedFeedWeightCows.length) > 1 ? 'Rata-rata Pakan per Sapi (Kg)' : 'Berat Pakan (Kg per Sapi)'}</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Contoh: 12.5"
                      keyboardType="numeric"
                      value={groupFeedWeight}
                      onChangeText={setGroupFeedWeight}
                    />
                    <Text style={styles.unitLabel}>
                      {(selectFeedWeightAll ? livestock.length : selectedFeedWeightCows.length) > 1 ? '*Total pakan akan didistribusikan secara proporsional sesuai kebutuhan BK.' : 'Masukkan porsi makan per sapi'}
                    </Text>
                  </View>
                </View>

                {/* Live Recommendation Card */}
                {(selectedFeedWeightCows.length > 0 || selectFeedWeightAll) && (() => {
                  const recs = calculateGroupRecommendations();
                  const cowCount = selectFeedWeightAll ? livestock.length : selectedFeedWeightCows.length;
                  
                  let selectedRecTotal = 0;
                  let labelRec = '';
                  
                  if (groupFeedType === 'Hijauan') {
                    selectedRecTotal = recs.totalForageAsFed;
                    labelRec = 'Rekomendasi Hijauan';
                  } else if (groupFeedType === 'Konsentrat') {
                    selectedRecTotal = recs.totalConcentrateAsFed;
                    labelRec = 'Rekomendasi Konsentrat';
                  } else if (groupFeedType === 'Tmr') {
                    selectedRecTotal = recs.totalTmrAsFed;
                    labelRec = 'Rekomendasi TMR';
                  } else if (groupFeedType === 'Konsentrat+hijauan') {
                    selectedRecTotal = recs.totalForageAsFed + recs.totalConcentrateAsFed;
                    labelRec = 'Rekomendasi Campuran';
                  }

                  const recPerCow = selectedRecTotal / cowCount;
                  const recPerCowSession = recPerCow / feedGoal;

                  return (
                    <View style={{ backgroundColor: '#f0f9ff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 12, gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#0369a1' }}>
                        💡 Rekomendasi Nutrisi Kelompok ({cowCount} Sapi)
                      </Text>
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: COLORS.textLight }}>Total BK Kelompok:</Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{recs.totalBk.toFixed(2)} kg BK/hari</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: COLORS.textLight }}>{labelRec} Kelompok:</Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{selectedRecTotal.toFixed(2)} kg/hari</Text>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: COLORS.textLight }}>Goal Makan Harian:</Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#2563eb' }}>{feedGoal}x sehari</Text>
                      </View>

                      {groupFeedType === 'Konsentrat+hijauan' ? (
                        <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e0f2fe', gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: COLORS.textLight }}>Hijauan Harian (Kelompok):</Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{recs.totalForageAsFed.toFixed(2)} kg</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: COLORS.textLight }}>Konsentrat Harian (Kelompok):</Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{recs.totalConcentrateAsFed.toFixed(2)} kg</Text>
                          </View>
                          <View style={{ borderTopWidth: 1, borderTopColor: '#e0f2fe', paddingTop: 4, marginTop: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: '500', color: COLORS.textLight }}>
                              Distribusi per Sapi ({feedGoal}x): {cowCount > 1 ? 'Proporsional (Sesuai Kebutuhan BK)' : `H: ${(recs.totalForageAsFed / feedGoal).toFixed(2)} kg | K: ${(recs.totalConcentrateAsFed / feedGoal).toFixed(2)} kg`}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e0f2fe', gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: COLORS.textLight }}>Total Harian (Kelompok):</Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{selectedRecTotal.toFixed(2)} kg</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: COLORS.textLight }}>{cowCount > 1 ? 'Rata-rata Harian (Per Sapi):' : 'Total Harian (Per Sapi):'}</Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{recPerCow.toFixed(2)} kg</Text>
                          </View>
                          {feedGoal > 1 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#059669' }}>{cowCount > 1 ? 'Rata-rata 1x (Per Sapi):' : 'Porsi 1x (Per Sapi):'}</Text>
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#059669' }}>{recPerCowSession.toFixed(2)} kg</Text>
                            </View>
                          )}
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        <TouchableOpacity 
                          style={{ flex: 1, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 6, borderRadius: 6, alignItems: 'center' }}
                          onPress={() => setGroupFeedWeight(recPerCow.toFixed(2))}
                        >
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af' }}>🎯 Harian ({cowCount > 1 ? 'Rata-rata ' : ''}{recPerCow.toFixed(2)} kg)</Text>
                        </TouchableOpacity>
                        
                        {feedGoal > 1 && (
                          <TouchableOpacity 
                            style={{ flex: 1, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingVertical: 6, borderRadius: 6, alignItems: 'center' }}
                            onPress={() => setGroupFeedWeight(recPerCowSession.toFixed(2))}
                          >
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#065f46' }}>🎯 Porsi 1x ({cowCount > 1 ? 'Rata-rata ' : ''}{recPerCowSession.toFixed(2)} kg)</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Proportional Distribution Breakdown */}
                      {groupFeedWeight && parseFloat(groupFeedWeight) > 0 && cowCount > 1 && (() => {
                        const asFedInputVal = parseFloat(groupFeedWeight);
                        const totalInputAsFed = asFedInputVal * cowCount;
                        const feedType = groupFeedType;
                        let bkPct = 0;
                        if (feedType === 'Hijauan') bkPct = 20;
                        else if (feedType === 'Konsentrat') bkPct = 86;
                        else if (feedType === 'Tmr') bkPct = 53;
                        else if (feedType === 'Konsentrat+hijauan') bkPct = 53;
                        
                        return (
                          <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#bae6fd' }}>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0369a1', marginBottom: 4 }}>Rincian Distribusi (Total: {totalInputAsFed.toFixed(2)} kg):</Text>
                            <View style={{ maxHeight: 150 }}>
                              <ScrollView nestedScrollEnabled={true}>
                                {livestock.filter(c => selectFeedWeightAll || selectedFeedWeightCows.includes(c.cattleId)).map(cow => {
                                  const cowWeight = cow.weight || 300;
                                  const bkReq = cowWeight * ((cow.targetBkPercent ?? 2.5) / 100);
                                  const proportion = recs.totalBk > 0 ? (bkReq / recs.totalBk) : (1 / cowCount);
                                  const cowAsFed = totalInputAsFed * proportion;
                                  const forageRatio = cow.forageRatio ?? 60;
                                  const concentrateRatio = cow.concentrateRatio ?? 40;
                                  const forageDM = cow.forageDM ?? 20;
                                  const concentrateDM = cow.concentrateDM ?? 86;
                                  let expectedAsFed = 0;
                                  if (feedType === 'Hijauan') {
                                      expectedAsFed = bkReq / (forageDM / 100);
                                  } else if (feedType === 'Konsentrat') {
                                      expectedAsFed = bkReq / (concentrateDM / 100);
                                  } else if (feedType === 'Tmr') {
                                      expectedAsFed = bkReq / (forageDM / 100);
                                  } else {
                                      expectedAsFed = (bkReq * (forageRatio / 100)) / (forageDM / 100) + (bkReq * (concentrateRatio / 100)) / (concentrateDM / 100);
                                  }
                                  const trueBkPct = expectedAsFed > 0 ? (bkReq / expectedAsFed) : (bkPct / 100);
                                  const cowBk = cowAsFed * trueBkPct;
                                  return (
                                    <View key={cow.id} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 6, borderRadius: 4, marginBottom: 4, borderWidth: 1, borderColor: '#e0f2fe' }}>
                                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#334155' }}>{cow.cattleId}</Text>
                                      <Text style={{ fontSize: 10, color: '#475569' }}>
                                        <Text style={{ fontWeight: 'bold' }}>{cowAsFed.toFixed(2)} kg</Text> <Text style={{ fontSize: 9 }}>({cowBk.toFixed(2)} kg BK)</Text>
                                      </Text>
                                    </View>
                                  );
                                })}
                              </ScrollView>
                            </View>
                          </View>
                        );
                      })()}

                    </View>
                  );
                })()}

                {/* Cow Selector Grid */}
                <View style={styles.selectorSection}>
                  <View style={styles.selectorHeader}>
                    <Text style={styles.selectorTitle}>Pilih Sapi Penerima</Text>
                    <TouchableOpacity 
                      style={[styles.selectAllBtn, selectFeedWeightAll && styles.selectAllBtnActive]} 
                      onPress={toggleSelectFeedWeightAll}
                    >
                      <Text style={[styles.selectAllText, selectFeedWeightAll && styles.selectAllTextActive]}>
                        {selectFeedWeightAll ? 'Batal Pilih Semua' : 'Pilih Semua'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* MODAL SEARCH & FILTER */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <View style={[styles.searchContainer, { flex: 1, margin: 0, height: 40 }]}>
                      <Search color={COLORS.textLight} size={18} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Cari ID/Nama Sapi..."
                        value={modalSearch}
                        onChangeText={setModalSearch}
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                      <TouchableOpacity 
                        style={[styles.pickerFakeItem, { width: 'auto', marginBottom: 0, paddingVertical: 8, marginRight: 8 }, modalZoneFilter === 'ALL' && styles.pickerFakeItemActive]}
                        onPress={() => setModalZoneFilter('ALL')}
                      ><Text style={[styles.pickerFakeText, modalZoneFilter === 'ALL' && styles.pickerFakeTextActive]}>Semua</Text></TouchableOpacity>
                      {zones.map(z => (
                        <TouchableOpacity 
                          key={z.id}
                          style={[styles.pickerFakeItem, { width: 'auto', marginBottom: 0, paddingVertical: 8, marginRight: 8 }, modalZoneFilter === z.id && styles.pickerFakeItemActive]}
                          onPress={() => setModalZoneFilter(z.id)}
                        ><Text style={[styles.pickerFakeText, modalZoneFilter === z.id && styles.pickerFakeTextActive]}>{z.name}</Text></TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.cowSelectGrid}>
                    {filteredModalLivestock.map(cow => {
                      const isSelected = selectedFeedWeightCows.includes(cow.cattleId) || selectFeedWeightAll;
                      return (
                        <TouchableOpacity 
                          key={cow.id} 
                          style={[styles.cowSelectCard, isSelected && styles.cowSelectCardActive]}
                          onPress={() => toggleSelectFeedWeightCattle(cow.cattleId)}
                        >
                          <Beef size={16} color={isSelected ? COLORS.primary : COLORS.textLight} />
                          <Text style={[styles.cowSelectId, isSelected && styles.cowSelectIdActive]}>
                            {cow.cattleId}
                          </Text>
                          {isSelected && (
                            <View style={styles.checkIcon}>
                              <Check size={10} color={COLORS.white} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.submitGroupBtn, { backgroundColor: '#059669' }]} 
                  onPress={submitGroupFeed}
                >
                  <Text style={styles.submitGroupBtnText}>Simpan Pakan Kelompok</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <LivestockFormModal 
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSubmit={handleAdd}
        loading={loading}
        zones={zones}
      />

      <CustomModal 
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
      />

      {/* FLOATING ACTION BUTTON (SPEED DIAL) FOR STAFF */}
      {userRole === 'STAFF' && (
        <View style={[styles.fabContainer, { bottom: 24 + insets.bottom }]}>
          {fabExpanded && (
            <View style={styles.fabMenu}>
              <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabExpanded(false); setFormVisible(true); }}>
                <Text style={styles.fabMenuLabel}>Tambah Sapi</Text>
                <View style={[styles.fabIconBtn, { backgroundColor: COLORS.primary }]}>
                  <Plus size={20} color={COLORS.white} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabExpanded(false); setWasteModalVisible(true); }}>
                <Text style={styles.fabMenuLabel}>Manajemen Limbah</Text>
                <View style={[styles.fabIconBtn, { backgroundColor: '#d97706' }]}>
                  <Trash2 size={20} color={COLORS.white} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabExpanded(false); setWeightModalVisible(true); }}>
                <Text style={styles.fabMenuLabel}>Timbang Berat</Text>
                <View style={[styles.fabIconBtn, { backgroundColor: '#2563eb' }]}>
                  <Scale size={20} color={COLORS.white} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fabMenuItem} onPress={() => { setFabExpanded(false); setFeedModalVisible(true); }}>
                <Text style={styles.fabMenuLabel}>Beri Pakan Massal</Text>
                <View style={[styles.fabIconBtn, { backgroundColor: '#10b981' }]}>
                  <Beef size={20} color={COLORS.white} />
                </View>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity 
            style={[styles.fabMainBtn, fabExpanded && { backgroundColor: '#ef4444' }]} 
            onPress={() => setFabExpanded(!fabExpanded)}
            activeOpacity={0.8}
          >
            <Plus size={28} color={COLORS.white} style={fabExpanded ? { transform: [{ rotate: '45deg' }] } : undefined} />
          </TouchableOpacity>
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
  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: SPACING.lg,
    marginTop: 0,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    height: 50,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 16,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cattleId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  breed: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  nutritionBox: {
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  nutritionLabel: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  nutritionValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#d97706',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtnOutlineFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  vitals: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  vitalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vitalText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: COLORS.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalScroll: {
    paddingBottom: SPACING.xl,
  },
  infoAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: SPACING.md,
  },
  infoAlertText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
  },
  formSectionBox: {
    backgroundColor: '#f8fafc',
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: SPACING.md,
  },
  sectionBoxTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  inputField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.text,
  },
  unitLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
  },
  selectorSection: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  selectAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  selectAllBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: COLORS.primary,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  selectAllTextActive: {
    color: COLORS.primary,
  },
  cowSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cowSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  cowSelectCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: COLORS.primary,
  },
  cowSelectId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  cowSelectIdActive: {
    color: COLORS.primary,
  },
  checkIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitGroupBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.md,
  },
  submitGroupBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  pickerFakeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
    justifyContent: 'space-between',
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
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
  },
  pickerFakeText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  pickerFakeTextActive: {
    color: '#d97706',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'flex-end',
    zIndex: 999,
  },
  fabMenu: {
    alignItems: 'flex-end',
    marginBottom: 16,
    gap: 16,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabMenuLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    ...SHADOWS.sm,
    overflow: 'hidden'
  },
  fabIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  fabMainBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
});

export default LivestockScreen;
