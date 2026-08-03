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
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { useReadingMode } from '../context/ReadingModeContext';
import { 
  LayoutDashboard, 
  LogOut, 
  Bell, 
  Clock,
  Thermometer, 
  Droplets, 
  Wind, 
  Beef, 
  HeartPulse, 
  Utensils,
  FileBarChart,
  Users,
  CheckCircle,
  Leaf,
  Circle,
  Calendar,
  Edit,
  Trash2,
  X,
  Scale,
  ListTodo,
  History,
  Activity,
  User,
  AlertTriangle,
  ClipboardList,
  Moon,
  Sun,
  Download,
  ChevronDown,
  Filter,
  Info
} from 'lucide-react-native';
import { Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const formatNotificationTime = (timestamp?: string | number | Date) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = dNow.getTime() - dDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  
  if (diffDays === 0) {
    return `Hari ini, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Kemarin, ${timeStr}`;
  } else {
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const month = months[date.getMonth()];
    return `${day} ${month}, ${timeStr}`;
  }
};

const DashboardScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const { isReadingMode, toggleReadingMode } = useReadingMode();
  const { data: socketData, isConnected } = useSocket(['websocket:environment', 'websocket:windspeed', 'websocket:alert']);
  const [stats, setStats] = useState<{
    totalCattle: number;
    avgTemp: number | null;
    avgHumidity: number | null;
    windSpeed: number | null;
    ammonia: number | null;
    thi: number | null;
    activeAlerts: number;
  }>({
    totalCattle: 0,
    avgTemp: null,
    avgHumidity: null,
    windSpeed: null,
    ammonia: null,
    thi: null,
    activeAlerts: 0
  });
  const [user, setUser] = useState<any>(null);
  
  // Performance Chart State
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [performanceSummaries, setPerformanceSummaries] = useState<any[]>([]);
  const [performanceRange, setPerformanceRange] = useState('minggu');
  const [isDummyChart, setIsDummyChart] = useState(false);
  const [livestock, setLivestock] = useState<any[]>([]);
  const [selectedChartCows, setSelectedChartCows] = useState<string[]>([]);
  const [selectedTableCows, setSelectedTableCows] = useState<string[]>([]);
  const [selectedCowsForChart, setSelectedCowsForChart] = useState<string[]>([]);
  const [isCowSelectModalVisible, setIsCowSelectModalVisible] = useState(false);
  const [isTableSelectModalVisible, setIsTableSelectModalVisible] = useState(false);
  const [searchChartText, setSearchChartText] = useState('');
  const [searchTableText, setSearchTableText] = useState('');

  // Daily Checklist & Input History States
  const [checklist, setChecklist] = useState<any>({
    feedTask: { done: false, count: 0, title: 'Pencatatan Pakan', subtitle: 'Memuat...' },
    wasteTask: { done: false, count: 0, title: 'Pencatatan Limbah', subtitle: 'Memuat...' },
    weightTask: { done: false, pendingCows: 0, title: 'Penimbangan Sapi', subtitle: 'Memuat...' }
  });
  const [recentInputs, setRecentInputs] = useState<any[]>([]);
  
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Notification States
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  // Environment & Waste States
  const [wasteStats, setWasteStats] = useState({ fecesKg: 0, urineL: 0 });
  const [wasteFilter, setWasteFilter] = useState('daily');
  const [sensorTrendData, setSensorTrendData] = useState<any[]>([]);
  const [windTrendData, setWindTrendData] = useState<any[]>([]);
  const [sensorTrendRange, setSensorTrendRange] = useState('24h');


  useEffect(() => {
    if (socketData['websocket:alert']) {
      const payload = socketData['websocket:alert'];
      const newNotif = {
        id: Date.now(),
        title: payload.title,
        body: payload.body,
        time: formatNotificationTime(payload.timestamp || Date.now())
      };
      setNotifications(prev => [newNotif, ...prev].slice(0, 10));
      setUnreadNotifCount(prev => prev + 1);
      
      Alert.alert(payload.title, payload.body);
      
      // Reset socket data to prevent infinite loop
      socketData['websocket:alert'] = null;
    }
  }, [socketData]);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [editValue2, setEditValue2] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [lastEnvTimestamp, setLastEnvTimestamp] = useState<number>(0);
  const [lastWindTimestamp, setLastWindTimestamp] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const isDataLive = isConnected && lastEnvTimestamp > 0 && (currentTime - lastEnvTimestamp < 70000);

  // Update stats saat ada data baru dari socket
  useEffect(() => {
    if (socketData['websocket:environment']) {
      const { temperature, humidity, ammonia, thi } = socketData['websocket:environment'];
      setLastEnvTimestamp(Date.now());
      setStats(prev => ({
        ...prev,
        avgTemp: temperature !== undefined ? temperature : prev.avgTemp,
        avgHumidity: humidity !== undefined ? humidity : prev.avgHumidity,
        ammonia: ammonia !== undefined ? ammonia : prev.ammonia,
        thi: thi !== undefined ? thi : prev.thi
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
        let nextThi = prev.thi;

        if (now - lastEnvTimestamp > 300000) {
          nextAvgTemp = null;
          nextAvgHumidity = null;
          nextThi = null;
        }
        if (now - lastWindTimestamp > 300000) {
          nextWindSpeed = null;
        }

        if (nextAvgTemp === prev.avgTemp && nextAvgHumidity === prev.avgHumidity && nextWindSpeed === prev.windSpeed && nextThi === prev.thi) {
          return prev;
        }

        return {
          ...prev,
          avgTemp: nextAvgTemp,
          avgHumidity: nextAvgHumidity,
          windSpeed: nextWindSpeed,
          thi: nextThi
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
    } catch (err) {
      console.warn('Error fetching dashboard summary:', err);
    }
    
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) setUser(JSON.parse(userStr));
    } catch (err) {
      console.warn('Error getting user from storage:', err);
    }
    
    try {
      const cowsRes = await apiClient.get('/livestock');
      if (cowsRes.data) setLivestock(cowsRes.data);
    } catch (err) {
      console.warn('Error fetching livestock:', err);
    }

    try {
      const liveEnvRes = await apiClient.get('/environment/live/1');
      if (liveEnvRes.data) {
        setStats(prev => ({
          ...prev,
          avgTemp: liveEnvRes.data.temperature !== undefined ? liveEnvRes.data.temperature : prev.avgTemp,
          avgHumidity: liveEnvRes.data.humidity !== undefined ? liveEnvRes.data.humidity : prev.avgHumidity,
          ammonia: liveEnvRes.data.ammonia !== undefined ? liveEnvRes.data.ammonia : prev.ammonia,
          thi: liveEnvRes.data.thi !== undefined ? liveEnvRes.data.thi : prev.thi
        }));
        setLastEnvTimestamp(Date.now());
      }
    } catch (err) {
      // Abaikan error jika data tidak tersedia (misal 404 saat awal mula)
    }

    try {
      const liveWindRes = await apiClient.get('/environment/live-wind/1');
      if (liveWindRes.data && liveWindRes.data.windspeed !== undefined) {
        setStats(prev => ({
          ...prev,
          windSpeed: liveWindRes.data.windspeed
        }));
        setLastWindTimestamp(Date.now());
      }
    } catch (err) {}

    // Fetch Waste
    try {
      const wasteRes = await apiClient.get(`/dashboard/waste?filter=${wasteFilter}`);
      if (wasteRes.data) {
        setWasteStats({ fecesKg: wasteRes.data.fecesKg || 0, urineL: wasteRes.data.urineL || 0 });
      }
    } catch (e) {}

    // Fetch Trend Environment
    try {
      const trendRes = await apiClient.get(`/environment/trend/1?range=${sensorTrendRange}`);
      if (trendRes.data && Array.isArray(trendRes.data)) {
        // API returns desc, we reverse to asc, take 15 points
        const chronological = [...trendRes.data].reverse();
        setSensorTrendData(chronological.slice(-15));
      }
    } catch (e) {}

    // Fetch Trend Wind
    try {
      const windRes = await apiClient.get(`/wind/trend/1?range=${sensorTrendRange}`);
      if (windRes.data && Array.isArray(windRes.data)) {
        const chronologicalWind = [...windRes.data].reverse();
        setWindTrendData(chronologicalWind.slice(-15));
      } else {
          // fallback if wind trend fails or uses different path
          const windResFallback = await apiClient.get(`/environment/wind/trend/1?range=${sensorTrendRange}`);
          if (windResFallback.data && Array.isArray(windResFallback.data)) {
              const chronologicalWind = [...windResFallback.data].reverse();
              setWindTrendData(chronologicalWind.slice(-15));
          }
      }
    } catch (e) {}

    // Fetch Notifications History
    try {
      const notifRes = await apiClient.get('/dashboard/notifications');
      if (notifRes.data && Array.isArray(notifRes.data)) {
        const formattedNotifs = notifRes.data.map((n: any) => ({
          id: n.id || Date.now(),
          title: n.title,
          body: n.body,
          time: formatNotificationTime(n.timestamp || Date.now())
        }));
        setNotifications(formattedNotifs);
        setUnreadNotifCount(formattedNotifs.length);
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
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
  }, [sensorTrendRange]);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        if (selectedChartCows.length === 0) {
          setPerformanceData([]);
          setIsDummyChart(false);
        } else {
          const chartCowIdParam = `&cowId=${selectedChartCows.join(',')}`;
          const chartRes = await apiClient.get(`/livestock/performance-chart?period=${performanceRange}${chartCowIdParam}`);
          if (chartRes.data?.data) {
            setPerformanceData(chartRes.data.data);
            setIsDummyChart(chartRes.data.isDummy);
            setSelectedCowsForChart(selectedChartCows);
          } else {
            setPerformanceData(chartRes.data || []);
            setIsDummyChart(false);
            setSelectedCowsForChart(selectedChartCows);
          }
        }

        if (selectedTableCows.length === 0) {
          setPerformanceSummaries([]);
        } else {
          const tableCowIdParam = `&cowId=${selectedTableCows.join(',')}`;
          const tableRes = await apiClient.get(`/livestock/performance-chart?period=${performanceRange}${tableCowIdParam}`);
          if (tableRes.data?.multiSummaries) {
            setPerformanceSummaries(tableRes.data.multiSummaries);
          } else if (tableRes.data?.summaries) {
            setPerformanceSummaries(tableRes.data.summaries);
          } else {
            setPerformanceSummaries([]);
          }
        }
      } catch (e) {
        console.error("Fetch Performance Error", e);
      }
    };
    fetchPerformance();
  }, [performanceRange, selectedChartCows, selectedTableCows]);

  useEffect(() => {
    const fetchWaste = async () => {
      try {
        const wasteRes = await apiClient.get(`/dashboard/waste?filter=${wasteFilter}`);
        if (wasteRes.data) {
          setWasteStats({ fecesKg: wasteRes.data.fecesKg || 0, urineL: wasteRes.data.urineL || 0 });
        }
      } catch (e) {}
    };
    fetchWaste();
  }, [wasteFilter]);


  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      const res = await apiClient.get('/activities/recent');
      setActivities(res.data || []);
    } catch (err) {
      console.log('Error fetching activities');
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/dashboard/notifications');
      if (res.data && Array.isArray(res.data)) {
        const formatted = res.data.map((item: any, idx: number) => ({
          id: item.id || Date.now() + idx,
          title: item.title,
          body: item.body,
          time: formatNotificationTime(item.timestamp)
        }));
        setNotifications(formatted);
      }
    } catch (err) {
      console.log('Error fetching notifications');
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
    fetchData().then(() => setRefreshing(false));
  }, []);

  const [infoModalContent, setInfoModalContent] = useState<{ title: string; desc: string; target?: string } | null>(null);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    navigation.replace('Login');
  };

  const StatCard = ({ title, value, icon: Icon, color, target, infoDesc }: any) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={() => infoDesc && setInfoModalContent({ title, desc: infoDesc, target })}
      activeOpacity={0.7}
    >
      <View style={styles.statInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.statLabel}>{title}</Text>
          {infoDesc && <Info size={11} color={COLORS.textLight} />}
        </View>
        <Text style={styles.statValue}>{value}</Text>
        {target && <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 4 }}>{target}</Text>}
      </View>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Icon size={24} color={color} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.greeting}>Halo, {user?.name || 'Peternak'}!</Text>
            <View 
              style={[styles.statusDot, { backgroundColor: isDataLive ? COLORS.success : COLORS.danger }]} 
            />
          </View>
          <Text style={styles.date}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity onPress={() => { setNotificationModalVisible(true); setUnreadNotifCount(0); }}>
              <View>
                <Bell size={20} color={COLORS.textLight} />
                {unreadNotifCount > 0 && (
                  <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.danger, borderRadius: 10, width: 14, height: 14, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontSize: 8, fontWeight: 'bold' }}>{unreadNotifCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setActivityModalVisible(true); fetchActivities(); }}>
              <Clock size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleReadingMode}>
              {isReadingMode ? <Sun size={20} color={COLORS.primary} /> : <Moon size={20} color={COLORS.textLight} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Ringkasan Kandang</Text>
        
        <View style={styles.statsGrid}>
          <StatCard 
            title="Total Sapi" 
            value={stats.totalCattle} 
            icon={Beef} 
            color="#3b82f6" 
            infoDesc="Jumlah keseluruhan ekor sapi yang terdaftar dalam sistem peternakan saat ini."
          />
          <StatCard 
            title="Kondisi Sehat" 
            value={stats.totalCattle - stats.activeAlerts} 
            icon={HeartPulse} 
            color="#10b981" 
            infoDesc="Jumlah sapi yang dalam kondisi sehat dan tidak memiliki catatan medis aktif."
          />
          <StatCard 
            title="Kondisi Sakit" 
            value={stats.activeAlerts} 
            icon={Activity} 
            color="#ef4444" 
            infoDesc="Jumlah sapi yang sedang mengalami gangguan kesehatan / dalam penanganan medis dokter hewan."
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>Monitoring Lingkungan (Tekan untuk Info)</Text>
        <View style={styles.statsGrid}>
          <StatCard 
            title="Suhu Ruangan" 
            value={stats.avgTemp !== null ? `${stats.avgTemp}°C` : '--'} 
            target="Target: 25-28°C"
            icon={Thermometer} 
            color="#f97316" 
            infoDesc="Suhu ambient udara sekitar area kandang. Target ideal: 25 - 28°C. Suhu udara tinggi dapat memicu stres panas pada sapi."
          />
          <StatCard 
            title="Kelembapan" 
            value={stats.avgHumidity !== null ? `${stats.avgHumidity}%` : '--'} 
            target="Target: 60-80%"
            icon={Droplets} 
            color="#3b82f6" 
            infoDesc="Persentase kelembapan relatif udara (RH) kandang. Target ideal: 60 - 80%. Kelembapan tinggi berisiko memicu pertumbuhan jamur & bakteri."
          />
          <StatCard 
            title="Sirkulasi Angin" 
            value={stats.windSpeed !== null ? `${stats.windSpeed} m/s` : '--'} 
            target="Target: > 1 m/s"
            icon={Wind} 
            color="#0d9488" 
            infoDesc="Kecepatan aliran udara kandang. Target ideal: > 1 m/s. Sirkulasi baik membantu menetralkan hawa panas & membuang amonia racun."
          />
          <StatCard 
            title="Amonia (NH3)" 
            value={stats.ammonia !== null ? `${stats.ammonia} ppm` : '--'} 
            target="Batas: < 20 ppm"
            icon={Leaf} 
            color="#ef4444" 
            infoDesc="Gas racun hasil penguraian feses & urine sapi. Batas aman: < 20 ppm. Amonia > 20 ppm mengiritasi mata & saluran pernapasan sapi."
          />
          <StatCard 
            title="Heat Stress (THI)" 
            value={stats.thi !== null ? stats.thi : '--'} 
            target="Target: < 72"
            icon={CheckCircle} 
            color="#ec4899" 
            infoDesc="Temperature Humidity Index (THI): Indeks kenyamanan termal sapi. <72 Aman, 72-78 Stres Ringan, >79 Stres Berat."
          />
        </View>

        {/* MANAJEMEN LIMBAH */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeaderResponsive}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Trash2 size={18} color={COLORS.primary} />
                <Text style={styles.chartTitle}>Manajemen Limbah</Text>
              </View>
              <Text style={styles.chartSubtitle}>Akumulasi produksi Feses dan Urine</Text>
            </View>
            <View style={styles.rangeSelector}>
              <TouchableOpacity onPress={() => setWasteFilter('daily')} style={[styles.rangeBtn, wasteFilter === 'daily' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, wasteFilter === 'daily' && styles.rangeBtnTextActive]}>Hr</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setWasteFilter('weekly')} style={[styles.rangeBtn, wasteFilter === 'weekly' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, wasteFilter === 'weekly' && styles.rangeBtnTextActive]}>Mg</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setWasteFilter('monthly')} style={[styles.rangeBtn, wasteFilter === 'monthly' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, wasteFilter === 'monthly' && styles.rangeBtnTextActive]}>Bl</Text></TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#fef3c7', padding: 16, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#b45309' }}>{wasteStats.fecesKg}</Text>
              <Text style={{ fontSize: 12, color: '#b45309', marginTop: 4, fontWeight: '500' }}>Feses (Kg)</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#e0f2fe', padding: 16, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0369a1' }}>{wasteStats.urineL}</Text>
              <Text style={{ fontSize: 12, color: '#0369a1', marginTop: 4, fontWeight: '500' }}>Urine (Liter)</Text>
            </View>
          </View>
        </View>

        {/* GRAFIK TREN SENSOR */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeaderResponsive}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Thermometer size={18} color="#f97316" />
                <Text style={styles.chartTitle}>Grafik Tren Sensor</Text>
              </View>
              <Text style={styles.chartSubtitle}>
                {sensorTrendRange === '1h' ? '1 JAM TERAKHIR' : sensorTrendRange === '24h' ? '24 JAM TERAKHIR' : sensorTrendRange === '7d' ? '7 HARI TERAKHIR' : '1 BULAN TERAKHIR'}
              </Text>
            </View>
            <View style={styles.rangeSelector}>
              <TouchableOpacity onPress={() => setSensorTrendRange('1h')} style={[styles.rangeBtn, sensorTrendRange === '1h' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, sensorTrendRange === '1h' && styles.rangeBtnTextActive]}>1J</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSensorTrendRange('24h')} style={[styles.rangeBtn, sensorTrendRange === '24h' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, sensorTrendRange === '24h' && styles.rangeBtnTextActive]}>24J</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSensorTrendRange('7d')} style={[styles.rangeBtn, sensorTrendRange === '7d' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, sensorTrendRange === '7d' && styles.rangeBtnTextActive]}>7H</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSensorTrendRange('30d')} style={[styles.rangeBtn, sensorTrendRange === '30d' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, sensorTrendRange === '30d' && styles.rangeBtnTextActive]}>1B</Text></TouchableOpacity>
            </View>
          </View>
          {sensorTrendData.length > 0 ? (
            <View>
              {/* Legend Gabungan */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8, marginBottom: 8 }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                   <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
                   <Text style={{ fontSize: 10, color: COLORS.textLight }}>Suhu (°C)</Text>
                 </View>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                   <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                   <Text style={{ fontSize: 10, color: COLORS.textLight }}>Kelembapan (%)</Text>
                 </View>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                   <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                   <Text style={{ fontSize: 10, color: COLORS.textLight }}>Amonia (ppm)</Text>
                 </View>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                   <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#06b6d4' }} />
                   <Text style={{ fontSize: 10, color: COLORS.textLight }}>Kecepatan Angin (m/s)</Text>
                 </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={{
                    labels: sensorTrendData.map(d => {
                      const date = new Date(d.timestamp || d.time);
                      if (sensorTrendRange === '1h' || sensorTrendRange === '24h') {
                        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                      }
                      return `${date.getDate()}/${date.getMonth()+1}`;
                    }),
                    datasets: [
                      {
                        data: sensorTrendData.map(d => d.temperature || d.temp || 0),
                        color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`, // Orange
                        strokeWidth: 2
                      },
                      {
                        data: sensorTrendData.map(d => d.humidity || 0),
                        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
                        strokeWidth: 2
                      },
                      {
                        data: sensorTrendData.map(d => d.ammonia || 0),
                        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red
                        strokeWidth: 2
                      },
                      {
                        data: sensorTrendData.map((d, i) => windTrendData[i]?.windspeed || 0),
                        color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`, // Cyan
                        strokeWidth: 2
                      }
                    ]
                  }}
                  width={Math.max(Dimensions.get("window").width - SPACING.lg * 2, sensorTrendData.length * 40)}
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
                    propsForDots: { r: "3", strokeWidth: "2" }
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 16 }}
                />
              </ScrollView>
            </View>
          ) : (
            <View style={{ height: 150, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: COLORS.textLight }}>Belum ada data tren sensor.</Text>
            </View>
          )}
        </View>

        {/* GRAFIK PERFORMA */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>DMI/BK VS ADG</Text>
                {isDummyChart && (
                  <View style={styles.dummyBadge}>
                    <Text style={styles.dummyText}>DUMMY</Text>
                  </View>
                )}
              </View>
              <Text style={styles.chartSubtitle}>Bahan Kering (BK) Konsumsi vs Pertambahan Bobot</Text>
            </View>
            <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <TouchableOpacity 
                style={styles.cowSelectFilterBtn} 
                onPress={() => {
                  setSearchChartText('');
                  setIsCowSelectModalVisible(true);
                }}
              >
                <Text style={styles.cowSelectFilterBtnText}>
                  {selectedChartCows.length > 0 ? `${selectedChartCows.length} Sapi` : 'Pilih Sapi'}
                </Text>
              </TouchableOpacity>
              <View style={styles.rangeSelector}>
                <TouchableOpacity onPress={() => setPerformanceRange('hari')} style={[styles.rangeBtn, performanceRange === 'hari' && styles.rangeBtnActive]}>
                  <Text style={[styles.rangeBtnText, performanceRange === 'hari' && styles.rangeBtnTextActive]}>Hari</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPerformanceRange('minggu')} style={[styles.rangeBtn, performanceRange === 'minggu' && styles.rangeBtnActive]}>
                  <Text style={[styles.rangeBtnText, performanceRange === 'minggu' && styles.rangeBtnTextActive]}>Mgg</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPerformanceRange('bulan')} style={[styles.rangeBtn, performanceRange === 'bulan' && styles.rangeBtnActive]}>
                  <Text style={[styles.rangeBtnText, performanceRange === 'bulan' && styles.rangeBtnTextActive]}>Bln</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {performanceData.length > 0 ? (
            <View>
              {/* Custom Legend Dinamis untuk Grafik Performa */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8, marginBottom: 12 }}>
                {selectedCowsForChart.map((cowId, index) => {
                  const colors = ['rgba(139, 92, 246, 1)', 'rgba(16, 185, 129, 1)', 'rgba(245, 158, 11, 1)', 'rgba(239, 68, 68, 1)', 'rgba(59, 130, 246, 1)', 'rgba(236, 72, 153, 1)', 'rgba(99, 102, 241, 1)', 'rgba(20, 184, 166, 1)'];
                  const isAll = cowId === 'ALL';
                  const bkColor = colors[(index * 2) % colors.length];
                  const adgColor = colors[(index * 2 + 1) % colors.length];
                  
                  return (
                    <React.Fragment key={cowId}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: bkColor }} />
                        <Text style={{ fontSize: 10, color: COLORS.textLight }}>BK ({isAll ? 'Avg' : cowId})</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: adgColor }} />
                        <Text style={{ fontSize: 10, color: COLORS.textLight }}>ADG ({isAll ? 'Avg' : cowId})</Text>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} maximumZoomScale={5} minimumZoomScale={1}>
                <LineChart
                  data={{
                    labels: performanceData.map(d => {
                      const date = new Date(d.date);
                      return `${date.getDate()}/${date.getMonth()+1}`;
                    }),
                    datasets: selectedCowsForChart.flatMap((cowId, index) => {
                      const colors = ['rgba(139, 92, 246, opacity)', 'rgba(16, 185, 129, opacity)', 'rgba(245, 158, 11, opacity)', 'rgba(239, 68, 68, opacity)', 'rgba(59, 130, 246, opacity)', 'rgba(236, 72, 153, opacity)', 'rgba(99, 102, 241, opacity)', 'rgba(20, 184, 166, opacity)'];
                      const isAll = cowId === 'ALL';
                      const bkKey = isAll ? 'bk' : `${cowId}_bk`;
                      const adgKey = isAll ? 'adg' : `${cowId}_adg`;
                      return [
                        { data: performanceData.map(d => Number(d[bkKey] || 0)), color: (opacity = 1) => colors[(index * 2) % colors.length].replace('opacity', String(opacity)), strokeWidth: 2 },
                        { data: performanceData.map(d => Number(d[adgKey] || 0)), color: (opacity = 1) => colors[(index * 2 + 1) % colors.length].replace('opacity', String(opacity)), strokeWidth: 2 }
                      ];
                    })
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
            </View>
          ) : selectedChartCows.length === 0 ? (
            <View style={[styles.emptyChart, { padding: 30 }]}>
              <AlertTriangle size={32} color={COLORS.warning} style={{ marginBottom: 10 }} />
              <Text style={[styles.chartSubtitle, { textAlign: 'center', fontWeight: 'bold', color: COLORS.text }]}>Silakan Pilih Sapi</Text>
              <Text style={[styles.chartSubtitle, { textAlign: 'center', marginTop: 4 }]}>Pilih minimal 1 ID sapi pada menu filter di atas untuk melihat grafik performa DMI VS ADG.</Text>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.chartSubtitle}>Belum ada data performa</Text>
            </View>
          )}

          {/* TABLE KOMPARASI PERFORMA */}
          <View style={styles.tableContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={styles.tableTitle}>Ringkasan Performa (Avg)</Text>
              <TouchableOpacity 
                style={styles.cowSelectFilterBtn} 
                onPress={() => {
                  setSearchTableText('');
                  setIsTableSelectModalVisible(true);
                }}
              >
                <Text style={styles.cowSelectFilterBtnText}>
                  {selectedTableCows.length > 0 ? `${selectedTableCows.length} Sapi` : 'Pilih Sapi'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal maximumZoomScale={5} minimumZoomScale={1}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                <View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, { width: 90 }]}>ID Sapi</Text>
                    <Text style={[styles.tableHeaderText, { width: 75, textAlign: 'center' }]}>DMI (Kg BK)</Text>
                    <Text style={[styles.tableHeaderText, { width: 60, textAlign: 'center' }]}>B.Awal</Text>
                    <Text style={[styles.tableHeaderText, { width: 60, textAlign: 'center' }]}>B.Akhir</Text>
                    <Text style={[styles.tableHeaderText, { width: 60, textAlign: 'center' }]}>ADG</Text>
                    <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'center' }]}>FCR</Text>
                  </View>
                  {performanceSummaries.map((sum, index) => (
                    <View key={index} style={styles.tableRow}>
                      <View style={{ width: 90 }}>
                        <Text style={[styles.tableRowText, { fontWeight: 'bold' }]}>{sum.cowId}</Text>
                        {sum.isEstimated && <Text style={{ fontSize: 9, color: '#f59e0b', marginTop: -2 }}>(Estimasi)</Text>}
                      </View>
                      <Text style={[styles.tableRowText, { width: 75, textAlign: 'center' }]}>{sum.totalBk}</Text>
                      <Text style={[styles.tableRowText, { width: 60, textAlign: 'center' }]}>{sum.startWeight}</Text>
                      <View style={{ width: 60, alignItems: 'center' }}>
                        <Text style={[styles.tableRowText, { textAlign: 'center' }]}>{sum.endWeight}</Text>
                        {sum.isEstimated ? (
                          <Text style={{ fontSize: 8, color: '#f59e0b', marginTop: -2 }}>~estimasi</Text>
                        ) : (
                          sum.estimatedWeight && Math.abs(sum.estimatedWeight - sum.endWeight) >= 0.5 && (
                            <Text style={{ fontSize: 8, color: '#64748b', marginTop: -2 }}>
                              ~{sum.estimatedWeight} <Text style={{ color: '#f59e0b', fontSize: 7 }}>(est)</Text>
                            </Text>
                          )
                        )}
                      </View>
                      <Text style={[styles.tableRowText, { width: 60, textAlign: 'center', color: COLORS.success, fontWeight: 'bold' }]}>{sum.adg}</Text>
                      <Text style={[styles.tableRowText, { width: 50, textAlign: 'center', color: COLORS.primary, fontWeight: 'bold' }]}>{sum.fcr}</Text>
                    </View>
                  ))}
                  {performanceSummaries.length === 0 && (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      {selectedTableCows.length === 0 ? (
                        <>
                          <Text style={[styles.chartSubtitle, { fontWeight: 'bold', color: COLORS.text, marginBottom: 4 }]}>Pilih sapi terlebih dahulu</Text>
                          <Text style={styles.chartSubtitle}>Gunakan filter sapi untuk memilih data</Text>
                        </>
                      ) : (
                        <Text style={styles.chartSubtitle}>Data ringkasan tidak tersedia</Text>
                      )}
                    </View>
                  )}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Menu Lanjutan</Text>
          <View style={styles.menuGrid}>
            {user?.role !== 'VETERINER' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => navigation.navigate('Health')}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#fef3c7' }]}>
                  <HeartPulse color="#92400e" size={28} />
                </View>
                <Text style={styles.menuText}>Rekam Medis</Text>
              </TouchableOpacity>
            )}
            {user?.role === 'STAFF' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  fetchRecentInputs();
                  setIsHistoryModalVisible(true);
                }}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#e0e7ff' }]}>
                  <History color="#4338ca" size={28} />
                </View>
                <Text style={styles.menuText}>Histori Input</Text>
              </TouchableOpacity>
            )}

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
          <View style={[styles.historyModalContent, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <History size={22} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Histori & Koreksi Input 24 Jam</Text>
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
                        <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>
                          Hapus
                        </Text>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.editModalContent, { paddingBottom: Math.max(insets.bottom, SPACING.xl) }]}>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================== */}
      {/* 3. MODAL FILTER SAPI (MULTI-SELECT) */}
      {/* ========================================== */}
      <Modal
        visible={isCowSelectModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSearchChartText('');
          setIsCowSelectModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.editModalContent, { paddingBottom: Math.max(insets.bottom, SPACING.xl) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pilih Sapi (Maksimal 5)</Text>
                <TouchableOpacity onPress={() => {
                  setSearchChartText('');
                  setIsCowSelectModalVisible(false);
                }}>
                  <X size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Pilih sapi yang ingin dibandingkan performanya di grafik.</Text>
              
              <TextInput
                style={[styles.input, { marginBottom: 12, backgroundColor: '#f1f5f9', borderWidth: 0 }]}
                placeholder="Cari ID Sapi..."
                value={searchChartText}
                onChangeText={setSearchChartText}
                placeholderTextColor={COLORS.textLight}
              />

              <ScrollView style={{ maxHeight: 300, marginBottom: SPACING.md }}>
                <View style={styles.cowSelectGrid}>
                  {livestock.filter(cow => cow.cattleId.toLowerCase().includes(searchChartText.toLowerCase())).slice(0, 5).map(cow => {
                    const isSelected = selectedChartCows.includes(cow.cattleId);
                    return (
                      <TouchableOpacity
                        key={cow.id}
                        style={[styles.cowSelectCard, isSelected && styles.cowSelectCardActive]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedChartCows(prev => prev.filter(id => id !== cow.cattleId));
                          } else {
                            if (selectedChartCows.length >= 5) {
                              Alert.alert('Batas Maksimal', 'Anda hanya dapat memilih maksimal 5 sapi.');
                              return;
                            }
                            setSelectedChartCows(prev => [...prev, cow.cattleId]);
                          }
                        }}
                      >
                        <Text style={[styles.cowSelectId, isSelected && styles.cowSelectIdActive]}>
                          {cow.cattleId}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {livestock.length === 0 && (
                    <Text style={{ color: COLORS.textLight, fontStyle: 'italic' }}>Tidak ada data sapi.</Text>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalCancelBtn]} 
                  onPress={() => {
                    setSelectedChartCows([]);
                    setSearchChartText('');
                    setIsCowSelectModalVisible(false);
                  }}
                >
                  <Text style={styles.modalCancelBtnText}>Reset Semua</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalSaveBtn]} 
                  onPress={() => {
                    setSearchChartText('');
                    setIsCowSelectModalVisible(false);
                  }}
                >
                  <Text style={styles.modalSaveBtnText}>Terapkan Filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================== */}
      {/* 4. MODAL FILTER SAPI UNTUK TABEL (Maks 10) */}
      {/* ========================================== */}
      <Modal
        visible={isTableSelectModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSearchTableText('');
          setIsTableSelectModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.editModalContent, { paddingBottom: Math.max(insets.bottom, SPACING.xl) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pilih Sapi untuk Tabel (Maksimal 10)</Text>
                <TouchableOpacity onPress={() => {
                  setSearchTableText('');
                  setIsTableSelectModalVisible(false);
                }}>
                  <X size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Pilih sapi yang ingin dibandingkan ringkasan performanya di tabel.</Text>
              
              <TextInput
                style={[styles.input, { marginBottom: 12, backgroundColor: '#f1f5f9', borderWidth: 0 }]}
                placeholder="Cari ID Sapi..."
                value={searchTableText}
                onChangeText={setSearchTableText}
                placeholderTextColor={COLORS.textLight}
              />

              <ScrollView style={{ maxHeight: 300, marginBottom: SPACING.md }}>
                <View style={styles.cowSelectGrid}>
                  {livestock.filter(cow => cow.cattleId.toLowerCase().includes(searchTableText.toLowerCase())).slice(0, 10).map(cow => {
                    const isSelected = selectedTableCows.includes(cow.cattleId);
                    return (
                      <TouchableOpacity
                        key={cow.id}
                        style={[styles.cowSelectCard, isSelected && styles.cowSelectCardActive]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedTableCows(prev => prev.filter(id => id !== cow.cattleId));
                          } else {
                            if (selectedTableCows.length >= 10) {
                              Alert.alert('Batas Maksimal', 'Anda hanya dapat memilih maksimal 10 sapi untuk tabel.');
                              return;
                            }
                            setSelectedTableCows(prev => [...prev, cow.cattleId]);
                          }
                        }}
                      >
                        <Text style={[styles.cowSelectId, isSelected && styles.cowSelectIdActive]}>
                          {cow.cattleId}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {livestock.length === 0 && (
                    <Text style={{ color: COLORS.textLight, fontStyle: 'italic' }}>Tidak ada data sapi.</Text>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalCancelBtn]} 
                  onPress={() => {
                    setSelectedTableCows([]);
                    setSearchTableText('');
                    setIsTableSelectModalVisible(false);
                  }}
                >
                  <Text style={styles.modalCancelBtnText}>Reset Semua</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, styles.modalSaveBtn]} 
                  onPress={() => {
                    setSearchTableText('');
                    setIsTableSelectModalVisible(false);
                  }}
                >
                  <Text style={styles.modalSaveBtnText}>Terapkan Filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================== */}
      {/* MODAL AKTIVITAS 24 JAM */}
      {/* ========================================== */}
      <Modal
        visible={activityModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActivityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.historyModalContent, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aktivitas 24 Jam Terakhir</Text>
              <TouchableOpacity onPress={() => setActivityModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Riwayat log sistem dan peringatan dalam 24 jam terakhir.</Text>

            {loadingActivities ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : activities.length > 0 ? (
              <FlatList
                data={activities}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }: { item: any }) => (
                  <View style={styles.historyCard}>
                    <View style={styles.historyCardBody}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={styles.historyCattleId}>{item.userName || 'Sistem'} - {item.action || 'Info'}</Text>
                        <Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <Text style={styles.historyDetails}>{item.details || item.body || ''}</Text>
                    </View>
                  </View>
                )}
                style={styles.historyList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={{ color: COLORS.textLight }}>Belum ada aktivitas tercatat hari ini.</Text>
              </View>
            )}
            
            {user?.role === 'STAFF' && (
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSaveBtn, { marginTop: 16 }]}
                onPress={() => {
                  setActivityModalVisible(false);
                  fetchRecentInputs();
                  setIsHistoryModalVisible(true);
                }}
              >
                <Text style={styles.modalSaveBtnText}>Koreksi Input Data</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL NOTIFIKASI */}
      {/* ========================================== */}
      <Modal 
        visible={notificationModalVisible} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.historyModalContent, { maxHeight: '80%', paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Peringatan Sistem</Text>
              <TouchableOpacity onPress={() => setNotificationModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {notifications.length > 0 ? (
              <FlatList
                data={notifications}
                keyExtractor={(item: any) => item.id.toString()}
                renderItem={({ item }: { item: any }) => (
                  <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ marginTop: 2, marginRight: 12, backgroundColor: '#fee2e2', padding: 6, borderRadius: 8 }}>
                      <AlertTriangle size={16} color="#ef4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.danger }}>{item.title}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textLight }}>{item.time}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: COLORS.text }}>{item.body}</Text>
                    </View>
                  </View>
                )}
                style={styles.historyList}
              />
            ) : (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Bell size={40} color={COLORS.textLight} />
                <Text style={{ marginTop: 12, color: COLORS.textLight, textAlign: 'center' }}>Tidak ada peringatan. Kondisi aman terkendali.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL KETERANGAN PENJELASAN ISTILAH (INFO) */}
      {/* ========================================== */}
      <Modal
        visible={!!infoModalContent}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setInfoModalContent(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setInfoModalContent(null)}
        >
          <View style={[styles.editModalContent, { padding: SPACING.lg, borderRadius: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ padding: 8, borderRadius: 10, backgroundColor: '#ecfdf5' }}>
                <Info size={22} color={COLORS.primary} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.text, flex: 1 }}>
                {infoModalContent?.title}
              </Text>
              <TouchableOpacity onPress={() => setInfoModalContent(null)}>
                <X size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 20, marginBottom: 14 }}>
              {infoModalContent?.desc}
            </Text>

            {infoModalContent?.target && (
              <View style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.primary }}>
                  {infoModalContent.target}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={{ backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
              onPress={() => setInfoModalContent(null)}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Mengerti</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  chartHeaderResponsive: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
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
  },
  cowSelectFilterBtn: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  cowSelectFilterBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  cowSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  cowSelectCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
  tableContainer: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: SPACING.md,
  },
  tableTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textLight,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowText: {
    fontSize: 12,
    color: COLORS.text,
  }
});

export default DashboardScreen;
