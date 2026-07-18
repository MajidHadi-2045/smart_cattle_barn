import { useState, useEffect } from 'react';
import { Outlet, Navigate, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import NotificationBell from '../components/dashboard/NotificationBell';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // --- LOGIKA DARK MODE ---
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const token = localStorage.getItem('token');

  return (
    <div className="relative min-h-screen md:flex bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-slate-50 to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 font-sans overflow-hidden transition-colors duration-300">

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-4 md:px-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-white/20 dark:border-slate-700/50 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-600 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition" onClick={toggleSidebar}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <Link to="/">
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white hover:text-primary-600 transition">Smart Cattle Barn</h1>
            </Link>
          </div>

          {/* POJOK KANAN ATAS: Dark Mode & History */}
          <div className="flex items-center gap-2">
            {/* Lonceng Notifikasi */}
            {token && <NotificationBell />}

            {/* Activity History Widget */}
            {token && <ActivityFeed />}

            {token && <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>}

            {/* Dark Mode Toggle Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg transition-all duration-300 ${isDarkMode ? 'bg-slate-700 text-yellow-400' : 'bg-slate-100 text-slate-500 hover:text-primary-600 shadow-inner'}`}
              title={isDarkMode ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            >
              {isDarkMode ? (
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 000 14 7 7 0 000-14z"></path></svg>
              ) : (
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
              )}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;