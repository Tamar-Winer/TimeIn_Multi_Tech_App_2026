
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
const NAV = [
  { to:'/',             label:'דאשבורד',          icon:'⊞', roles:['employee','manager','admin'] },
  { to:'/report',       label:'דיווח שעות',       icon:'+', roles:['employee','manager','admin'] },
  { to:'/my-entries',   label:'הדיווחים שלי',     icon:'☰', roles:['employee','manager','admin'] },
  { to:'/projects',     label:'פרויקטים ומשימות', icon:'📁', roles:['manager','admin'] },
  { to:'/management',   label:'ניהול',             icon:'◈', roles:['manager','admin'] },
  { to:'/integrations', label:'אינטגרציות',        icon:'⇄', roles:['employee','manager','admin'] },
];
export default function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <div dir="rtl" style={{ width:200,background:'#fff',borderLeft:'1px solid #e2e8f0',display:'flex',flexDirection:'column',flexShrink:0 }}>
      <div style={{ padding:'20px 16px',borderBottom:'1px solid #f1f5f9' }}>
        <div style={{ fontSize:20,fontWeight:700,color:'#6366f1' }}>TimeIn</div>
        <div style={{ fontSize:10,color:'#94a3b8',marginTop:2 }}>ניהול שעות עבודה</div>
      </div>
      <nav style={{ padding:8,flex:1 }}>
        {NAV.filter(n => n.roles.includes(user?.role)).map(n => (
          <NavLink key={n.to} to={n.to} end={n.to==='/'} style={({ isActive }) => ({ display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:8,marginBottom:2,textDecoration:'none',background:isActive?'#e0e7ff':'transparent',color:isActive?'#4f46e5':'#64748b',fontSize:13,fontWeight:isActive?500:400 })}>
            <span>{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding:12,borderTop:'1px solid #f1f5f9' }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
          <Avatar name={user?.full_name} size={28} />
          <div><div style={{ fontSize:12,fontWeight:500,color:'#334155' }}>{user?.full_name}</div><div style={{ fontSize:10,color:'#94a3b8' }}>{user?.role}</div></div>
        </div>
        <button onClick={logout} style={{ width:'100%',padding:7,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer' }}>יציאה</button>
      </div>
    </div>
  );
}
