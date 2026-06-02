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
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Calendar
} from 'lucide-react-native';
import apiClient from '../api/client';
import LivestockFormModal from '../components/LivestockFormModal';
import CustomModal from '../components/CustomModal';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';

const LivestockScreen = ({ navigation }: any) => {
  const [livestock, setLivestock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [selectedFeedWeightCows, setSelectedFeedWeightCows] = useState<string[]>([]);
  const [selectFeedWeightAll, setSelectFeedWeightAll] = useState(false);
  const [feedGoal, setFeedGoal] = useState(1);

  const fetchLivestock = async () => {
    try {
      const [liveRes, checklistRes, zonesRes] = await Promise.all([
        apiClient.get('/livestock'),
        apiClient.get('/dashboard/daily-checklist').catch(() => null),
        apiClient.get('/zones').catch(() => ({ data: [] }))
      ]);
      setLivestock(liveRes.data);
      if (checklistRes && checklistRes.data?.config) {
        setFeedGoal(checklistRes.data.config.feedGoal || 1);
      }
      setZones(zonesRes.data || []);
    } catch (error) {
      console.error('Error fetching livestock:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLivestock();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLivestock();
  };

  const handleAdd = async (data: any) => {
    setLoading(true);
    try {
      await apiClient.post('/livestock', data);
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sehat': return COLORS.success;
      case 'sakit': return COLORS.danger;
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

      if (concentrateRatio === 999) {
        totalTmrAsFed += bkReq / (forageDM / 100);
      } else {
        if (forageRatio > 0) {
          totalForageAsFed += (bkReq * (forageRatio / 100)) / (forageDM / 100);
        }
        if (concentrateRatio > 0) {
          totalConcentrateAsFed += (bkReq * (concentrateRatio / 100)) / (concentrateDM / 100);
        }
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

      targetIds.forEach(cowId => {
        promises.push(
          apiClient.post('/livestock/feed', {
            cattleId: cowId,
            feedType: groupFeedType,
            weightKg: parseFloat(groupFeedWeight),
            bkPercent: computedBkPercent
          })
        );
      });

      await Promise.all(promises);
      showToast(`Berhasil mencatat pemberian pakan untuk ${targetIds.length} ekor sapi!`, 'success');
      
      setFeedModalVisible(false);
      setGroupFeedWeight('');
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
      onPress={() => navigation.navigate('LivestockDetail', { id: item.dbId })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.idContainer}>
          <Beef size={18} color={COLORS.primary} />
          <Text style={styles.cattleId}>{item.cattleId}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.healthStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.healthStatus) }]}>
            {item.healthStatus || 'N/A'}
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

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionBtnOutlineFull}
          onPress={() => navigation.navigate('LivestockDetail', { id: item.dbId })}
        >
          <Settings size={14} color={COLORS.primary} />
          <Text style={[styles.actionBtnText, {color: COLORS.primary}]}>Detail & Target Nutrisi</Text>
        </TouchableOpacity>
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

      {/* Action Bar for Collective Operations */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarRow}>
          <TouchableOpacity 
            style={styles.wasteGroupBtn} 
            onPress={() => setWasteModalVisible(true)}
          >
            <Trash2 size={15} color={COLORS.white} />
            <Text style={styles.actionBtnTextWhite}>Limbah Kelompok</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionBarRow}>
          <TouchableOpacity 
            style={styles.weightGroupBtn} 
            onPress={() => setWeightModalVisible(true)}
          >
            <Scale size={15} color={COLORS.white} />
            <Text style={styles.actionBtnTextWhite}>Timbang Kelompok</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.feedGroupBtn} 
            onPress={() => setFeedModalVisible(true)}
          >
            <Beef size={15} color={COLORS.white} />
            <Text style={styles.actionBtnTextWhite}>Pakan Kelompok</Text>
          </TouchableOpacity>
        </View>
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
          data={filteredLivestock}
          renderItem={LivestockCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Tidak ada data sapi ditemukan</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button - Tambah Sapi */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setFormVisible(true)}
      >
        <Plus size={30} color={COLORS.white} />
      </TouchableOpacity>

      {/* MODAL 1: COLLECTIVE WASTE LOGGING */}
      <Modal visible={wasteModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
      </Modal>

      {/* MODAL 2: COLLECTIVE WEIGHT LOGGING */}
      <Modal visible={weightModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Timbang Kelompok</Text>
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

                <View style={styles.cowSelectGrid}>
                  {livestock.map(cow => {
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
                <Text style={styles.submitGroupBtnText}>Simpan Timbang Kelompok</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: COLLECTIVE FEED LOGGING */}
      <Modal visible={feedModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pemberian Pakan Kelompok</Text>
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

                <View style={{ marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Berat Pakan (Kg per Sapi)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contoh: 12.5"
                    keyboardType="numeric"
                    value={groupFeedWeight}
                    onChangeText={setGroupFeedWeight}
                  />
                  <Text style={styles.unitLabel}>Masukkan porsi makan per sapi</Text>
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
                            Porsi per Sapi ({feedGoal}x): H: {(recs.totalForageAsFed / (cowCount * feedGoal)).toFixed(2)} kg | K: {(recs.totalConcentrateAsFed / (cowCount * feedGoal)).toFixed(2)} kg
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
                          <Text style={{ fontSize: 11, color: COLORS.textLight }}>Total Harian (Per Sapi):</Text>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{recPerCow.toFixed(2)} kg</Text>
                        </View>
                        {feedGoal > 1 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#059669' }}>Porsi 1x (Per Sapi):</Text>
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
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af' }}>🎯 Harian ({recPerCow.toFixed(2)} kg)</Text>
                      </TouchableOpacity>
                      
                      {feedGoal > 1 && (
                        <TouchableOpacity 
                          style={{ flex: 1, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingVertical: 6, borderRadius: 6, alignItems: 'center' }}
                          onPress={() => setGroupFeedWeight(recPerCowSession.toFixed(2))}
                        >
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#065f46' }}>🎯 Porsi 1x ({recPerCowSession.toFixed(2)} kg)</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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

                <View style={styles.cowSelectGrid}>
                  {livestock.map(cow => {
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
      </Modal>

      <LivestockFormModal 
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSubmit={handleAdd}
        loading={loading}
      />

      <CustomModal 
        visible={modalConfig.visible}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
      />
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
  actionBar: {
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  actionBarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  wasteGroupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d97706',
    borderRadius: 12,
    height: 40,
    ...SHADOWS.sm
  },
  weightGroupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 40,
    ...SHADOWS.sm
  },
  feedGroupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 12,
    height: 40,
    ...SHADOWS.sm
  },
  actionBtnTextWhite: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 12
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
    gap: 6,
    marginBottom: 6,
  },
  pickerFakeItem: {
    flex: 1,
    minWidth: '45%',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
});

export default LivestockScreen;
