import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import apiClient from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { 
  ChevronLeft, 
  Thermometer, 
  Droplets, 
  Wind, 
  Beef, 
  HeartPulse, 
  Activity,
  X
} from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';

const PublicDashboardScreen = ({ navigation }: any) => {
  const [refreshing, setRefreshing] = useState(false);
  const { data: socketData, isConnected } = useSocket(['websocket:environment', 'websocket:windspeed']);
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
  
  // Performance Chart State
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [performanceSummaries, setPerformanceSummaries] = useState<any[]>([]);
  const [performanceRange, setPerformanceRange] = useState('minggu');
  const [livestock, setLivestock] = useState<any[]>([]);
  const [selectedChartCows, setSelectedChartCows] = useState<string[]>([]);
  const [selectedTableCows, setSelectedTableCows] = useState<string[]>([]);
  const [selectedCowsForChart, setSelectedCowsForChart] = useState<string[]>(['ALL']);
  const [isCowSelectModalVisible, setIsCowSelectModalVisible] = useState(false);
  const [isTableSelectModalVisible, setIsTableSelectModalVisible] = useState(false);

  const [lastEnvTimestamp, setLastEnvTimestamp] = useState<number>(0);
  const [lastWindTimestamp, setLastWindTimestamp] = useState<number>(0);

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

  const fetchData = async () => {
    try {
      const response = await apiClient.get('/dashboard/summary');
      const farmData = response.data;
      setStats(prev => ({
        ...prev,
        totalCattle: farmData.total || 0,
        activeAlerts: farmData.sakit || 0
      }));
      
      const cowsRes = await apiClient.get('/livestock');
      if (cowsRes.data) setLivestock(cowsRes.data);

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
      }

      const chartCowIdParam = selectedChartCows.length > 0 ? `&cowId=${selectedChartCows.join(',')}` : '';
      const chartRes = await apiClient.get(`/livestock/performance-chart?period=${performanceRange}${chartCowIdParam}`);
      if (chartRes.data?.data) {
        setPerformanceData(chartRes.data.data);
        setSelectedCowsForChart(chartRes.data.selectedCows || ['ALL']);
      } else {
        setPerformanceData(chartRes.data || []);
        setSelectedCowsForChart(['ALL']);
      }

      const tableCowIdParam = selectedTableCows.length > 0 ? `&cowId=${selectedTableCows.join(',')}` : '';
      const tableRes = await apiClient.get(`/livestock/performance-chart?period=${performanceRange}${tableCowIdParam}`);
      if (tableRes.data?.multiSummaries) {
        setPerformanceSummaries(tableRes.data.multiSummaries);
      } else if (tableRes.data?.summaries) {
        setPerformanceSummaries(tableRes.data.summaries);
      } else {
        setPerformanceSummaries([]);
      }
    } catch (error) {
      console.warn('Error fetching public dashboard data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [performanceRange, selectedChartCows, selectedTableCows]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchData().then(() => setRefreshing(false));
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, target }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statInfo}>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {target && <Text style={{ fontSize: 10, color: COLORS.textLight, marginTop: 4 }}>{target}</Text>}
      </View>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Icon size={24} color={color} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Dashboard Publik</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? COLORS.success : COLORS.danger }]} />
            <Text style={{ fontSize: 12, color: COLORS.textLight, marginLeft: 4 }}>
              {isConnected ? 'Sensor Terhubung' : 'Sensor Terputus'}
            </Text>
          </View>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionTitle}>Ringkasan Kandang</Text>
        <View style={styles.statsGrid}>
          <StatCard title="Total Sapi" value={stats.totalCattle} icon={Beef} color="#3b82f6" />
          <StatCard title="Kondisi Sehat" value={stats.totalCattle - stats.activeAlerts} icon={HeartPulse} color="#10b981" />
          <StatCard title="Kondisi Sakit" value={stats.activeAlerts} icon={Activity} color="#ef4444" />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>Monitoring Lingkungan</Text>
        <View style={styles.statsGrid}>
          <StatCard title="Suhu Ruangan" value={stats.avgTemp !== null ? `${stats.avgTemp}°C` : '--'} target="Target: 25-28°C" icon={Thermometer} color="#f97316" />
          <StatCard title="Kelembapan" value={stats.avgHumidity !== null ? `${stats.avgHumidity}%` : '--'} target="Target: 60-80%" icon={Droplets} color="#3b82f6" />
          <StatCard title="Sirkulasi Angin" value={stats.windSpeed !== null ? `${stats.windSpeed} m/s` : '--'} target="Target: > 1 m/s" icon={Wind} color="#0d9488" />
          <StatCard title="Amonia (NH3)" value={stats.ammonia !== null ? `${stats.ammonia} ppm` : '--'} target="Batas: < 20 ppm" icon={Activity} color="#ef4444" />
          <StatCard title="Heat Stress (THI)" value={stats.thi !== null ? stats.thi : '--'} target="Target: < 72" icon={Activity} color="#ec4899" />
        </View>

        {/* GRAFIK PERFORMA */}
        <View style={styles.chartContainer}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.sectionTitle}>DMI/BK VS ADG</Text>
              <Text style={styles.chartSubtitle}>Bahan Kering (BK) Konsumsi vs Pertambahan Bobot</Text>
            </View>
            <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <TouchableOpacity style={styles.cowSelectFilterBtn} onPress={() => setIsCowSelectModalVisible(true)}>
                <Text style={styles.cowSelectFilterBtnText}>{selectedChartCows.length > 0 ? `${selectedChartCows.length} Sapi` : 'Semua Sapi'}</Text>
              </TouchableOpacity>
              <View style={styles.rangeSelector}>
                <TouchableOpacity onPress={() => setPerformanceRange('hari')} style={[styles.rangeBtn, performanceRange === 'hari' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, performanceRange === 'hari' && styles.rangeBtnTextActive]}>Hari</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPerformanceRange('minggu')} style={[styles.rangeBtn, performanceRange === 'minggu' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, performanceRange === 'minggu' && styles.rangeBtnTextActive]}>Mgg</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setPerformanceRange('bulan')} style={[styles.rangeBtn, performanceRange === 'bulan' && styles.rangeBtnActive]}><Text style={[styles.rangeBtnText, performanceRange === 'bulan' && styles.rangeBtnTextActive]}>Bln</Text></TouchableOpacity>
              </View>
            </View>
          </View>

          {performanceData.length > 0 ? (
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
                  }),
                  legend: selectedCowsForChart.flatMap(cowId => {
                    const isAll = cowId === 'ALL';
                    return [`BK (${isAll ? 'Avg' : cowId})`, `ADG (${isAll ? 'Avg' : cowId})`];
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
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.chartSubtitle}>Belum ada data performa</Text>
            </View>
          )}

          {/* TABLE KOMPARASI PERFORMA */}
          <View style={styles.tableContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
              <Text style={styles.tableTitle}>Ringkasan Performa (Avg)</Text>
              <TouchableOpacity style={styles.cowSelectFilterBtn} onPress={() => setIsTableSelectModalVisible(true)}>
                <Text style={styles.cowSelectFilterBtnText}>{selectedTableCows.length > 0 ? `${selectedTableCows.length} Sapi` : 'Semua Sapi'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} maximumZoomScale={5} minimumZoomScale={1}>
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
                        <Text style={[styles.tableRowText, { fontWeight: 'bold' }]}>{sum.cowId === 'ALL' ? 'Rata-rata' : sum.cowId}</Text>
                        {sum.isEstimated && <Text style={{ fontSize: 9, color: '#f59e0b', marginTop: -2 }}>(Estimasi)</Text>}
                      </View>
                      <Text style={[styles.tableRowText, { width: 75, textAlign: 'center' }]}>{sum.totalBk}</Text>
                      <Text style={[styles.tableRowText, { width: 60, textAlign: 'center' }]}>{sum.startWeight}</Text>
                      <View style={{ width: 60, alignItems: 'center' }}>
                        <Text style={[styles.tableRowText, { textAlign: 'center' }]}>{sum.endWeight}</Text>
                        {sum.isEstimated && <Text style={{ fontSize: 9, color: '#f59e0b', marginTop: -2 }}>~estimasi</Text>}
                      </View>
                      <Text style={[styles.tableRowText, { width: 60, textAlign: 'center', color: COLORS.success, fontWeight: 'bold' }]}>{sum.adg}</Text>
                      <Text style={[styles.tableRowText, { width: 50, textAlign: 'center', color: COLORS.primary, fontWeight: 'bold' }]}>{sum.fcr}</Text>
                    </View>
                  ))}
                  {performanceSummaries.length === 0 && (
                    <View style={{ padding: 12, alignItems: 'center' }}>
                      <Text style={styles.chartSubtitle}>Data ringkasan tidak tersedia</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      {/* MODAL FILTER SAPI (GRAFIK) */}
      <Modal visible={isCowSelectModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsCowSelectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Sapi (Grafik - Maks 5)</Text>
              <TouchableOpacity onPress={() => setIsCowSelectModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300, marginBottom: SPACING.md }}>
              <View style={styles.cowSelectGrid}>
                {livestock.map(cow => {
                  const isSelected = selectedChartCows.includes(cow.cattleId);
                  return (
                    <TouchableOpacity
                      key={cow.id}
                      style={[styles.cowSelectCard, isSelected && styles.cowSelectCardActive]}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedChartCows(prev => prev.filter(id => id !== cow.cattleId));
                        } else {
                          if (selectedChartCows.length >= 5) return;
                          setSelectedChartCows(prev => [...prev, cow.cattleId]);
                        }
                      }}
                    >
                      <Text style={[styles.cowSelectId, isSelected && styles.cowSelectIdActive]}>{cow.cattleId}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={() => setIsCowSelectModalVisible(false)}>
              <Text style={styles.modalSaveBtnText}>Terapkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL FILTER SAPI (TABEL) */}
      <Modal visible={isTableSelectModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsTableSelectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Sapi (Tabel - Maks 10)</Text>
              <TouchableOpacity onPress={() => setIsTableSelectModalVisible(false)}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300, marginBottom: SPACING.md }}>
              <View style={styles.cowSelectGrid}>
                {livestock.map(cow => {
                  const isSelected = selectedTableCows.includes(cow.cattleId);
                  return (
                    <TouchableOpacity
                      key={cow.id}
                      style={[styles.cowSelectCard, isSelected && styles.cowSelectCardActive]}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedTableCows(prev => prev.filter(id => id !== cow.cattleId));
                        } else {
                          if (selectedTableCows.length >= 10) return;
                          setSelectedTableCows(prev => [...prev, cow.cattleId]);
                        }
                      }}
                    >
                      <Text style={[styles.cowSelectId, isSelected && styles.cowSelectIdActive]}>{cow.cattleId}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={() => setIsTableSelectModalVisible(false)}>
              <Text style={styles.modalSaveBtnText}>Terapkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.white, ...SHADOWS.sm },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  scrollContent: { padding: SPACING.lg },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: SPACING.lg },
  statCard: { width: '48%', backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 12, marginBottom: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, ...SHADOWS.sm },
  statInfo: { flex: 1 },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  statIconContainer: { padding: SPACING.sm, borderRadius: 8 },
  chartContainer: { backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.lg, ...SHADOWS.md, marginBottom: SPACING.xl },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  chartSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  rangeSelector: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 2 },
  rangeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  rangeBtnActive: { backgroundColor: COLORS.white, ...SHADOWS.sm },
  rangeBtnText: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  rangeBtnTextActive: { color: COLORS.primary },
  cowSelectFilterBtn: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#bfdbfe' },
  cowSelectFilterBtnText: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary },
  emptyChart: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16 },
  tableContainer: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: SPACING.md },
  tableTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, marginBottom: 4 },
  tableHeaderText: { fontSize: 11, fontWeight: 'bold', color: COLORS.textLight },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableRowText: { fontSize: 12, color: COLORS.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  cowSelectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cowSelectCard: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  cowSelectCardActive: { backgroundColor: '#eff6ff', borderColor: COLORS.primary },
  cowSelectId: { fontSize: 13, fontWeight: 'bold', color: COLORS.textLight },
  cowSelectIdActive: { color: COLORS.primary },
  modalSaveBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: SPACING.sm },
  modalSaveBtnText: { color: COLORS.white, fontWeight: 'bold' }
});

export default PublicDashboardScreen;
