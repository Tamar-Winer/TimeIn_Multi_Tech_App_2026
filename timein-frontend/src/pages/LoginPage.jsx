
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { useToast }    from '../context/ToastContext';
import { T }           from '../theme';

const GOOGLE_CLIENT_ID = (() => {
  const v = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
  return v.endsWith('.apps.googleusercontent.com') ? v : '';
})();

const inp = {
  width: '100%', padding: '10px 14px', marginTop: 6,
  border: `1px solid ${T.border}`, borderRadius: T.radius,
  fontSize: 13, boxSizing: 'border-box', background: T.surface,
  color: T.text, fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
};
const lbl = { fontSize: 12, color: T.textSub, fontWeight: 600, letterSpacing: '0.02em' };

export default function LoginPage() {
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading,  setLoading]  = useState(false);
  const googleBtnRef            = useRef(null);
  const { login, register }     = useAuth();
  const { addToast }            = useToast();
  const navigate                = useNavigate();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch (_) {} };
  }, []);

  const initGoogle = () => {
    if (!window.google) return;
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse, auto_select: false });
    renderGoogleBtn();
  };
  const renderGoogleBtn = () => {
    if (!window.google || !googleBtnRef.current) return;
    googleBtnRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', width: 280, locale: 'he' });
  };
  useEffect(() => { if (window.google && googleBtnRef.current) renderGoogleBtn(); });

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    try { await login(null, null, response.credential); navigate('/'); }
    catch (err) { addToast(err.message || 'שגיאת כניסה עם Google', 'error'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { addToast('נא למלא אימייל וסיסמה', 'error'); return; }
    if (mode === 'register' && !fullName.trim()) { addToast('נא למלא שם מלא', 'error'); return; }
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else { await register(fullName.trim(), email, password); addToast('נרשמת בהצלחה!', 'success'); }
      navigate('/');
    } catch (err) { addToast(err.message || 'שגיאה, נסה שוב', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div dir="rtl" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${T.primary} 0%, #1D4ED8 50%, ${T.accent} 100%)`,
      padding: 20,
    }}>
      {/* Decorative blobs */}
      <div style={{ position:'fixed', top:-120, right:-80, width:400, height:400, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:-100, left:-60, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />

      <div style={{
        background: T.surface, borderRadius: 20, padding: '40px 36px',
        width: '100%', maxWidth: 360,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: T.primary, letterSpacing: '-1px', lineHeight: 1 }}>TimeIn</div>
          <p style={{ color: T.textFaint, fontSize: 13, margin: '8px 0 0', fontWeight: 400 }}>מערכת ניהול שעות עבודה</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex', background: T.surfaceAlt, borderRadius: T.radius, padding: 4, marginBottom: 28 }}>
          {['login','register'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '8px 0', border: 'none', borderRadius: T.radiusSm,
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: mode === m ? T.surface : 'transparent',
              color:      mode === m ? T.primary : T.textSub,
              boxShadow:  mode === m ? T.shadow : 'none',
              transition: 'all 0.15s',
            }}>
              {m === 'login' ? 'כניסה' : 'הרשמה'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          {mode === 'register' && (
            <div>
              <label style={lbl}>שם מלא</label>
              <input className="ti-input" type="text" value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="ישראל ישראלי" style={inp} />
            </div>
          )}
          <div>
            <label style={lbl}>אימייל</label>
            <input className="ti-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus placeholder="email@example.com" style={inp} />
          </div>
          <div>
            <label style={lbl}>סיסמה</label>
            <input className="ti-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" style={inp} />
          </div>
          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: '11px 0',
            borderRadius: T.radius, background: T.primary,
            color: '#fff', border: 'none', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.75 : 1,
            letterSpacing: '0.02em',
            boxShadow: '0 2px 8px rgba(30,58,138,0.3)',
            transition: 'opacity 0.15s, transform 0.1s',
          }}>
            {loading
              ? (mode === 'login' ? 'מתחבר...' : 'נרשם...')
              : (mode === 'login' ? 'כניסה למערכת' : 'יצירת חשבון')}
          </button>
        </form>

        {/* Google login */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display:'flex', alignItems:'center', margin:'24px 0 16px', gap:12 }}>
              <div style={{ flex:1, height:1, background: T.border }} />
              <span style={{ fontSize:11, color: T.textFaint, whiteSpace:'nowrap', fontWeight:500 }}>או התחבר עם</span>
              <div style={{ flex:1, height:1, background: T.border }} />
            </div>
            <div ref={googleBtnRef} style={{ display:'flex', justifyContent:'center' }} />
          </>
        )}

        {!GOOGLE_CLIENT_ID && (
          <p style={{ marginTop:24, textAlign:'center', fontSize:11, color: T.textFaint }}>
            כניסה עם Google תופעל לאחר הגדרת REACT_APP_GOOGLE_CLIENT_ID
          </p>
        )}
      </div>
    </div>
  );
}
