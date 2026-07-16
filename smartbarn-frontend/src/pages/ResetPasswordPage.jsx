import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Jika tidak ada token di URL, tampilkan pesan error
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Akses Ditolak</h2>
          <p className="text-slate-600 mb-6">Link reset password tidak valid atau rusak.</p>
          <button onClick={() => navigate('/login')} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Password dan Konfirmasi Password tidak cocok!');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter!');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          newPassword
        })
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Gagal mereset password. Link mungkin sudah kedaluwarsa.');
      }
      
      toast.success(data.message || 'Password berhasil diubah!');
      // Arahkan ke halaman login setelah 2 detik
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
        {/* Dekorasi Latar Belakang Form */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 to-secondary-500"></div>

        {/* Header Form */}
        <div className="text-center mb-8 mt-2">
            <div className="inline-flex bg-white p-2 rounded-full mb-4 shadow-sm border border-slate-100">
                <img src="/logoxl.svg" alt="Logo" className="w-12 h-12 object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Buat Password Baru</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Akun: <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>
            </p>
        </div>

        <form onSubmit={handleReset} className="space-y-5 animate-fade-in">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password Baru</label>
            <input
              type="password"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Konfirmasi Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all transform ${
              loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30 hover:-translate-y-0.5'
            }`}
          >
            {loading ? 'Memproses...' : 'Simpan Password Baru'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
