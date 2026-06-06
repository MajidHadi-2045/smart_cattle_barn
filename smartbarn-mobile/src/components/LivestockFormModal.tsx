import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../theme';
import { X, Beef, MapPin, Activity } from 'lucide-react-native';

interface LivestockFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: any;
  loading?: boolean;
}

const LivestockFormModal = ({ 
  visible, 
  onClose, 
  onSubmit, 
  initialData,
  loading 
}: LivestockFormModalProps) => {
  const [formData, setFormData] = useState({
    cattleId: '',
    breed: '',
    gender: 'BETINA',
    zone: 'ZONA_1',
    status: 'SEHAT',
    weight: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        cattleId: initialData.cattleId || '',
        breed: initialData.breed || '',
        gender: initialData.gender || 'BETINA',
        zone: initialData.zone || 'ZONA_1',
        status: initialData.status || 'SEHAT',
        weight: initialData.weight?.toString() || ''
      });
    } else {
      setFormData({
        cattleId: '',
        breed: '',
        gender: 'BETINA',
        zone: 'ZONA_1',
        status: 'SEHAT',
        weight: ''
      });
    }
  }, [initialData, visible]);

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
              label="Lokasi Kandang"
              value={formData.zone}
              onSelect={(val: any) => setFormData({...formData, zone: val})}
              options={[
                { label: 'Kandang 1', value: 'ZONA_1' },
                { label: 'Kandang 2', value: 'ZONA_2' },
                { label: 'Kandang 3', value: 'ZONA_3' }
              ]}
            />

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
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%', padding: SPACING.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  form: { flex: 1 },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textLight, marginBottom: 8 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 12, fontSize: 16, color: COLORS.text },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  optionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  optionTextActive: { color: COLORS.white },
  submitButton: { backgroundColor: COLORS.primary, height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.md, ...SHADOWS.md },
  submitText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' }
});

export default LivestockFormModal;
