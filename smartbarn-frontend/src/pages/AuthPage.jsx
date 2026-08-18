import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-5 sm:p-8 border border-slate-200 dark:border-slate-800 relative overflow-hidden">

                {/* Accent Top Border */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-primary-600"></div>

                {/* Header Form */}
                <div className="text-center mb-6 sm:mb-8 mt-1">
                    <Link 
                        to="/" 
                        className="inline-flex flex-col items-center group focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-2xl p-1.5 transition-all duration-300"
                        title="Kembali ke Halaman Utama (Landing Page)"
                        aria-label="Kembali ke Halaman Utama"
                    >
                        <div className="bg-white dark:bg-slate-800 p-2.5 rounded-full mb-2.5 shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-110 group-hover:shadow-md group-hover:border-primary-200 transition-all duration-300">
                            <img src="/logoxl.svg" alt="Logo Smart Cattle Barn" width="48" height="48" className="w-12 h-12 object-contain" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-300 flex items-center gap-1.5">
                            Smart Cattle Barn
                            <svg className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg>
                        </h2>
                    </Link>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Silakan masuk untuk mengakses sistem</p>
                </div>

                {/* Pesan Error Alert */}
                {error && (
                    <div className="mb-5 p-3 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-700 dark:text-red-300 text-xs sm:text-sm rounded-lg flex items-start gap-2">
                        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {/* --- TAMPILAN LOGIN --- */}
                <div className="animate-fade-in">
                    <form className="space-y-4" onSubmit={handleLogin}>
                        {/* UBAH METODE PILIH PERAN MENJADI Ubin INTERAKTIF (MOBILE FRIENDLY) */}
                        <div>
                            <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Pilih Peran / Akses <span className="text-red-500">*</span>
                            </label>
                            
                            <div className="grid grid-cols-3 gap-2">
                                {/* Role 1: Super Admin */}
                                <button
                                    type="button"
                                    onClick={() => setLoginRole('super_admin')}
                                    className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border text-center transition-all duration-200 focus:outline-none ${
                                        loginRole === 'super_admin'
                                            ? 'border-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/30 shadow-sm font-bold scale-[1.02]'
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 font-medium'
                                    }`}
                                >
                                    {loginRole === 'super_admin' && (
                                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
                                            ✓
                                        </span>
                                    )}
                                    <span className="text-xs sm:text-sm font-bold leading-tight">Super Admin</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-normal">Manajer</span>
                                </button>

                                {/* Role 2: Dokter Hewan */}
                                <button
                                    type="button"
                                    onClick={() => setLoginRole('veteriner')}
                                    className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border text-center transition-all duration-200 focus:outline-none ${
                                        loginRole === 'veteriner'
                                            ? 'border-teal-600 bg-teal-50/90 dark:bg-teal-950/50 text-teal-900 dark:text-teal-100 ring-2 ring-teal-500/30 shadow-sm font-bold scale-[1.02]'
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-teal-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 font-medium'
                                    }`}
                                >
                                    {loginRole === 'veteriner' && (
                                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white text-[10px]">
                                            ✓
                                        </span>
                                    )}
                                    <span className="text-xs sm:text-sm font-bold leading-tight">Dokter Hewan</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-normal">Veteriner</span>
                                </button>

                                {/* Role 3: Staff */}
                                <button
                                    type="button"
                                    onClick={() => setLoginRole('staff')}
                                    className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl border text-center transition-all duration-200 focus:outline-none ${
                                        loginRole === 'staff'
                                            ? 'border-blue-600 bg-blue-50/90 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/30 shadow-sm font-bold scale-[1.02]'
                                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 font-medium'
                                    }`}
                                >
                                    {loginRole === 'staff' && (
                                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white text-[10px]">
                                            ✓
                                        </span>
                                    )}
                                    <span className="text-xs sm:text-sm font-bold leading-tight">Staff Operator</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-normal">Kandang</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Username atau Email</label>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value.replace(/\s/g, ''));
                                }}
                                placeholder="budi_123 atau email@domain.com"
                                className="w-full px-4 py-3 text-base sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Kata Sandi</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 text-base sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md active:scale-[0.99] ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20'}`}
                        >
                            {isLoading ? 'Memproses...' : 'Masuk Beranda'}
                        </button>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!email || !email.includes('@')) {
                                        setError('Silakan ketik alamat Email Anda yang valid di kolom atas, lalu tekan tombol Lupa Password ini lagi.');
                                        return;
                                    }
                                    setIsLoading(true);
                                    setError('');
                                    try {
                                        const res = await fetch(`${API_URL}/auth/forgot-password`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ email })
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                            toast.success(data.message || 'Link reset password telah dikirim ke email Anda.', { duration: 4000 });
                                        } else {
                                            setError(data.message || 'Gagal mengirim email reset.');
                                        }
                                    } catch (err) {
                                        console.error("Forgot Password Error:", err);
                                        setError('Gagal menghubungi server.');
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline transition"
                            >
                                Lupa Password?
                            </button>
                        </div>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-450 italic">
                        Akses baru hanya dapat didaftarkan melalui undangan Admin atau melalui Permintaan Akun dari dalam sistem.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;