import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import UserProfileModal from '../../components/dashboard/UserProfileModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { fetchApi } from '../../utils/api';

const UserManagement = () => {
    const userRole = localStorage.getItem('userRole');
    const currentUserName = localStorage.getItem('userName') || 'Staf';

    // --- 1. STATE MANAGEMENT ---
    const [activeTab, setActiveTab] = useState(userRole === 'SUPER_ADMIN' ? 'list' : 'form'); // 'list', 'requests', 'form'
    const [users, setUsers] = useState([]);
    const [requests, setRequests] = useState([]);

    // State Pagination
    const [currentUserPage, setCurrentUserPage] = useState(1);
    const USERS_PER_PAGE = 8;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // State untuk Modal Detail User & Konfirmasi
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', id: null, title: '', message: '', isDanger: true });

    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        phone: '', // Menambahkan properti phone
        password: '',
        role: userRole === 'VETERINER' ? 'veteriner' : 'staff',
        reason: ''
    });

    // --- 2. FUNGSI MENGAMBIL DATA (GET) ---
    const fetchUserData = async (silent = false) => {
        if (userRole !== 'SUPER_ADMIN') {
            setIsLoading(false);
            return;
        }
        if (!silent) setIsLoading(true);
        try {
            // Mengambil daftar user aktif
            const usersRes = await fetchApi('/users/staff');
            if (!usersRes.ok) throw new Error('Gagal mengambil data pengguna');

            const usersData = await usersRes.json();
            setUsers(usersData.filter(u => u.status === 'AKTIF')); // Hanya tampilkan yang sudah aktif

            if (userRole === 'SUPER_ADMIN') {
                const pendingRes = await fetchApi('/users/requests');
                if (pendingRes.ok) {
                    setRequests(await pendingRes.json());
                } else {
                    setRequests([]);
                }
            } else {
                setRequests([]);
            }
            setError(null);

        } catch (err) {
            console.error(err);
            setError(err.message);
            setUsers([]);
            setRequests([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    // --- 3. FUNGSI TAMBAH USER / REQUEST (POST) ---
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        
        // Validasi Username Khusus Admin
        if (userRole === 'SUPER_ADMIN') {
            const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
            if (!usernameRegex.test(formData.username)) {
                toast.error("Username tidak valid! Hanya boleh huruf, angka, _ dan -, tanpa spasi. Panjang 3-20 karakter.");
                return;
            }
        }

        setIsSubmitting(true);

        const isSuperAdmin = userRole === 'SUPER_ADMIN';
        const url = isSuperAdmin ? '/users/staff' : '/users/requests';
        
        const payload = isSuperAdmin ? formData : {
            requester: currentUserName,
            calonName: formData.name,
            calonEmail: formData.email,
            calonPhone: formData.phone, // Kirim nomer HP
            posisi: formData.role.toUpperCase(),
            alasan: formData.reason
        };

        toast.promise(
            fetchApi(url, {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Gagal menyimpan data');
                }
                return res.json();
            }),
            {
                loading: isSuperAdmin ? 'Membuat pengguna baru...' : 'Mengirim permintaan akses...',
                success: (result) => {
                    setFormData({ name: '', username: '', email: '', phone: '', password: '', role: userRole === 'VETERINER' ? 'veteriner' : 'staff', reason: '' });
                    setActiveTab('list');
                    
                    if (isSuperAdmin) {
                        setUsers(prev => [...prev, result]);
                        return 'Pengguna baru berhasil ditambahkan!';
                    } else {
                        return 'Permintaan akses berhasil diajukan ke Admin!';
                    }
                },
                error: (err) => `Gagal: ${err.message}`,
            }
        ).finally(() => setIsSubmitting(false));
    };

    // --- 4. FUNGSI AKSI USER (DELETE / APPROVE) ---
    const handleDeleteUser = (id, name) => {
        setConfirmModal({
            isOpen: true,
            type: 'delete_user',
            id: id,
            title: 'Cabut Hak Akses?',
            message: `PERINGATAN! Anda yakin ingin mencabut akses untuk ${name}? Akun ini tidak akan bisa login lagi ke sistem.`,
            isDanger: true
        });
    };

    const confirmDeleteUser = async (id) => {
        try {
            const response = await fetchApi(`/users/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Gagal menghapus pengguna');

            setUsers(users.filter(u => u.id !== id));
            toast.success('Akses pengguna berhasil dicabut.');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleResetPassword = (id, name) => {
        setConfirmModal({
            isOpen: true,
            type: 'reset_password',
            id: id,
            title: 'Reset Password Pengguna?',
            message: `Apakah Anda yakin ingin me-reset password untuk ${name}? Password barunya akan menjadi "SmartBarn2026!" dan disarankan untuk segera diubah oleh pengguna.`,
            isDanger: false
        });
    };

    const confirmResetPassword = async (id) => {
        try {
            const response = await fetchApi(`/users/force-reset/${id}`, { method: 'PATCH' });
            if (!response.ok) throw new Error('Gagal mereset password');
            const data = await response.json();
            toast.success(`Berhasil! Password baru: ${data.defaultPassword || 'SmartBarn2026!'}`, { duration: 6000 });
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleApproveRequest = async (id, roleName) => {
        if (userRole !== 'SUPER_ADMIN') {
            toast.error('Hanya Super Admin yang memiliki izin menyetujui akses.');
            return;
        }

        toast.promise(
            fetchApi(`/users/requests/${id}/process`, {
                method: 'PATCH',
                body: JSON.stringify({ action: 'TERIMA' })
            }).then(async res => { 
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Gagal menyetujui');
                }
                return res.json(); 
            }),
            {
                loading: 'Menyetujui permintaan...',
                success: () => {
                    setRequests(prev => prev.filter(req => req.id !== id));
                    fetchUserData(true);
                    return 'Akun berhasil diaktifkan!';
                },
                error: (err) => `Gagal: ${err.message}`,
            }
        );
    };

    const handleRejectRequest = (id) => {
        setConfirmModal({
            isOpen: true,
            type: 'reject_request',
            id: id,
            title: 'Tolak Permintaan?',
            message: 'Hapus permintaan pendaftaran ini? Calon pengguna harus meminta ulang jika ingin bergabung.',
            isDanger: true
        });
    };

    const confirmRejectRequest = async (id) => {
        try {
            const response = await fetchApi(`/users/requests/${id}/process`, {
                method: 'PATCH',
                body: JSON.stringify({ action: 'TOLAK' })
            });
            if (!response.ok) throw new Error('Gagal menolak pengguna');

            setRequests(prev => prev.filter(req => req.id !== id));
            toast.success('Permintaan pendaftaran ditolak.');
            fetchUserData(true);
        } catch (err) {
            toast.error(err.message);
        }
    };

    // Eksekutor Modal Konfirmasi
    const handleConfirmAction = () => {
        const { type, id } = confirmModal;
        setConfirmModal({ ...confirmModal, isOpen: false });

        if (type === 'delete_user') confirmDeleteUser(id);
        else if (type === 'reject_request') confirmRejectRequest(id);
        else if (type === 'reset_password') confirmResetPassword(id);
    };

    // Helper untuk menampilkan Modal Detail User
    const viewUserDetails = (user) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    // --- 5. RENDER UI ---
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {userRole === 'SUPER_ADMIN' ? 'Manajemen Pengguna' : 'Ajukan Akses Baru'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {userRole === 'SUPER_ADMIN' ? 'Kelola hak akses, peran staf, dan persetujuan akun baru' : 'Ajukan permohonan penambahan akses pengguna/staf baru ke Admin'}
                    </p>
                </div>

                {userRole === 'SUPER_ADMIN' && (
                    <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setActiveTab('list')} className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'list' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Daftar Pengguna</button>
                        <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 text-sm font-bold rounded-md transition flex items-center gap-2 ${activeTab === 'requests' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                            Antrian Akses
                            {requests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{requests.length}</span>}
                        </button>
                        <button onClick={() => setActiveTab('form')} className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'form' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                            Tambah Akses
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm">
                    Mode Offline / Error: {error}. Menampilkan data cadangan lokal.
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <>
                    {/* --- TAB: DAFTAR PENGGUNA --- */}
                    {activeTab === 'list' && (() => {
                        const totalUserPages = Math.ceil(users.length / USERS_PER_PAGE);
                        const paginatedUsers = users.slice((currentUserPage - 1) * USERS_PER_PAGE, currentUserPage * USERS_PER_PAGE);
                        return (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">Nama Pengguna</th>
                                            <th className="px-6 py-4">Kontak</th>
                                            <th className="px-6 py-4">Peran / Role</th>
                                            <th className="px-6 py-4 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                                        {paginatedUsers.length > 0 ? paginatedUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                                                            {user.photo || user.photo_url ? (
                                                                <img src={user.photo || user.photo_url} alt={user.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                user.name.replace(/\b(?:super\s*)?admin\b/gi, '').trim().charAt(0)
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 dark:text-slate-100">{user.name.replace(/\b(?:super\s*)?admin\b/gi, '').trim()}</p>
                                                            <p className="text-xs text-slate-500">Terdaftar: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : (user.joinDate || '2024')}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium">{user.email}</p>
                                                    <p className="text-xs text-slate-500">{user.phone || '-'}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${user.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                            user.role === 'VETERINER' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                'bg-green-50 text-green-700 border-green-200'
                                                        }`}>
                                                        {user.role.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <button onClick={() => viewUserDetails(user)} className="text-primary-600 hover:text-primary-800 font-medium transition" title="Lihat Profil">Detail</button>
                                                        {userRole === 'SUPER_ADMIN' && (
                                                            <>
                                                                <button onClick={() => handleResetPassword(user.id, user.name)} className="text-amber-500 hover:text-amber-700 transition" title="Reset Password">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                                </button>
                                                                <button onClick={() => handleDeleteUser(user.id, user.name)} className="text-red-500 hover:text-red-700 transition" title="Cabut Akses">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line></svg>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="text-center py-8 text-slate-500">Tidak ada data pengguna.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination Controls */}
                            {totalUserPages > 1 && (
                                <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Menampilkan {(currentUserPage - 1) * USERS_PER_PAGE + 1} - {Math.min(currentUserPage * USERS_PER_PAGE, users.length)} dari {users.length} pengguna
                                    </span>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => setCurrentUserPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentUserPage === 1}
                                            className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300"
                                        >
                                            Mundur
                                        </button>
                                        <div className="flex items-center px-3 py-1 text-xs font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg">
                                            Halaman {currentUserPage} / {totalUserPages}
                                        </div>
                                        <button 
                                            onClick={() => setCurrentUserPage(prev => Math.min(prev + 1, totalUserPages))}
                                            disabled={currentUserPage === totalUserPages}
                                            className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300"
                                        >
                                            Lanjut
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    {/* --- TAB: REQUESTS (ANTRIAN AKSES) --- */}
                    {activeTab === 'requests' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {requests.length > 0 ? requests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                                    <div className="flex justify-between items-start mb-4 pl-2">
                                        <div>
                                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Permintaan Baru</p>
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{req.calonName}</h3>
                                            <p className="text-sm text-slate-500">{req.calonEmail}</p>
                                        </div>
                                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 text-xs font-bold rounded-full">
                                            Role: {req.posisi}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg text-sm text-slate-600 dark:text-slate-300 mb-4 pl-2">
                                        <span className="font-bold">Diajukan oleh:</span> {req.requester} <br />
                                        {req.alasan && (
                                            <>
                                                <span className="font-bold">Alasan:</span> {req.alasan} <br />
                                            </>
                                        )}
                                        <span className="text-xs text-slate-400">
                                            {new Date(req.createdAt).toLocaleString('id-ID', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex gap-3 pl-2">
                                        <button onClick={() => handleApproveRequest(req.id, req.posisi)} className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-bold hover:bg-primary-700 transition">Setujui</button>
                                        <button onClick={() => handleRejectRequest(req.id)} className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition">Tolak</button>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-10 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                    Tidak ada antrian permintaan akses saat ini.
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB: FORM TAMBAH PENGGUNA --- */}
                    {activeTab === 'form' && (
                        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
                                {userRole === 'SUPER_ADMIN' ? 'Undang Pengguna / Staf Baru' : 'Ajukan Permintaan Akses Baru'}
                            </h3>
                            <form onSubmit={handleFormSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                                        <input type="text" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    </div>
                                    {userRole === 'SUPER_ADMIN' && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Username (Tanpa Spasi)</label>
                                            <input type="text" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '') })} placeholder="budi_123" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Email Utama</label>
                                        <input type="email" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Nomor Kontak / HP</label>
                                        <input type="text" placeholder="0812xxxxxx" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>
                                {userRole === 'SUPER_ADMIN' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Password Sementara</label>
                                        <input type="password" placeholder="Min. 6 karakter" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Pilih Role Akses</label>
                                    {userRole === 'SUPER_ADMIN' ? (
                                        <select className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                                            <option value="super_admin">Super Admin (Manajer)</option>
                                            <option value="veteriner">Dokter Hewan (Veteriner)</option>
                                            <option value="staff">Staff (Operator Kandang)</option>
                                        </select>
                                    ) : (
                                        <select disabled className="w-full px-4 py-2 border rounded-lg bg-slate-105 dark:bg-slate-700 dark:text-white" value={formData.role}>
                                            <option value="veteriner">Dokter Hewan (Veteriner)</option>
                                            <option value="staff">Staff (Operator Kandang)</option>
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Alasan Penambahan</label>
                                    <textarea className="w-full px-4 py-2 border rounded-lg h-24 dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Mengapa akun ini diperlukan?" required value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}></textarea>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setFormData({ name: '', email: '', password: '', role: userRole === 'VETERINER' ? 'veteriner' : 'staff', reason: '' });
                                            if (userRole === 'SUPER_ADMIN') setActiveTab('list');
                                        }} 
                                        className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                    >
                                        Batal
                                    </button>
                                    <button type="submit" disabled={isSubmitting} className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-500/30 disabled:opacity-70">
                                        {isSubmitting ? 'Memproses...' : (userRole === 'SUPER_ADMIN' ? 'Buat Pengguna' : 'Ajukan Permintaan')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </>
            )}

            {/* Render Modal Detail Profil */}
            <UserProfileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                onProfileUpdate={(id, updatedData) => {
                    // Update state users agar list langsung terefresh
                    setUsers(prevUsers => prevUsers.map(u => 
                        u.id === id ? { ...u, ...updatedData } : u
                    ));
                    // Update selectedUser jika sedang dibuka
                    if (selectedUser && selectedUser.id === id) {
                        setSelectedUser({ ...selectedUser, ...updatedData });
                    }
                }}
            />

            {/* Render Modal Konfirmasi Global */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.type === 'reject_request' ? "Tolak Permintaan" : confirmModal.type === 'reset_password' ? "Ya, Reset Password" : "Ya, Cabut Akses"}
                isDanger={confirmModal.isDanger}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            />
        </div>
    );
};

export default UserManagement;