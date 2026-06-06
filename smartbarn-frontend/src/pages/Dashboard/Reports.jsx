import { useState } from 'react';

const Reports = () => {
    // --- 1. STATE MANAGEMENT ---
    const [reportType, setReportType] = useState('Lingkungan');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState('');

    const API_URL = import.meta.env.VITE_API_BASE_URL;

    // --- 2. FUNGSI UNDUH (DOWNLOAD BLOB) ---
    const handleDownload = async (e) => {
        e.preventDefault();
        setIsDownloading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_URL}/reports/download?jenis=${reportType}&start=${startDate}&end=${endDate}&format=PDF`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Gagal mengunduh laporan dari server');
            }

            // 1. Ubah response dari server menjadi bentuk Blob (File Biner)
            const blob = await response.blob();

            // 2. Buat URL sementara (Object URL) di memori browser
            const url = window.URL.createObjectURL(blob);

            // 3. Buat elemen <a> fiktif untuk memicu klik download
            const a = document.createElement('a');
            a.href = url;

            // 4. Tetapkan nama file otomatis berdasarkan tanggal hari ini
            const today = new Date().toISOString().split('T')[0];
            a.download = `Laporan_${reportType}_Smart_Cattle_Barn_${today}.pdf`;

            // 5. Eksekusi proses unduh
            document.body.appendChild(a);
            a.click();

            // 6. Bersihkan memori (Penting agar browser tidak berat)
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            console.error("Download error:", err);
            setError(err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    // --- 3. RENDER UI ---
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Pusat Laporan Operasional</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Cetak rekapitulasi data ternak, pakan, dan sensor untuk laporan</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm max-w-2xl mx-auto">
                    Terjadi Kesalahan: {error}
                </div>
            )}

            <div className="flex justify-center mt-8">
                <div className="w-full max-w-2xl bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Buat Laporan Baru
                    </h2>

                    <form onSubmit={handleDownload} className="space-y-6">
                        {/* Pilihan Jenis Laporan */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jenis Laporan</label>
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition text-slate-900 dark:text-slate-100"
                            >
                                <option value="Lingkungan">Laporan Lingkungan Kandang (Sensor)</option>
                                <option value="Kesehatan">Laporan Kesehatan & Medis Ternak</option>
                                <option value="Populasi">Laporan Total Populasi Ternak</option>
                                <option value="Pakan">Laporan Konsumsi Pakan (As-Fed & BK)</option>
                                <option value="Limbah">Laporan Manajemen Limbah (Feses & Urine)</option>
                            </select>
                        </div>

                        {/* Pilihan Tanggal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dari Tanggal</label>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition text-slate-900 dark:text-slate-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sampai Tanggal</label>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none transition text-slate-900 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        {/* Tombol Aksi */}
                        <button
                            type="submit"
                            disabled={isDownloading}
                            className="w-full px-4 py-4 mt-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition shadow-lg shadow-primary-500/30 disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {isDownloading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Memproses Laporan...
                                </>
                            ) : (
                                <>Buat & Unduh Laporan</>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Reports;