import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

import DashboardHome from './pages/Dashboard/DashboardHome';

// --- CODE SPLITTING UNTUK RUTE DASHBOARD TERLINDUNGI ---
const DashboardLayout = React.lazy(() => import('./layouts/DashboardLayout'));
const PublicDashboardLayout = React.lazy(() => import('./layouts/PublicDashboardLayout'));
const Livestock = React.lazy(() => import('./pages/Dashboard/Livestock'));
const HealthPage = React.lazy(() => import('./pages/Dashboard/HealthPage'));
const Feed = React.lazy(() => import('./pages/Dashboard/Feed'));
const Reports = React.lazy(() => import('./pages/Dashboard/Reports'));
const UserManagement = React.lazy(() => import('./pages/Dashboard/UserManagement'));
const HistoryPage = React.lazy(() => import('./pages/Dashboard/HistoryPage'));

// --- SKELETON PLACEHOLDER UNTUK MENCEGAH LAYOUT SHIFT (CLS = 0.00) ---
const PageSkeleton = () => (
  <div className="relative min-h-screen md:flex bg-slate-50 dark:bg-slate-950 font-sans">
    {/* Sidebar Skeleton (Presisi w-64 di desktop untuk mencegah 256px layout shift) */}
    <div className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 shrink-0 space-y-4">
      <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg mb-6"></div>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      ))}
    </div>

    {/* Main Content Skeleton */}
    <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
      {/* Header Skeleton h-20 */}
      <div className="flex items-center justify-between h-20 px-4 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
          <div className="h-6 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        </div>
        <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
      </div>
      {/* Body Skeleton */}
      <div className="flex-1 p-4 md:p-8 space-y-6 animate-pulse">
        <div className="h-[116px] md:h-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-1"></div>
            <div className="h-4 w-80 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
          <div className="h-9 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-[106px] bg-slate-200 dark:bg-slate-800 rounded-2xl animate-shimmer"></div>
          <div className="h-[106px] bg-slate-200 dark:bg-slate-800 rounded-2xl animate-shimmer"></div>
          <div className="h-[106px] bg-slate-200 dark:bg-slate-800 rounded-2xl animate-shimmer"></div>
        </div>
        <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      </div>
    </main>
  </div>
);

// Skeleton khusus isi rute (tanpa header ganda) untuk me-eliminate CLS 0.000
const PageContentSkeleton = () => (
  <div className="space-y-6 pb-20 animate-pulse">
    <div className="h-[116px] md:h-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-1"></div>
        <div className="h-4 w-80 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>
      <div className="h-9 w-44 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="h-[106px] bg-slate-200 dark:bg-slate-800 rounded-2xl animate-shimmer"></div>
      <div className="h-[106px] bg-slate-200 dark:bg-slate-800 rounded-2xl animate-shimmer"></div>
      <div className="h-[106px] bg-slate-200 dark:bg-slate-800 rounded-2xl animate-shimmer"></div>
    </div>
    <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
  </div>
);

// --- KOMPONEN PENJAGA (PROTECTED ROUTE) ---
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token'); 

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Rute Publik Khusus Dashboard */}
        <Route path="/public-dashboard" element={<Suspense fallback={<PageSkeleton />}><PublicDashboardLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<PageContentSkeleton />}><DashboardHome isPublicRoute={true} /></Suspense>} />
        </Route>

        {/* Rute Terlindungi: Dashboard Admin/Staff */}
        <Route 
          path="/dashboard" 
          element={<Suspense fallback={<PageSkeleton />}><DashboardLayout /></Suspense>}
        >
          <Route index element={<ProtectedRoute><Suspense fallback={<PageContentSkeleton />}><DashboardHome /></Suspense></ProtectedRoute>} />
          <Route path="livestock" element={<ProtectedRoute><Suspense fallback={<PageContentSkeleton />}><Livestock /></Suspense></ProtectedRoute>} />
          <Route path="feed" element={<ProtectedRoute><Suspense fallback={<PageContentSkeleton />}><Feed /></Suspense></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute><Suspense fallback={<PageContentSkeleton />}><Reports /></Suspense></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute><Suspense fallback={<PageContentSkeleton />}><UserManagement /></Suspense></ProtectedRoute>} />
          <Route path="health" element={<ProtectedRoute><Suspense fallback={<PageContentSkeleton />}><HealthPage /></Suspense></ProtectedRoute>} />
          <Route path="history" element={<ProtectedRoute><Suspense fallback={<PageContentSkeleton />}><HistoryPage /></Suspense></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;