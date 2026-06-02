import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
    const [view, setView] = useState('login');
    const [loginRole, setLoginRole] = useState('');

    // State untuk input form
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // Khusus register

    // State untuk menangani loading dan pesan error
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    // Mengambil URL API dari file .env
    const API_URL = import.meta.env.VITE_API_BASE_URL;

    // --- FUNGSI LOGIN DENGAN JALUR TIKUS (BYPASS) ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!loginRole) {
            setError("Silakan pilih Kategori/Peran Anda terlebih dahulu.");
            return;
        }

        setIsLoading(true);

        try {
            // Mapping role ke Enum Backend
            const roleMap = {
                'super_admin': 'SUPER_ADMIN',
                'veteriner': 'VETERINER',
                'staff': 'STAFF'
            };
            const backendRole = roleMap[loginRole] || 'STAFF';

            // Mencoba menembak API Backend
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role: backendRole })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login gagal. Periksa email dan password.');
            }

            // PENTING: Simpan data sesi ke LocalStorage
            localStorage.setItem('token', data.accessToken || data.access_token);
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRole', data.user.role);
            localStorage.setItem('userName', data.user.name);
            localStorage.setItem('userEmail', data.user.email || email);
            localStorage.setItem('userCreatedAt', data.user.createdAt || new Date().toISOString());

            navigate('/dashboard');

        } catch (err) {
            console.error("Login error:", err);
            setError(err.message || "Gagal menghubungi server. Pastikan backend aktif.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- FUNGSI REGISTRASI ---
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (!loginRole) {
            setError("Silakan pilih Kategori/Peran Anda.");
            return;
        }

        setIsLoading(true);

        try {
            // Mapping role ke Enum Backend
            const roleMap = {
                'super_admin': 'SUPER_ADMIN',
                'veteriner': 'VETERINER',
                'staff': 'STAFF'
            };
            const backendRole = roleMap[loginRole] || 'STAFF';

            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role: backendRole })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registrasi gagal.');
            }

            alert("Registrasi berhasil! Silakan login.");
            setView('login');
            setPassword(''); // Kosongkan password untuk keamanan
        } catch (err) {
            setError(err.message || "Gagal mendaftar. Pastikan backend aktif.");
        } finally {
            setIsLoading(false);
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
                        <img src="/public/logoxl.svg" alt="Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Smart CattleBarn System</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Silakan masuk untuk mengakses dashboard</p>
                </div>

                {/* Pesan Error Alert */}
                {error && (
                    <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
                        {error}
                    </div>
                )}

                {/* --- TAMPILAN LOGIN --- */}
                {view === 'login' ? (
                    <div className="animate-fade-in">
                        <form className="space-y-5" onSubmit={handleLogin}>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Peran / Akses</label>
                                <select
                                    value={loginRole}
                                    onChange={(e) => setLoginRole(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
                                    required
                                >
                                    <option value="" disabled>-- Kategori Pengguna --</option>
                                    <option value="super_admin">Super Admin (IT)</option>
                                    <option value="veteriner">Dokter Hewan (Veteriner)</option>
                                    <option value="staff">Staf Kandang / Operator</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@domain.com"
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kata Sandi</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full py-3.5 rounded-xl font-bold text-white transition-all transform ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/30 hover:-translate-y-0.5'}`}
                            >
                                {isLoading ? 'Memproses...' : 'Masuk Dashboard'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            Belum punya akun?
                            <button onClick={() => { setView('register'); setError(''); }} className="ml-1 text-primary-600 dark:text-primary-400 font-bold hover:underline transition">
                                Daftar Baru
                            </button>
                        </p>
                    </div>
                ) : (

                    /* --- TAMPILAN REGISTRASI --- */
                    <div className="animate-fade-in">
                        <form className="space-y-5" onSubmit={handleRegister}>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Peran</label>
                                <select value={loginRole} onChange={(e) => setLoginRole(e.target.value)} className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-secondary-500 outline-none transition" required>
                                    <option value="" disabled>-- Kategori Pengguna --</option>
                                    <option value="super_admin">Super Admin</option>
                                    <option value="veteriner">Dokter Hewan</option>
                                    <option value="staff">Staf Kandang</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-secondary-500 outline-none transition" required />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                <input type="email" placeholder="email@domain.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-secondary-500 outline-none transition" required />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kata Sandi</label>
                                <input type="password" placeholder="Minimal 8 karakter" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-secondary-500 outline-none transition" required />
                            </div>

                            <button type="submit" disabled={isLoading} className={`w-full py-3.5 bg-secondary-600 text-white rounded-xl font-bold hover:bg-secondary-700 transition-all transform shadow-lg shadow-secondary-500/30 hover:-translate-y-0.5 ${isLoading ? 'opacity-70' : ''}`}>
                                {isLoading ? 'Mendaftarkan...' : 'Buat Akun'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                            Sudah punya akun?
                            <button onClick={() => { setView('login'); setError(''); }} className="ml-1 text-secondary-600 dark:text-secondary-400 font-bold hover:underline transition">
                                Kembali ke Login
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthPage;