import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { fetchApi } from '../../utils/api';
import ConfirmModal from '../../components/common/ConfirmModal';

const fetcher = async (url) => {
    const res = await fetchApi(url);
    if (!res.ok) throw new Error('Gagal mengambil data dari server');
    return res.json();
};

const HealthPage = () => {
  const userRole = localStorage.getItem('userRole');
  
  const { data: healthData, error: swrError, isLoading: swrLoading, mutate: mutateHealth } = useSWR('/health', fetcher);
  const { data: livestockData } = useSWR('/livestock', fetcher);

  // ==========================================
  // BAGIAN 1: DEKLARASI STATE KOMPONEN
  // ==========================================
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [healthRecords, setHealthRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Bulk / Vaccination States
  const [livestock, setLivestock] = useState([]);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedCattleIds, setSelectedCattleIds] = useState([]);
  const [isSelectAll, setIsSelectAll] = useState(true);
  const [cattleSearchTerm, setCattleSearchTerm] = useState('');

  // State Confirm Modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  // State Form Input
  const [formData, setFormData] = useState({
    id: null, // Tambahkan ID untuk mode edit
    cattleId: '',
    diagnosis: '',
    treatment: '',
    vet: '',
    notes: '',
    status: 'Dalam Perawatan'
  });

  // ==========================================
  // BAGIAN 2: LOGIKA PENGAMBILAN DATA (FETCHING)
  // ==========================================
  const fetchHealthRecords = async () => {
    await mutateHealth();
  };

  useEffect(() => {
    if (healthData) {
        setHealthRecords(healthData);
        setError(null);
    }
    if (swrError) setError(swrError.message);
    setIsLoading(swrLoading);
  }, [healthData, swrError, swrLoading]);

  useEffect(() => {
    if (livestockData) {
        setLivestock(livestockData);
    }
  }, [livestockData]);

  // ==========================================
  // BAGIAN 3: PENGENDALI INPUT FORMULIR
  // ==========================================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ==========================================
  // BAGIAN 4: LOGIKA SUBMIT DAN MUTASI DATA
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const isEdit = !!formData.id;

    if (isBulkMode && !isEdit) {
        const payload = {
            cattleIds: isSelectAll ? [] : selectedCattleIds,
            diagnosis: formData.diagnosis,
            treatment: formData.treatment,
            vet: formData.vet,
            status: formData.status === 'Dalam Perawatan' ? 'DALAM_PERAWATAN' : 
                    formData.status === 'Sembuh' ? 'SEMBUH' : 
                    formData.status === 'Sakit' ? 'SAKIT' : 
                    formData.status === 'Mati' ? 'MATI' : 'KRITIS'
        };

        toast.promise(
            fetchApi('/health/bulk', {
                method: 'POST',
                body: JSON.stringify(payload)
            }).then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Gagal menyimpan rekam medis massal');
                }
                return res.json();
            }),
            {
                loading: 'Mencatat rekam medis massal...',
                success: (resData) => {
                    setIsModalOpen(false);
                    setFormData({ id: null, cattleId: '', diagnosis: '', treatment: '', vet: '', notes: '', status: 'Dalam Perawatan' });
                    setSelectedCattleIds([]);
                    setIsSelectAll(true);
                    fetchHealthRecords();
                    return `Pencatatan massal berhasil untuk ${resData.count} sapi!`;
                },
                error: (err) => `Error: ${err.message}`,
            }
        ).finally(() => setIsSubmitting(false));
        return;
    }

    const method = isEdit ? 'PATCH' : 'POST';
    const url = isEdit ? `/health/${formData.id}` : '/health';

    const payload = {
        cattleId: formData.cattleId,
        diagnosa: formData.diagnosis,
        penanganan: formData.treatment,
        pemeriksa: formData.vet,
        status: formData.status === 'Dalam Perawatan' ? 'DALAM_PERAWATAN' : 
                formData.status === 'Sembuh' ? 'SEMBUH' : 
                formData.status === 'Sakit' ? 'SAKIT' : 
                formData.status === 'Mati' ? 'MATI' : 'KRITIS'
    };

        toast.promise(
            fetchApi(url, {
                method,
                body: JSON.stringify(payload)
            }).then(async (res) => {
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.message || 'Gagal menyimpan rekam medis');
                }
                return res.json();
            }),
            {
                loading: 'Menyimpan rekam medis...',
                success: (savedRecord) => {
                    setIsModalOpen(false);
                    setFormData({ id: null, cattleId: '', diagnosis: '', treatment: '', vet: '', notes: '', status: 'Dalam Perawatan' });
                    
                    if (isEdit) {
                        setHealthRecords(prev => prev.map(r => r.id === savedRecord.id ? savedRecord : r));
                    } else {
                        setHealthRecords(prev => [savedRecord, ...prev]);
                    }
                    
                    return `Rekam medis berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}!`;
                },
                error: (err) => `Error: ${err.message}`,
            }
        ).finally(() => setIsSubmitting(false));
  };

  // --- 4.1 FUNGSI EDIT & HAPUS ---
  const handleEdit = (record) => {
    setIsBulkMode(false);
    setFormData({
        id: record.id,
        cattleId: record.cattleId,
        diagnosis: record.diagnosa || record.diagnosis || '',
        treatment: record.penanganan || record.treatment || '',
        vet: record.pemeriksa || record.vet || '',
        status: record.status === 'DALAM_PERAWATAN' ? 'Dalam Perawatan' : 
                record.status === 'SEMBUH' ? 'Sembuh' : 
                record.status === 'SAKIT' ? 'Sakit' : 
                record.status === 'MATI' ? 'Mati' : 
                record.status === 'KRITIS' ? 'Kritis' : record.status,
        notes: ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    const id = confirmModal.id;
    setConfirmModal({ isOpen: false, id: null });
    
    try {
        const response = await fetchApi(`/health/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Gagal menghapus data');
        
        setHealthRecords(healthRecords.filter(r => r.id !== id));
        toast.success('Rekam medis berhasil dihapus');
    } catch (err) {
        toast.error(err.message);
    }
  };

  // --- 4.2 FILTERING DATA ---
  const filteredRecords = healthRecords.filter(record => {
    const searchStr = (record.cattleId + (record.diagnosa || record.diagnosis)).toLowerCase();
    const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || record.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- 5. RENDER UI ---
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Aksi */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Rekam Medis Ternak</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Kelola riwayat kesehatan dan jadwal pemeriksaan dokter hewan</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <input 
                type="text" 
                placeholder="Cari ID Sapi atau Penyakit..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none w-full md:w-64"
            />
            <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none font-medium"
            >
                <option value="ALL">Semua Rekam</option>
                <option value="SAKIT">Sakit</option>
                <option value="DALAM_PERAWATAN">Dalam Perawatan</option>
                <option value="SEMBUH">Sembuh</option>
                <option value="KRITIS">Kritis</option>
                <option value="MATI">Mati</option>
            </select>
            {userRole === 'VETERINER' && (
                <button 
                    onClick={() => {
                        setFormData({ id: null, cattleId: '', diagnosis: '', treatment: '', vet: '', notes: '', status: 'Dalam Perawatan' });
                        setIsBulkMode(false);
                        setSelectedCattleIds([]);
                        setIsSelectAll(true);
                        setCattleSearchTerm('');
                        setIsModalOpen(true);
                    }}
                    className="bg-gradient-to-r from-primary-500 to-indigo-600 hover:from-primary-600 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all duration-300 hover:scale-105 shadow-lg shadow-primary-500/30 flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Catat Pemeriksaan Baru
                </button>
            )}
        </div>
      </div>

      {error && (
          <div className="p-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm">
              Mode Offline / Error: {error}. Menampilkan data cadangan lokal.
          </div>
      )}

      {/* Tabel Data Rekam Medis */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/40 dark:border-slate-700/50 overflow-hidden transition-all duration-300 hover:shadow-2xl">
          {isLoading ? (
               <div className="flex justify-center items-center h-40">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
               </div>
          ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">ID Sapi</th>
                            <th className="px-6 py-4">Tanggal</th>
                            <th className="px-6 py-4">Diagnosis</th>
                            <th className="px-6 py-4">Penanganan</th>
                            <th className="px-6 py-4">Dokter</th>
                             <th className="px-6 py-4">Status</th>
                             {userRole === 'VETERINER' && <th className="px-6 py-4 text-center">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {paginatedRecords.length > 0 ? paginatedRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{record.cattleId}</td>
                                <td className="px-6 py-4">{record.createdAt ? new Date(record.createdAt).toLocaleDateString('id-ID') : '-'}</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                        {record.diagnosa || record.diagnosis || '-'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">{record.penanganan || record.treatment || '-'}</td>
                                <td className="px-6 py-4">{record.pemeriksa || record.vet || '-'}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                        record.status === 'SEMBUH' || record.status === 'Sembuh' ? 'bg-green-50 text-green-700 border-green-200' :
                                        record.status === 'KRITIS' || record.status === 'Kritis' ? 'bg-red-50 text-red-700 border-red-200' :
                                        record.status === 'MATI' || record.status === 'Mati' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' :
                                        'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}>
                                        {record.status === 'DALAM_PERAWATAN' ? 'DALAM PERAWATAN' : record.status}
                                    </span>
                                </td>
                                {userRole === 'VETERINER' && (
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleEdit(record)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Edit">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button onClick={() => handleDelete(record.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition" title="Hapus">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        )) : (
                            <tr>
                                 <td colSpan={userRole === 'VETERINER' ? 7 : 6} className="px-6 py-8 text-center text-slate-500">Belum ada data rekam medis.</td>
                             </tr>
                        )}
                    </tbody>
                </table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {!isLoading && totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                      Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} dari {filteredRecords.length} data
                  </span>
                  <div className="flex gap-1">
                      <button 
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300"
                      >
                          Mundur
                      </button>
                      <div className="flex items-center px-3 py-1 text-xs font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg">
                          Halaman {currentPage} / {totalPages}
                      </div>
                      <button 
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300"
                      >
                          Lanjut
                      </button>
                  </div>
              </div>
          )}
      </div>

      {/* --- MODAL FORM --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-white/50 dark:border-slate-600 transition-all transform scale-100">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{formData.id ? 'Edit Rekam Medis' : 'Catat Pemeriksaan Baru'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {!formData.id && (
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsBulkMode(false);
                                    setFormData(prev => ({ ...prev, diagnosis: '', treatment: '', status: 'Dalam Perawatan' }));
                                }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${!isBulkMode ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                Pemeriksaan Individu
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsBulkMode(true);
                                    setFormData(prev => ({ ...prev, diagnosis: 'Vaksinasi', treatment: 'Vaksin PMK Dosis 1', status: 'Sembuh' }));
                                }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${isBulkMode ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            >
                                Vaksinasi / Massal
                            </button>
                        </div>
                    )}

                    {isBulkMode && !formData.id ? (
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-bold text-slate-850 dark:text-slate-200">Pilih Target Sapi *</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsSelectAll(true)}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${isSelectAll ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-350'}`}
                                    >
                                        Semua Sapi
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsSelectAll(false)}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${!isSelectAll ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-350'}`}
                                    >
                                        Sapi Pilihan
                                    </button>
                                </div>
                            </div>

                            {isSelectAll ? (
                                <p className="text-xs text-slate-500 dark:text-slate-450 italic bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                    Semua sapi ({livestock.length} ekor) yang terdaftar di peternakan akan dicatat rekam medis kesehatannya sekaligus.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Cari ID Sapi..."
                                        value={cattleSearchTerm}
                                        onChange={(e) => setCattleSearchTerm(e.target.value)}
                                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded-lg outline-none text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-primary-500"
                                    />
                                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-750 rounded-lg p-2.5 bg-white dark:bg-slate-800">
                                        {livestock
                                            .filter(cow => cow.cattleId.toLowerCase().includes(cattleSearchTerm.toLowerCase()))
                                            .map(cow => {
                                                const isChecked = selectedCattleIds.includes(cow.cattleId);
                                                return (
                                                    <label
                                                        key={cow.cattleId}
                                                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs font-bold cursor-pointer transition ${isChecked ? 'bg-primary-50 dark:bg-primary-950/20 border-primary-305 text-primary-700 dark:text-primary-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-750 text-slate-650 dark:text-slate-300 hover:bg-slate-50'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (isChecked) {
                                                                    setSelectedCattleIds(prev => prev.filter(id => id !== cow.cattleId));
                                                                } else {
                                                                    setSelectedCattleIds(prev => [...prev, cow.cattleId]);
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 text-primary-650 focus:ring-primary-500 w-3.5 h-3.5"
                                                        />
                                                        <span>{cow.cattleId}</span>
                                                    </label>
                                                );
                                            })
                                        }
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Terpilih: <span className="font-bold text-primary-600">{selectedCattleIds.length}</span> dari {livestock.length} sapi
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ID Sapi *</label>
                                <input
                                    type="text"
                                    name="cattleId"
                                    required
                                    placeholder="Cth: C-302"
                                    value={formData.cattleId}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status Pasca Periksa</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                                >
                                    <option value="Sakit">Sakit</option>
                                    <option value="Dalam Perawatan">Dalam Perawatan</option>
                                    <option value="Sembuh">Sembuh</option>
                                    <option value="Kritis">Kritis</option>
                                    <option value="Mati">Mati</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {isBulkMode && !formData.id && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status Pasca Periksa</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                            >
                                <option value="Sakit">Sakit</option>
                                <option value="Dalam Perawatan">Dalam Perawatan</option>
                                <option value="Sembuh">Sembuh</option>
                                <option value="Kritis">Kritis</option>
                                <option value="Mati">Mati</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {isBulkMode ? 'Nama Vaksin / Diagnosis *' : 'Diagnosis Penyakit *'}
                        </label>
                        <input
                            type="text"
                            name="diagnosis"
                            required
                            placeholder={isBulkMode ? "Cth: Vaksinasi Anthrax / PMK" : "Cth: Flu Bovine"}
                            value={formData.diagnosis}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {isBulkMode ? 'Detail Vaksinasi / Penanganan *' : 'Penanganan / Obat *'}
                        </label>
                        <input
                            type="text"
                            name="treatment"
                            required
                            placeholder={isBulkMode ? "Cth: Dosis 2ml intramuskular" : "Cth: Injeksi Vitamin C"}
                            value={formData.treatment}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Petugas / Dokter Hewan Bertugas</label>
                        <input
                            type="text"
                            name="vet"
                            placeholder="Nama Pemeriksa / Petugas"
                            value={formData.vet}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-slate-800 dark:text-slate-100"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-bold transition"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (isBulkMode && !isSelectAll && selectedCattleIds.length === 0)}
                            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-bold shadow-lg shadow-primary-600/30 transition disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Menyimpan...' : (formData.id ? 'Perbarui Data' : 'Simpan Data')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- CONFIRM MODAL --- */}
      <ConfirmModal 
          isOpen={confirmModal.isOpen}
          title="Hapus Rekam Medis?"
          message="Tindakan ini akan menghapus riwayat kesehatan sapi secara permanen. Anda tidak dapat mengembalikannya."
          confirmText="Ya, Hapus"
          isDanger={true}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  );
};

export default HealthPage;