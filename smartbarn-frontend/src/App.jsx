import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './layouts/DashboardLayout';
import PublicDashboardLayout from './layouts/PublicDashboardLayout';
import DashboardHome from './pages/Dashboard/DashboardHome';
import Livestock from './pages/Dashboard/Livestock';
import HealthPage from './pages/Dashboard/HealthPage';
import Feed from './pages/Dashboard/Feed';
import Reports from './pages/Dashboard/Reports';
import UserManagement from './pages/Dashboard/UserManagement';

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

        {/* Rute Publik Khusus Dashboard (Tanpa Auth/Profil sama sekali) */}
        <Route path="/public-dashboard" element={<PublicDashboardLayout />}>
          <Route index element={<DashboardHome isPublicRoute={true} />} />
        </Route>

        {/* Rute Terlindungi: Dashboard Admin/Staff */}
        <Route 
          path="/dashboard" 
          element={<DashboardLayout />}
        >
          {/* Semua sub-rute ini otomatis ikut terlindungi */}
          {/* Semua sub-rute ini dilindungi oleh ProtectedRoute (Kecuali yang index mungkin tidak sengaja terbuka, tapi kita biarkan DashboardHome biasa) */}
          <Route index element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
          <Route path="livestock" element={<ProtectedRoute><Livestock /></ProtectedRoute>} />
          <Route path="feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="health" element={<ProtectedRoute><HealthPage /></ProtectedRoute>} />
        </Route>

        {/* Jika user mengetik rute yang tidak terdaftar, arahkan ke landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;