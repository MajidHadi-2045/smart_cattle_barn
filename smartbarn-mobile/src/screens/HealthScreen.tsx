import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { HeartPulse, User, Calendar, ClipboardList } from 'lucide-react-native';
import apiClient from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';

const HealthScreen = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchRecords = async () => {
    try {
      // Endpoint yang sesuai di backend
      const response = await apiClient.get('/health');
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching health records:', error);
      // Fallback data if API not ready
      setRecords([
        { id: 1, cattleId: 'C-301', diagnosa: 'Kelelahan', penanganan: 'Istirahat & Vitamin', pemeriksa: 'Dr. Ahmad', status: 'SEMBUH', createdAt: new Date().toISOString() },
        { id: 2, cattleId: 'C-305', diagnosa: 'Infeksi Kulit', penanganan: 'Salep Antibiotik', pemeriksa: 'Dr. Susi', status: 'DALAM_PERAWATAN', createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SEMBUH': return COLORS.success;
      case 'DALAM_PERAWATAN': return COLORS.warning;
      case 'KRITIS': return COLORS.danger;
      case 'MATI': return '#64748b';
      default: return COLORS.textLight;
    }
  };

  const HealthCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.idBadge}>
          <Text style={styles.idText}>{item.cattleId}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.recordContent}>
        <View style={styles.row}>
          <ClipboardList size={16} color={COLORS.primary} />
          <Text style={styles.diagnosa}>{item.diagnosa}</Text>
        </View>
        <Text style={styles.penanganan}>{item.penanganan}</Text>
        
        <View style={styles.footer}>
          <View style={styles.meta}>
            <User size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>{item.pemeriksa}</Text>
          </View>
          <View style={styles.meta}>
            <Calendar size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>{new Date(item.createdAt).toLocaleDateString('id-ID')}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HeartPulse size={32} color={COLORS.primary} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Rekam Medis</Text>
          <Text style={styles.subtitle}>Riwayat kesehatan ternak</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <LoadingSpinner message="Memuat Rekam Medis..." />
        </View>
      ) : (() => {
        const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
        const paginatedRecords = records.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
        return (
        <FlatList
          data={paginatedRecords}
          renderItem={HealthCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecords(); setCurrentPage(1); }} />}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Tidak ada riwayat kesehatan</Text>
            </View>
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingHorizontal: 10 }}>
                <Text style={{ color: COLORS.primary, fontWeight: 'bold' }} onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                  {currentPage > 1 ? 'Mundur' : ''}
                </Text>
                <Text style={{ color: COLORS.text, fontWeight: 'bold' }}>{currentPage} / {totalPages}</Text>
                <Text style={{ color: COLORS.primary, fontWeight: 'bold' }} onPress={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                  {currentPage < totalPages ? 'Lanjut' : ''}
                </Text>
              </View>
            ) : null
          }
        />
        );
      })()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: SPACING.lg, 
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerText: { marginLeft: SPACING.md },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textLight },
  listContent: { padding: SPACING.lg },
  card: { 
    backgroundColor: COLORS.white, 
    borderRadius: 16, 
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
    overflow: 'hidden'
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  idBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  idText: { color: COLORS.white, fontWeight: 'bold', fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  recordContent: { padding: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  diagnosa: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  penanganan: { fontSize: 14, color: COLORS.textLight, marginBottom: SPACING.md, marginLeft: 24 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: SPACING.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textLight },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  emptyText: { color: COLORS.textLight, fontSize: 16 },
});

export default HealthScreen;
