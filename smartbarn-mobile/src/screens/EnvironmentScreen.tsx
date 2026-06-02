import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { ChevronLeft, Thermometer, Droplets, Wind, Activity, Zap } from 'lucide-react-native';
import { useSocket } from '../hooks/useSocket';
import Svg, { Path, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');

const EnvironmentScreen = ({ navigation }: any) => {
  const [envData, setEnvData] = useState({
    temperature: 28.5,
    humidity: 72,
    windSpeed: 12,
    ammonia: 0.5
  });

  const [tempHistory, setTempHistory] = useState<number[]>(new Array(15).fill(28));
  
  // Listen ke update sensor lingkungan
  const { data: socketData } = useSocket(['websocket:environment', 'websocket:windspeed']);

  useEffect(() => {
    if (socketData['websocket:environment']) {
      const { temperature, humidity } = socketData['websocket:environment'];
      setEnvData(prev => ({ ...prev, temperature, humidity }));
      
      // Update grafik suhu
      setTempHistory(prev => [...prev.slice(1), temperature]);
    }
    if (socketData['websocket:windspeed']) {
      const { windspeed } = socketData['websocket:windspeed'];
      setEnvData(prev => ({ ...prev, windSpeed: windspeed }));
    }
  }, [socketData]);

  const generateChartPath = (data: number[]) => {
    const step = (width - 80) / (data.length - 1);
    const min = Math.min(...data) - 2;
    const max = Math.max(...data) + 2;
    const range = max - min;

    return data.map((val, i) => {
      const x = i * step;
      const y = 80 - ((val - min) / range) * 60;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

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

        {/* Temperature Trend Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Tren Suhu (Live)</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.dot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          
          <View style={styles.svgContainer}>
            <Svg height="100" width={width - 80}>
              <Path
                d={generateChartPath(tempHistory)}
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <View style={styles.chartLabels}>
            <Text style={styles.labelSmall}>60m lalu</Text>
            <Text style={styles.labelSmall}>Sekarang</Text>
          </View>
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ef4444',
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
