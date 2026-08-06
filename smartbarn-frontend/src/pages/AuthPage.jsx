import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-sm p-8 border border-slate-200 dark:border-slate-800 relative overflow-hidden">

                {/* Accent Top Border */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-primary-600"></div>

                {/* Header Form */}
                <div className="text-center mb-8 mt-2">
                    <div className="inline-flex bg-white p-2 rounded-full mb-4 shadow-sm border border-slate-100">
                        <img src="/logoxl.svg" alt="Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Smart Cattle Barn</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Silakan masuk untuk mengakses sistem</p>
                </div>

                {/* Pesan Error Alert */}
                {error && (
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 text-sm rounded-md">
                        {error}
                    </div>
                )}

                {/* --- TAMPILAN LOGIN --- */}
                <div className="animate-fade-in">
                    <form className="space-y-4" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Peran / Akses</label>
                            <select
                                value={loginRole}
                                onChange={(e) => setLoginRole(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
                                required
                            >
                                <option value="" disabled>-- Pilih Peran --</option>
                                <option value="super_admin">Super Admin (Manajer)</option>
                                <option value="veteriner">Dokter Hewan (Veteriner)</option>
                                <option value="staff">Staff (Operator Kandang)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username atau Email</label>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value.replace(/\s/g, ''));
                                }}
                                placeholder="budi_123 atau email@domain.com"
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
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
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 shadow-sm'}`}
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