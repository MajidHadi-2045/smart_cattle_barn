import { Link, useLocation } from 'react-router-dom';

const PublicSidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();

  const getLinkClass = (path) => {
    const baseClass = "group relative flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm";
    const activeClass = "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 font-bold shadow-2xs before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:bg-emerald-600 dark:before:bg-emerald-400 before:rounded-r-full";
    const inactiveClass = "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100";
    return location.pathname === path ? `${baseClass} ${activeClass}` : `${baseClass} ${inactiveClass}`;
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-black/50 transition-opacity md:hidden ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={toggleSidebar}
      ></div>

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-700/80 transform transition-transform duration-300 flex flex-col h-full md:relative md:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'}`}>

        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-white p-1 rounded-xl shadow-xs border border-slate-100 group-hover:scale-105 transition-transform">
              <img src="/logoxl.svg" alt="Logo" width="32" height="32" className="h-8 w-8 object-contain" />
            </div>
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight group-hover:text-emerald-600 transition-colors">Smart Cattle Barn</span>
          </Link>

          <button aria-label="Tutup Sidebar" className="md:hidden text-slate-400 hover:text-slate-600 transition" onClick={toggleSidebar}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          <Link to="/public-dashboard" className={getLinkClass('/public-dashboard')} onClick={() => window.innerWidth < 768 && toggleSidebar()}>
            <svg className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            <span>Beranda Publik</span>
          </Link>
        </nav>
      </aside>
    </>
  );
};

export default PublicSidebar;
