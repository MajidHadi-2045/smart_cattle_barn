import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { fetchApi } from '../../utils/api';

const Feed = () => {
    // --- 1. STATE MANAGEMENT ---
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' atau 'schedule'
    const [silos, setSilos] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [zones, setZones] = useState([]);
    const [cows, setCows] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // State untuk Form Jadwal Baru
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [newSchedule, setNewSchedule] = useState({
        time: '',
        sectionId: '', 
        feedType: '', 
        status: 'TERJADWAL'
    });

    // State untuk Edit Jadwal
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [editZoneId, setEditZoneId] = useState('');
    const [editFormData, setEditFormData] = useState({
        time: '',
        sectionId: '',
        feedType: '',
        status: ''
    });

    // State untuk Manajemen Silo
    const [showSiloModal, setShowSiloModal] = useState(false);
    const [siloFormData, setSiloFormData] = useState({
        id: null,
        name: '',
        feedType: 'Hijauan',
        capacity: 100,
        currentStock: 0,
        unit: 'Kg'
    });

    // State Transaksi Silo (Pakan Masuk & Keluar)
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [selectedSiloForTx, setSelectedSiloForTx] = useState(null);
    const [txFormData, setTxFormData] = useState({
        type: 'MASUK', // 'MASUK' atau 'KELUAR'
        weightKg: '',
        expiryDate: '',
        description: ''
    });

    // State Laporan Pakan & Sapi
    const [feedReport, setFeedReport] = useState({
        transactions: [],
        cows: { total: 0, breeds: [] }
    });

    // --- 2. FUNGSI MENGAMBIL DATA (GET) ---
    const fetchFeedReport = async () => {
        try {
            const res = await fetchApi('/feed/report');
            if (res.ok) {
                const data = await res.json();
                setFeedReport(data);
            }
        } catch (err) {
            console.error('Error fetching feed report:', err);
        }
    };

    const fetchFeedData = async () => {
        setIsLoading(true);
        try {
            const [silosRes, schedulesRes, cowsRes] = await Promise.all([
                fetchApi('/feed/silo'),
                fetchApi('/feed/schedule'),
                fetchApi('/livestock')
            ]);
            if (!silosRes.ok || !schedulesRes.ok) throw new Error('Gagal mengambil data pakan');
            const silosData = await silosRes.json();
            setSilos(silosData.map(s => ({
                ...s,
                current: s.currentStock,
                max: s.capacity,
                isCritical: s.status === 'KRITIS'
            })));
            setSchedules(await schedulesRes.json());
            
            if (cowsRes.ok) {
                setCows(await cowsRes.json());
            }

            await fetchFeedReport();

            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchZones = async () => {
        try {
            const res = await fetchApi('/zones');
            if (res.ok) setZones(await res.json());
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetchFeedData();
        fetchZones();
    }, []);

    // --- 3. FUNGSI MENYIMPAN JADWAL (POST) ---
    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        toast.promise(
            fetchApi('/feed/schedule', {
                method: 'POST',
                body: JSON.stringify(newSchedule)
            }).then(async (res) => {
                if (!res.ok) throw new Error('Gagal menyimpan jadwal');
                return res.json();
            }),
            {
                loading: 'Menyimpan jadwal...',
                success: (savedSchedule) => {
                    setSchedules([...schedules, savedSchedule]);
                    setNewSchedule({ time: '', sectionId: '', feedType: '', status: 'TERJADWAL' });
                    setSelectedZoneId('');
                    setActiveTab('overview');
                    return 'Jadwal berhasil ditambahkan!';
                },
                error: (err) => `Gagal: ${err.message}`,
            }
        ).finally(() => setIsSubmitting(false));
    };

    // --- 3.1 FUNGSI MANAJEMEN SILO (CRUD) ---
    const handleSiloSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const isEdit = !!siloFormData.id;
        const method = isEdit ? 'PATCH' : 'POST';
        const url = isEdit ? `/feed/silo/${siloFormData.id}` : '/feed/silo';

        toast.promise(
            fetchApi(url, {
                method,
                body: JSON.stringify(siloFormData)
            }).then(async res => { 
                if(!res.ok) throw new Error(); 
                return res.json(); 
            }),
            {
                loading: 'Menyimpan data silo...',
                success: (savedSilo) => {
                    setShowSiloModal(false);
                    if (isEdit) {
                        setSilos(prev => prev.map(s => s.id === savedSilo.id ? {
                            ...s,
                            ...savedSilo,
                            current: savedSilo.currentStock,
                            max: savedSilo.capacity,
                            isCritical: savedSilo.status === 'KRITIS'
                        } : s));
                    } else {
                        setSilos(prev => [...prev, {
                            ...savedSilo,
                            current: savedSilo.currentStock,
                            max: savedSilo.capacity,
                            isCritical: savedSilo.status === 'KRITIS'
                        }]);
                    }
                    return isEdit ? 'Silo berhasil diperbarui' : 'Silo baru berhasil ditambahkan';
                },
                error: 'Gagal menyimpan data silo',
            }
        ).finally(() => setIsSubmitting(false));
    };

    const handleDeleteSilo = async (id) => {
        if (!window.confirm('Hapus silo ini? Seluruh data stok akan hilang.')) return;
        try {
            await fetchApi(`/feed/silo/${id}`, { method: 'DELETE' });
            setSilos(silos.filter(s => s.id !== id));
            toast.success('Silo berhasil dihapus');
        } catch (err) {
            toast.error('Gagal menghapus: ' + err.message);
        }
    };

    const openEditSilo = (silo) => {
        setSiloFormData({
            id: silo.id,
            name: silo.name,
            feedType: silo.feedType || 'Hijauan',
            capacity: silo.max,
            currentStock: silo.current,
            unit: silo.unit,
            expiryDate: silo.expiryDate ? silo.expiryDate.split('T')[0] : ''
        });
        setShowSiloModal(true);
    };

    const openTransactionModal = (silo) => {
        setSelectedSiloForTx(silo);
        setTxFormData({
            type: 'MASUK',
            weightKg: '',
            expiryDate: silo.expiryDate ? silo.expiryDate.split('T')[0] : '',
            description: ''
        });
        setShowTransactionModal(true);
    };

    const handleTransactionSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        toast.promise(
            fetchApi(`/feed/silo/${selectedSiloForTx.id}/transaction`, {
                method: 'POST',
                body: JSON.stringify(txFormData)
            }).then(async res => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Gagal mencatat transaksi');
                }
                return res.json();
            }),
            {
                loading: 'Mencatat transaksi pakan...',
                success: (updatedSilo) => {
                    setShowTransactionModal(false);
                    // update silos list
                    setSilos(prev => prev.map(s => s.id === updatedSilo.id ? {
                        ...s,
                        ...updatedSilo,
                        current: updatedSilo.currentStock,
                        max: updatedSilo.capacity,
                        isCritical: updatedSilo.status === 'KRITIS'
                    } : s));
                    // refresh report
                    fetchFeedReport();
                    return 'Transaksi pakan berhasil disimpan!';
                },
                error: (err) => `Gagal: ${err.message}`
            }
        ).finally(() => setIsSubmitting(false));
    };

    // --- 4. FUNGSI HAPUS JADWAL (DELETE) ---
    const handleDeleteSchedule = async (id) => {
        if (!window.confirm('Hapus jadwal ini?')) return;
        try {
            await fetchApi(`/feed/schedule/${id}`, {
                method: 'DELETE'
            });
            setSchedules(schedules.filter(sch => sch.id !== id));
            toast.success('Jadwal berhasil dihapus');
        } catch (err) {
            toast.error('Gagal menghapus: ' + err.message);
        }
    };

    // --- 4.1 FUNGSI EDIT JADWAL (UPDATE) ---
    const openEditSchedule = (sch) => {
        setEditingSchedule(sch);
        setEditZoneId(sch.section?.zoneId || '');
        setEditFormData({
            time: sch.time,
            sectionId: sch.sectionId,
            feedType: sch.feedType,
            status: sch.status
        });
        setShowScheduleModal(true);
    };

    const handleScheduleUpdate = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        toast.promise(
            fetchApi(`/feed/schedule/${editingSchedule.id}`, {
                method: 'PATCH',
                body: JSON.stringify(editFormData)
            }).then(async (res) => {
                if (!res.ok) throw new Error('Gagal memperbarui jadwal');
                return res.json();
            }),
            {
                loading: 'Memperbarui jadwal...',
                success: (updatedSchedule) => {
                    setSchedules(schedules.map(s => s.id === updatedSchedule.id ? updatedSchedule : s));
                    setShowScheduleModal(false);
                    return 'Jadwal berhasil diperbarui!';
                },
                error: (err) => `Gagal: ${err.message}`,
            }
        ).finally(() => setIsSubmitting(false));
    };

    // --- 5. RENDER UI ---
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Manajemen Pakan</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Pantau stok Silo dan atur jadwal pemberian pakan ternak</p>
                </div>
                
                {/* Navigasi Tab */}
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('overview')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'overview' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        Ringkasan Stok
                    </button>
                    <button 
                        onClick={() => setActiveTab('schedule')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'schedule' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        Atur Jadwal
                    </button>
                    <button 
                        onClick={() => setActiveTab('report')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'report' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        Riwayat & Laporan
                    </button>
                </div>
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
                    {/* --- TAB: OVERVIEW (STOK SILO) --- */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                            {/* Kartu Status Silo */}
                            {silos.map(silo => {
                                const percentage = Math.round((silo.current / silo.max) * 100);
                                const barColor = silo.isCritical || percentage < 20 ? 'bg-red-500' : 'bg-green-500';
                                
                                // Kalkulasi Estimasi Berdasarkan Data Nutrisi Sapi (As-Fed Sinkron)
                                const totalWeight = cows.reduce((acc, cow) => acc + (cow.weight || 0), 0);
                                const cowCount = cows.length;
                                let dailyConsumption = 0;
                                
                                // Pengenalan Jenis Pakan Cerdas (Mendeteksi nama seperti "Silase Jagung")
                                const typeStr = (silo.feedType || '').toLowerCase();
                                const nameStr = (silo.name || '').toLowerCase();
                                
                                const isHijauan = typeStr.includes('hijauan') || typeStr.includes('silase') || nameStr.includes('silase') || nameStr.includes('rumput') || nameStr.includes('tebon');
                                const isKonsentrat = typeStr.includes('konsentrat') || nameStr.includes('konsentrat') || nameStr.includes('dedak') || nameStr.includes('ampas');
                                const isVitamin = typeStr.includes('vitamin') || typeStr.includes('suplemen') || nameStr.includes('vitamin');
                                
                                // Variabel penanda untuk UI tooltip
                                let calcCategory = 'Umum';

                                if (isHijauan || isKonsentrat) {
                                    cows.forEach(cow => {
                                        const weight = cow.weight || 0;
                                        if (weight === 0) return;
                                        
                                        // Ambil parameter nutrisi sapi atau gunakan default
                                        const targetBkPercent = cow.targetBkPercent ?? 2.5;
                                        const bkRequirement = weight * (targetBkPercent / 100);
                                        
                                        if (isHijauan) {
                                            calcCategory = 'Hijauan';
                                            const forageRatio = cow.forageRatio ?? 60;
                                            const forageDM = cow.forageDM ?? 20;
                                            dailyConsumption += (bkRequirement * (forageRatio / 100)) / (forageDM / 100);
                                        } else if (isKonsentrat) {
                                            calcCategory = 'Konsentrat';
                                            const concentrateRatio = cow.concentrateRatio ?? 40;
                                            const concentrateDM = cow.concentrateDM ?? 86;
                                            dailyConsumption += (bkRequirement * (concentrateRatio / 100)) / (concentrateDM / 100);
                                        }
                                    });
                                } else if (isVitamin) {
                                    calcCategory = 'Vitamin';
                                    dailyConsumption = cowCount * 0.05; // 50g per cow
                                } else {
                                    calcCategory = 'Default/Lainnya';
                                    dailyConsumption = totalWeight * 0.02; // Default 2%
                                }
                                
                                let estimatedDays = dailyConsumption > 0 ? Math.floor(silo.current / dailyConsumption) : 0;
                                if (estimatedDays === Infinity) estimatedDays = 0;
                                
                                return (
                                    <div key={silo.id} className={`group relative bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border transition-all hover:shadow-md ${silo.isCritical ? 'border-red-300 dark:border-red-800/50' : 'border-slate-200 dark:border-slate-700'}`}>
                                        {/* Action Overlay */}
                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditSilo(silo)} className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-blue-500 rounded-lg shadow-sm">
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                            </button>
                                            <button onClick={() => handleDeleteSilo(silo.id)} className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-red-500 rounded-lg shadow-sm">
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>

                                        <div className="flex justify-between items-start mb-4 pr-16">
                                            <div>
                                                <h3 className="font-bold text-slate-800 dark:text-slate-100">{silo.name}</h3>
                                                <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border ${
                                                    calcCategory === 'Hijauan' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 
                                                    calcCategory === 'Konsentrat' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                                                    calcCategory === 'Vitamin' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' :
                                                    'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                                                }`}>
                                                    {calcCategory}
                                                </span>
                                            </div>
                                            {silo.isCritical && <span className="animate-pulse px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md mt-1">Kritis</span>}
                                        </div>
                                        <div className="flex items-end gap-2 mb-4">
                                            <span className="text-4xl font-black text-slate-800 dark:text-slate-100">{silo.current}</span>
                                            <span className="text-slate-500 font-medium mb-1">/ {silo.max} {silo.unit}</span>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3.5 mb-2 overflow-hidden shadow-inner">
                                            <div className={`${barColor} h-full rounded-full transition-all duration-1000 shadow-lg`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <span>Stok Tersedia</span>
                                            <span>{percentage}%</span>
                                        </div>

                                        {/* Info Estimasi Ketahanan & Realisasi */}
                                        {isVitamin ? (
                                            <div className="bg-purple-50/50 dark:bg-purple-950/10 p-3.5 rounded-xl mt-4 border border-purple-100 dark:border-purple-900/20 flex flex-col gap-1 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-purple-800 dark:text-purple-400 flex items-center gap-1">📅 Kadaluarsa:</span>
                                                    <strong className="text-purple-700 dark:text-purple-300">
                                                        {silo.expiryDate ? new Date(silo.expiryDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Tidak Kadaluarsa / Belum Diatur'}
                                                    </strong>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div 
                                                    className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg mt-4 border border-slate-100 dark:border-slate-700 cursor-help"
                                                    title={calcCategory === 'Default/Lainnya' 
                                                        ? `Estimasi kasar (2% bobot) karena jenis pakan tidak dikenali.`
                                                        : `Dihitung berdasarkan total Kebutuhan As-Fed [${calcCategory}] harian dari ${cowCount} sapi aktif.`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl">⏳</span>
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400">Estimasi Tahan</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                                                                {estimatedDays > 0 ? `${estimatedDays} Hari` : 'Habis / Data kurang'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400">Konsumsi Harian</p>
                                                        <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
                                                            ~{dailyConsumption.toFixed(1)} {silo.unit}/hari
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="opacity-0 max-h-0 overflow-hidden pointer-events-none group-hover:opacity-100 group-hover:max-h-20 group-hover:pointer-events-auto transition-all duration-300">
                                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-lg mt-3 border border-emerald-100 dark:border-emerald-900/20 flex justify-between items-center text-xs">
                                                        <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">📊 Realisasi Keluar Hari Ini:</span>
                                                        <strong className="text-emerald-700 dark:text-emerald-300">
                                                            {silo.estimasiKeluarHariIni ?? 0} {silo.unit}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div className="opacity-0 max-h-0 overflow-hidden pointer-events-none group-hover:opacity-100 group-hover:max-h-20 group-hover:pointer-events-auto transition-all duration-300">
                                            <button 
                                                onClick={() => openTransactionModal(silo)} 
                                                className="w-full mt-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-indigo-100 dark:border-indigo-900/30 shadow-sm"
                                            >
                                                🔄 Catat Catatan Stok Pakan
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Tombol Tambah Silo Baru */}
                            <button 
                                onClick={() => { setSiloFormData({ id: null, name: '', feedType: 'Hijauan', capacity: 100, currentStock: 0, unit: 'Kg', expiryDate: '' }); setShowSiloModal(true); }}
                                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition group h-full min-h-[180px]"
                            >
                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600 transition mb-3">
                                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                </div>
                                <span className="font-bold text-slate-500 group-hover:text-primary-600 transition">Tambah Bar Stok</span>
                            </button>
                            
                            {/* Daftar Jadwal Hari Ini */}
                            <div className="md:col-span-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Jadwal Pemberian Pakan (Hari Ini)</h3>
                                <div className="space-y-4">
                                    {schedules.length > 0 ? schedules.map(sch => (
                                        <div key={sch.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                                            <div className="flex items-center gap-4">
                                                <div className="px-3 py-2 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-lg font-bold">
                                                    {sch.time}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-100">{sch.feedType}</p>
                                                    <p className="text-sm text-slate-500">
                                                        {sch.section ? `${sch.section.zone.name} - ${sch.section.name}` : sch.location || 'Lokasi tidak diketahui'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                                    sch.status === 'Selesai' ? 'bg-green-100 text-green-700' :
                                                    sch.status === 'Berlangsung' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                                    'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                                                }`}>
                                                    {sch.status}
                                                </span>
                                                <div className="flex gap-1 ml-2">
                                                    <button onClick={() => openEditSchedule(sch)} className="p-1.5 text-slate-400 hover:text-blue-500 transition" title="Edit Jadwal">
                                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                    </button>
                                                    <button onClick={() => handleDeleteSchedule(sch.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition" title="Hapus Jadwal">
                                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-slate-500 text-center py-4">Belum ada jadwal pakan hari ini.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: SCHEDULE (FORM JADWAL BARU) --- */}
                    {activeTab === 'schedule' && (
                        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Buat Jadwal Baru</h3>
                            <form onSubmit={handleScheduleSubmit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Waktu Pemberian</label>
                                        <input type="time" required value={newSchedule.time} onChange={e => setNewSchedule({...newSchedule, time: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jenis Pakan</label>
                                        <input type="text" required placeholder="Cth: Rumput Kering" value={newSchedule.feedType} onChange={e => setNewSchedule({...newSchedule, feedType: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pilih Kandang</label>
                                    <select 
                                        required 
                                        value={selectedZoneId} 
                                        onChange={e => {
                                            setSelectedZoneId(e.target.value);
                                            setNewSchedule({...newSchedule, sectionId: ''}); // Reset section
                                        }} 
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                                    >
                                        <option value="">-- Pilih Kandang --</option>
                                        {zones.map(z => (
                                            <option key={z.id} value={z.id}>{z.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pilih Section (Kandang)</label>
                                    <select 
                                        required 
                                        disabled={!selectedZoneId}
                                        value={newSchedule.sectionId} 
                                        onChange={e => setNewSchedule({...newSchedule, sectionId: e.target.value})} 
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white disabled:opacity-50"
                                    >
                                        <option value="">-- Pilih Kandang --</option>
                                        {zones.find(z => z.id == selectedZoneId)?.sections?.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="pt-4">
                                    <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition shadow-lg shadow-primary-500/30 disabled:opacity-70">
                                        {isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal Pakan'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* --- TAB: REPORT (RIWAYAT PAKAN & STATISTIK SAPI) --- */}
                    {activeTab === 'report' && (
                        <div className="space-y-6">
                            {/* Card Rangkuman Sapi */}
                            <div className="bg-gradient-to-r from-primary-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <h3 className="text-xl font-black mb-1">Statistik Populasi Ternak</h3>
                                    <p className="text-primary-100 text-sm">Rangkuman jenis dan total sapi yang saat ini dikelola di kandang</p>
                                </div>
                                <div className="flex gap-6 items-center">
                                    <div className="bg-white/10 px-4 py-3 rounded-xl backdrop-blur-md">
                                        <p className="text-xs uppercase font-bold tracking-wider text-primary-200">Total Populasi</p>
                                        <p className="text-3xl font-black">{feedReport.cows?.total ?? 0} Ekor</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 max-w-md">
                                        {feedReport.cows?.breeds?.map(b => (
                                            <span key={b.breed} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 transition text-xs font-bold rounded-lg backdrop-blur-md flex items-center gap-1.5">
                                                🐄 {b.breed}: {b.count} ekor
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                             {/* Tabel Riwayat Transaksi */}
                             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                 <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                     <div>
                                         <h3 className="font-bold text-slate-800 dark:text-slate-100">Riwayat Catatan Stok Pakan Masuk & Keluar</h3>
                                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Catatan log pemasokan silo dan pemakaian pakan mandiri</p>
                                     </div>
                                 </div>
 
                                 <div className="overflow-x-auto">
                                     <table className="w-full text-left border-collapse">
                                         <thead>
                                             <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-500">
                                                 <th className="px-6 py-4">Waktu</th>
                                                 <th className="px-6 py-4">Silo / Stok</th>
                                                 <th className="px-6 py-4">Kategori</th>
                                                 <th className="px-6 py-4">Tipe</th>
                                                 <th className="px-6 py-4">Jumlah</th>
                                                 <th className="px-6 py-4">Kadaluarsa (Khusus Vitamin)</th>
                                                 <th className="px-6 py-4">Penginput</th>
                                                 <th className="px-6 py-4">Keterangan</th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                                             {feedReport.transactions?.length > 0 ? (
                                                 feedReport.transactions.map((tx) => (
                                                     <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                                         <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                                             {new Date(tx.createdAt).toLocaleString('id-ID', {
                                                                 year: 'numeric', month: 'short', day: 'numeric',
                                                                 hour: '2-digit', minute: '2-digit'
                                                             })}
                                                         </td>
                                                         <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                                                             {tx.silo?.name ?? 'Silo Terhapus'}
                                                         </td>
                                                         <td className="px-6 py-4 whitespace-nowrap">
                                                             <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                                 {tx.silo?.feedType ?? 'Umum'}
                                                             </span>
                                                         </td>
                                                         <td className="px-6 py-4 whitespace-nowrap">
                                                             <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                                                 tx.type === 'MASUK' 
                                                                     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                                     : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                             }`}>
                                                                 {tx.type === 'MASUK' ? '📥 Masuk' : '📤 Keluar'}
                                                             </span>
                                                         </td>
                                                         <td className={`px-6 py-4 whitespace-nowrap font-bold ${
                                                             tx.type === 'MASUK' ? 'text-emerald-600' : 'text-indigo-600'
                                                         }`}>
                                                             {tx.type === 'MASUK' ? `+` : `-`}{tx.weightKg} {tx.silo?.unit ?? 'Kg'}
                                                         </td>
                                                         <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                                             {tx.expiryDate 
                                                                 ? new Date(tx.expiryDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) 
                                                                 : '-'
                                                             }
                                                         </td>
                                                         <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                                                             {tx.creator || 'Admin'}
                                                         </td>
                                                         <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                                             {tx.description || '-'}
                                                         </td>
                                                     </tr>
                                                 ))
                                             ) : (
                                                 <tr>
                                                     <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                                                         Belum ada catatan aliran stok pakan masuk atau keluar yang tercatat.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* --- MODAL MANAJEMEN SILO --- */}
            {showSiloModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{siloFormData.id ? 'Edit Bar Stok' : 'Tambah Bar Stok Baru'}</h3>
                            <button onClick={() => setShowSiloModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSiloSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Nama Stok / Pakan</label>
                                    <input type="text" required placeholder="Cth: Silase Jagung" value={siloFormData.name} onChange={e => setSiloFormData({...siloFormData, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Jenis Pakan</label>
                                    <select required value={siloFormData.feedType} onChange={e => setSiloFormData({...siloFormData, feedType: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500">
                                        <option value="Hijauan">Hijauan</option>
                                        <option value="Konsentrat">Konsentrat</option>
                                        <option value="Vitamin">Vitamin / Suplemen</option>
                                        <option value="Umum">Umum / Lainnya</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Kapasitas Maksimum</label>
                                    <input type="number" required value={siloFormData.capacity} onChange={e => setSiloFormData({...siloFormData, capacity: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Satuan</label>
                                    <input type="text" required placeholder="Kg / Liter" value={siloFormData.unit} onChange={e => setSiloFormData({...siloFormData, unit: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Stok Saat Ini</label>
                                <input type="number" required value={siloFormData.currentStock} onChange={e => setSiloFormData({...siloFormData, currentStock: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                            </div>

                            {siloFormData.feedType === 'Vitamin' && (
                                <div className="animate-fade-in">
                                    <label className="block text-sm font-medium mb-1">Tanggal Kadaluarsa (Khusus Vitamin)</label>
                                    <input 
                                        type="date" 
                                        value={siloFormData.expiryDate || ''} 
                                        onChange={e => setSiloFormData({...siloFormData, expiryDate: e.target.value})} 
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary-500" 
                                    />
                                </div>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowSiloModal(false)} className="flex-1 py-2 border rounded-lg font-bold text-slate-500 hover:bg-slate-50 transition">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-bold shadow-lg hover:bg-primary-700 transition">
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL EDIT JADWAL --- */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Jadwal Pakan</h3>
                            <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleScheduleUpdate} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Waktu</label>
                                    <input type="time" required value={editFormData.time} onChange={e => setEditFormData({...editFormData, time: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Status</label>
                                    <select value={editFormData.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none">
                                        <option value="TERJADWAL">TERJADWAL</option>
                                        <option value="Berlangsung">Berlangsung</option>
                                        <option value="Selesai">Selesai</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-1">Jenis Pakan</label>
                                <input type="text" required value={editFormData.feedType} onChange={e => setEditFormData({...editFormData, feedType: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pilih Kandang</label>
                                    <select 
                                        required 
                                        value={editZoneId} 
                                        onChange={e => {
                                            setEditZoneId(e.target.value);
                                            setEditFormData({...editFormData, sectionId: ''});
                                        }} 
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none"
                                    >
                                        <option value="">-- Pilih Kandang --</option>
                                        {zones.map(z => (
                                            <option key={z.id} value={z.id}>{z.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pilih Kandang</label>
                                    <select 
                                        required 
                                        disabled={!editZoneId}
                                        value={editFormData.sectionId} 
                                        onChange={e => setEditFormData({...editFormData, sectionId: e.target.value})} 
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none"
                                    >
                                        <option value="">-- Pilih Kandang --</option>
                                        {zones.find(z => z.id == editZoneId)?.sections?.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowScheduleModal(false)} className="flex-1 py-2 border rounded-lg font-bold text-slate-500 hover:bg-slate-50 transition">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-primary-600 text-white rounded-lg font-bold shadow-lg hover:bg-primary-700 transition">
                                    {isSubmitting ? 'Memperbarui...' : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL TRANSAKSI SILO (PAKAN MASUK / KELUAR) --- */}
            {showTransactionModal && selectedSiloForTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-slide-up">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Catat Transaksi Silo</h3>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Silo: {selectedSiloForTx.name} ({selectedSiloForTx.feedType})</p>
                            </div>
                            <button onClick={() => setShowTransactionModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleTransactionSubmit} className="p-6 space-y-4">
                            {/* Tipe Transaksi */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tipe Transaksi</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setTxFormData({...txFormData, type: 'MASUK'})}
                                        className={`py-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 ${
                                            txFormData.type === 'MASUK' 
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-500 dark:text-emerald-400' 
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                                        }`}
                                    >
                                        📥 Pakan Masuk
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setTxFormData({...txFormData, type: 'KELUAR'})}
                                        className={`py-3 rounded-xl font-bold border transition flex items-center justify-center gap-1.5 ${
                                            txFormData.type === 'KELUAR' 
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-500 dark:text-indigo-400' 
                                                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                                        }`}
                                    >
                                        📤 Pakan Keluar
                                    </button>
                                </div>
                            </div>

                            {/* Jumlah */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Jumlah ({selectedSiloForTx.unit})</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="any"
                                        required 
                                        placeholder="0.0" 
                                        value={txFormData.weightKg} 
                                        onChange={e => setTxFormData({...txFormData, weightKg: e.target.value})} 
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white font-bold" 
                                    />
                                    <span className="absolute right-4 top-3 text-sm font-bold text-slate-400">{selectedSiloForTx.unit}</span>
                                </div>
                            </div>

                            {/* Tanggal Kadaluarsa (Hanya untuk Vitamin & Transaksi MASUK) */}
                            {(selectedSiloForTx.feedType?.toLowerCase().includes('vitamin') || selectedSiloForTx.name?.toLowerCase().includes('vitamin')) && txFormData.type === 'MASUK' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tanggal Kadaluarsa (Khusus Vitamin)</label>
                                    <input 
                                        type="date" 
                                        required
                                        value={txFormData.expiryDate} 
                                        onChange={e => setTxFormData({...txFormData, expiryDate: e.target.value})} 
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" 
                                    />
                                </div>
                            )}

                            {/* Keterangan */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Keterangan / Catatan</label>
                                <textarea 
                                    rows="2"
                                    placeholder="Cth: Suplai distributor, sisa pakan pagi, dll." 
                                    value={txFormData.description} 
                                    onChange={e => setTxFormData({...txFormData, description: e.target.value})} 
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowTransactionModal(false)} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">Batal</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 transition">
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Feed;