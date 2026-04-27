@echo off
chcp 65001 >nul
echo === משלים קבצים חסרים ===

cd C:\Projects

:: ── Card.jsx ────────────────────────────────────────────────
(
echo export default function Card({ children, style={} }) {
echo   return ^<div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',...style }}^>{children}^</div^>;
echo }
) > timein-frontend\src\components\common\Card.jsx

:: ── Spinner.jsx ─────────────────────────────────────────────
(
echo export default function Spinner({ fullPage }) {
echo   const w = fullPage ? {position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.8)',zIndex:999} : {display:'flex',justifyContent:'center',padding:32};
echo   return ^<div style={w}^>^<div style={{width:28,height:28,border:'3px solid #e2e8f0',borderTop:'3px solid #6366f1',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} /^>^<style^>{'@keyframes spin{to{transform:rotate(360deg)}}'}^</style^>^</div^>;
echo }
) > timein-frontend\src\components\common\Spinner.jsx

:: ── Badge.jsx ───────────────────────────────────────────────
(
echo const M={draft:['טיוטה','#f1f5f9','#64748b'],submitted:['הוגש','#dbeafe','#1d4ed8'],approved:['אושר','#d1fae5','#065f46'],rejected:['נדחה','#fee2e2','#991b1b']};
echo export default function Badge({status}) {
echo   const [l,bg,c]=M[status]^^||['?','#f1f5f9','#64748b'];
echo   return ^<span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:20,background:bg,color:c}}^>{l}^</span^>;
echo }
) > timein-frontend\src\components\common\Badge.jsx

:: ── Avatar.jsx ──────────────────────────────────────────────
(
echo export default function Avatar({name,size=32}) {
echo   const ini=name?.split(' ').map(w=^>w[0]).join('').slice(0,2)^^||'??';
echo   return ^<div style={{width:size,height:size,borderRadius:'50%',background:'#e0e7ff',color:'#4f46e5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:500,flexShrink:0}}^>{ini}^</div^>;
echo }
) > timein-frontend\src\components\common\Avatar.jsx

echo [1/6] Common components - OK

:: ── Sidebar.jsx ─────────────────────────────────────────────
(
echo import { NavLink } from 'react-router-dom';
echo import { useAuth } from '../../context/AuthContext';
echo import Avatar from '../common/Avatar';
echo const NAV=[
echo   {to:'/',label:'דאשבורד',icon:'⊞',roles:['employee','manager','admin']},
echo   {to:'/report',label:'דיווח שעות',icon:'+',roles:['employee','manager','admin']},
echo   {to:'/my-entries',label:'הדיווחים שלי',icon:'☰',roles:['employee','manager','admin']},
echo   {to:'/management',label:'ניהול',icon:'◈',roles:['manager','admin']},
echo   {to:'/integrations',label:'אינטגרציות',icon:'⇄',roles:['employee','manager','admin']},
echo ];
echo export default function Sidebar() {
echo   const {user,logout}=useAuth();
echo   return (
echo     ^<div dir="rtl" style={{width:200,background:'#fff',borderLeft:'1px solid #e2e8f0',display:'flex',flexDirection:'column',flexShrink:0}}^>
echo       ^<div style={{padding:'20px 16px',borderBottom:'1px solid #f1f5f9'}}^>
echo         ^<div style={{fontSize:20,fontWeight:700,color:'#6366f1'}}^>TimeIn^</div^>
echo         ^<div style={{fontSize:10,color:'#94a3b8',marginTop:2}}^>ניהול שעות עבודה^</div^>
echo       ^</div^>
echo       ^<nav style={{padding:8,flex:1}}^>
echo         {NAV.filter(n=^>n.roles.includes(user?.role)).map(n=^>(
echo           ^<NavLink key={n.to} to={n.to} end={n.to==='/'} style={({isActive})=^>({display:'flex',alignItems:'center',gap:8,padding:'9px 10px',borderRadius:8,marginBottom:2,textDecoration:'none',background:isActive?'#e0e7ff':'transparent',color:isActive?'#4f46e5':'#64748b',fontSize:13,fontWeight:isActive?500:400})}^>
echo             ^<span^>{n.icon}^</span^>{n.label}
echo           ^</NavLink^>
echo         ))}
echo       ^</nav^>
echo       ^<div style={{padding:12,borderTop:'1px solid #f1f5f9'}}^>
echo         ^<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}^>
echo           ^<Avatar name={user?.full_name} size={28}/^>
echo           ^<div^>^<div style={{fontSize:12,fontWeight:500,color:'#334155'}}^>{user?.full_name}^</div^>^<div style={{fontSize:10,color:'#94a3b8'}}^>{user?.role}^</div^>^</div^>
echo         ^</div^>
echo         ^<button onClick={logout} style={{width:'100%',padding:7,borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer'}}^>יציאה^</button^>
echo       ^</div^>
echo     ^</div^>
echo   );
echo }
) > timein-frontend\src\components\layout\Sidebar.jsx

echo [2/6] Sidebar - OK

:: ── LoginPage.jsx ───────────────────────────────────────────
(
echo import {useState} from 'react';
echo import {useNavigate} from 'react-router-dom';
echo import {useAuth} from '../context/AuthContext';
echo import {useToast} from '../context/ToastContext';
echo export default function LoginPage() {
echo   const [email,setEmail]=useState('');
echo   const [password,setPassword]=useState('');
echo   const [loading,setLoading]=useState(false);
echo   const {login}=useAuth();
echo   const {addToast}=useToast();
echo   const navigate=useNavigate();
echo   const handleSubmit=async(e)=^>{
echo     e.preventDefault();
echo     if(!email^^||!password){addToast('נא למלא אימייל וסיסמה','error');return;}
echo     setLoading(true);
echo     try{await login(email,password);navigate('/');}
echo     catch(err){addToast(err.message,'error');}
echo     finally{setLoading(false);}
echo   };
echo   return (
echo     ^<div dir="rtl" style={{minHeight:'100vh',background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif'}}^>
echo       ^<div style={{background:'#fff',borderRadius:16,padding:'40px 36px',width:340,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}^>
echo         ^<div style={{textAlign:'center',marginBottom:32}}^>
echo           ^<h1 style={{fontSize:32,fontWeight:700,color:'#6366f1',margin:0}}^>TimeIn^</h1^>
echo           ^<p style={{color:'#94a3b8',fontSize:13,margin:'4px 0 0'}}^>מערכת ניהול שעות עבודה^</p^>
echo         ^</div^>
echo         ^<form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:14}}^>
echo           ^<div^>^<label style={{fontSize:12,color:'#64748b',fontWeight:500}}^>אימייל^</label^>^<input type="email" value={email} onChange={e=^>setEmail(e.target.value)} autoFocus style={{width:'100%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box'}}^^/^>^</div^>
echo           ^<div^>^<label style={{fontSize:12,color:'#64748b',fontWeight:500}}^>סיסמה^</label^>^<input type="password" value={password} onChange={e=^>setPassword(e.target.value)} style={{width:'100%',marginTop:4,padding:'9px 12px',border:'1px solid #e2e8f0',borderRadius:8,fontSize:14,boxSizing:'border-box'}}^^/^>^</div^>
echo           ^<button type="submit" disabled={loading} style={{marginTop:8,padding:10,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',opacity:loading?0.7:1}}^>{loading?'מתחבר...':'כניסה'}^</button^>
echo         ^</form^>
echo       ^</div^>
echo     ^</div^>
echo   );
echo }
) > timein-frontend\src\pages\LoginPage.jsx

echo [3/6] LoginPage - OK

:: ── DashboardPage.jsx ───────────────────────────────────────
(
echo import {useEffect,useState} from 'react';
echo import {useNavigate} from 'react-router-dom';
echo import {useAuth} from '../context/AuthContext';
echo import {useTimeEntries} from '../hooks/useTimeEntries';
echo import {reportsApi} from '../api/reports';
echo import Card from '../components/common/Card';
echo import Badge from '../components/common/Badge';
echo import Spinner from '../components/common/Spinner';
echo const fmt=m=>`${Math.floor(m/60)}:${String(m%%60).padStart(2,'0')}`;
echo export default function DashboardPage() {
echo   const {user}=useAuth();
echo   const navigate=useNavigate();
echo   const {entries,loading}=useTimeEntries();
echo   const [summary,setSummary]=useState(null);
echo   useEffect(()=^>{reportsApi.summary().then(setSummary).catch(()=^>{});},[]);
echo   return (
echo     ^<div dir="rtl" style={{fontFamily:'system-ui,sans-serif'}}^>
echo       ^<div style={{marginBottom:20}}^>
echo         ^<h2 style={{fontSize:20,fontWeight:600,margin:0,color:'#1e293b'}}^>שלום, {user?.full_name?.split(' ')[0]}^</h2^>
echo         ^<p style={{color:'#94a3b8',fontSize:13,marginTop:4}}^>{new Date().toLocaleDateString('he-IL',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}^</p^>
echo       ^</div^>
echo       ^<div style={{display:'flex',gap:12,marginBottom:20}}^>
echo         {[['היום',summary?.today_minutes,'#6366f1'],['השבוע',summary?.week_minutes,'#3b82f6'],['החודש',summary?.month_minutes,'#10b981'],['טיוטות',summary?.draft_count,'#f59e0b']].map(([l,v,c])=^>(
echo           ^<Card key={l} style={{flex:1}}^>^<div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase'}}^>{l}^</div^>^<div style={{fontSize:24,fontWeight:600,color:c,margin:'4px 0'}}^>{v!=null?(l==='טיוטות'?v:fmt(+v)):'—'}^</div^>^</Card^>
echo         ))}
echo       ^</div^>
echo       ^<Card^>
echo         ^<div style={{fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12}}^>דיווחים אחרונים^</div^>
echo         {loading^^&&^<Spinner/^>}
echo         {entries.slice(0,5).map(e=^>(
echo           ^<div key={e.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12}}^>
echo             ^<span style={{color:'#94a3b8',minWidth:80}}^>{e.date}^</span^>
echo             ^<span style={{flex:1,color:'#334155',fontWeight:500}}^>{e.project_name}^</span^>
echo             ^<span style={{color:'#64748b'}}^>{e.description}^</span^>
echo             ^<span style={{fontWeight:600,color:'#6366f1'}}^>{fmt(e.duration_minutes)}^</span^>
echo             ^<Badge status={e.status}/^>
echo           ^</div^>
echo         ))}
echo         ^<button onClick={()=^>navigate('/report')} style={{marginTop:12,width:'100%',padding:8,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}^>+ דיווח חדש^</button^>
echo       ^</Card^>
echo     ^</div^>
echo   );
echo }
) > timein-frontend\src\pages\DashboardPage.jsx

echo [4/6] DashboardPage - OK

:: ── MyEntriesPage.jsx ───────────────────────────────────────
(
echo import {useState} from 'react';
echo import {useNavigate} from 'react-router-dom';
echo import {useTimeEntries} from '../hooks/useTimeEntries';
echo import {useProjects} from '../hooks/useProjects';
echo import {useToast} from '../context/ToastContext';
echo import Card from '../components/common/Card';
echo import Badge from '../components/common/Badge';
echo import Spinner from '../components/common/Spinner';
echo const fmt=m=>`${Math.floor(m/60)}:${String(m%%60).padStart(2,'0')}`;
echo export default function MyEntriesPage() {
echo   const navigate=useNavigate();
echo   const {addToast}=useToast();
echo   const {projects}=useProjects();
echo   const [f,setF]=useState({projectId:'',status:'',date:''});
echo   const {entries,loading,submit,remove}=useTimeEntries(Object.fromEntries(Object.entries(f).filter(([,v])=^>v)));
echo   const sel={border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff'};
echo   return (
echo     ^<div dir="rtl" style={{fontFamily:'system-ui,sans-serif'}}^>
echo       ^<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}^>
echo         ^<h2 style={{fontSize:18,fontWeight:600,margin:0,color:'#1e293b'}}^>הדיווחים שלי^</h2^>
echo         ^<button onClick={()=^>navigate('/report')} style={{padding:'7px 16px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer'}}^>+ דיווח חדש^</button^>
echo       ^</div^>
echo       ^<Card style={{marginBottom:14}}^>
echo         ^<div style={{display:'flex',gap:10,flexWrap:'wrap'}}^>
echo           ^<select value={f.projectId} onChange={e=^>setF(p=^>({...p,projectId:e.target.value}))} style={sel}^>^<option value=""^>כל הפרויקטים^</option^>{projects.map(p=^>^<option key={p.id} value={p.id}^>{p.project_name}^</option^>)}^</select^>
echo           ^<select value={f.status} onChange={e=^>setF(p=^>({...p,status:e.target.value}))} style={sel}^>^<option value=""^>כל הסטטוסים^</option^>^<option value="draft"^>טיוטה^</option^>^<option value="submitted"^>הוגש^</option^>^<option value="approved"^>אושר^</option^>^<option value="rejected"^>נדחה^</option^>^</select^>
echo           ^<input type="date" value={f.date} onChange={e=^>setF(p=^>({...p,date:e.target.value}))} style={sel}/^>
echo           ^<button onClick={()=^>setF({projectId:'',status:'',date:''})} style={{padding:'7px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer'}}^>נקה^</button^>
echo         ^</div^>
echo       ^</Card^>
echo       ^<Card^>
echo         {loading^^&&^<Spinner/^>}
echo         {!loading^^&&!entries.length^^&&^<p style={{textAlign:'center',color:'#94a3b8',padding:40}}^>אין דיווחים^</p^>}
echo         {entries.map(e=^>(
echo           ^<div key={e.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 0',borderBottom:'1px solid #f1f5f9',fontSize:12}}^>
echo             ^<span style={{color:'#94a3b8',minWidth:80}}^>{e.date}^</span^>
echo             ^<div style={{flex:1}}^>^<div style={{fontWeight:500,color:'#1e293b'}}^>{e.project_name}^</div^>^<div style={{color:'#64748b'}}^>{e.description}^</div^>^</div^>
echo             ^<span style={{fontWeight:600,color:'#6366f1',minWidth:48}}^>{fmt(e.duration_minutes)}^</span^>
echo             ^<Badge status={e.status}/^>
echo             ^<div style={{display:'flex',gap:5}}^>
echo               {e.status==='draft'^^&&^<^>
echo                 ^<button onClick={()=^>submit(e.id).catch(err=^>addToast(err.message,'error'))} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer'}}^>הגש^</button^>
echo                 ^<button onClick={()=^>navigate(`/report/${e.id}`)} style={{padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer'}}^>✏^</button^>
echo                 ^<button onClick={()=^>{if(window.confirm('למחוק?'))remove(e.id);}} style={{padding:'4px 8px',borderRadius:6,border:'none',background:'#fee2e2',color:'#dc2626',fontSize:11,cursor:'pointer'}}^>✕^</button^>
echo               ^</>}
echo               {e.status==='rejected'^^&&^<button onClick={()=^>navigate(`/report/${e.id}`)} style={{padding:'4px 10px',borderRadius:6,border:'1px solid #fca5a5',color:'#dc2626',background:'#fff',fontSize:11,cursor:'pointer'}}^>תקן^</button^>}
echo             ^</div^>
echo           ^</div^>
echo         ))}
echo       ^</Card^>
echo     ^</div^>
echo   );
echo }
) > timein-frontend\src\pages\MyEntriesPage.jsx

echo [5/6] MyEntriesPage - OK

:: ── App.jsx ─────────────────────────────────────────────────
(
echo import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
echo import {AuthProvider,useAuth} from './context/AuthContext';
echo import {ToastProvider} from './context/ToastContext';
echo import Sidebar from './components/layout/Sidebar';
echo import Spinner from './components/common/Spinner';
echo import LoginPage from './pages/LoginPage';
echo import DashboardPage from './pages/DashboardPage';
echo import MyEntriesPage from './pages/MyEntriesPage';
echo import IntegrationsPage from './pages/IntegrationsPage';
echo function ProtectedRoute({children,roles}) {
echo   const {user,loading}=useAuth();
echo   if(loading) return ^<Spinner fullPage/^>;
echo   if(!user) return ^<Navigate to="/login" replace/^>;
echo   if(roles^^&&!roles.includes(user.role)) return ^<Navigate to="/" replace/^>;
echo   return children;
echo }
echo function AppLayout() {
echo   return (
echo     ^<div dir="rtl" style={{display:'flex',height:'100vh',background:'#f8fafc',fontFamily:'system-ui,sans-serif'}}^>
echo       ^<Sidebar/^>
echo       ^<main style={{flex:1,overflow:'auto',padding:24}}^>
echo         ^<Routes^>
echo           ^<Route path="/" element={^<DashboardPage/^>}/^>
echo           ^<Route path="/my-entries" element={^<MyEntriesPage/^>}/^>
echo           ^<Route path="/integrations" element={^<IntegrationsPage/^>}/^>
echo           ^<Route path="*" element={^<Navigate to="/" replace/^>}/^>
echo         ^</Routes^>
echo       ^</main^>
echo     ^</div^>
echo   );
echo }
echo export default function App() {
echo   return (
echo     ^<BrowserRouter^>
echo       ^<AuthProvider^>
echo         ^<ToastProvider^>
echo           ^<Routes^>
echo             ^<Route path="/login" element={^<LoginPage/^>}/^>
echo             ^<Route path="/*" element={^<ProtectedRoute^>^<AppLayout/^>^</ProtectedRoute^>}/^>
echo           ^</Routes^>
echo         ^</ToastProvider^>
echo       ^</AuthProvider^>
echo     ^</BrowserRouter^>
echo   );
echo }
) > timein-frontend\src\App.jsx

echo [6/6] App.jsx - OK

:: ── התקנת חבילות ────────────────────────────────────────────
echo.
echo === מתקין Backend packages ===
cd timein-backend
call npm install
cd ..

echo.
echo === מתקין Frontend packages ===
cd timein-frontend
call npm install
cd ..

:: ── מסד נתונים ──────────────────────────────────────────────
echo.
echo === יוצר מסד נתונים ===
"C:\Program Files\PostgreSQL\18\bin\psql.exe" postgresql://postgres:Winer4852@localhost:5432/postgres -c "CREATE DATABASE timein;" 2>nul
"C:\Program Files\PostgreSQL\18\bin\psql.exe" postgresql://postgres:Winer4852@localhost:5432/timein -f timein-backend\src\db\schema.sql

echo.
echo ========================================
echo  הכל מוכן!
echo.
echo  עכשיו פתחי 2 חלונות CMD:
echo.
echo  חלון 1:
echo    cd C:\Projects\timein-backend
echo    npm run dev
echo.
echo  חלון 2:
echo    cd C:\Projects\timein-frontend
echo    npm start
echo.
echo  כתובת האתר: http://localhost:3000
echo  כניסה: eli@timein.io / 123456
echo ========================================
pause