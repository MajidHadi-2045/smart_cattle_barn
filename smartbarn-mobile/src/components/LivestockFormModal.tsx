import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { X, Beef, MapPin, Activity } from 'lucide-react-native';

interface LivestockFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  loading?: boolean;
  zones?: any[];
}

const LivestockFormModal = ({ 
  visible, 
  onClose, 
  onSubmit, 
  initialData,
  loading,
  zones = []
}: LivestockFormModalProps) => {
  const [formData, setFormData] = useState({
    cattleId: '',
    breed: '',
    gender: 'BETINA',
    status: 'SEHAT',
    weight: '',
    zoneId: '',
    sectionId: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        cattleId: initialData.cattleId || '',
        breed: initialData.breed || '',
        gender: initialData.gender || 'BETINA',
        status: initialData.status || 'SEHAT',
        weight: initialData.weight?.toString() || '',
        zoneId: initialData.zoneId?.toString() || '',
        sectionId: initialData.sectionId?.toString() || ''
      });
    } else {
      setFormData({
        cattleId: '',
        breed: '',
        gender: 'BETINA',
        status: 'SEHAT',
        weight: '',
        zoneId: '',
        sectionId: ''
      });
    }
  }, [initialData, visible]);

  const selectedZone = zones.find(z => z.id.toString() === formData.zoneId);
  const sections = selectedZone?.sections || [];

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const OptionSelector = ({ label, options, value, onSelect }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((opt: any) => (
          <TouchableOpacity 
            key={opt.value}
            style={[styles.optionItem, value === opt.value && styles.optionActive]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.optionText, value === opt.value && styles.optionTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{initialData ? 'Edit Data Sapi' : 'Tambah Sapi Baru'}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ID Sapi (RFID)</Text>
              <TextInput 
                style={styles.input}
                value={formData.cattleId}
                onChangeText={(txt) => setFormData({...formData, cattleId: txt})}
                placeholder="Contoh: C-301"
                editable={!initialData}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Jenis / Breed</Text>
              <TextInput 
                style={styles.input}
                value={formData.breed}
                onChangeText={(txt) => setFormData({...formData, breed: txt})}
                placeholder="Contoh: Limousin"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Berat Awal (Kg)</Text>
              <TextInput 
                style={styles.input}
                value={formData.weight}
                onChangeText={(txt) => setFormData({...formData, weight: txt})}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>

            <OptionSelector 
              label="Jenis Kelamin"
              value={formData.gender}
              onSelect={(val: any) => setFormData({...formData, gender: val})}
              options={[
                { label: 'Jantan', value: 'JANTAN' },
                { label: 'Betina', value: 'BETINA' }
              ]}
            />

            <OptionSelector 
              label="Lokasi Kandang (Zone)"
              value={formData.zoneId}
              onSelect={(val: any) => setFormData({...formData, zoneId: val, sectionId: ''})}
              options={zones.map(z => ({ label: z.name, value: z.id.toString() }))}
            />

            {sections.length > 0 && (
              <OptionSelector 
                label="Section Kandang"
                value={formData.sectionId}
                onSelect={(val: any) => setFormData({...formData, sectionId: val})}
                options={sections.map((s: any) => ({ label: s.name, value: s.id.toString() }))}
              />
            )}

            <OptionSelector 
              label="Status Kesehatan"
              value={formData.status}
              onSelect={(val: any) => setFormData({...formData, status: val})}
              options={[
                { label: 'Sehat', value: 'SEHAT' },
                { label: 'Sakit', value: 'SAKIT' },
                { label: 'Perawatan', value: 'DALAM_PERAWATAN' },
                { label: 'Kritis', value: 'KRITIS' },
                { label: 'Mati', value: 'MATI' }
              ]}
            />
          </ScrollView>

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={COLORS.white} /> : (
              <Text style={styles.submitText}>{initialData ? 'Simpan Perubahan' : 'Tambah Sapi'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, height: '85%', padding: SPACING.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  form: { flex: 1 },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textLight, marginBottom: 8 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 15, color: COLORS.text },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  optionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  optionTextActive: { color: COLORS.white },
  submitButton: { backgroundColor: COLORS.primary, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md, ...SHADOWS.sm },
  submitText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' }
});

export default LivestockFormModal;
