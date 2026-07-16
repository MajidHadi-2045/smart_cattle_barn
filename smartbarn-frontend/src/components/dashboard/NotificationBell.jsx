import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Hubungkan ke WebSocket backend
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const socket = io(apiUrl);

    // Ambil History Notifikasi dari Server
    fetch(`${apiUrl}/dashboard/notifications`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          const formatted = data.map((item, idx) => ({
            id: item.id || Date.now() + idx,
            title: item.title,
            body: item.body,
            time: item.time || new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          }));
          setNotifications(formatted);
        }
      })
      .catch(err => console.log('Gagal memuat history notifikasi', err));

    // Dengarkan event 'websocket:alert' dari Redis
    socket.on('websocket:alert', (payload) => {
      // 1. Munculkan Toast Merah di Layar (Seragam dengan Mobile)
      toast.error(
        (t) => (
          <div className="flex flex-col gap-1 cursor-pointer" onClick={() => toast.dismiss(t.id)}>
            <span className="font-bold text-red-700">{payload.title}</span>
            <span className="text-sm text-slate-800">{payload.body}</span>
          </div>
        ),
        { 
          duration: 10000, // Tampil agak lama (10 detik)
          style: { border: '2px solid #ef4444', padding: '16px' } 
        }
      );

      // 2. Tambahkan ke daftar riwayat lonceng
      const newNotif = {
        id: Date.now(),
        title: payload.title,
        body: payload.body,
        time: new Date(payload.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      
      setNotifications(prev => [newNotif, ...prev].slice(0, 10)); // Simpan 10 terakhir
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenDropdown = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      setUnreadCount(0); // Reset badge saat dibuka
    }
  };

  return (
    <div className="relative">
      {/* Tombol Lonceng */}
      <button 
        onClick={handleOpenDropdown}
        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary-600 dark:text-slate-300 transition-all relative shadow-inner"
        title="Notifikasi Sistem"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
        </svg>
        
        {/* Badge Merah jika ada yang belum dibaca */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Riwayat Notifikasi */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden transform origin-top-right transition-all">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-white">Peringatan Terbaru</h3>
            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-semibold">{notifications.length} Info</span>
          </div>
          
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Tidak ada peringatan. Kondang aman terkendali.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {notifications.map(notif => (
                  <div key={notif.id} className="p-4 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors cursor-default">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm text-red-600 dark:text-red-400">{notif.title}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{notif.time}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{notif.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
