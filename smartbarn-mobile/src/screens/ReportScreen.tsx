import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { ChevronLeft, FileText, Download, TrendingUp, PieChart, Info, Calendar, CheckCircle, ChevronDown } from 'lucide-react-native';
import apiClient, { BASE_URL } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/storage';

import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const { width } = Dimensions.get('window');

const ReportScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [wasteData, setWasteData] = useState({ fecesKg: 0, urineL: 0 });
  
  // States for New Report Generator
  const [jenisLaporan, setJenisLaporan] = useState('Lingkungan');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const { showToast } = useToast();

  // Custom Date Picker States & Helpers
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [navDate, setNavDate] = useState(new Date());

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handleOpenPicker = (mode: 'start' | 'end') => {
    setPickerMode(mode);
    const initialDate = new Date(mode === 'start' ? startDate : endDate);
    setNavDate(isNaN(initialDate.getTime()) ? new Date() : initialDate);
    setPickerVisible(true);
  };

  const handlePrevMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const selected = new Date(navDate.getFullYear(), navDate.getMonth(), day);
    const year = selected.getFullYear();
    const month = String(selected.getMonth() + 1).padStart(2, '0');
    const dateStr = String(selected.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${dateStr}`;

    if (pickerMode === 'start') {
      if (new Date(formatted) > new Date(endDate)) {
        showToast('Tanggal mulai tidak boleh melebihi tanggal selesai', 'error');
        return;
      }
      setStartDate(formatted);
    } else {
      if (new Date(formatted) < new Date(startDate)) {
        showToast('Tanggal selesai tidak boleh kurang dari tanggal mulai', 'error');
        return;
      }
      setEndDate(formatted);
    }
    setPickerVisible(false);
  };

  const REPORT_TYPES = [
    { id: 'Lingkungan', title: 'Laporan Lingkungan Kandang (Suhu, Kelembapan, Angin, Amonia)' },
    { id: 'Vital', title: 'Laporan Vital Sign Sapi (Suhu Tubuh & Detak Jantung)' },
    { id: 'Kesehatan', title: 'Laporan Kesehatan & Medis Ternak' },
    { id: 'Populasi', title: 'Laporan Total Populasi Ternak' },
    { id: 'Pakan', title: 'Laporan Konsumsi Pakan (As-Fed & BK)' },
    { id: 'Limbah', title: 'Laporan Manajemen Limbah (Feses & Urine)' }
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
      const token = await getToken();
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
        <Text style={[styles.valueText, { color }]}>{value} <Text style={styles.unitText}>{unit}</Text></Text>
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
          <Text style={styles.sectionTitle}>Download Laporan (PDF)</Text>

          <View style={styles.topInfoBox}>
            <Info size={18} color={COLORS.primary} />
            <Text style={styles.topInfoText}>Laporan otomatis digenerate secara real-time berdasarkan data server pusat.</Text>
          </View>
          
          <View style={styles.formContainer}>
            <Text style={styles.label}>Pilih Kategori Laporan</Text>
            <TouchableOpacity 
              style={styles.dropdownBox}
              onPress={() => setDropdownVisible(true)}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.dropdownSelectedTitle}>
                  {REPORT_TYPES.find(r => r.id === jenisLaporan)?.title || 'Pilih Kategori Laporan'}
                </Text>
              </View>
              <ChevronDown size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.dateRow}>
              <View style={styles.dateInputContainer}>
                <Text style={styles.label}>Dari Tanggal</Text>
                <TouchableOpacity onPress={() => handleOpenPicker('start')} style={styles.dateBox}>
                  <Calendar size={18} color={COLORS.textLight} />
                  <Text style={styles.dateText}>{startDate}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateInputContainer}>
                <Text style={styles.label}>Sampai Tanggal</Text>
                <TouchableOpacity onPress={() => handleOpenPicker('end')} style={styles.dateBox}>
                  <Calendar size={18} color={COLORS.textLight} />
                  <Text style={styles.dateText}>{endDate}</Text>
                </TouchableOpacity>
              </View>
            </View>
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

      {/* ========================================== */}
      {/* MODAL DROPDOWN KATEGORI LAPORAN */}
      {/* ========================================== */}
      <Modal
        visible={dropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity 
          style={styles.pickerOverlay} 
          activeOpacity={1} 
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Pilih Kategori Laporan</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Text style={styles.pickerCloseBtn}>Tutup</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {REPORT_TYPES.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.dropdownItem, jenisLaporan === item.id && styles.dropdownItemActive]}
                  onPress={() => {
                    setJenisLaporan(item.id);
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, jenisLaporan === item.id && styles.dropdownItemTextActive]}>
                    {item.title}
                  </Text>
                  {jenisLaporan === item.id && <CheckCircle size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================== */}
      {/* MODAL DATE PICKER */}
      {/* ========================================== */}
      <Modal
        visible={pickerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {pickerMode === 'start' ? 'Pilih Tanggal Mulai' : 'Pilih Tanggal Selesai'}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.pickerCloseBtn}>Batal</Text>
              </TouchableOpacity>
            </View>

            {/* Month Navigator */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
                <ChevronLeft size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {navDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
                <ChevronLeft size={20} color={COLORS.text} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            </View>

            {/* Days of Week Header */}
            <View style={styles.weekHeader}>
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((w) => (
                <Text key={w} style={styles.weekDayText}>{w}</Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {(() => {
                const daysInMonth = getDaysInMonth(navDate.getFullYear(), navDate.getMonth());
                const firstDay = getFirstDayOfMonth(navDate.getFullYear(), navDate.getMonth());
                const cells = [];
                
                for (let i = 0; i < firstDay; i++) {
                  cells.push({ key: `empty-${i}`, day: null });
                }
                for (let d = 1; d <= daysInMonth; d++) {
                  cells.push({ key: `day-${d}`, day: d });
                }

                return cells.map((cell) => {
                  if (cell.day === null) {
                    return <View key={cell.key} style={styles.dayCell} />;
                  }

                  const cellDate = new Date(navDate.getFullYear(), navDate.getMonth(), cell.day);
                  const year = cellDate.getFullYear();
                  const month = String(cellDate.getMonth() + 1).padStart(2, '0');
                  const dateStr = String(cellDate.getDate()).padStart(2, '0');
                  const formatted = `${year}-${month}-${dateStr}`;

                  const isSelected = pickerMode === 'start' ? startDate === formatted : endDate === formatted;

                  return (
                    <TouchableOpacity
                      key={cell.key}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                      onPress={() => handleSelectDay(cell.day)}
                    >
                      <Text style={[styles.dayCellText, isSelected && styles.dayCellTextSelected]}>
                        {cell.day}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          </View>
        </View>
      </Modal>
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
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
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
  topInfoBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    backgroundColor: '#ecfdf5', 
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: SPACING.md, 
    borderRadius: 12,
    marginBottom: SPACING.md
  },
  topInfoText: { flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  downloadButton: { 
    backgroundColor: COLORS.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    height: 55, 
    borderRadius: 16, 
    marginTop: SPACING.sm,
    ...SHADOWS.md
  },
  downloadText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: 16,
    ...SHADOWS.sm,
    marginBottom: SPACING.sm
  },
  label: { fontSize: 14, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
  dropdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#0ea5e9',
    marginBottom: SPACING.md,
  },
  dropdownSelectedTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: '#ecfdf5',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 8,
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  optionBtnActive: {
    backgroundColor: '#ecfdf5',
    borderColor: COLORS.primary,
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textLight,
    marginRight: 8,
  },
  optionTextActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  radioCircleActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
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
  },
  // Custom Date Picker styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg
  },
  pickerContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 16
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text
  },
  pickerCloseBtn: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '600'
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9'
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  weekDayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text
  },
  dayCellTextSelected: {
    color: COLORS.white,
    fontWeight: 'bold'
  }
});

export default ReportScreen;
