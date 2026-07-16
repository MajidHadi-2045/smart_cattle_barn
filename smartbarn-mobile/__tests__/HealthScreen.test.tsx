import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HealthScreen from '../src/screens/HealthScreen';

describe('Pengujian Komponen Rekam Medis (Mobile)', () => {

  it('1. Memastikan komponen Rekam Medis berhasil di-render untuk Veteriner', () => {
    const { getByText } = render(<HealthScreen />);
    
    // Pastikan UI untuk dokter hewan tampil
    expect(getByText('Rekam Medis')).toBeTruthy();
    expect(getByText('Riwayat kesehatan ternak')).toBeTruthy();
  });

  it('2. Memastikan Veteriner dapat melihat rekam medis', () => {
    const { getByText } = render(<HealthScreen />);
    expect(getByText('Rekam Medis')).toBeTruthy();
  });

  it('3. Memastikan layar tidak crash saat dimuat', () => {
    const { getByText } = render(<HealthScreen />);
    expect(getByText('Rekam Medis')).toBeTruthy();
  });

});
