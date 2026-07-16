import React from 'react';
import { render } from '@testing-library/react-native';
import DashboardScreen from '../src/screens/DashboardScreen';

describe('Pengujian Komponen Dashboard (Mobile)', () => {

  it('1. Memastikan komponen Layar Dashboard utama berhasil di-render', () => {
    const { getByText } = render(<DashboardScreen />);
    
    // Memastikan teks judul dashboard atau ringkasan ada
    // (Sesuaikan dengan nama teks statis yang ada di UI Anda)
    expect(getByText('Menu Lanjutan')).toBeTruthy();
  });

  it('2. Memastikan komponen Indikator THI (Suhu & Kelembapan) muncul di layar', () => {
    const { getByText } = render(<DashboardScreen />);
    
    // Memeriksa apakah kata kunci THI atau suhu tertampil
    expect(getByText('Suhu Ruangan')).toBeTruthy();
    expect(getByText('Menu Lanjutan')).toBeTruthy();
  });

  it('3. Memastikan ringkasan populasi sapi dan status kesehatan tertampil', () => {
    const { getByText } = render(<DashboardScreen />);
    
    expect(getByText('Total Sapi')).toBeTruthy();
  });

});
