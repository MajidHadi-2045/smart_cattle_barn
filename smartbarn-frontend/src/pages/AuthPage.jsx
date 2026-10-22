import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const AuthPage = () => {
    // State input form login
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // State penanganan status loading dan error
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    // Mengambil URL API dari environment
    const API_URL = import.meta.env.VITE_API_BASE_URL;

    // --- FUNGSI LOGIN LANGSUNG (OTOMATIS SESUAI ROLE DARI DATABASE) ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        const cleanIdentifier = identifier.trim();
        if (!cleanIdentifier || !password) {
            setError("Silakan masukkan Username atau Email dan Kata Sandi Anda.");
            return;
        }

        setIsLoading(true);

        try {
            // Kirim username/email dan password ke API backend
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: cleanIdentifier, 
                    username: cleanIdentifier, 
                    password 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login gagal. Periksa username/email dan kata sandi Anda.');
            }

            // Simpan data sesi ke LocalStorage
            localStorage.setItem('token', data.accessToken || data.access_token);
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRole', data.user.role);
            localStorage.setItem('userName', data.user.name);
            localStorage.setItem('userEmail', data.user.email || cleanIdentifier);
            localStorage.setItem('userCreatedAt', data.user.createdAt || new Date().toISOString());

            // Tampilkan notifikasi selamat datang sesuai peran akun
            const roleLabels = {
                'SUPER_ADMIN': 'Super Admin',
                'MANAGER': 'Manajer',
                'VETERINER': 'Dokter Hewan',
                'STAFF': 'Staff Operator'
            };
            const roleTitle = roleLabels[data.user.role] || data.user.role;
            toast.success(`Selamat datang, ${data.user.name} (${roleTitle})!`);

            // Otomatis diarahkan ke dashboard pengguna sesuai peran (role) dari akunnya
            navigate('/dashboard');

        } catch (err) {
            console.error("Login error:", err);
            setError(err.message || "Gagal menghubungi server. Pastikan backend aktif.");
        } finally {
            setIsLoading(false);
        }
    };

    // --- FUNGSI LUPA PASSWORD ---
    const handleForgotPassword = async () => {
        const cleanIdentifier = identifier.trim();
        if (!cleanIdentifier || !cleanIdentifier.includes('@')) {
            setError('Silakan ketik alamat Email Anda yang valid di kolom atas, lalu klik tombol Lupa Password ini kembali.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanIdentifier })
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

                {/* --- FORM LOGIN LANGSUNG --- */}
                <div className="animate-fade-in">
                    <form className="space-y-4" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Username atau Email
                            </label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value.replace(/\s/g, ''))}
                                placeholder="budi_123 atau email@domain.com"
                                className="w-full px-4 py-3 text-base sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                                autoComplete="username"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Kata Sandi
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 pr-11 text-base sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition"
                                    title={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                                    aria-label={showPassword ? 'Sembunyikan Kata Sandi' : 'Tampilkan Kata Sandi'}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 ${
                                isLoading 
                                    ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed' 
                                    : 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/20'
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Memproses...</span>
                                </>
                            ) : (
                                'Masuk Beranda'
                            )}
                        </button>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                onClick={handleForgotPassword}
                                className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline transition"
                            >
                                Lupa Password?
                            </button>
                        </div>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 italic">
                        Akses baru hanya dapat didaftarkan melalui undangan Admin atau melalui Permintaan Akun dari dalam sistem.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;