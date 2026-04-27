
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }   = useAuth();
  const { addToast } = useToast();
  const navigate    = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { addToast('נא למלא אימייל וסיסמה', 'error'); return; }
    setLoading(true);
    try { await login(email, password); navigate('/'); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  };
  return (
    <div dir="rtl" style={{ minHeight:'100vh',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'#fff',borderRadius:16,padding:'40px 36px',width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign:'center',marginBottom:32 }}>
          <h1 style={{ fontSize:32,fontWeight:700,color:'#6366f1',margin:0 }}>TimeIn</h1>
          <p style={{ color:'#94a3b8',fontSize:13,margin:'4px 0 0' }}>מערכת ניהול שעות עבודה</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div><label style={{ fontSize:12,color:'#64748b',fontWeight:500 }}>אימייל</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoFocus style={{ width:'100%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box' }} /></div>
          <div><label style={{ fontSize:12,color:'#64748b',fontWeight:500 }}>סיסמה</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width:'100%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box' }} /></div>
          <button type="submit" disabled={loading} style={{ marginTop:8,padding:10,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',opacity:loading?0.7:1 }}>{loading?'מתחבר...':'כניסה'}</button>
        </form>
      </div>
    </div>
  );
}
