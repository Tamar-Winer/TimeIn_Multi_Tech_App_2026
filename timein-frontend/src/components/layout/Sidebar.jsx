
import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import Avatar from '../common/Avatar';

const NAV = [
  { to:'/',             label:'דאשבורד',          icon:'⊞', roles:['employee','manager','admin'] },
  { to:'/report',       label:'דיווח שעות',       icon:'+', roles:['employee','manager','admin'] },
  { to:'/my-entries',   label:'הדיווחים שלי',     icon:'☰', roles:['employee','manager','admin'] },
  { to:'/projects',     label:'פרויקטים ומשימות', icon:'📁', roles:['manager','admin'] },
  { to:'/management',   label:'ניהול',             icon:'◈', roles:['manager','admin'] },
  { to:'/integrations', label:'אינטגרציות',        icon:'⇄', roles:['employee','manager','admin'] },
];

export default function Sidebar({ isMobile, open, onClose }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNavClick = () => { if (isMobile) onClose(); };
  const handleLogout   = () => { if (isMobile) onClose(); logout(); };

  const mobileStyle = isMobile ? {
    position: 'fixed',
    top: 0,
    right: 0,
    height: '100%',
    width: 260,
    zIndex: 50,
    transform: open ? 'translateX(0)' : 'translateX(110%)',
    transition: 'transform 0.25s ease',
    boxShadow: open ? '-4px 0 24px rgba(0,0,0,0.15)' : 'none',
  } : {
    width: 220,
    flexShrink: 0,
  };

  return (
    <div dir="rtl" style={{
      background: '#fff',
      borderLeft: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      ...mobileStyle,
    }}>
      {/* Header */}
      <div style={{ padding:'20px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'#6366f1' }}>TimeIn</div>
          <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>ניהול שעות עבודה</div>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8', lineHeight:1, padding:4 }}>✕</button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding:8, flex:1, overflowY:'auto' }}>
        {NAV.filter(n => n.roles.includes(user?.role)).map(n => (
          <NavLink key={n.to} to={n.to} end={n.to==='/'} onClick={handleNavClick} style={({ isActive }) => ({
            display:'flex', alignItems:'center', gap:8, padding:'9px 10px', borderRadius:8,
            marginBottom:2, textDecoration:'none',
            background: isActive ? '#e0e7ff' : 'transparent',
            color:       isActive ? '#4f46e5' : '#64748b',
            fontSize:13, fontWeight: isActive ? 500 : 400,
          })}>
            <span>{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: notifications + user */}
      <div style={{ padding:12, borderTop:'1px solid #f1f5f9' }}>
        {/* Notifications bell */}
        <div ref={panelRef} style={{ position:'relative', marginBottom:10 }}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', background: notifOpen ? '#f1f5f9' : '#fff', cursor:'pointer', fontSize:12, color:'#64748b' }}
          >
            <span style={{ fontSize:16 }}>🔔</span>
            <span style={{ flex:1, textAlign:'right' }}>התראות</span>
            {unreadCount > 0 && (
              <span style={{ background:'#ef4444', color:'#fff', borderRadius:99, fontSize:10, fontWeight:700, padding:'1px 6px', minWidth:18, textAlign:'center' }}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position:'absolute', bottom:'100%', right:0,
              width: isMobile ? 'calc(100vw - 40px)' : 300, maxWidth:320,
              background:'#fff', border:'1px solid #e2e8f0', borderRadius:12,
              boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:1000,
              marginBottom:6, maxHeight:360, display:'flex', flexDirection:'column',
            }}>
              <div style={{ padding:'12px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>התראות</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ fontSize:11, color:'#6366f1', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    סמן הכל כנקרא
                  </button>
                )}
              </div>
              <div style={{ overflowY:'auto', flex:1 }}>
                {notifications.length === 0 && (
                  <p style={{ color:'#94a3b8', textAlign:'center', padding:'24px 16px', fontSize:12 }}>אין התראות</p>
                )}
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    style={{
                      padding:'11px 14px', borderBottom:'1px solid #f8fafc',
                      background: n.is_read ? '#fff' : '#fef3f2',
                      cursor: n.is_read ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background: n.is_read ? 'transparent' : '#ef4444', flexShrink:0, marginTop:4 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:'#334155', lineHeight:1.5 }}>{n.message}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', marginTop:4 }}>
                          {new Date(n.created_at).toLocaleString('he-IL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User info */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <Avatar name={user?.full_name} size={28} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:500, color:'#334155', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.full_name}</div>
            <div style={{ fontSize:10, color:'#94a3b8' }}>{user?.role}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ width:'100%', padding:7, borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, cursor:'pointer' }}>
          יציאה
        </button>
      </div>
    </div>
  );
}
