// File: src/components/dashboard/UserProfileModal.jsx
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

const UserProfileModal = ({ isOpen, onClose, user, onPhotoUpdate }) => {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
        // Cek apakah ada foto di local storage untuk user ini
        const savedPhoto = localStorage.getItem(`profile_photo_${user.id}`);
        setPhotoPreview(savedPhoto || user.photo || user.photo_url || null);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handlePhotoClick = () => {
    if(!isUploading) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
        toast.error('Mohon upload file gambar.');
        return;
    }

    // Validasi ukuran file (Maksimal 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB dalam bytes
    if (file.size > maxSize) {
        toast.error('Ukuran foto terlalu besar (Maksimal 5MB)');
        return;
    }

    setIsUploading(true);

    // Menggunakan FileReader untuk menyimpan foto Base64 ke Database
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = reader.result;
        setPhotoPreview(base64String);
        localStorage.setItem(`profile_photo_${user.id}`, base64String); // Backup lokal
        
        try {
            const token = localStorage.getItem('token');
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
            
            const response = await fetch(`${apiUrl}/users/profile/${user.id}/photo`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({ photo: base64String })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Gagal mengunggah foto ke database');
            }

            toast.success('Foto profil berhasil diperbarui!');
            if (onPhotoUpdate) onPhotoUpdate(base64String);
        } catch (error) {
            console.error("Gagal simpan ke DB:", error);
            toast.error(error.message || 'Koneksi server terputus saat mengunggah foto');
            // Kembalikan ke foto lama jika gagal
            const savedPhoto = localStorage.getItem(`profile_photo_${user.id}`);
            setPhotoPreview(savedPhoto || user.photo_url || null);
        } finally {
            setIsUploading(false);
        }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[99] p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 relative transform transition-all scale-100">
        
        {/* Tombol Close */}
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 z-10 bg-black/20 hover:bg-black/40 text-white rounded-full p-2 transition backdrop-blur-md"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        {/* ... (Background Header Tetap Sama) ... */}
        <div className="h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative">
            <div className="absolute inset-0 bg-black/10"></div>
        </div>

        <div className="px-6 pb-8 text-center -mt-16 relative">
            
            {/* AREA FOTO PROFIL */}
            <div className="relative inline-block group">
                <div 
                    onClick={handlePhotoClick}
                    className={`w-32 h-32 mx-auto rounded-full border-4 border-white dark:border-slate-800 bg-slate-200 overflow-hidden shadow-lg cursor-pointer relative z-10 ${isUploading ? 'opacity-50' : ''}`}
                >
                    {photoPreview ? (
                        <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-4xl bg-slate-100 dark:bg-slate-900">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                    )}
                    
                    {/* Overlay Loading atau Kamera */}
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {isUploading ? (
                            <span className="text-white text-xs">Mengunggah...</span>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                <span className="text-white text-[10px] font-medium mt-1">Ubah Foto</span>
                            </>
                        )}
                    </div>
                </div>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                    disabled={isUploading}
                />
            </div>
            
            
            <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{user.name?.replace(/\b(?:super\s*)?admin\b/gi, '').trim()}</h2>
            <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-1 uppercase tracking-widest">{user.role?.replace('_', ' ')}</p>
            
            <div className="mt-6 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl flex items-center gap-4 text-left border border-slate-100 dark:border-slate-700">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Email Address</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.email || 'Belum diatur'}</p>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl flex items-center gap-4 text-left border border-slate-100 dark:border-slate-700">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Bergabung Sejak</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : (user.joinDate || 'Tahun ini')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-500 font-medium mb-1">Status Akun</p>
                        <span className="inline-flex px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold uppercase">Aktif</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-500 font-medium mb-1">ID Pengguna</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">#{user.id}</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;