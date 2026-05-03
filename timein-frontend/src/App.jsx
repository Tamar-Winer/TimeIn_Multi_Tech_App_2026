
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
import TeamsPage         from './pages/TeamsPage';
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
    <div dir="rtl" style={{ display:'flex', height:'100vh', background:'#EEF2F8', overflow:'hidden' }}>
      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(5,15,35,0.55)', zIndex:40, backdropFilter:'blur(3px)' }}
        />
      )}

      <Sidebar isMobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main style={{ flex:1, overflow:'auto', padding: isMobile ? '62px 16px 28px' : '30px 30px 30px' }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            position:'fixed', top:0, left:0, right:0, zIndex:30,
            background:'#0B1628',
            borderBottom:'1px solid rgba(255,255,255,0.08)',
            height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px',
            boxShadow:'0 2px 12px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{
                width:30, height:30, borderRadius:9,
                background:'linear-gradient(135deg,#1E40AF,#3B82F6)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 2px 8px rgba(59,130,246,0.4)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <span style={{ fontSize:17, fontWeight:800, color:'#fff', letterSpacing:'-0.3px' }}>TimeIn</span>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
                borderRadius:9, width:36, height:36,
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', color:'#93C5FD',
              }}
              aria-label="פתח תפריט"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/report"       element={<ReportPage />} />
          <Route path="/report/:id"   element={<ReportPage />} />
          <Route path="/my-entries"   element={<MyEntriesPage />} />
          <Route path="/projects"     element={<ProtectedRoute roles={['manager','admin']}><ProjectsPage /></ProtectedRoute>} />
          <Route path="/teams"        element={<ProtectedRoute roles={['admin']}><TeamsPage /></ProtectedRoute>} />
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
