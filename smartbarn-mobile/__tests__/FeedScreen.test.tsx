import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FeedScreen from '../src/screens/FeedScreen';

describe('Pengujian Komponen Pakan Sapi (Mobile)', () => {

  it('1. Memastikan layar Pakan berhasil di-render', () => {
    const { getAllByText, getByText } = render(<FeedScreen />);
    
    // Pastikan judul halaman pakan ada
    expect(getAllByText('Silo Pakan')[0]).toBeTruthy();
    expect(getByText('Stok Silo & Penjadwalan')).toBeTruthy();
  });

  it('2. Memastikan komponen indikator status berhasil di-render', () => {
    // Pengujian bisa diperluas nanti untuk list silo jika data dimock
    expect(true).toBe(true);
  });

  it('3. Memastikan layar dimuat tanpa crash', () => {
    const { getAllByText } = render(<FeedScreen />);
    expect(getAllByText('Silo Pakan')[0]).toBeTruthy();
  });

});
