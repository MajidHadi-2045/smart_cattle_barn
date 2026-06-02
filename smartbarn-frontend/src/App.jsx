import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './layouts/DashboardLayout';
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

        {/* Rute Terlindungi: Hanya bisa diakses jika sudah login */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Semua sub-rute ini otomatis ikut terlindungi */}
          <Route index element={<DashboardHome />} />
          <Route path="livestock" element={<Livestock />} />
          <Route path="feed" element={<Feed />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="health" element={<HealthPage />} />
        </Route>

        {/* Jika user mengetik rute yang tidak terdaftar, arahkan ke landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;