import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { ChevronLeft, FileText, Download, TrendingUp, PieChart, Info, Calendar, CheckCircle } from 'lucide-react-native';
import apiClient, { BASE_URL } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const { width } = Dimensions.get('window');

const ReportScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [wasteData, setWasteData] = useState({ fecesKg: 0, urineL: 0 });
  
  // States for New Report Generator
  const [jenisLaporan, setJenisLaporan] = useState('Lingkungan');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const { showToast } = useToast();

  const REPORT_TYPES = [
    { id: 'Lingkungan', title: 'Lingkungan Kandang' },
    { id: 'Kesehatan', title: 'Kesehatan Ternak' },
    { id: 'Populasi', title: 'Total Populasi' },
    { id: 'Pakan', title: 'Konsumsi Pakan' },
    { id: 'Limbah', title: 'Manajemen Limbah' }
  ];

  const fetchReports = async () => {
    try {
      const response = await apiClient.get('/dashboard/waste?filter=daily');
      setWasteData(response.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const downloadUrl = `${BASE_URL}/api/reports/download?jenis=${jenisLaporan}&start=${startDate}&end=${endDate}&format=PDF&token=${token}`;
      
      // Buka URL download menggunakan browser sistem untuk mengunduh file secara langsung
      await Linking.openURL(downloadUrl);
      showToast(`Membuka unduhan laporan ${jenisLaporan}...`, 'success');
    } catch (error) {
      console.error('Download error:', error);
      showToast('Gagal mengunduh laporan', 'error');
    } finally {
      setIsDownloading(false);
    }
  };


  useEffect(() => {
    fetchReports();
  }, []);

  const ReportCard = ({ title, value, unit, icon: Icon, color, description }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
          <Icon size={24} color={color} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.valueText}>{value} <Text style={styles.unitText}>{unit}</Text></Text>
        <Text style={styles.descText}>{description}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Laporan</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingSpinner message="Mempersiapkan Laporan..." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.summaryBox}>
            <TrendingUp size={24} color={COLORS.white} />
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Total Produksi Hari Ini</Text>
              <Text style={styles.summaryValue}>Optimal</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Generator Laporan (PDF)</Text>
          
          <View style={styles.formContainer}>
            <Text style={styles.label}>Pilih Kategori Laporan</Text>
            <View style={styles.optionsGrid}>
              {REPORT_TYPES.map((type) => (
                <TouchableOpacity 
                  key={type.id} 
                  style={[styles.optionBtn, jenisLaporan === type.id && styles.optionBtnActive]}
                  onPress={() => setJenisLaporan(type.id)}
                >
                  {jenisLaporan === type.id && <CheckCircle size={14} color={COLORS.primary} style={{marginRight: 4}}/>}
                  <Text style={[styles.optionText, jenisLaporan === type.id && styles.optionTextActive]}>{type.title}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateInputContainer}>
                <Text style={styles.label}>Dari Tanggal</Text>
                <View style={styles.dateBox}>
                  <Calendar size={18} color={COLORS.textLight} />
                  <Text style={styles.dateText}>{startDate}</Text>
                </View>
              </View>
              <View style={styles.dateInputContainer}>
                <Text style={styles.label}>Sampai Tanggal</Text>
                <View style={styles.dateBox}>
                  <Calendar size={18} color={COLORS.textLight} />
                  <Text style={styles.dateText}>{endDate}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Info size={20} color={COLORS.textLight} />
            <Text style={styles.infoText}>Laporan otomatis digenerate secara real-time berdasarkan data server pusat.</Text>
          </View>

          <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Download size={20} color={COLORS.white} />
                <Text style={styles.downloadText}>Unduh Laporan PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: SPACING.lg, 
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  scrollContent: { padding: SPACING.lg },
  summaryBox: { 
    backgroundColor: COLORS.primary, 
    borderRadius: 20, 
    padding: SPACING.lg, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 15,
    marginBottom: SPACING.xl,
    ...SHADOWS.md
  },
  summaryText: { flex: 1 },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  summaryValue: { color: COLORS.white, fontSize: 22, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
  grid: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  card: { 
    width: '48%', 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    padding: SPACING.md, 
    marginBottom: SPACING.md,
    ...SHADOWS.sm
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  cardBody: { marginTop: 4 },
  valueText: { fontSize: 24, fontWeight: 'black', color: COLORS.text },
  unitText: { fontSize: 14, fontWeight: 'normal', color: COLORS.textLight },
  descText: { fontSize: 10, color: COLORS.textLight, marginTop: 4 },
  infoBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    backgroundColor: '#f1f5f9', 
    padding: SPACING.md, 
    borderRadius: 12,
    marginTop: SPACING.lg
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.textLight },
  downloadButton: { 
    backgroundColor: COLORS.text, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    height: 55, 
    borderRadius: 16, 
    marginTop: SPACING.xl,
    ...SHADOWS.md
  },
  downloadText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 16,
    ...SHADOWS.sm,
    marginBottom: SPACING.md
  },
  label: { fontSize: 14, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.lg
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  optionTextActive: {
    color: COLORS.primary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateText: {
    fontSize: 14,
    color: COLORS.text,
  }
});

export default ReportScreen;
