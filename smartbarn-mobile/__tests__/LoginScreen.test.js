import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LoginScreen from '../src/screens/LoginScreen'; 

describe('Pengujian Unit Layar Login (Mobile)', () => {

  it('1. Memastikan komponen Layar Login berhasil di-render tanpa crash', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    // Memeriksa apakah input form dan tombol ada di layar
    expect(getByPlaceholderText('Username atau Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Login Sekarang')).toBeTruthy();
  });

  it('2. Memastikan input menerima ketikan teks pengguna dengan benar', () => {
    const { getByPlaceholderText } = render(<LoginScreen />);
    const emailInput = getByPlaceholderText('Username atau Email');

    // Simulasikan pengguna mengetik
    fireEvent.changeText(emailInput, 'staff@barn.com');

    // Memeriksa apakah nilai form berubah sesuai ketikan
    expect(emailInput.props.value).toBe('staff@barn.com');
  });

  it('3. Memastikan opsi pilihan peran muncul', () => {
    const { getByText } = render(<LoginScreen />);
    
    expect(getByText('Pilih Peran Anda:')).toBeTruthy();
    expect(getByText('Super Admin (Manajer)')).toBeTruthy();
    expect(getByText('Staff (Operator Kandang)')).toBeTruthy();
    expect(getByText('Dokter Hewan (Veteriner)')).toBeTruthy();
  });

});
