import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import UserProfileModal from './dashboard/UserProfileModal';
import ConfirmModal from './common/ConfirmModal';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userCreatedAt, setUserCreatedAt] = useState('');
  const [userPhoto, setUserPhoto] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName');
    const email = localStorage.getItem('userEmail');
    const createdAt = localStorage.getItem('userCreatedAt');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const actualUserId = localStorage.getItem('userId') || user.id;

    if (role) setUserRole(role);
    if (name) setUserName(name);
    if (email) setUserEmail(email);
    if (createdAt) setUserCreatedAt(createdAt);
    if (actualUserId) setUserId(actualUserId);

    const dbPhoto = user.photo;
    const cachedPhoto = localStorage.getItem(`profile_photo_${actualUserId}`);
    if (dbPhoto) {
      setUserPhoto(dbPhoto);
    } else if (cachedPhoto) {
      setUserPhoto(cachedPhoto);
    }
  }, []);

  const handlePhotoUpdate = (newPhotoBase64) => {
    setUserPhoto(newPhotoBase64);
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
    setIsProfileMenuOpen(false);
  };

  const executeLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const getLinkClass = (path) => {
    const baseClass = "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200";
    const activeClass = "bg-primary-50 text-primary-600 font-semibold dark:bg-primary-900/50 dark:text-primary-300";
    const inactiveClass = "text-slate-600 hover:bg-slate-100 font-medium dark:text-slate-300 dark:hover:bg-slate-700";
    return location.pathname === path ? `${baseClass} ${activeClass}` : `${baseClass} ${inactiveClass}`;
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-black/50 transition-opacity md:hidden ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={toggleSidebar}
      ></div>

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 flex flex-col h-full md:relative md:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full shadow-none'}`}>

        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg">
              <img src="/logoxl.svg" alt="Logo" className="h-8 w-8 object-contain" />
            </div>
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">Smart CattleBarn</span>
          </Link>

          <button className="md:hidden text-slate-400" onClick={toggleSidebar}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          <Link to="/dashboard" className={getLinkClass('/dashboard')} onClick={() => window.innerWidth < 768 && toggleSidebar()}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            <span>Dashboard</span>
          </Link>

          <p className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Manajemen</p>

          <Link to="/dashboard/livestock" className={getLinkClass('/dashboard/livestock')} onClick={() => window.innerWidth < 768 && toggleSidebar()}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <span>Data Ternak</span>
          </Link>

          <Link to="/dashboard/health" className={getLinkClass('/dashboard/health')} onClick={() => window.innerWidth < 768 && toggleSidebar()}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
            <span>Rekam Medis</span>
          </Link>

          <Link to="/dashboard/feed" className={getLinkClass('/dashboard/feed')} onClick={() => window.innerWidth < 768 && toggleSidebar()}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
            <span>Silo Pakan</span>
          </Link>

          <Link to="/dashboard/reports" className={getLinkClass('/dashboard/reports')} onClick={() => window.innerWidth < 768 && toggleSidebar()}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span>Laporan</span>
          </Link>

          {userRole === 'SUPER_ADMIN' && (
            <>
              <p className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Administrator</p>
              <Link to="/dashboard/users" className={getLinkClass('/dashboard/users')} onClick={() => window.innerWidth < 768 && toggleSidebar()}>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                <span>Pengguna</span>
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 mt-auto relative shrink-0">
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-0 w-full px-4 pb-2 z-50 animate-fade-in-up">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden p-1">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  <span className="font-medium">Lihat Profil</span>
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"></div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={`flex items-center gap-3 w-full p-2 rounded-xl transition-all duration-200 focus:outline-none group ${isProfileMenuOpen ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold uppercase shrink-0 shadow-sm group-hover:shadow-md transition-shadow overflow-hidden border-2 border-white dark:border-slate-800">
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userName ? userName.charAt(0) : 'U'
              )}
            </div>

            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{userName?.replace(/\b(?:super\s*)?admin\b/gi, '').trim() || 'Pengguna'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">{userRole?.replace('_', ' ') || 'Tamu'}</p>
              </div>
            </div>

            <div className={`p-1 rounded-full text-slate-400 transition-transform duration-300 ${isProfileMenuOpen ? 'rotate-180 bg-slate-200 dark:bg-slate-600' : ''}`}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </button>
        </div>
      </aside>

      <UserProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={{ name: userName, role: userRole, id: userId, email: userEmail, createdAt: userCreatedAt, photo: userPhoto }}
        onPhotoUpdate={handlePhotoUpdate}
      />

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        title="Keluar dari Sistem?"
        message="Anda akan keluar dari sesi saat ini. Anda perlu login kembali untuk mengakses sistem."
        confirmText="Ya, Logout"
        isDanger={true}
        onConfirm={executeLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />
    </>
  );
};

export default Sidebar;