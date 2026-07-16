import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../utils/api';
import toast from 'react-hot-toast';

const HistoryPage = () => {
    const [recentInputs, setRecentInputs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [editValue2, setEditValue2] = useState('');

    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null, label: '', isBatch: false });

    const fetchRecentInputs = async () => {
        setIsLoading(true);
        try {
            const res = await fetchApi('/livestock/recent-inputs');
            if (res.ok) {
                const data = await res.json();
                setRecentInputs(data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRecentInputs();
    }, []);

    const handleEdit = (item) => {
        setSelectedItem(item);
        if (item.type === 'PAKAN') {
            setEditValue(item.raw?.weightKg || '');
        } else if (item.type === 'TIMBANGAN') {
            setEditValue(item.raw?.weight || '');
        } else if (item.type === 'LIMBAH' || item.type === 'LIMBAH_KANDANG') {
            setEditValue(item.raw?.fecesKg || '');
            setEditValue2(item.raw?.urineL || '');
        }
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedItem) return;
        const { type, id } = selectedItem;
        const payload = {};

        if (type === 'PAKAN') {
            if (!editValue) return alert('Berat tidak boleh kosong');
            payload.weightKg = parseFloat(editValue);
        } else if (type === 'TIMBANGAN') {
            if (!editValue) return alert('Berat tidak boleh kosong');
            payload.weight = parseFloat(editValue);
        } else if (type === 'LIMBAH' || type === 'LIMBAH_KANDANG') {
            if (!editValue && !editValue2) return alert('Data tidak boleh kosong');
            if (editValue) payload.fecesKg = parseFloat(editValue);
            if (editValue2) payload.urineL = parseFloat(editValue2);
        }

        try {
            let endpoint = '';
            if (type === 'PAKAN') endpoint = `/livestock/feed/${id}`;
            else if (type === 'TIMBANGAN') endpoint = `/livestock/weight/${id}`;
            else if (type === 'LIMBAH') endpoint = `/livestock/waste/${id}`;
            else if (type === 'LIMBAH_KANDANG') endpoint = `/livestock/waste/zone/${id}`;

            const res = await fetchApi(endpoint, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success('Koreksi berhasil disimpan!');
                setIsEditModalOpen(false);
                fetchRecentInputs();
            } else {
                toast.error('Gagal menyimpan koreksi.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Terjadi kesalahan.');
        }
    };

    const handleDelete = (item) => {
        const itemLabel = item.type === 'LIMBAH_KANDANG' ? item.title : `${item.title} sapi ${item.cattleId}`;
        setDeleteConfirm({ isOpen: true, item: item, label: itemLabel, isBatch: false });
    };

    const confirmDelete = async () => {
        const { item } = deleteConfirm;
        if (!item) return;

        try {
            const id = item.id;
            let endpoint = '';
            if (item.type === 'PAKAN') endpoint = `/livestock/feed/${id}`;
            else if (item.type === 'TIMBANGAN') endpoint = `/livestock/weight/${id}`;
            else if (item.type === 'LIMBAH') endpoint = `/livestock/waste/${id}`;
            else if (item.type === 'LIMBAH_KANDANG') endpoint = `/livestock/waste/zone/${id}`;

            const res = await fetchApi(endpoint, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Data berhasil dihapus!');
                fetchRecentInputs();
            } else {
                toast.error('Gagal menghapus data.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Terjadi kesalahan.');
        } finally {
            setDeleteConfirm({ isOpen: false, item: null, label: '', isBatch: false });
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Riwayat & Koreksi</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Daftar input terbaru ke sistem</p>
                </div>
                <button
                    onClick={fetchRecentInputs}
                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    title="Muat Ulang"
                >
                    <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-medium">Memuat riwayat...</p>
                </div>
            ) : recentInputs.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Belum Ada Riwayat</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm">Data yang diinput seperti pakan dan timbangan akan muncul di sini.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentInputs.map((item, idx) => (
                        <div key={`${item.type}-${item.id}-${idx}`} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                        item.type === 'PAKAN' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
                                        item.type === 'TIMBANGAN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    }`}>
                                        {item.type}
                                    </span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {item.type === 'LIMBAH_KANDANG' ? `Kandang: ${item.zoneName}` : `Sapi ID: ${item.cattleId}`}
                                    </span>
                                </div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.details}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {new Date(item.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>

                            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                <button
                                    onClick={() => handleEdit(item)}
                                    className="flex-1 py-2 px-3 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/30 dark:hover:bg-sky-900/50 text-sky-600 dark:text-sky-400 font-bold text-xs rounded-xl transition"
                                >
                                    Koreksi
                                </button>
                                <button
                                    onClick={() => handleDelete(item)}
                                    className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl transition"
                                >
                                    Hapus
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Koreksi Data */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/55">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Koreksi Data {selectedItem?.type}</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition text-slate-500">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedItem?.type === 'LIMBAH_KANDANG' ? (
                                    <>Kandang: <b>{selectedItem?.zoneName}</b> | </>
                                ) : (
                                    <>Sapi ID: <b>{selectedItem?.cattleId}</b> | </>
                                )}
                                Silakan masukkan data koreksi terbaru.
                            </p>
                            {selectedItem?.type === 'PAKAN' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Berat Pakan Baru (Kg)</label>
                                    <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                                </div>
                            )}
                            {selectedItem?.type === 'TIMBANGAN' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Berat Sapi Baru (Kg)</label>
                                    <input type="number" step="0.1" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                                </div>
                            )}
                            {(selectedItem?.type === 'LIMBAH' || selectedItem?.type === 'LIMBAH_KANDANG') && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Feces Baru (Kg)</label>
                                        <input type="number" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Urine Baru (Liter)</label>
                                        <input type="number" step="0.01" value={editValue2} onChange={(e) => setEditValue2(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/55">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs rounded-xl transition">Batal</button>
                            <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Hapus */}
            {deleteConfirm.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 p-6 text-center animate-slide-up">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Konfirmasi Hapus</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Apakah Anda yakin ingin menghapus data <b>{deleteConfirm.label}</b>?</p>
                        
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm({ isOpen: false, item: null, label: '', isBatch: false })} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">Batal</button>
                            <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition">Ya, Hapus</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoryPage;