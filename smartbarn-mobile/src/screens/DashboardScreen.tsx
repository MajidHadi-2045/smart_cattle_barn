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
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { 
  LayoutDashboard, 
  LogOut, 
  Thermometer, 
  Droplets, 
  Wind, 
  Beef, 
  HeartPulse, 
  Utensils,
  FileBarChart,
  Users,
  CheckCircle,
  Circle,
  Calendar,
  Edit,
  Trash2,
  X,
  Scale,
  ListTodo,
  History,
  Activity
} from 'lucide-react-native';
import { Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const DashboardScreen = ({ navigation }: any) => {
  const [refreshing, setRefreshing] = useState(false);
  const { data: socketData, isConnected } = useSocket(['websocket:environment', 'websocket:windspeed']);
  const [stats, setStats] = useState<{
    totalCattle: number;
    avgTemp: number | null;
    avgHumidity: number | null;
    windSpeed: number | null;
    activeAlerts: number;
  }>({
    totalCattle: 0,
    avgTemp: null,
    avgHumidity: null,
    windSpeed: null,
    activeAlerts: 0
  });
  const [user, setUser] = useState<any>(null);
  
  // Performance Chart State
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [performanceRange, setPerformanceRange] = useState('minggu');
  const [isDummyChart, setIsDummyChart] = useState(false);

  // Daily Checklist & Input History States
  const [checklist, setChecklist] = useState<any>({
    feedTask: { done: false, count: 0, title: 'Pencatatan Pakan', subtitle: 'Memuat...' },
    wasteTask: { done: false, count: 0, title: 'Pencatatan Limbah', subtitle: 'Memuat...' },
    weightTask: { done: false, pendingCows: 0, title: 'Penimbangan Sapi', subtitle: 'Memuat...' }
  });
  const [recentInputs, setRecentInputs] = useState<any[]>([]);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [editValue2, setEditValue2] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [lastEnvTimestamp, setLastEnvTimestamp] = useState<number>(0);
  const [lastWindTimestamp, setLastWindTimestamp] = useState<number>(0);

  // Update stats saat ada data baru dari socket
  useEffect(() => {
    if (socketData['websocket:environment']) {
      const { temperature, humidity } = socketData['websocket:environment'];
      setLastEnvTimestamp(Date.now());
      setStats(prev => ({
        ...prev,
        avgTemp: temperature !== undefined ? temperature : prev.avgTemp,
        avgHumidity: humidity !== undefined ? humidity : prev.avgHumidity
      }));
    }
    if (socketData['websocket:windspeed']) {
      const { windspeed } = socketData['websocket:windspeed'];
      setLastWindTimestamp(Date.now());
      setStats(prev => ({
        ...prev,
        windSpeed: windspeed !== undefined ? windspeed : prev.windSpeed
      }));
    }
  }, [socketData]);

  // Efek interval untuk mendeteksi matinya data sensor lingkungan (stale) setelah 70 detik
  useEffect(() => {
    const checkStale = setInterval(() => {
      const now = Date.now();
      setStats(prev => {
        let nextAvgTemp = prev.avgTemp;
        let nextAvgHumidity = prev.avgHumidity;
        let nextWindSpeed = prev.windSpeed;

        if (now - lastEnvTimestamp > 70000) {
          nextAvgTemp = null;
          nextAvgHumidity = null;
        }
        if (now - lastWindTimestamp > 70000) {
          nextWindSpeed = null;
        }

        if (nextAvgTemp === prev.avgTemp && nextAvgHumidity === prev.avgHumidity && nextWindSpeed === prev.windSpeed) {
          return prev;
        }

        return {
          ...prev,
          avgTemp: nextAvgTemp,
          avgHumidity: nextAvgHumidity,
          windSpeed: nextWindSpeed
        };
      });
    }, 5000);

    return () => clearInterval(checkStale);
  }, [lastEnvTimestamp, lastWindTimestamp]);

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/dashboard/summary');
      const farmData = response.data;
      setStats(prev => ({
        ...prev,
        totalCattle: farmData.total || 0,
        activeAlerts: farmData.sakit || 0
      }));
      
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setUser(JSON.parse(userStr));
      
      // Fetch Performance Chart
      const perfRes = await apiClient.get(`/livestock/performance-chart?period=${performanceRange}`);
      if (perfRes.data?.data) {
        setPerformanceData(perfRes.data.data);
        setIsDummyChart(perfRes.data.isDummy);
      } else {
        setPerformanceData(perfRes.data || []);
        setIsDummyChart(false);
      }

      // Fetch Daily Checklist
      try {
        const checklistRes = await apiClient.get('/dashboard/daily-checklist');
        if (checklistRes.data) {
          setChecklist(checklistRes.data);
        }
      } catch (err) {
        console.warn('Error fetching daily checklist:', err);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchRecentInputs = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.get('/livestock/recent-inputs');
      if (res.data) setRecentInputs(res.data);
    } catch (err) {
      console.warn('Error fetching recent inputs:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleEditItem = (item: any) => {
    setSelectedItemForEdit(item);
    if (item.type === 'PAKAN') {
      setEditValue(item.raw.weightKg.toString());
    } else if (item.type === 'TIMBANGAN') {
      setEditValue(item.raw.weight.toString());
    } else if (item.type === 'LIMBAH' || item.type === 'LIMBAH_KANDANG') {
      setEditValue(item.raw.fecesKg.toString());
      setEditValue2(item.raw.urineL.toString());
    }
    setIsEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!selectedItemForEdit) return;
    try {
      const id = selectedItemForEdit.id;
      if (selectedItemForEdit.type === 'PAKAN') {
        await apiClient.patch(`/livestock/feed/${id}`, { weightKg: parseFloat(editValue) });
      } else if (selectedItemForEdit.type === 'TIMBANGAN') {
        await apiClient.patch(`/livestock/weight/${id}`, { weight: parseFloat(editValue) });
      } else if (selectedItemForEdit.type === 'LIMBAH') {
        await apiClient.patch(`/livestock/waste/${id}`, { fecesKg: parseFloat(editValue), urineL: parseFloat(editValue2) });
      } else if (selectedItemForEdit.type === 'LIMBAH_KANDANG') {
        await apiClient.patch(`/livestock/waste/zone/${id}`, { fecesKg: parseFloat(editValue), urineL: parseFloat(editValue2) });
      }
      
      Alert.alert('Sukses', 'Data berhasil diperbarui!');
      setIsEditModalVisible(false);
      fetchRecentInputs();
      fetchData(); // Refresh stats & checklist
    } catch (err) {
      Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan data.');
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
              fetchData();
            } catch (err) {
              Alert.alert('Gagal', 'Gagal menghapus data.');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    fetchData();
  }, [performanceRange]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchData().then(() => setRefreshing(false));
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.replace('Login');
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statInfo}>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Icon size={24} color={color} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.greeting}>Halo, {user?.name || 'Peternak'}!</Text>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? COLORS.success : COLORS.danger }]} />
          </View>
          <Text style={styles.date}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* CHECKLIST HARIAN & RIWAYAT INPUT */}
        <View style={styles.checklistCard}>
          <View style={styles.checklistHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ListTodo size={20} color={COLORS.primary} />
              <Text style={styles.checklistTitle}>Tugas Harian Operator</Text>
            </View>
            <View style={styles.checklistDateBadge}>
              <Calendar size={12} color={COLORS.textLight} />
              <Text style={styles.checklistDateText}>Hari Ini</Text>
            </View>
          </View>

          <View style={styles.checklistItems}>
            {/* 1. PAKAN */}
            <View style={styles.checkItem}>
              <View style={styles.checkIconWrapper}>
                {checklist.feedTask?.done ? (
                  <CheckCircle size={22} color={COLORS.success} />
                ) : (
                  <Circle size={22} color="#94a3b8" />
                )}
              </View>
              <View style={styles.checkTextWrapper}>
                <Text style={[styles.checkTextTitle, checklist.feedTask?.done && styles.checkTextDone]}>
                  {checklist.feedTask?.title || 'Pencatatan Pakan'}
                </Text>
                <Text style={styles.checkTextSubtitle}>{checklist.feedTask?.subtitle}</Text>
              </View>
            </View>

            {/* 2. LIMBAH */}
            <View style={styles.checkItem}>
              <View style={styles.checkIconWrapper}>
                {checklist.wasteTask?.done ? (
                  <CheckCircle size={22} color={COLORS.success} />
                ) : (
                  <Circle size={22} color="#94a3b8" />
                )}
              </View>
              <View style={styles.checkTextWrapper}>
                <Text style={[styles.checkTextTitle, checklist.wasteTask?.done && styles.checkTextDone]}>
                  {checklist.wasteTask?.title || 'Pencatatan Limbah'}
                </Text>
                <Text style={styles.checkTextSubtitle}>{checklist.wasteTask?.subtitle}</Text>
              </View>
            </View>

            {/* 3. TIMBANGAN */}
            <View style={styles.checkItem}>
              <View style={styles.checkIconWrapper}>
                {checklist.weightTask?.done ? (
                  <CheckCircle size={22} color={COLORS.success} />
                ) : (
                  <Circle size={22} color="#94a3b8" />
                )}
              </View>
              <View style={styles.checkTextWrapper}>
                <Text style={[styles.checkTextTitle, checklist.weightTask?.done && styles.checkTextDone]}>
                  {checklist.weightTask?.title || 'Penimbangan Sapi'}
                </Text>
                <Text style={styles.checkTextSubtitle}>{checklist.weightTask?.subtitle}</Text>
              </View>
            </View>
          </View>

          {/* TOMBOL PENGELOLAAN INPUT */}
          <TouchableOpacity 
            style={styles.historyBtn} 
            onPress={() => {
              fetchRecentInputs();
              setIsHistoryModalVisible(true);
            }}
          >
            <History size={16} color={COLORS.primary} />
            <Text style={styles.historyBtnText}>Lihat & Koreksi Salah Input Data</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Ringkasan Kandang</Text>
        
        <View style={styles.statsGrid}>
          <StatCard 
            title="Total Sapi" 
            value={stats.totalCattle} 
            icon={Beef} 
            color="#3b82f6" 
          />
          <StatCard 
            title="Suhu Rata-rata" 
            value={stats.avgTemp !== null ? `${stats.avgTemp}°C` : '--'} 
            icon={Thermometer} 
            color="#ef4444" 
          />
          <StatCard 
            title="Kelembaban" 
            value={stats.avgHumidity !== null ? `${stats.avgHumidity}%` : '--'} 
            icon={Droplets} 
            color="#10b981" 
          />
          <StatCard 
            title="Kecepatan Angin" 
            value={stats.windSpeed !== null ? `${stats.windSpeed} m/s` : '--'} 
            icon={Wind} 
            color="#f59e0b" 
          />
        </View>

        {/* GRAFIK PERFORMA */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Korelasi Performa</Text>
                {isDummyChart && (
                  <View style={styles.dummyBadge}>
                    <Text style={styles.dummyText}>DUMMY</Text>
                  </View>
                )}
              </View>
              <Text style={styles.chartSubtitle}>BK vs Bobot vs Limbah vs THI</Text>
            </View>
            <View style={styles.rangeSelector}>
              <TouchableOpacity onPress={() => setPerformanceRange('hari')} style={[styles.rangeBtn, performanceRange === 'hari' && styles.rangeBtnActive]}>
                <Text style={[styles.rangeBtnText, performanceRange === 'hari' && styles.rangeBtnTextActive]}>Hari</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPerformanceRange('minggu')} style={[styles.rangeBtn, performanceRange === 'minggu' && styles.rangeBtnActive]}>
                <Text style={[styles.rangeBtnText, performanceRange === 'minggu' && styles.rangeBtnTextActive]}>Mgg</Text>
              </TouchableOpacity>
            </View>
          </View>

          {performanceData.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: performanceData.map(d => {
                    const date = new Date(d.date);
                    return `${date.getDate()}/${date.getMonth()+1}`;
                  }),
                  datasets: [
                    { data: performanceData.map(d => d.bk), color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`, strokeWidth: 2 },
                    { data: performanceData.map(d => d.weightGain), color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, strokeWidth: 2 },
                    { data: performanceData.map(d => d.waste), color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, strokeWidth: 2 }
                  ],
                  legend: ["BK (kg)", "ADG (kg)", "Limbah"]
                }}
                width={Math.max(Dimensions.get("window").width - SPACING.lg * 2, performanceData.length * 50)}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                yAxisInterval={1}
                chartConfig={{
                  backgroundColor: COLORS.white,
                  backgroundGradientFrom: COLORS.white,
                  backgroundGradientTo: COLORS.white,
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "3", strokeWidth: "1", stroke: "#fff" }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </ScrollView>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.chartSubtitle}>Belum ada data performa</Text>
            </View>
          )}
        </View>

        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Menu Utama</Text>
          <View style={styles.menuGrid}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Livestock')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#dcfce7' }]}>
                <Beef color="#166534" size={28} />
              </View>
              <Text style={styles.menuText}>Data Ternak</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Environment')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#dbeafe' }]}>
                <LayoutDashboard color="#1e40af" size={28} />
              </View>
              <Text style={styles.menuText}>Monitoring</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Health')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
                <HeartPulse color="#92400e" size={28} />
              </View>
              <Text style={styles.menuText}>Rekam Medis</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Feed')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#f3e8ff' }]}>
                <Utensils color="#6b21a8" size={28} />
              </View>
              <Text style={styles.menuText}>Silo Pakan</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Reports')}
            >
              <View style={[styles.menuIcon, { backgroundColor: '#ffe4e6' }]}>
                <FileBarChart color="#be123c" size={28} />
              </View>
              <Text style={styles.menuText}>Laporan</Text>
            </TouchableOpacity>

            {user?.role === 'SUPER_ADMIN' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('UserManagement')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#e0f2fe' }]}>
                  <Users color="#0369a1" size={28} />
                </View>
                <Text style={styles.menuText}>Pengguna</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      {/* ========================================== */}
      {/* 1. MODAL RIWAYAT INPUT TERBARU (HISTORY) */}
      {/* ========================================== */}
      <Modal
        visible={isHistoryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <History size={22} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Koreksi Input Data</Text>
              </View>
              <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Daftar input pakan, timbangan, & limbah terbaru. Klik koreksi/hapus untuk membetulkan.</Text>

            {loadingHistory ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ marginTop: 8, color: COLORS.textLight }}>Memuat riwayat...</Text>
              </View>
            ) : recentInputs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <History size={40} color="#cbd5e1" style={{ marginBottom: 8 }} />
                <Text style={{ color: COLORS.textLight, textAlign: 'center' }}>Belum ada data input terbaru.</Text>
              </View>
            ) : (
              <ScrollView style={styles.historyList}>
                {recentInputs.map((item, idx) => (
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
                           {item.type === 'LIMBAH_KANDANG' ? `Kandang: ${item.zoneName}` : `Sapi: ${item.cattleId}`}
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
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* 2. MODAL FORM EDIT / KOREKSI DATA */}
      {/* ========================================== */}
      <Modal
        visible={isEditModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Koreksi Data {selectedItemForEdit?.type === 'LIMBAH_KANDANG' ? 'Limbah Kandang' : selectedItemForEdit?.type}</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <Text style={styles.editLabel}>
                {selectedItemForEdit?.type === 'LIMBAH_KANDANG' ? `Kandang: ${selectedItemForEdit?.zoneName}` : `Sapi: ${selectedItemForEdit?.cattleId}`}
              </Text>
              
              {selectedItemForEdit?.type === 'PAKAN' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Berat Pakan (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={editValue}
                    onChangeText={setEditValue}
                    keyboardType="decimal-pad"
                    placeholder="Masukkan berat pakan baru"
                  />
                </View>
              )}

              {selectedItemForEdit?.type === 'TIMBANGAN' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Berat Sapi (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={editValue}
                    onChangeText={setEditValue}
                    keyboardType="decimal-pad"
                    placeholder="Masukkan berat sapi baru"
                  />
                </View>
              )}

              {(selectedItemForEdit?.type === 'LIMBAH' || selectedItemForEdit?.type === 'LIMBAH_KANDANG') && (
                <View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Feces (kg)</Text>
                    <TextInput
                      style={styles.input}
                      value={editValue}
                      onChangeText={setEditValue}
                      keyboardType="decimal-pad"
                      placeholder="Feces baru"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Urine (L)</Text>
                    <TextInput
                      style={styles.input}
                      value={editValue2}
                      onChangeText={setEditValue2}
                      keyboardType="decimal-pad"
                      placeholder="Urine baru"
                    />
                  </View>
                </View>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalCancelBtn]} 
                  onPress={() => setIsEditModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalSaveBtn]} 
                  onPress={saveEdit}
                >
                  <Text style={styles.modalSaveBtnText}>Simpan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  date: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  logoutButton: {
    padding: SPACING.sm,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statIconContainer: {
    padding: SPACING.sm,
    borderRadius: 8,
  },
  menuContainer: {
    marginTop: SPACING.sm,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '23%',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  menuIcon: {
    width: 60,
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  menuText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 16,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  chartSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  dummyBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  dummyText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#d97706',
  },
  rangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  rangeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rangeBtnActive: {
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  rangeBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  rangeBtnTextActive: {
    color: COLORS.primary,
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Checklist Card Styles
  checklistCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 16,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: SPACING.sm,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  checklistDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  checklistDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  checklistItems: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkTextWrapper: {
    flex: 1,
  },
  checkTextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  checkTextDone: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  checkTextSubtitle: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  historyBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: SPACING.sm,
  },
  historyBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  editModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyList: {
    maxHeight: 400,
  },
  historyCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCardBody: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  historyCattleId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  historyDetails: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    marginVertical: 2,
  },
  historyDate: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  historyActions: {
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  editActionBtn: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  deleteActionBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  editForm: {
    marginTop: SPACING.sm,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: SPACING.lg,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  modalCancelBtn: {
    backgroundColor: '#f1f5f9',
  },
  modalCancelBtnText: {
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.primary,
  },
  modalSaveBtnText: {
    fontWeight: 'bold',
    color: COLORS.white,
  }
});

export default DashboardScreen;
