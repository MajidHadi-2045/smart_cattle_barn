import { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';

const PublicDashboardLayout = () => {
  // Sidebar sepenuhnya dihapus untuk tampilan publik

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

  return (
    <div className="relative min-h-screen md:flex bg-slate-50 dark:bg-slate-950 font-sans overflow-hidden transition-colors duration-300">
      
      {/* Sidebar Khusus Publik Dihapus Sesuai Permintaan */}

      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-10 flex items-center justify-between h-20 px-4 md:px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <img src="/logoxl.svg" alt="Logo" width="32" height="32" className="h-8 w-8 object-contain" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white hover:text-primary-600 transition tracking-tight">Smart Cattle Barn</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-bold bg-primary-700 hover:bg-primary-800 text-white rounded-lg shadow-sm transition">
              Login
            </Link>
            
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

            {/* Dark Mode Toggle */}
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

export default PublicDashboardLayout;
