
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }         from './context/ToastContext';
import Sidebar           from './components/layout/Sidebar';
import Spinner           from './components/common/Spinner';
import LoginPage         from './pages/LoginPage';
import DashboardPage     from './pages/DashboardPage';
import ReportPage        from './pages/ReportPage';
import MyEntriesPage     from './pages/MyEntriesPage';
import ManagementPage    from './pages/ManagementPage';
import IntegrationsPage  from './pages/IntegrationsPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner fullPage />;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppLayout() {
  return (
    <div dir="rtl" style={{ display:'flex',height:'100vh',background:'#f8fafc',fontFamily:'system-ui,sans-serif' }}>
      <Sidebar />
      <main style={{ flex:1,overflow:'auto',padding:24 }}>
        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/report"       element={<ReportPage />} />
          <Route path="/report/:id"   element={<ReportPage />} />
          <Route path="/my-entries"   element={<MyEntriesPage />} />
          <Route path="/management"   element={<ProtectedRoute roles={['manager','admin']}><ManagementPage /></ProtectedRoute>} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*"     element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
