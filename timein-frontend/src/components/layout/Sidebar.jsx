
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth }           from '../../context/AuthContext';
import { useNotifications }  from '../../hooks/useNotifications';
import Avatar                from '../common/Avatar';
import { T }                 from '../../theme';

// ── Minimal SVG icon engine ───────────────────────────────────────
const Ic = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display:'block', flexShrink:0 }}>
    {children}
  </svg>
);

const IcDashboard = () => <Ic>
  <rect x="3" y="3" width="7" height="7" rx="1.5"/>
  <rect x="14" y="3" width="7" height="7" rx="1.5"/>
  <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  <rect x="3" y="14" width="7" height="7" rx="1.5"/>
</Ic>;

const IcClock = () => <Ic>
  <circle cx="12" cy="12" r="10"/>
  <polyline points="12 6 12 12 16 14"/>
</Ic>;

const IcFileText = () => <Ic>
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="16" y1="13" x2="8" y2="13"/>
  <line x1="16" y1="17" x2="8" y2="17"/>
</Ic>;

const IcFolder = () => <Ic>
  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
</Ic>;

const IcUsers = () => <Ic>
  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
  <circle cx="9" cy="7" r="4"/>
  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
</Ic>;

const IcLink = () => <Ic>
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
</Ic>;

const IcBell = ({ size = 16 }) => <Ic size={size}>
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
</Ic>;

const IcLogOut = () => <Ic size={15}>
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
  <polyline points="16 17 21 12 16 7"/>
  <line x1="21" y1="12" x2="9" y2="12"/>
</Ic>;

const IcX = () => <Ic size={13}>
  <line x1="18" y1="6" x2="6" y2="18"/>
  <line x1="6" y1="6" x2="18" y2="18"/>
</Ic>;

// ─────────────────────────────────────────────────────────────────
const NAV = [
  { to:'/',             label:'דאשבורד',          Icon: IcDashboard,  roles:['employee','manager','admin'] },
  { to:'/report',       label:'דיווח שעות',        Icon: IcClock,      roles:['employee','manager','admin'] },
  { to:'/my-entries',   label:'הדיווחים שלי',      Icon: IcFileText,   roles:['employee','manager','admin'] },
  { to:'/projects',     label:'פרויקטים ומשימות',  Icon: IcFolder,     roles:['manager','admin'] },
  { to:'/management',   label:'ניהול',              Icon: IcUsers,      roles:['manager','admin'] },
  { to:'/integrations', label:'אינטגרציות',         Icon: IcLink,       roles:['employee','manager','admin'] },
];

const ROLE_LABELS = { employee: 'עובד', manager: 'מנהל', admin: 'מנהל מערכת' };

export default function Sidebar({ isMobile, open, onClose }) {
  const { user, logout }    = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate            = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleNavClick = () => { if (isMobile) onClose(); };
  const handleLogout   = () => { if (isMobile) onClose(); logout(); navigate('/login'); };

  const mobileStyle = isMobile ? {
    position: 'fixed', top: 0, right: 0, height: '100%', width: 256,
    zIndex: 50,
    transform: open ? 'translateX(0)' : 'translateX(110%)',
    transition: 'transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: open ? '-16px 0 56px rgba(0,0,0,0.45)' : 'none',
  } : { width: 228, flexShrink: 0 };

  return (
    <div dir="rtl" style={{
      background: T.sidebarBg,
      borderLeft: `1px solid ${T.sidebarBorder}`,
      display: 'flex', flexDirection: 'column',
      ...mobileStyle,
    }}>

      {/* ── Logo ─────────────────────────────────────── */}
      <div style={{
        padding: '22px 20px 20px',
        borderBottom: `1px solid ${T.sidebarBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
            flexShrink: 0,
          }}>
            <IcClock />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.1 }}>TimeIn</div>
            <div style={{ fontSize: 9, color: T.sidebarTextSub, marginTop: 2, letterSpacing: '0.1em', fontWeight: 500, textTransform: 'uppercase' }}>מערכת שעות</div>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} style={{
            background: T.sidebarHover, border: `1px solid ${T.sidebarBorder}`,
            borderRadius: T.radiusSm, width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.sidebarTextSub,
          }}><IcX /></button>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────── */}
      <nav className="ti-sidebar-scroll" style={{ padding: '14px 12px', flex: 1, overflowY: 'auto' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: T.sidebarTextSub,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '0 10px 10px', opacity: 0.55,
        }}>
          ניווט ראשי
        </div>

        {NAV.filter(n => n.roles.includes(user?.role)).map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={handleNavClick}
            className={({ isActive }) => `ti-sidebar-link${isActive ? ' active' : ''}`}>
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom area ─────────────────────────────── */}
      <div style={{ padding: '12px 12px 18px', borderTop: `1px solid ${T.sidebarBorder}` }}>

        {/* Notifications */}
        <div ref={panelRef} style={{ position: 'relative', marginBottom: 10 }}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 12px', borderRadius: T.radius,
              border: `1px solid ${notifOpen ? 'rgba(59,130,246,0.4)' : T.sidebarBorder}`,
              background: notifOpen ? T.sidebarActive : 'transparent',
              cursor: 'pointer', fontSize: 12.5, color: T.sidebarTextSub,
              transition: 'all 0.14s', fontFamily: 'inherit',
            }}
          >
            <span style={{ color: T.sidebarTextSub, display:'flex', alignItems:'center' }}>
              <IcBell />
            </span>
            <span style={{ flex: 1, textAlign: 'right', fontWeight: 400 }}>התראות</span>
            {unreadCount > 0 && (
              <span style={{
                background: T.error, color: '#fff', borderRadius: 99,
                fontSize: 10, fontWeight: 700, padding: '1px 7px',
                minWidth: 20, textAlign: 'center', lineHeight: '16px',
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', right: 0,
              width: isMobile ? 'calc(100vw - 48px)' : 300, maxWidth: 320,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: T.radiusLg, boxShadow: T.shadowDeep,
              zIndex: 1000, marginBottom: 6, maxHeight: 360,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <div style={{
                padding: '13px 16px', borderBottom: `1px solid ${T.borderLight}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>התראות</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{
                    fontSize: 11, color: T.accent, background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontWeight: 600, fontFamily: 'inherit',
                  }}>
                    סמן הכל כנקרא
                  </button>
                )}
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>🔔</div>
                    <p style={{ color: T.textFaint, fontSize: 12, margin: 0, fontWeight: 500 }}>אין התראות חדשות</p>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    style={{
                      padding: '11px 16px', borderBottom: `1px solid ${T.borderLight}`,
                      background: n.is_read ? T.surface : T.primaryLight,
                      cursor: n.is_read ? 'default' : 'pointer',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                        background: n.is_read ? 'transparent' : T.accent,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.55 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>
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

        {/* User card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', marginBottom: 8,
          background: T.sidebarSurface,
          borderRadius: T.radius,
          border: `1px solid ${T.sidebarBorder}`,
        }}>
          <Avatar name={user?.full_name} size={32} dark />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.sidebarText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name}
            </div>
            <div style={{ fontSize: 10, color: T.sidebarTextSub, marginTop: 1 }}>
              {ROLE_LABELS[user?.role] || user?.role}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{
          width: '100%', padding: '8px 12px', borderRadius: T.radius,
          border: `1px solid ${T.sidebarBorder}`, background: 'transparent',
          fontSize: 12.5, color: T.sidebarTextSub, fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.14s', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.12)'; e.currentTarget.style.color = '#F87171'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.sidebarTextSub; e.currentTarget.style.borderColor = T.sidebarBorder; }}>
          <IcLogOut />
          יציאה מהמערכת
        </button>
      </div>
    </div>
  );
}
