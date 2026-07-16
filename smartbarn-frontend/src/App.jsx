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
        <Route path="/public-dashboard" element={<Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 font-bold">Memuat Dashboard Publik...</div>}><PublicDashboardLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<div>Memuat Data...</div>}><DashboardHome isPublicRoute={true} /></Suspense>} />
        </Route>

        {/* Rute Terlindungi: Dashboard Admin/Staff */}
        <Route 
          path="/dashboard" 
          element={<Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 font-bold">Memuat Dashboard...</div>}><DashboardLayout /></Suspense>}
        >
          {/* Semua sub-rute ini otomatis ikut terlindungi */}
          <Route index element={<ProtectedRoute><Suspense fallback={<div>Memuat...</div>}><DashboardHome /></Suspense></ProtectedRoute>} />
          <Route path="livestock" element={<ProtectedRoute><Suspense fallback={<div>Memuat...</div>}><Livestock /></Suspense></ProtectedRoute>} />
          <Route path="feed" element={<ProtectedRoute><Suspense fallback={<div>Memuat...</div>}><Feed /></Suspense></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute><Suspense fallback={<div>Memuat...</div>}><Reports /></Suspense></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute><Suspense fallback={<div>Memuat...</div>}><UserManagement /></Suspense></ProtectedRoute>} />
          <Route path="health" element={<ProtectedRoute><Suspense fallback={<div>Memuat...</div>}><HealthPage /></Suspense></ProtectedRoute>} />
          <Route path="history" element={<ProtectedRoute><Suspense fallback={<div>Memuat...</div>}><HistoryPage /></Suspense></ProtectedRoute>} />
        </Route>

        {/* Jika user mengetik rute yang tidak terdaftar, arahkan ke landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;