import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { ChevronLeft, Thermometer, Droplets, Wind, Activity, Zap } from 'lucide-react-native';
import { useSocket } from '../hooks/useSocket';
import { LineChart } from 'react-native-chart-kit';
import apiClient from '../api/client';

const { width } = Dimensions.get('window');

const EnvironmentScreen = ({ navigation }: any) => {
  const [envData, setEnvData] = useState({
    temperature: 28.5,
    humidity: 72,
    windSpeed: 12,
    ammonia: 0.5
  });

  const [sensorTrendData, setSensorTrendData] = useState<any[]>([]);
  const [windTrendData, setWindTrendData] = useState<any[]>([]);
  const [sensorTrendRange, setSensorTrendRange] = useState('24h');
  
  // Listen ke update sensor lingkungan
  const { data: socketData } = useSocket(['websocket:environment', 'websocket:windspeed']);

  useEffect(() => {
    if (socketData['websocket:environment']) {
      const { temperature, humidity } = socketData['websocket:environment'];
      setEnvData(prev => ({ ...prev, temperature, humidity }));
    }
    if (socketData['websocket:windspeed']) {
      const { windspeed } = socketData['websocket:windspeed'];
      setEnvData(prev => ({ ...prev, windSpeed: windspeed }));
    }
  }, [socketData]);

  useEffect(() => {
    const fetchLiveAndTrendData = async () => {
      try {
        const liveEnvRes = await apiClient.get('/environment/live/1');
        if (liveEnvRes.data) {
          setEnvData(prev => ({
            ...prev,
            temperature: liveEnvRes.data.temperature !== undefined ? liveEnvRes.data.temperature : prev.temperature,
            humidity: liveEnvRes.data.humidity !== undefined ? liveEnvRes.data.humidity : prev.humidity,
            ammonia: liveEnvRes.data.ammonia !== undefined ? liveEnvRes.data.ammonia : prev.ammonia,
          }));
        }
      } catch (e) {}

      try {
        const liveWindRes = await apiClient.get('/environment/live-wind/1');
        if (liveWindRes.data && liveWindRes.data.windspeed !== undefined) {
          setEnvData(prev => ({
            ...prev,
            windSpeed: liveWindRes.data.windspeed
          }));
        }
      } catch (e) {}

      try {
        const trendRes = await apiClient.get(`/environment/trend/1?range=${sensorTrendRange}`);
        if (trendRes.data && Array.isArray(trendRes.data)) {
          const chronological = [...trendRes.data].reverse();
          setSensorTrendData(chronological.slice(-15));
        }
      } catch (e) {}

      try {
        const windRes = await apiClient.get(`/wind/trend/1?range=${sensorTrendRange}`);
        if (windRes.data && Array.isArray(windRes.data)) {
          const chronologicalWind = [...windRes.data].reverse();
          setWindTrendData(chronologicalWind.slice(-15));
        }
      } catch (e) {}
    };
    fetchLiveAndTrendData();
  }, [sensorTrendRange]);

  const SensorCard = ({ title, value, unit, icon: Icon, color, subValue }: any) => (
    <View style={styles.sensorCard}>
      <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.sensorInfo}>
        <Text style={styles.sensorLabel}>{title}</Text>
        <View style={styles.valueRow}>
          <Text style={styles.sensorValue}>{value}</Text>
          <Text style={styles.sensorUnit}>{unit}</Text>
        </View>
        <Text style={styles.sensorSub}>{subValue}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kondisi Kandang</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: envData.temperature > 30 ? '#fee2e2' : '#dcfce7' }]}>
          <Zap size={20} color={envData.temperature > 30 ? COLORS.danger : COLORS.success} />
          <Text style={[styles.statusText, { color: envData.temperature > 30 ? COLORS.danger : COLORS.success }]}>
            {envData.temperature > 30 ? 'Kandang Terlalu Panas!' : 'Kondisi Kandang Ideal'}
          </Text>
        </View>

        <View style={styles.grid}>
          <SensorCard 
            title="Suhu" 
            value={envData.temperature} 
            unit="°C" 
            icon={Thermometer} 
            color="#ef4444"
            subValue="Target: 25-28°C"
          />
          <SensorCard 
            title="Kelembaban" 
            value={envData.humidity} 
            unit="%" 
            icon={Droplets} 
            color="#3b82f6"
            subValue="Target: 60-80%"
          />
          <SensorCard 
            title="Angin" 
            value={envData.windSpeed} 
            unit="km/h" 
            icon={Wind} 
            color="#f59e0b"
            subValue="Status: Normal"
          />
          <SensorCard 
            title="Ammonia" 
            value={envData.ammonia} 
            unit="ppm" 
            icon={Activity} 
            color="#8b5cf6"
            subValue="Batas: 20ppm"
          />
        </View>

        {/* Sensor Trend Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chartTitle}>GRAFIK TREN SENSOR</Text>
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
                   <Text style={{ fontSize: 10, color: COLORS.textLight }}>Angin (m/s)</Text>
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
                        color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
                        strokeWidth: 2
                      },
                      {
                        data: sensorTrendData.map(d => d.humidity || 0),
                        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                        strokeWidth: 2
                      },
                      {
                        data: sensorTrendData.map(d => d.ammonia || 0),
                        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                        strokeWidth: 2
                      },
                      {
                        data: sensorTrendData.map((d, i) => windTrendData[i]?.windspeed || 0),
                        color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
                        strokeWidth: 2
                      }
                    ]
                  }}
                  width={Math.max(Dimensions.get("window").width - SPACING.lg * 2, sensorTrendData.length * 40)}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  withDots={true}
                  withInnerLines={false}
                  withOuterLines={false}
                  chartConfig={{
                    backgroundColor: COLORS.white,
                    backgroundGradientFrom: COLORS.white,
                    backgroundGradientTo: COLORS.white,
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                    propsForDots: {
                      r: "3",
                      strokeWidth: "2"
                    }
                  }}
                  bezier
                  style={{
                    marginVertical: 8,
                    borderRadius: 16
                  }}
                />
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={{ marginTop: 8, color: COLORS.textLight, fontSize: 12 }}>Memuat data grafik...</Text>
            </View>
          )}
        </View>

        {/* Additional Info */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Reports')}
        >
          <Text style={styles.actionButtonText}>Lihat Laporan Lengkap</Text>
        </TouchableOpacity>
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
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.lg,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sensorCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sensorInfo: {
    flex: 1,
  },
  sensorLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sensorValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sensorUnit: {
    fontSize: 12,
    marginLeft: 2,
    color: COLORS.textLight,
  },
  sensorSub: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
  },
  chartSection: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  svgContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  labelSmall: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default EnvironmentScreen;
