import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../../utils/api';

const ActivityFeed = () => {
    const [activities, setActivities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
    const dropdownRef = useRef(null);

    const getUserKey = () => {
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const u = JSON.parse(userStr);
                return u.id || u.username || 'default';
            }
        } catch (e) {}
        return 'default';
    };

    const fetchActivities = async () => {
        try {
            const userId = getUserKey();
            const lastReadStr = localStorage.getItem(`user_last_read_activity_${userId}`);
            const lastReadTs = lastReadStr ? parseInt(lastReadStr, 10) : 0;

            const res = await fetchApi('/activities/recent');
            if (res.ok) {
                const data = await res.json();
                setActivities(data);
                if (Array.isArray(data) && data.length > 0) {
                    const unreadExists = data.some(act => new Date(act.createdAt).getTime() > lastReadTs);
                    setHasUnreadActivity(unreadExists);
                } else {
                    setHasUnreadActivity(false);
                }
            }
        } catch (err) {
            console.error('Failed to fetch activities:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
        const interval = setInterval(fetchActivities, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleToggleOpen = () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            setHasUnreadActivity(false); // Hilangkan titik merah saat dibuka
            const userId = getUserKey();
            localStorage.setItem(`user_last_read_activity_${userId}`, Date.now().toString());
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getActionColor = (action) => {
        switch (action) {
            case 'TAMBAH': return 'text-green-500 bg-green-500/10';
            case 'EDIT': return 'text-blue-500 bg-blue-500/10';
            case 'HAPUS': return 'text-red-500 bg-red-500/10';
            case 'UNDUH': return 'text-purple-500 bg-purple-500/10';
            default: return 'text-slate-500 bg-slate-500/10';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Toggle Button */}
            <button 
                onClick={handleToggleOpen}
                className={`p-2 rounded-lg transition-all duration-200 relative ${
                    isOpen 
                        ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' 
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Riwayat Aktivitas 24 Jam"
            >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {/* Titik Merah Murni Tanpa Angka (Hilang jika sudah dibaca, muncul jika ada yang baru) */}
                {hasUnreadActivity && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-fade-in-up">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">Aktivitas 24 Jam</h4>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{activities.length} total</span>
                    </div>
                    
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-4 space-y-4">
                        {isLoading && activities.length === 0 ? (
                            <div className="flex justify-center py-8">
                                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : activities.length > 0 ? activities.map((log) => (
                            <div key={log.id} className="relative pl-5 border-l-2 border-slate-100 dark:border-slate-700 py-1 group hover:border-primary-400 transition-colors">
                                <div className="absolute -left-[6px] top-2 w-2.5 h-2.5 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 group-hover:border-primary-400 transition-colors"></div>
                                
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">{log.userName}</span>
                                        <span className="text-[9px] text-slate-400 font-medium">
                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </span>
                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">{log.module}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mt-0.5">
                                        {log.details}
                                    </p>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 px-4">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <p className="text-xs text-slate-400 italic">Belum ada aktivitas baru dalam 24 jam terakhir.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2 text-center">
                        {localStorage.getItem('userRole') === 'STAFF' && (
                            <button 
                                onClick={() => {
                                    setIsOpen(false);
                                    window.dispatchEvent(new CustomEvent('openHistoryKoreksi'));
                                }} 
                                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 py-2 px-4 rounded-lg w-full transition-colors flex items-center justify-center gap-1"
                            >
                                <span>✏️</span> Koreksi Data
                            </button>
                        )}
                        <button onClick={fetchActivities} className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase">Refresh Log</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityFeed;
