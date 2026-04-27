
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { useToast }    from '../context/ToastContext';

const GOOGLE_CLIENT_ID = (() => {
  const v = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
  return v.endsWith('.apps.googleusercontent.com') ? v : '';
})();

export default function LoginPage() {
  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading]   = useState(false);
  const googleBtnRef            = useRef(null);
  const { login, register }     = useAuth();
  const { addToast }            = useToast();
  const navigate                = useNavigate();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch (_) {} };
  }, []);

  const initGoogle = () => {
    if (!window.google) return;
    window.google.accounts.id.initialize({
      client_id:   GOOGLE_CLIENT_ID,
      callback:    handleGoogleResponse,
      auto_select: false,
    });
    renderGoogleBtn();
  };

  const renderGoogleBtn = () => {
    if (!window.google || !googleBtnRef.current) return;
    googleBtnRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme:  'outline',
      size:   'large',
      width:  268,
      locale: 'he',
    });
  };

  // מרנדר מחדש את כפתור Google כשה-ref זמין
  useEffect(() => {
    if (window.google && googleBtnRef.current) renderGoogleBtn();
  });

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    try {
      await login(null, null, response.credential);
      navigate('/');
    } catch (err) {
      addToast(err.message || 'שגיאת כניסה עם Google', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { addToast('נא למלא אימייל וסיסמה', 'error'); return; }
    if (mode === 'register' && !fullName.trim()) { addToast('נא למלא שם מלא', 'error'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(fullName.trim(), email, password);
        addToast('נרשמת בהצלחה!', 'success');
      }
      navigate('/');
    } catch (err) {
      addToast(err.message || 'שגיאה, נסה שוב', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', marginTop: 4, padding: '9px 12px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, boxSizing: 'border-box', outline: 'none',
  };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 500 };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', width: 340, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* כותרת */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#6366f1', margin: 0 }}>TimeIn</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 0' }}>מערכת ניהול שעות עבודה</p>
        </div>

        {/* טאבים כניסה / הרשמה */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 24 }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontSize: 13,
              fontWeight: 500, cursor: 'pointer', transition: 'all .15s',
              background: mode === m ? '#fff' : 'transparent',
              color: mode === m ? '#6366f1' : '#64748b',
              boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
              {m === 'login' ? 'כניסה' : 'הרשמה'}
            </button>
          ))}
        </div>

        {/* טופס */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div>
              <label style={labelStyle}>שם מלא</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="ישראל ישראלי" style={inputStyle} />
            </div>
          )}
          <div>
            <label style={labelStyle}>אימייל</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoFocus placeholder="email@example.com" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>סיסמה</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" style={inputStyle} />
          </div>
          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: 10, borderRadius: 8, background: '#6366f1',
            color: '#fff', border: 'none', fontSize: 14, fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>
            {loading
              ? (mode === 'login' ? 'מתחבר...' : 'נרשם...')
              : (mode === 'login' ? 'כניסה' : 'הרשמה')}
          </button>
        </form>

        {/* כניסה עם Google */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>או התחבר עם</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>
            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center' }} />
          </>
        )}

        {!GOOGLE_CLIENT_ID && (
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#cbd5e1' }}>
            כניסה עם Google תופעל לאחר הגדרת REACT_APP_GOOGLE_CLIENT_ID
          </p>
        )}
      </div>
    </div>
  );
}
