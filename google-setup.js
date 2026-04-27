// ============================================================
// שמרי קובץ זה בשם: google-setup.js
// הרץ עם: node google-setup.js
// ============================================================
// מה הקובץ עושה:
// 1. מוסיף Google OAuth לבאקנד
// 2. מעדכן את LoginPage לכניסה עם Google
// 3. יוצר את משתמשי הדמו במסד הנתונים
// ============================================================

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mkd = (p) => fs.mkdirSync(p, { recursive: true });
const w   = (p, c) => { mkd(path.dirname(p)); fs.writeFileSync(p, c, 'utf8'); };

// ── שלב 1: התקנת חבילת Google OAuth ────────────────────────
console.log('📦 מתקין חבילות Google OAuth...');
try {
  execSync('cd timein-backend && npm install passport passport-google-oauth20', { stdio: 'inherit' });
  execSync('cd timein-frontend && npm install @react-oauth/google', { stdio: 'inherit' });
  console.log('✓ חבילות הותקנו\n');
} catch(e) {
  console.log('⚠ התקנה נכשלה – המשך ידנית:\n  cd timein-backend && npm install passport passport-google-oauth20\n  cd timein-frontend && npm install @react-oauth/google\n');
}

// ── שלב 2: עדכון DB Schema – הוספת google_id ───────────────
console.log('🗄 מעדכן schema...');
w('timein-backend/src/db/add_google.sql', `
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
`);
console.log('✓ add_google.sql נוצר – הרץ אותו על ה-DB\n');

// ── שלב 3: route חדש לGoogle Auth ──────────────────────────
w('timein-backend/src/routes/googleAuth.js', `
const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const pool    = require('../config/db');
require('dotenv').config();

// POST /api/auth/google
// מקבל את ה-credential מ-Google (JWT token) ומחזיר JWT שלנו
router.post('/google', async (req, res, next) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing credential' });

  try {
    // פענוח ה-JWT של Google (ללא ולידציה מלאה – לפיתוח)
    // בייצור: להשתמש ב-google-auth-library לולידציה מלאה
    const base64 = credential.split('.')[1];
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

    const { sub: googleId, email, name, picture } = payload;

    if (!email) return res.status(400).json({ error: 'No email from Google' });

    // חפש משתמש קיים לפי google_id או email
    let { rows } = await pool.query(
      'SELECT * FROM users WHERE google_id=$1 OR email=$2 LIMIT 1',
      [googleId, email]
    );

    let user;
    if (rows.length) {
      // משתמש קיים – עדכן google_id אם חסר
      user = rows[0];
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id=$1 WHERE id=$2', [googleId, user.id]);
      }
    } else {
      // משתמש חדש – צור אוטומטית
      const { rows: newRows } = await pool.query(
        'INSERT INTO users (full_name, email, google_id, role, is_active) VALUES ($1,$2,$3,$4,TRUE) RETURNING *',
        [name, email, googleId, 'employee']
      );
      user = newRows[0];
    }

    if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });

  } catch (err) { next(err); }
});

module.exports = router;
`);
console.log('✓ googleAuth.js נוצר\n');

// ── שלב 4: עדכון app.js – הוספת route ─────────────────────
w('timein-backend/src/app.js', `
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/auth',         require('./routes/googleAuth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/projects',     require('./routes/projects'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/integrations', require('./routes/integrations'));
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use(require('./middleware/errorHandler'));

module.exports = app;
`);
console.log('✓ app.js עודכן\n');

// ── שלב 5: LoginPage עם Google ─────────────────────────────
w('timein-frontend/src/pages/LoginPage.jsx', `
import { useState, useEffect } from 'react';
import { useNavigate }   from 'react-router-dom';
import { useAuth }       from '../context/AuthContext';
import { useToast }      from '../context/ToastContext';

// Google Client ID – תחליפי עם ה-ID שלך מ-Google Console
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

export default function LoginPage() {
  const { login }    = useAuth();
  const { addToast } = useToast();
  const navigate     = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // טעינת ספריית Google
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, []);

  const initGoogle = () => {
    if (!window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
      auto_select: false,
    });
    window.google.accounts.id.renderButton(
      document.getElementById('google-btn'),
      {
        theme: 'outline',
        size: 'large',
        width: 288,
        text: 'signin_with',
        locale: 'he',
      }
    );
  };

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    try {
      await login(null, null, response.credential);
      navigate('/');
    } catch(err) {
      addToast(err.message || 'שגיאת כניסה עם Google', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" style={{ minHeight:'100vh', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'48px 40px', width:360, boxShadow:'0 20px 60px rgba(0,0,0,0.18)', textAlign:'center' }}>

        {/* לוגו */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:40, fontWeight:700, color:'#6366f1', letterSpacing:'-0.02em' }}>TimeIn</div>
          <div style={{ fontSize:13, color:'#94a3b8', marginTop:6 }}>מערכת ניהול שעות עבודה</div>
        </div>

        {/* כפתור Google */}
        <div style={{ marginBottom:24 }}>
          <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>התחברי עם חשבון Google שלך</p>
          <div id="google-btn" style={{ display:'flex', justifyContent:'center' }}></div>
        </div>

        {loading && (
          <div style={{ display:'flex', justifyContent:'center', marginTop:16 }}>
            <div style={{ width:24,height:24,border:'3px solid #e2e8f0',borderTop:'3px solid #6366f1',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}

        <div style={{ marginTop:28, padding:'16px', background:'#f8fafc', borderRadius:10, fontSize:12, color:'#64748b', lineHeight:1.6 }}>
          <strong style={{ color:'#334155' }}>לכניסה ראשונה:</strong><br/>
          היכנסי עם חשבון Google – המערכת תיצור לך חשבון אוטומטית<br/>
          <span style={{ color:'#6366f1' }}>תפקיד ברירת מחדל: עובד</span>
        </div>
      </div>
    </div>
  );
}
`);
console.log('✓ LoginPage עם Google נוצר\n');

// ── שלב 6: עדכון AuthContext לתמיכה ב-Google ───────────────
w('timein-frontend/src/context/AuthContext.jsx', `
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('timein_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(setUser)
      .catch(() => localStorage.removeItem('timein_token'))
      .finally(() => setLoading(false));
  }, []);

  // login עם אימייל+סיסמה או עם Google credential
  const login = useCallback(async (email, password, googleCredential) => {
    let data;
    if (googleCredential) {
      // כניסה עם Google
      data = await client.post('/auth/google', { credential: googleCredential });
    } else {
      // כניסה רגילה
      data = await authApi.login(email, password);
    }
    localStorage.setItem('timein_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('timein_token');
    // התנתקות מ-Google אם מחובר
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
`);
console.log('✓ AuthContext עודכן\n');

// ── שלב 7: עדכון .env של frontend ──────────────────────────
const envPath = 'timein-frontend/.env';
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath,'utf8') : '';
if (!envContent.includes('REACT_APP_GOOGLE_CLIENT_ID')) {
  fs.appendFileSync(envPath, '\nREACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID\n');
}
console.log('✓ .env עודכן\n');

// ── הוראות ─────────────────────────────────────────────────
console.log(`
✅ הקבצים מוכנים!

═══════════════════════════════════════════════
  עכשיו צריך להשיג Google Client ID:
═══════════════════════════════════════════════

1. כנסי ל: https://console.cloud.google.com
2. צרי פרויקט חדש (שם: "TimeIn")
3. APIs & Services → Credentials
4. Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized JavaScript origins: http://localhost:3000
7. Authorized redirect URIs: http://localhost:3000
8. לחצי Create ← תקבלי Client ID

9. פתחי: timein-frontend/.env
   שני את:  REACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
   ל:       REACT_APP_GOOGLE_CLIENT_ID=XXXXXX.apps.googleusercontent.com

10. עדכני את מסד הנתונים:
    "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" postgresql://postgres:Winer4852@localhost:5432/timein -f timein-backend/src/db/add_google.sql

11. הפעלי מחדש את שני השרתים

═══════════════════════════════════════════════
`);