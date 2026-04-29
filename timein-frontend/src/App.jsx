
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider }         from './context/ToastContext';
import { TimerProvider }         from './context/TimerContext';
import { useResponsive }         from './hooks/useResponsive';
import Sidebar           from './components/layout/Sidebar';
import Spinner           from './components/common/Spinner';
import LoginPage         from './pages/LoginPage';
import DashboardPage     from './pages/DashboardPage';
import ReportPage        from './pages/ReportPage';
import MyEntriesPage     from './pages/MyEntriesPage';
import ManagementPage    from './pages/ManagementPage';
import ProjectsPage      from './pages/ProjectsPage';
import IntegrationsPage  from './pages/IntegrationsPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner fullPage />;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppLayout() {
  const { isMobile } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div dir="rtl" style={{ display:'flex', height:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif', overflow:'hidden' }}>
      {/* Backdrop overlay for mobile sidebar */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:40 }}
        />
      )}

      <Sidebar isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main style={{ flex:1, overflow:'auto', padding: isMobile ? '56px 12px 20px' : 24 }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            position:'fixed', top:0, left:0, right:0, zIndex:30,
            background:'#fff', borderBottom:'1px solid #e2e8f0',
            height:52, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px',
          }}>
            <span style={{ fontSize:17, fontWeight:700, color:'#6366f1' }}>TimeIn</span>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#64748b', padding:'4px 8px', lineHeight:1 }}
              aria-label="פתח תפריט"
            >☰</button>
          </div>
        )}

        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/report"       element={<ReportPage />} />
          <Route path="/report/:id"   element={<ReportPage />} />
          <Route path="/my-entries"   element={<MyEntriesPage />} />
          <Route path="/projects"     element={<ProtectedRoute roles={['manager','admin']}><ProjectsPage /></ProtectedRoute>} />
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
          <TimerProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*"     element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
            </Routes>
          </TimerProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
