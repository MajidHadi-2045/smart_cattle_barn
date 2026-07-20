import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { fetchApi } from '../../utils/api';

const fetcher = async (url) => {
    const res = await fetchApi(url);
    if (!res.ok) throw new Error('Gagal mengambil data dari server');
    return res.json();
};

const Feed = () => {
    const userRole = localStorage.getItem('userRole');
    // --- 1. STATE MANAGEMENT ---
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' atau 'schedule'
    const [silos, setSilos] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [zones, setZones] = useState([]);
    const [cows, setCows] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // SWR Hooks
    const { data: silosData, mutate: mutateSilos, isLoading: isSilosLoading } = useSWR('/feed/silo', fetcher);
    const { data: schedulesData, mutate: mutateSchedules, isLoading: isSchedulesLoading } = useSWR('/feed/schedule', fetcher);
    const { data: cowsData, isLoading: isCowsLoading } = useSWR('/livestock', fetcher);
    const { data: zonesData, isLoading: isZonesLoading } = useSWR('/zones', fetcher);
    const { data: reportData, mutate: mutateReport, isLoading: isReportLoading } = useSWR('/feed/report', fetcher);
    
    // Gunakan SWR isLoading agar spinner hanya muncul di load awal (belum ada cache)
    const isLoading = isSilosLoading || isSchedulesLoading || isCowsLoading || isZonesLoading;

    // State untuk Form Jadwal Baru
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [newSchedule, setNewSchedule] = useState({
        timeStart: '',
        timeEnd: '',
        zoneId: '', 
        feedType: '', 
        status: 'BELUM'
    });

    // State untuk Edit Jadwal
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [editZoneId, setEditZoneId] = useState('');
    const [editFormData, setEditFormData] = useState({
        timeStart: '',
        timeEnd: '',
        zoneId: '',
        feedType: '',
        status: ''
    });

    // State untuk Manajemen Silo
    const [showSiloModal, setShowSiloModal] = useState(false);
    const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
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

    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, type: '', title: '' });

    // State Laporan Pakan & Sapi
    const [feedReport, setFeedReport] = useState({
        transactions: [],
        cows: { total: 0, breeds: [] }
    });

    // State Pagination Transaksi
    const [currentTxPage, setCurrentTxPage] = useState(1);
    const TX_PER_PAGE = 10;

    // --- 2. EFFECT UNTUK SINKRONISASI CACHE SWR KE STATE ---
    useEffect(() => {
        if (silosData) {
            setSilos(silosData.map(s => ({
                ...s,
                current: s.currentStock,
                max: s.capacity,
                isCritical: s.status === 'KRITIS'
            })));
        }
        if (schedulesData) setSchedules(schedulesData);
        if (cowsData) setCows(cowsData);
        if (zonesData) setZones(zonesData);
        if (reportData) setFeedReport(reportData);
    }, [silosData, schedulesData, cowsData, zonesData, reportData]);

    // --- 3. FUNGSI MENYIMPAN JADWAL (POST) ---
    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const finalFeedType = newSchedule.feedType;

        toast.promise(
            fetchApi('/feed/schedule', {
                method: 'POST',
                body: JSON.stringify({
                    time: `${newSchedule.timeStart} - ${newSchedule.timeEnd}`,
                    zoneId: newSchedule.zoneId,
                    feedType: finalFeedType,
                    status: newSchedule.status
                })
            }).then(async (res) => {
                if (!res.ok) throw new Error('Gagal menyimpan jadwal');
                return res.json();
            }),
            {
                loading: 'Menyimpan jadwal...',
                success: (savedSchedule) => {
                    mutateSchedules(); // Update Cache SWR
                    setNewSchedule({ timeStart: '', timeEnd: '', zoneId: '', feedType: '', status: 'BELUM' });
                    setShowNewScheduleModal(false);
                    return 'Jadwal berhasil ditambahkan!';
                },
                error: (err) => `Gagal: ${err.message}`,
            }
        ).finally(() => setIsSubmitting(false));
    };

    // --- 3.1 QUICK TOGGLE JADWAL ---
    const handleToggleStatus = async (sch) => {
        toast('Info: Status jadwal pakan kini diperbarui otomatis (menjadi SUDAH, TELAT, atau LEBIH AWAL) saat Anda mencatat pakan.', {
            icon: 'ℹ️',
        });
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
                    mutateSilos(); // Update Cache SWR
                    return isEdit ? 'Silo berhasil diperbarui' : 'Silo baru berhasil ditambahkan';
                },
                error: 'Gagal menyimpan data silo',
            }
        ).finally(() => setIsSubmitting(false));
    };

    const handleDeleteSilo = (id) => {
        setDeleteConfirm({
            isOpen: true,
            id: id,
            type: 'silo',
            title: 'Hapus stok silo ini? Seluruh data stok akan hilang permanen.'
        });
    };

    const confirmDeleteSilo = async (id) => {
        try {
            await fetchApi(`/feed/silo/${id}`, { method: 'DELETE' });
            mutateSilos(); // Update Cache SWR
            toast.success('Silo berhasil dihapus');
        } catch (err) {
            toast.error('Gagal menghapus: ' + err.message);
        } finally {
            setDeleteConfirm({ isOpen: false, id: null, type: '', title: '' });
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
                    mutateSilos(); // update silos list cache
                    mutateReport(); // refresh report cache
                    return 'Transaksi pakan berhasil disimpan!';
                },
                error: (err) => `Gagal: ${err.message}`
            }
        ).finally(() => setIsSubmitting(false));
    };

    // --- 4. FUNGSI HAPUS JADWAL (DELETE) ---
    const handleDeleteSchedule = (id) => {
        setDeleteConfirm({
            isOpen: true,
            id: id,
            type: 'schedule',
            title: 'Hapus jadwal pakan ini?'
        });
    };

    const confirmDeleteSchedule = async (id) => {
        try {
            await fetchApi(`/feed/schedule/${id}`, {
                method: 'DELETE'
            });
            mutateSchedules(); // Update Cache SWR
            toast.success('Jadwal berhasil dihapus');
        } catch (err) {
            toast.error('Gagal menghapus: ' + err.message);
        } finally {
            setDeleteConfirm({ isOpen: false, id: null, type: '', title: '' });
        }
    };

    // --- 4.1 FUNGSI EDIT JADWAL (UPDATE) ---
    const openEditSchedule = (sch) => {
        const [timeStart, timeEnd] = (sch.time || '').split(' - ');
        setEditingSchedule(sch);
        setEditFormData({
            timeStart: timeStart || '',
            timeEnd: timeEnd || '',
            zoneId: sch.zoneId,
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
                body: JSON.stringify({
                    time: `${editFormData.timeStart} - ${editFormData.timeEnd}`,
                    zoneId: editFormData.zoneId,
                    feedType: editFormData.feedType,
                    status: editFormData.status
                })
            }).then(async (res) => {
                if (!res.ok) throw new Error('Gagal memperbarui jadwal');
                return res.json();
            }),
            {
                loading: 'Memperbarui jadwal...',
                success: (updatedSchedule) => {
                    mutateSchedules(); // Update Cache SWR
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
                    {userRole === 'STAFF' && (
                        <button 
                            onClick={() => setActiveTab('schedule')} 
                            className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'schedule' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            Jadwal Pakan
                        </button>
                    )}
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
                                let barColor = 'bg-green-500';
                                if (percentage <= 20 || silo.isCritical) {
                                    barColor = 'bg-red-500';
                                } else if (percentage <= 50) {
                                    barColor = 'bg-amber-400'; // Kuning/Amber untuk peringatan
                                }
                                
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
                                const isTmr = typeStr.includes('tmr') || nameStr.includes('tmr');
                                
                                // Variabel penanda untuk UI tooltip
                                let calcCategory = 'Umum';

                                if (isHijauan || isKonsentrat || isTmr) {
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
                                        } else if (isTmr) {
                                            calcCategory = 'TMR';
                                            const tmrDM = cow.forageDM ?? 50; 
                                            dailyConsumption += bkRequirement / (tmrDM / 100);
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
                                        {userRole === 'STAFF' && (
                                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditSilo(silo)} className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-blue-500 rounded-lg shadow-sm">
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                </button>
                                                <button onClick={() => handleDeleteSilo(silo.id)} className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-red-500 rounded-lg shadow-sm">
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        )}

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

                                        {userRole === 'STAFF' && (
                                            <div className="opacity-0 max-h-0 overflow-hidden pointer-events-none group-hover:opacity-100 group-hover:max-h-20 group-hover:pointer-events-auto transition-all duration-300">
                                                <button 
                                                    onClick={() => openTransactionModal(silo)} 
                                                    className="w-full mt-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-indigo-100 dark:border-indigo-900/30 shadow-sm"
                                                >
                                                    🔄 Catat Catatan Stok Pakan
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Tombol Tambah Silo Baru */}
                            {userRole === 'STAFF' && (
                                <button 
                                    onClick={() => { setSiloFormData({ id: null, name: '', feedType: 'Hijauan', capacity: 100, currentStock: 0, unit: 'Kg', expiryDate: '' }); setShowSiloModal(true); }}
                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition group h-full min-h-[180px]"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary-100 group-hover:text-primary-600 transition mb-3">
                                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                    </div>
                                    <span className="font-bold text-slate-500 group-hover:text-primary-600 transition">Tambah Bar Stok</span>
                                </button>
                            )}
                            
                        </div>
                    )}

                    {/* --- TAB: SCHEDULE (JADWAL PAKAN) --- */}
                    {activeTab === 'schedule' && (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Daftar Jadwal Pakan</h3>
                                    <p className="text-sm text-slate-500">Kelola jadwal pemberian pakan harian untuk semua kandang</p>
                                </div>
                                {userRole === 'STAFF' && (
                                    <button 
                                        onClick={() => setShowNewScheduleModal(true)}
                                        className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 transition flex items-center gap-2"
                                    >
                                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                        </svg>
                                        Tambah Jadwal
                                    </button>
                                )}
                            </div>

                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                                <div className="space-y-4">
                                    {schedules.length > 0 ? schedules.map(sch => (
                                        <div key={sch.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="px-3 py-2 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-lg font-bold">
                                                    {sch.time}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-100">{sch.feedType}</p>
                                                    <p className="text-sm text-slate-500">
                                                        {sch.zone ? sch.zone.name : sch.location || 'Lokasi tidak diketahui'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 self-start sm:self-auto">
                                                <button 
                                                    onClick={() => handleToggleStatus(sch)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-full transition ${
                                                        sch.status === 'SUDAH' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200' :
                                                        sch.status === 'LEBIH_AWAL' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-200' :
                                                        sch.status === 'TELAT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200' :
                                                        'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                                    }`}
                                                >
                                                    {sch.status === 'LEBIH_AWAL' ? 'LEBIH AWAL' : sch.status}
                                                </button>
                                                {userRole === 'STAFF' && (
                                                    <div className="flex gap-1 ml-2">
                                                        <button onClick={() => openEditSchedule(sch)} className="p-1.5 text-slate-400 hover:text-blue-500 transition" title="Edit Jadwal">
                                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteSchedule(sch.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition" title="Hapus Jadwal">
                                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-slate-500 text-center py-4">Belum ada jadwal pakan.</p>
                                    )}
                                </div>
                            </div>
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
                                 {(() => {
                                     const totalTxPages = Math.ceil((feedReport.transactions?.length || 0) / TX_PER_PAGE);
                                     const paginatedTx = (feedReport.transactions || []).slice((currentTxPage - 1) * TX_PER_PAGE, currentTxPage * TX_PER_PAGE);
                                     return (
                                     <>
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
                                             {paginatedTx.length > 0 ? (
                                                 paginatedTx.map((tx) => (
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
                                
                                {/* Pagination Controls */}
                                {totalTxPages > 1 && (
                                    <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            Menampilkan {(currentTxPage - 1) * TX_PER_PAGE + 1} - {Math.min(currentTxPage * TX_PER_PAGE, feedReport.transactions.length)} dari {feedReport.transactions.length} data
                                        </span>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => setCurrentTxPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentTxPage === 1}
                                                className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300"
                                            >
                                                Mundur
                                            </button>
                                            <div className="flex items-center px-3 py-1 text-xs font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg">
                                                Halaman {currentTxPage} / {totalTxPages}
                                            </div>
                                            <button 
                                                onClick={() => setCurrentTxPage(prev => Math.min(prev + 1, totalTxPages))}
                                                disabled={currentTxPage === totalTxPages}
                                                className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300"
                                            >
                                                Lanjut
                                            </button>
                                        </div>
                                    </div>
                                )}
                                </>
                                )})()}
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
                                        <option value="TMR">TMR</option>
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
                                    <label className="block text-sm font-medium mb-1">Waktu Mulai</label>
                                    <input type="time" required value={editFormData.timeStart} onChange={e => setEditFormData({...editFormData, timeStart: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Waktu Selesai</label>
                                    <input type="time" required value={editFormData.timeEnd} onChange={e => setEditFormData({...editFormData, timeEnd: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Jenis Pakan</label>
                                    <input type="text" required value={editFormData.feedType} onChange={e => setEditFormData({...editFormData, feedType: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Status</label>
                                    <select value={editFormData.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none">
                                        <option value="BELUM">BELUM</option>
                                        <option value="SUDAH">SUDAH</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pilih Kandang</label>
                                    <select 
                                        required 
                                        value={editFormData.zoneId} 
                                        onChange={e => {
                                            setEditFormData({...editFormData, zoneId: e.target.value});
                                        }} 
                                        className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 outline-none"
                                    >
                                        <option value="">-- Pilih Kandang --</option>
                                        {zones.map(z => (
                                            <option key={z.id} value={z.id}>{z.name}</option>
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

            {/* Modal Tambah Jadwal Pakan */}
            {showNewScheduleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 my-8 animate-slide-up">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Buat Jadwal Baru</h3>
                            <button onClick={() => setShowNewScheduleModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleScheduleSubmit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Waktu Mulai</label>
                                        <input type="time" required value={newSchedule.timeStart} onChange={e => setNewSchedule({...newSchedule, timeStart: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Waktu Selesai</label>
                                        <input type="time" required value={newSchedule.timeEnd} onChange={e => setNewSchedule({...newSchedule, timeEnd: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jenis Pakan</label>
                                        <select required value={newSchedule.feedType} onChange={e => setNewSchedule({...newSchedule, feedType: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white">
                                            <option value="">Pilih Metode/Jenis Pakan</option>
                                            <option value="Hijauan">Hijauan</option>
                                            <option value="Konsentrat">Konsentrat</option>
                                            <option value="Hijauan + Konsentrat">Hijauan + Konsentrat</option>
                                            <option value="TMR">TMR</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pilih Kandang</label>
                                    <select 
                                        required 
                                        value={newSchedule.zoneId} 
                                        onChange={e => {
                                            setNewSchedule({...newSchedule, zoneId: e.target.value});
                                        }} 
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                                    >
                                        <option value="">-- Pilih Kandang --</option>
                                        {zones.map(z => (
                                            <option key={z.id} value={z.id}>{z.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setShowNewScheduleModal(false)} className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                                        Batal
                                    </button>
                                    <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition shadow-lg shadow-primary-500/30 disabled:opacity-70">
                                        {isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL KONFIRMASI HAPUS --- */}
            {deleteConfirm.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 p-6 text-center animate-slide-up">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Konfirmasi Hapus</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{deleteConfirm.title}</p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirm({ isOpen: false, id: null, type: '', title: '' })} 
                                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={() => {
                                    if (deleteConfirm.type === 'schedule') confirmDeleteSchedule(deleteConfirm.id);
                                    if (deleteConfirm.type === 'silo') confirmDeleteSilo(deleteConfirm.id);
                                }} 
                                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Feed;