import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const playAlarmSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playBeep = (startTime, frequency, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth'; // Siren-like tone
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    const now = ctx.currentTime;
    playBeep(now, 880, 0.25);
    playBeep(now + 0.3, 1000, 0.25);
  } catch (err) {
    console.log('Failed to play alarm audio:', err);
  }
};

const formatNotificationTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  
  const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = dNow.getTime() - dDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  
  if (diffDays === 0) {
    return `Hari ini, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Kemarin, ${timeStr}`;
  } else {
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const month = months[date.getMonth()];
    return `${day} ${month}, ${timeStr}`;
  }
};

// Helper stabil untuk mengekstrak timestamp angka dari data notifikasi
const getNotificationTimestamp = (item) => {
  if (!item) return 0;
  if (typeof item.timestamp === 'number') return item.timestamp;
  if (item.timestamp) {
    const t = new Date(item.timestamp).getTime();
    if (!isNaN(t)) return t;
  }
  if (typeof item.id === 'number' && item.id > 1000000000000) {
    return item.id;
  }
  return 0;
};

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef(null);
  const showDropdownRef = useRef(false);
  const lastReadTsRef = useRef(0);

  // Ambil identifier akun pengguna secara presisi
  const getUserKey = () => {
    try {
      const directUserId = localStorage.getItem('userId');
      if (directUserId && directUserId !== 'undefined' && directUserId !== 'null') {
        return directUserId;
      }
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && (u.id || u.username || u.email)) {
          return u.id || u.username || u.email;
        }
      }
      const email = localStorage.getItem('userEmail');
      if (email) return email;
      const name = localStorage.getItem('userName');
      if (name) return name;
    } catch (e) {
      console.error('Gagal mengambil user key:', e);
    }
    return 'default';
  };

  // Selalu sinkronkan showDropdownRef untuk akses real-time di socket listener
  useEffect(() => {
    showDropdownRef.current = showDropdown;
  }, [showDropdown]);

  // Fungsi menandai semua notifikasi saat ini telah terbaca untuk akun aktif
  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
    const userId = getUserKey();
    const latestNotifTs = notifications.length > 0 
      ? Math.max(...notifications.map(n => getNotificationTimestamp(n))) 
      : 0;
    const markTs = Math.max(Date.now(), latestNotifTs);
    lastReadTsRef.current = markTs;
    try {
      localStorage.setItem(`user_last_read_notif_${userId}`, markTs.toString());
    } catch (e) {
      console.error('Gagal menyimpan status baca notifikasi:', e);
    }
  }, [notifications]);

  useEffect(() => {
    const userId = getUserKey();
    const lastReadStr = localStorage.getItem(`user_last_read_notif_${userId}`);
    const lastReadTs = lastReadStr ? parseInt(lastReadStr, 10) : 0;
    lastReadTsRef.current = !isNaN(lastReadTs) ? lastReadTs : 0;

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    const socketUrl = import.meta.env.VITE_WS_URL || apiBaseUrl.replace(/\/api$/, '');
    const socket = io(socketUrl);

    // Ambil History Notifikasi dari Server
    fetch(`${apiBaseUrl}/dashboard/notifications`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data)) {
          const formatted = data.map((item, idx) => {
            const itemTs = getNotificationTimestamp(item);
            return {
              id: item.id || (Date.now() + idx),
              title: item.title,
              body: item.body || item.message || '',
              timestamp: itemTs,
              time: formatNotificationTime(item.timestamp || itemTs)
            };
          });
          setNotifications(formatted);
          const unread = formatted.filter(n => n.timestamp > lastReadTsRef.current).length;
          setUnreadCount(unread);
        }
      })
      .catch(err => console.log('Gagal memuat history notifikasi', err));

    // Dengarkan event 'websocket:alert' dari Redis secara real-time
    socket.on('websocket:alert', (payload) => {
      if (!payload) return;

      // 0. Mainkan Suara Sirene/Alarm di browser
      playAlarmSound();

      // 1. Munculkan Toast Merah di Layar
      toast.error(
        (t) => (
          <div className="flex flex-col gap-1 cursor-pointer" onClick={() => toast.dismiss(t.id)}>
            <span className="font-bold text-red-700">{payload.title}</span>
            <span className="text-sm text-slate-800">{payload.body || payload.message}</span>
          </div>
        ),
        { 
          duration: 10000,
          style: { border: '2px solid #ef4444', padding: '16px' } 
        }
      );

      // 2. Tambahkan ke daftar riwayat lonceng
      const notifTs = payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now();
      const newNotif = {
        id: payload.id || Date.now(),
        title: payload.title,
        body: payload.body || payload.message || '',
        timestamp: notifTs,
        time: formatNotificationTime(payload.timestamp || new Date().toISOString())
      };
      
      setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== newNotif.id)].slice(0, 20));

      // 3. Kelola status unread & bintik merah lonceng
      if (showDropdownRef.current) {
        // Jika dropdown sedang dibuka oleh user, langsung tandai notifikasi ini terbaca
        const markTs = Math.max(Date.now(), notifTs);
        lastReadTsRef.current = markTs;
        try {
          localStorage.setItem(`user_last_read_notif_${userId}`, markTs.toString());
        } catch (e) {}
        setUnreadCount(0);
      } else {
        // Jika dropdown tertutup dan notifikasi lebih baru dari waktu baca terakhir akun ini
        if (notifTs > lastReadTsRef.current) {
          setUnreadCount(prev => prev + 1);
        }
      }
    });

    // Sinkronisasi status baca antar-tab pada browser yang sama
    const handleStorageChange = (e) => {
      if (e.key === `user_last_read_notif_${userId}`) {
        const newReadTs = e.newValue ? parseInt(e.newValue, 10) : 0;
        lastReadTsRef.current = !isNaN(newReadTs) ? newReadTs : 0;
        setNotifications(prev => {
          const unread = prev.filter(n => n.timestamp > lastReadTsRef.current).length;
          setUnreadCount(unread);
          return prev;
        });
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      socket.disconnect();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Menutup dropdown saat pengguna mengklik di luar area lonceng
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenDropdown = () => {
    const nextState = !showDropdown;
    setShowDropdown(nextState);
    if (nextState) {
      // Saat lonceng dibuka oleh user akun ini: bintik merah langsung hilang & tersimpan per-akun
      markAllAsRead();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Lonceng */}
      <button 
        onClick={handleOpenDropdown}
        className={`p-2 rounded-lg transition-all duration-200 relative ${
          showDropdown 
            ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' 
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title="Notifikasi Sistem"
        aria-label="Notifikasi Sistem"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
        </svg>
        
        {/* Badge Merah jika ada notifikasi baru yang belum dibaca */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Riwayat Notifikasi */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden transform origin-top-right transition-all">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Peringatan Terbaru</h3>
              <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">
                {notifications.length} Info
              </span>
            </div>
            {unreadCount > 0 ? (
              <button 
                onClick={markAllAsRead} 
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Tandai dibaca
              </button>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                Terbaca
              </span>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Tidak ada peringatan. Kandang aman terkendali.
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
