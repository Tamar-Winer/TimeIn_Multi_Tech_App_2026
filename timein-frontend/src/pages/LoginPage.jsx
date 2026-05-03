
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
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const googleBtnRef            = useRef(null);
  const { login }               = useAuth();
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
    setLoading(true);
    try {
      await login(email, password);
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: T.primary, letterSpacing: '-1px', lineHeight: 1 }}>TimeIn</div>
          <p style={{ color: T.textFaint, fontSize: 13, margin: '8px 0 0', fontWeight: 400 }}>מערכת ניהול שעות עבודה</p>
        </div>

        {/* Google SSO — primary action */}
        {GOOGLE_CLIENT_ID ? (
          <div style={{ marginBottom: 24 }}>
            <div ref={googleBtnRef} style={{ display:'flex', justifyContent:'center' }} />
          </div>
        ) : (
          <div style={{
            marginBottom: 24, padding: '12px 16px', borderRadius: T.radius,
            background: T.primaryLight, border: `1px solid ${T.primaryBorder}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span style={{ fontSize: 12, color: T.primary, fontWeight: 500 }}>
              כניסה עם Google תופעל לאחר הגדרת REACT_APP_GOOGLE_CLIENT_ID
            </span>
          </div>
        )}

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', marginBottom: 20, gap:12 }}>
          <div style={{ flex:1, height:1, background: T.border }} />
          <span style={{ fontSize:11, color: T.textFaint, whiteSpace:'nowrap', fontWeight:500 }}>או כניסה עם סיסמה</span>
          <div style={{ flex:1, height:1, background: T.border }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          <div>
            <label style={lbl}>אימייל</label>
            <input className="ti-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus placeholder="email@example.com" style={inp} />
          </div>
          <div>
            <label style={lbl}>סיסמה</label>
            <div style={{ position: 'relative' }}>
              <input className="ti-input" type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" style={{ ...inp, paddingLeft: 36 }} />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: T.textFaint, display: 'flex', alignItems: 'center',
              }}>
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
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
            {loading ? 'מתחבר...' : 'כניסה למערכת'}
          </button>
        </form>
      </div>
    </div>
  );
}
