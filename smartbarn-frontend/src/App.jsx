import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// --- CODE SPLITTING UNTUK MENINGKATKAN SKOR LCP ---
// Komponen Dashboard yang berat (mengandung chart, map, js besar) dipisah menjadi chunk terpisah
const DashboardLayout = React.lazy(() => import('./layouts/DashboardLayout'));
const PublicDashboardLayout = React.lazy(() => import('./layouts/PublicDashboardLayout'));
const DashboardHome = React.lazy(() => import('./pages/Dashboard/DashboardHome'));
const Livestock = React.lazy(() => import('./pages/Dashboard/Livestock'));
const HealthPage = React.lazy(() => import('./pages/Dashboard/HealthPage'));
const Feed = React.lazy(() => import('./pages/Dashboard/Feed'));
const Reports = React.lazy(() => import('./pages/Dashboard/Reports'));
const UserManagement = React.lazy(() => import('./pages/Dashboard/UserManagement'));
const HistoryPage = React.lazy(() => import('./pages/Dashboard/HistoryPage'));

// --- SKELETON PLACEHOLDER UNTUK MENCEGAH LAYOUT SHIFT (CLS) ---
const PageSkeleton = () => (
  <div className="space-y-6 p-4 md:p-8 animate-pulse min-h-screen bg-slate-50 dark:bg-slate-950">
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mb-2"></div>
        <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>
      <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[120px]">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      ))}
    </div>
    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
  </div>
);

// --- KOMPONEN PENJAGA (PROTECTED ROUTE) ---
// Komponen ini akan mengecek apakah user sudah login atau belum
const ProtectedRoute = ({ children }) => {
  // Mengecek keberadaan token di localStorage
  const token = localStorage.getItem('token'); 

  if (!token) {
    // Jika tidak ada token, tendang user kembali ke halaman login
    return <Navigate to="/login" replace />;
  }

  // Jika ada token, izinkan akses ke komponen yang dituju
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Rute Publik: Bisa diakses siapa saja */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Rute Publik Khusus Dashboard (Tanpa Auth/Profil sama sekali) */}
        <Route path="/public-dashboard" element={<Suspense fallback={<PageSkeleton />}><PublicDashboardLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<PageSkeleton />}><DashboardHome isPublicRoute={true} /></Suspense>} />
        </Route>

        {/* Rute Terlindungi: Dashboard Admin/Staff */}
        <Route 
          path="/dashboard" 
          element={<Suspense fallback={<PageSkeleton />}><DashboardLayout /></Suspense>}
        >
          {/* Semua sub-rute ini otomatis ikut terlindungi */}
          <Route index element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><DashboardHome /></Suspense></ProtectedRoute>} />
          <Route path="livestock" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><Livestock /></Suspense></ProtectedRoute>} />
          <Route path="feed" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><Feed /></Suspense></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><Reports /></Suspense></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><UserManagement /></Suspense></ProtectedRoute>} />
          <Route path="health" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><HealthPage /></Suspense></ProtectedRoute>} />
          <Route path="history" element={<ProtectedRoute><Suspense fallback={<PageSkeleton />}><HistoryPage /></Suspense></ProtectedRoute>} />
        </Route>

        {/* Jika user mengetik rute yang tidak terdaftar, arahkan ke landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;