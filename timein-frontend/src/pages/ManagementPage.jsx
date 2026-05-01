
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useAuth }        from '../context/AuthContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useReports }     from '../hooks/useReports';
import { useToast }       from '../context/ToastContext';
import { usersApi }       from '../api/users';
import { useProjects }    from '../hooks/useProjects';
import { integrationsApi } from '../api/integrations';
import { reportsApi }      from '../api/reports';
import { timeEntriesApi } from '../api/timeEntries';
import { exportApi }      from '../api/export';
import { payrollApi }     from '../api/payroll';
import { slackApi }       from '../api/slack';
import { apiKeysApi }     from '../api/apiKeys';
import { remindersApi }   from '../api/reminders';
import { useResponsive }  from '../hooks/useResponsive';
import { T }              from '../theme';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';

const fmt  = m => m != null ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '—';
const fmtH = h => h != null ? `${h}ש'` : '—';

const ROLE_COLORS = { employee: T.textSub, manager: T.accent, admin: T.error };

function todayStr()      { return new Date().toISOString().slice(0,10); }
function weekStartStr()  { const d = new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().slice(0,10); }
function monthStartStr() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); }

// ── SVG icons ─────────────────────────────────────────────────────
const Ic = ({ children, size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display:'block', flexShrink:0 }}>
    {children}
  </svg>
);
const IcCheck    = ({ s=16 }) => <Ic size={s}><polyline points="20 6 9 17 4 12"/></Ic>;
const IcX        = ({ s=16 }) => <Ic size={s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Ic>;
const IcChart    = ({ s=16 }) => <Ic size={s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Ic>;
const IcTarget   = ({ s=16 }) => <Ic size={s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Ic>;
const IcDownload = ({ s=16 }) => <Ic size={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Ic>;
const IcGit      = ({ s=16 }) => <Ic size={s}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></Ic>;
const IcBell     = ({ s=16 }) => <Ic size={s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Ic>;
const IcDollar   = ({ s=16 }) => <Ic size={s}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Ic>;
const IcSlack    = ({ s=16 }) => <Ic size={s}><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></Ic>;
const IcKey      = ({ s=16 }) => <Ic size={s}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></Ic>;
const IcUsers    = ({ s=16 }) => <Ic size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Ic>;
const IcWarn     = ({ s=16 }) => <Ic size={s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Ic>;
const IcFilter   = ({ s=16 }) => <Ic size={s}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Ic>;
const IcChevron  = ({ s=16, up }) => <Ic size={s}>{up ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}</Ic>;
const IcUser     = ({ s=16 }) => <Ic size={s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Ic>;
const IcManage   = ({ s=16 }) => <Ic size={s}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></Ic>;
const IcSettings = ({ s=16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display:'block', flexShrink:0 }}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ── Shared style helpers ──────────────────────────────────────────
const sel = {
  border:`1px solid ${T.border}`, borderRadius: T.radiusSm,
  padding:'7px 10px', fontSize:12, background: T.surface, color: T.text, fontFamily:'inherit',
};
const inp = {
  border:`1px solid ${T.border}`, borderRadius: T.radius,
  padding:'8px 12px', fontSize:13, width:'100%', boxSizing:'border-box',
  background: T.surface, color: T.text, fontFamily:'inherit',
};
const lbl = { fontSize:11, color: T.textSub, fontWeight:600, display:'block', marginBottom:4, letterSpacing:'0.03em', textTransform:'uppercase' };
const th  = { textAlign:'right', padding:'8px 10px', fontWeight:600, fontSize:10, color: T.textFaint, borderBottom:`2px solid ${T.borderLight}`, letterSpacing:'0.06em', textTransform:'uppercase' };
const td  = { padding:'10px 10px', fontSize:12, borderBottom:`1px solid ${T.borderLight}` };

function SectionLabel({ icon, children, sub }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: sub ? 4 : 14 }}>
      <span style={{ width:3, height:14, background: T.primary, borderRadius:2, display:'inline-block', flexShrink:0 }}/>
      {icon && <span style={{ color: T.primary }}>{icon}</span>}
      <span style={{ fontSize:13, fontWeight:700, color: T.text }}>{children}</span>
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:22, background: T.surfaceAlt, padding:4, borderRadius: T.radiusLg, width:'fit-content', maxWidth:'100%' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'8px 14px', borderRadius: T.radius, border:'none',
          background: active === t.key ? T.surface : 'transparent',
          color: active === t.key ? T.primary : T.textSub,
          fontSize:12, fontWeight: active === t.key ? 700 : 500,
          cursor:'pointer', fontFamily:'inherit',
          boxShadow: active === t.key ? T.shadow : 'none',
          transition:'all 0.15s', whiteSpace:'nowrap',
        }}>
          {t.icon && <span style={{ opacity: active === t.key ? 1 : 0.6 }}>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return <p style={{ color: T.textFaint, textAlign:'center', padding:'28px 0', margin:0, fontSize:13 }}>{text}</p>;
}

export default function ManagementPage() {
  const { user }     = useAuth();
  const { addToast } = useToast();
  const { isMobile } = useResponsive();
  const isAdmin      = user?.role === 'admin';

  const [mainTab, setMainTab] = useState('approvals');

  const { projects } = useProjects();
  const [allUsers, setAllUsers] = useState([]);
  useEffect(() => { usersApi.list().then(setAllUsers).catch(() => {}); }, []);

  // ── Approvals ────────────────────────────────────────────────
  const [f, setF] = useState({ status:'', dateFrom:'', dateTo:'', userId:'', projectId:'' });
  const { entries, loading, approve, reject } = useTimeEntries(
    Object.fromEntries(Object.entries(f).filter(([,v]) => v))
  );

  // ── Reports ──────────────────────────────────────────────────
  const { data, loading: rLoading, fetch: fetchReport } = useReports();
  const [rType,   setRType]   = useState('byUser');
  const [rFrom,   setRFrom]   = useState('');
  const [rTo,     setRTo]     = useState('');
  const [rPreset, setRPreset] = useState('');
  const [expandId,    setExpandId]    = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [detailLoading, setDL]        = useState(false);
  const [detailTab,   setDetailTab]   = useState('');
  const [drillDown,   setDrillDown]   = useState(null);
  const [drillEntries,setDrillEntries]= useState([]);
  const [drillLoading,setDrillLoading]= useState(false);

  const applyPreset = (preset) => {
    setRPreset(preset);
    if (preset === 'today')  { setRFrom(todayStr());      setRTo(todayStr()); }
    if (preset === 'week')   { setRFrom(weekStartStr());  setRTo(todayStr()); }
    if (preset === 'month')  { setRFrom(monthStartStr()); setRTo(todayStr()); }
    if (preset === 'custom') { setRFrom(''); setRTo(''); }
  };

  const doFetch = useCallback(() => {
    const params = {};
    if (rFrom) params.dateFrom = rFrom;
    if (rTo)   params.dateTo   = rTo;
    fetchReport(rType, params);
    setExpandId(null); setDetail(null);
  }, [rType, rFrom, rTo, fetchReport]);

  useEffect(() => { if (mainTab === 'reports') doFetch(); }, [rType, rFrom, rTo, mainTab]);

  const handleRowClick = async (id) => {
    if (expandId === id) { setExpandId(null); setDetail(null); setDrillDown(null); return; }
    setExpandId(id); setDetail(null); setDrillDown(null); setDL(true);
    const params = {};
    if (rFrom) params.dateFrom = rFrom;
    if (rTo)   params.dateTo   = rTo;
    try {
      let d;
      if (rType==='byUser')    { d = await reportsApi.byUserDetail(id,params);    setDetailTab('projects'); }
      if (rType==='byProject') { d = await reportsApi.byProjectDetail(id,params); setDetailTab('employees'); }
      if (rType==='byTask')    { d = await reportsApi.byTaskDetail(id,params);    setDetailTab('employees'); }
      setDetail(d);
    } catch (err) { addToast(err.message,'error'); }
    finally { setDL(false); }
  };

  const handleDrillDown = async (filters, label) => {
    setDrillDown({ label, filters }); setDrillLoading(true);
    try {
      const params = { ...filters };
      if (rFrom) params.dateFrom = rFrom;
      if (rTo)   params.dateTo   = rTo;
      setDrillEntries(await timeEntriesApi.getAll(params));
    } catch (err) { addToast(err.message,'error'); }
    finally { setDrillLoading(false); }
  };

  // ── Commits ──────────────────────────────────────────────────
  const [commits, setCommits] = useState([]);
  const [cLoad, setCLoad]     = useState(false);
  useEffect(() => {
    if (mainTab !== 'commits') return;
    setCLoad(true);
    integrationsApi.getCommits().then(setCommits).catch(() => {}).finally(() => setCLoad(false));
  }, [mainTab]);

  // ── Export ───────────────────────────────────────────────────
  const [expState, setExpState] = useState({
    te:        { from:'', to:'', busy:false },
    byUser:    { from:'', to:'', busy:false },
    byProject: { from:'', to:'', busy:false },
  });
  const setExp = (key, patch) => setExpState(p => ({ ...p, [key]: { ...p[key], ...patch } }));
  const runExport = async (key, fn) => {
    setExp(key, { busy:true });
    try { await fn(expState[key].from, expState[key].to); }
    catch (err) { addToast(err.message,'error'); }
    finally { setExp(key, { busy:false }); }
  };

  // ── Estimate vs Actual ───────────────────────────────────────
  const [evaData,    setEvaData]  = useState([]);
  const [evaLoading, setEvaLoad]  = useState(false);
  const [evaFrom,    setEvaFrom]  = useState('');
  const [evaTo,      setEvaTo]    = useState('');
  useEffect(() => {
    if (mainTab !== 'estimate') return;
    setEvaLoad(true);
    reportsApi.estimateVsActual({ dateFrom:evaFrom, dateTo:evaTo })
      .then(setEvaData).catch(() => {}).finally(() => setEvaLoad(false));
  }, [mainTab, evaFrom, evaTo]);

  // ── Payroll ──────────────────────────────────────────────────
  const [payrollData,  setPayrollData]  = useState([]);
  const [payrollLoad,  setPayrollLoad]  = useState(false);
  const [payrollFrom,  setPayrollFrom]  = useState('');
  const [payrollTo,    setPayrollTo]    = useState('');
  const [rateEdits,    setRateEdits]    = useState({});
  const [rateSaving,   setRateSaving]   = useState(null);
  const loadPayroll = useCallback(() => {
    setPayrollLoad(true);
    payrollApi.summary({ dateFrom:payrollFrom, dateTo:payrollTo })
      .then(rows => { setPayrollData(rows); setRateEdits(Object.fromEntries(rows.map(r => [r.id, r.hourly_rate]))); })
      .catch(() => {}).finally(() => setPayrollLoad(false));
  }, [payrollFrom, payrollTo]);
  useEffect(() => { if (mainTab==='payroll') loadPayroll(); }, [mainTab, payrollFrom, payrollTo]);

  // ── Slack ────────────────────────────────────────────────────
  const [slackConfig,  setSlackConfig]  = useState({ configured:false, webhook_masked:'', enabled:false });
  const [slackUrl,     setSlackUrl]     = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackSaving,  setSlackSaving]  = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  useEffect(() => {
    if (mainTab !== 'slack') return;
    slackApi.getConfig().then(cfg => { setSlackConfig(cfg); setSlackEnabled(cfg.enabled); }).catch(() => {});
  }, [mainTab]);

  // ── Reminders ────────────────────────────────────────────────
  const [reminderHour,      setReminderHour]  = useState(17);
  const [reminderEnabled,   setReminderEn]    = useState(false);
  const [reminderSaving,    setReminderSave]  = useState(false);
  const [missingUsers,      setMissingUsers]  = useState([]);
  const [reminderTriggering,setRTrig]         = useState(false);
  const [retroAllowed,      setRetroAllowed]  = useState(true);
  const [retroMaxDays,      setRetroMaxDays]  = useState(30);
  const [retroSaving,       setRetroSaving]   = useState(false);
  useEffect(() => {
    if (mainTab !== 'reminders') return;
    remindersApi.getConfig().then(cfg => { setReminderHour(cfg.hour); setReminderEn(cfg.enabled); }).catch(() => {});
    remindersApi.missingToday().then(setMissingUsers).catch(() => {});
    if (isAdmin) remindersApi.getRetroConfig().then(cfg => { setRetroAllowed(cfg.allowed); setRetroMaxDays(cfg.maxDays); }).catch(() => {});
  }, [mainTab]);

  // ── API Keys ─────────────────────────────────────────────────
  const [apiKeys,    setApiKeys]   = useState([]);
  const [apiKeysLoad,setAKLoad]    = useState(false);
  const [newKeyName, setNewKeyName]= useState('');
  const [newKeyValue,setNewKeyValue]= useState('');
  const [keyCreating,setKeyCreating]= useState(false);
  const loadApiKeys = () => {
    setAKLoad(true);
    apiKeysApi.list().then(setApiKeys).catch(() => {}).finally(() => setAKLoad(false));
  };
  useEffect(() => { if (mainTab==='apikeys') loadApiKeys(); }, [mainTab]);

  // ── Users (admin) ────────────────────────────────────────────
  const [users,       setUsers]       = useState([]);
  const [usersLoading,setUL]          = useState(false);
  const [savingId,    setSavingId]    = useState(null);
  const [roleMap,     setRoleMap]     = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser,     setNewUser]     = useState({ fullName:'', email:'', password:'', role:'employee', team:'' });
  const [addSaving,   setAddSaving]   = useState(false);

  const loadUsers = async () => {
    setUL(true);
    try {
      const d = await usersApi.list();
      setUsers(d);
      setRoleMap(Object.fromEntries(d.map(u => [u.id, u.role])));
    } catch (err) { addToast(err.message,'error'); }
    finally { setUL(false); }
  };
  useEffect(() => { if (mainTab==='users' && isAdmin) loadUsers(); }, [mainTab]);

  const handleRoleChange = async (uid) => {
    setSavingId(uid);
    try {
      await usersApi.update(uid, { role: roleMap[uid] });
      setUsers(prev => prev.map(u => u.id===uid ? { ...u, role:roleMap[uid] } : u));
      addToast('תפקיד עודכן', 'success');
    } catch (err) { addToast(err.message,'error'); }
    finally { setSavingId(null); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.fullName||!newUser.email||!newUser.password) { addToast('נא למלא את כל השדות','error'); return; }
    setAddSaving(true);
    try {
      await usersApi.create({ fullName:newUser.fullName, email:newUser.email, password:newUser.password, role:newUser.role, team:newUser.team||undefined });
      addToast(`משתמש "${newUser.fullName}" נוצר`, 'success');
      setNewUser({ fullName:'', email:'', password:'', role:'employee', team:'' });
      setShowAddForm(false); loadUsers();
    } catch (err) { addToast(err.message,'error'); }
    finally { setAddSaving(false); }
  };

  const handleToggleActive = async (u) => {
    try {
      await usersApi.update(u.id, { isActive: !u.is_active });
      setUsers(prev => prev.map(x => x.id===u.id ? { ...x, is_active:!u.is_active } : x));
      addToast(u.is_active ? 'משתמש הושבת' : 'משתמש הופעל', 'success');
    } catch (err) { addToast(err.message,'error'); }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('סיבת הדחייה:');
    try { await reject(id, reason); } catch (err) { addToast(err.message,'error'); }
  };

  // ── Styles ───────────────────────────────────────────────────
  const presetBtn = (p) => ({
    padding:'5px 12px', borderRadius: T.radiusSm, fontSize:12, cursor:'pointer', fontFamily:'inherit',
    border: rPreset===p ? 'none' : `1px solid ${T.border}`,
    background: rPreset===p ? T.primaryMid : T.surface,
    color: rPreset===p ? T.primary : T.textSub,
    fontWeight: rPreset===p ? 700 : 400,
  });

  const clickableRow = (isExpanded) => ({
    cursor:'pointer',
    background: isExpanded ? T.primaryLight : 'transparent',
    transition:'background 0.15s',
  });

  const detailTabBtn = (active) => ({
    padding:'4px 12px', borderRadius: T.radiusSm, fontSize:11, cursor:'pointer', border:'none', fontFamily:'inherit',
    background: active ? T.primary : T.surfaceAlt,
    color: active ? '#fff' : T.textSub,
    fontWeight: active ? 700 : 500,
  });

  // ── Drill-down entries ────────────────────────────────────────
  const renderDrillEntries = () => (
    <div style={{ padding:'12px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <button onClick={() => setDrillDown(null)} style={{
          background: T.primaryMid, border:'none', borderRadius: T.radiusSm,
          padding:'4px 10px', fontSize:11, cursor:'pointer', color: T.primary, fontWeight:600, fontFamily:'inherit',
          display:'flex', alignItems:'center', gap:4,
        }}>
          ← חזור
        </button>
        <span style={{ fontSize:11, color: T.textSub }}>{drillDown?.label}</span>
      </div>
      {drillLoading && <Spinner />}
      {!drillLoading && drillEntries.length === 0 && <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין דיווחים בטווח זה</p>}
      {!drillLoading && drillEntries.length > 0 && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:380 }}>
            <thead>
              <tr>
                <th style={th}>תאריך</th><th style={th}>עובד</th><th style={th}>פרויקט</th>
                <th style={th}>משימה</th><th style={th}>שעות</th><th style={th}>סטטוס</th><th style={th}>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {drillEntries.map(e => (
                <tr key={e.id}>
                  <td style={td}>{e.date}</td>
                  <td style={{ ...td, fontWeight:600 }}>{e.user_name}</td>
                  <td style={{ ...td, color: T.textSub }}>{e.project_name||'—'}</td>
                  <td style={{ ...td, color: T.textSub }}>{e.task_name||'—'}</td>
                  <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmt(e.duration_minutes)}</td>
                  <td style={td}><Badge status={e.status} resubmitted={!!e.rejection_reason} /></td>
                  <td style={{ ...td, color: T.textFaint, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize:11, color: T.textFaint, marginTop:8 }}>
            {drillEntries.length} דיווחים · סה״כ {fmt(drillEntries.reduce((s,e) => s+(e.duration_minutes||0), 0))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Detail panel (drill level 1) ──────────────────────────────
  const renderDetailPanel = (row) => {
    if (expandId !== row.id) return null;
    const drillHover = e => { e.currentTarget.style.background = T.primaryLight; };
    const drillLeave = e => { e.currentTarget.style.background = 'transparent'; };

    return (
      <tr>
        <td colSpan={10} style={{ padding:0, background: T.primaryLight, borderBottom:`2px solid ${T.primaryBorder}` }}>
          {detailLoading && <div style={{ padding:16 }}><Spinner /></div>}

          {drillDown && renderDrillEntries()}

          {!drillDown && detail && rType === 'byUser' && (
            <div style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                {[['projects','פרויקטים'],['tasks','משימות'],['daily','יומי']].map(([k,l]) => (
                  <button key={k} style={detailTabBtn(detailTab===k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'projects' && (
                detail.projects.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr><th style={th}>פרויקט</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.projects.map((p,i) => (
                        <tr key={i} style={{ cursor:'pointer', transition:'background 0.12s' }}
                          onMouseEnter={drillHover} onMouseLeave={drillLeave}
                          onClick={() => handleDrillDown({ userId:row.id, projectId:p.id }, `${row.full_name} ← ${p.project_name}`)}>
                          <td style={td}>{p.project_name}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(p.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{p.entry_count}</td>
                          <td style={{ ...td, color: T.accentLight, fontSize:10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין פרויקטים בטווח זה</p>
              )}
              {detailTab === 'tasks' && (
                detail.tasks.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr><th style={th}>משימה</th><th style={th}>פרויקט</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.tasks.map((t,i) => (
                        <tr key={i} style={{ cursor:'pointer', transition:'background 0.12s' }}
                          onMouseEnter={drillHover} onMouseLeave={drillLeave}
                          onClick={() => handleDrillDown({ userId:row.id, taskId:t.id }, `${row.full_name} ← ${t.task_name}`)}>
                          <td style={td}>{t.task_name}</td>
                          <td style={{ ...td, color: T.textSub }}>{t.project_name}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(t.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{t.entry_count}</td>
                          <td style={{ ...td, color: T.accentLight, fontSize:10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין משימות בטווח זה</p>
              )}
              {detailTab === 'daily' && (
                detail.daily.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr><th style={th}>תאריך</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.daily.map((d,i) => (
                        <tr key={i} style={{ cursor:'pointer', transition:'background 0.12s' }}
                          onMouseEnter={drillHover} onMouseLeave={drillLeave}
                          onClick={() => handleDrillDown({ userId:row.id, dateFrom:d.date, dateTo:d.date }, `${row.full_name} ← ${d.date}`)}>
                          <td style={td}>{d.date}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(d.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{d.entry_count}</td>
                          <td style={{ ...td, color: T.accentLight, fontSize:10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין נתונים יומיים</p>
              )}
            </div>
          )}

          {!drillDown && detail && rType === 'byProject' && (
            <div style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                {[['employees','עובדים'],['tasks','משימות']].map(([k,l]) => (
                  <button key={k} style={detailTabBtn(detailTab===k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'employees' && (
                detail.employees.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr><th style={th}>עובד</th><th style={th}>צוות</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.employees.map((e,i) => (
                        <tr key={i} style={{ cursor:'pointer', transition:'background 0.12s' }}
                          onMouseEnter={drillHover} onMouseLeave={drillLeave}
                          onClick={() => handleDrillDown({ projectId:row.id, userId:e.id }, `${row.project_name} ← ${e.full_name}`)}>
                          <td style={td}>{e.full_name}</td>
                          <td style={{ ...td, color: T.textSub }}>{e.team||'—'}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(e.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{e.entry_count}</td>
                          <td style={{ ...td, color: T.accentLight, fontSize:10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין עובדים בטווח זה</p>
              )}
              {detailTab === 'tasks' && (
                detail.tasks.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr><th style={th}>משימה</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.tasks.map((t,i) => (
                        <tr key={i} style={{ cursor:'pointer', transition:'background 0.12s' }}
                          onMouseEnter={drillHover} onMouseLeave={drillLeave}
                          onClick={() => handleDrillDown({ projectId:row.id, taskId:t.id }, `${row.project_name} ← ${t.task_name}`)}>
                          <td style={td}>{t.task_name}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(t.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{t.entry_count}</td>
                          <td style={{ ...td, color: T.accentLight, fontSize:10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין משימות בטווח זה</p>
              )}
            </div>
          )}

          {!drillDown && detail && rType === 'byTask' && (
            <div style={{ padding:'12px 16px' }}>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                {[['employees','עובדים'],['dates','תאריכי עבודה']].map(([k,l]) => (
                  <button key={k} style={detailTabBtn(detailTab===k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'employees' && (
                detail.employees.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr><th style={th}>עובד</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.employees.map((e,i) => (
                        <tr key={i} style={{ cursor:'pointer', transition:'background 0.12s' }}
                          onMouseEnter={drillHover} onMouseLeave={drillLeave}
                          onClick={() => handleDrillDown({ taskId:row.id, userId:e.id }, `${row.task_name} ← ${e.full_name}`)}>
                          <td style={td}>{e.full_name}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(e.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{e.entry_count}</td>
                          <td style={{ ...td, color: T.accentLight, fontSize:10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין עובדים בטווח זה</p>
              )}
              {detailTab === 'dates' && (
                detail.dates.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead><tr><th style={th}>תאריך</th><th style={th}>עובד</th><th style={th}>שעות</th></tr></thead>
                      <tbody>{detail.dates.map((d,i) => (
                        <tr key={i}>
                          <td style={td}>{d.date}</td>
                          <td style={{ ...td, color: T.textSub }}>{d.full_name}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmt(d.duration_minutes)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12, margin:0 }}>אין תאריכים בטווח זה</p>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  };

  // ── Tabs config ───────────────────────────────────────────────
  const tabs = [
    { key:'approvals', label:'אישורים',   icon:<IcCheck s={13}/> },
    { key:'reports',   label:'דוחות',     icon:<IcChart s={13}/> },
    { key:'estimate',  label:'Estimate',  icon:<IcTarget s={13}/> },
    { key:'export',    label:'ייצוא',     icon:<IcDownload s={13}/> },
    { key:'commits',   label:'Git',       icon:<IcGit s={13}/> },
    { key:'reminders', label:'תזכורות',   icon:<IcBell s={13}/> },
    ...(isAdmin ? [
      { key:'payroll',  label:'שכר',        icon:<IcDollar s={13}/> },
      { key:'slack',    label:'Slack',       icon:<IcSlack s={13}/> },
      { key:'apikeys',  label:'API Keys',    icon:<IcKey s={13}/> },
      { key:'users',    label:'משתמשים',    icon:<IcUsers s={13}/> },
    ] : []),
  ];

  return (
    <div dir="rtl" style={{ fontFamily:'inherit' }}>

      {/* Page header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${T.primary}, ${T.accent})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 4px 12px ${T.primary}40` }}>
            <IcManage s={18}/>
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, margin:0, color: T.text, letterSpacing:'-0.5px' }}>ניהול</h2>
        </div>
        <p style={{ margin:'0 0 0 46px', fontSize:12, color: T.textFaint, fontWeight:500 }}>
          אישור דיווחים, דוחות, ייצוא ועוד
        </p>
      </div>

      <TabBar tabs={tabs} active={mainTab} onChange={setMainTab} />

      {/* ── Approvals ── */}
      {mainTab === 'approvals' && (
        <Card>
          <SectionLabel icon={<IcCheck s={14}/>}>אישור דיווחי שעות</SectionLabel>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', padding:'10px 12px', background: T.surfaceAlt, borderRadius: T.radius }}>
            <select value={f.userId} onChange={e => setF(p => ({...p, userId:e.target.value}))} style={sel}>
              <option value="">כל העובדים</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <select value={f.projectId} onChange={e => setF(p => ({...p, projectId:e.target.value}))} style={sel}>
              <option value="">כל הפרויקטים</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
            <select value={f.status} onChange={e => setF(p => ({...p, status:e.target.value}))} style={sel}>
              <option value="">כל הסטטוסים</option>
              <option value="submitted">ממתינים</option>
              <option value="approved">אושרו</option>
              <option value="rejected">נדחו</option>
            </select>
            <input type="date" value={f.dateFrom} onChange={e => setF(p => ({...p, dateFrom:e.target.value}))} style={sel} />
            <span style={{ fontSize:12, color: T.textFaint, alignSelf:'center' }}>עד</span>
            <input type="date" value={f.dateTo}   onChange={e => setF(p => ({...p, dateTo:e.target.value}))}   style={sel} />
            {(f.userId||f.projectId||f.status||f.dateFrom||f.dateTo) && (
              <button onClick={() => setF({ status:'', dateFrom:'', dateTo:'', userId:'', projectId:'' })}
                style={{ padding:'6px 12px', borderRadius: T.radiusSm, border:`1px solid ${T.border}`, background: T.surface, fontSize:12, cursor:'pointer', color: T.textSub, fontFamily:'inherit' }}>
                נקה
              </button>
            )}
          </div>

          {loading && <Spinner />}
          {!loading && !entries.length && <EmptyState text="אין דיווחים התואמים לפילטר" />}
          {entries.map(e => (
            <div key={e.id} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, padding:'12px 0', borderBottom:`1px solid ${T.borderLight}`, fontSize:12 }}>
              <span style={{ color: T.textFaint, whiteSpace:'nowrap', fontSize:11, fontWeight:500 }}>{e.date}</span>
              <div style={{ flex:'1 1 120px', minWidth:0 }}>
                <div style={{ fontWeight:600, color: T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.user_name}</div>
                <div style={{ color: T.textSub, fontSize:11 }}>{e.project_name}</div>
              </div>
              <span style={{ fontWeight:700, color: T.primary, whiteSpace:'nowrap', fontFamily:'monospace' }}>{fmt(e.duration_minutes)}</span>
              <Badge status={e.status} resubmitted={!!e.rejection_reason} />
              {e.status === 'submitted' && (
                <div style={{ display:'flex', gap:5, flexBasis: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                  <button onClick={() => approve(e.id).catch(err => addToast(err.message,'error'))}
                    style={{ padding:'4px 12px', borderRadius: T.radiusSm, background: T.successBg, color: T.success, border:'none', fontSize:11, cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:'inherit' }}>
                    <IcCheck s={11}/> אשר
                  </button>
                  <button onClick={() => handleReject(e.id)}
                    style={{ padding:'4px 12px', borderRadius: T.radiusSm, background: T.errorBg, color: T.error, border:'none', fontSize:11, cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:4, fontFamily:'inherit' }}>
                    <IcX s={11}/> דחה
                  </button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* ── Reports ── */}
      {mainTab === 'reports' && (
        <Card>
          <SectionLabel icon={<IcChart s={14}/>}>דוחות שעות</SectionLabel>

          {/* Report type */}
          <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
            {[['byUser','לפי עובד'],['byProject','לפי פרויקט'],['byTask','לפי משימה'],['anomalies','חריגות']].map(([k,l]) => (
              <button key={k} onClick={() => setRType(k)} style={{
                padding:'6px 14px', borderRadius: T.radiusSm, fontFamily:'inherit',
                border: rType===k ? 'none' : `1px solid ${T.border}`,
                background: rType===k ? T.primary : T.surface,
                color: rType===k ? '#fff' : T.textSub,
                fontSize:12, cursor:'pointer', fontWeight: rType===k ? 700 : 400,
              }}>{l}</button>
            ))}
          </div>

          {/* Date filter */}
          {rType !== 'anomalies' && (
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap', padding:'10px 12px', background: T.surfaceAlt, borderRadius: T.radius }}>
              <span style={{ fontSize:12, color: T.textSub, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}><IcFilter s={12}/> טווח:</span>
              {['today','week','month','custom'].map((p,i) => (
                <button key={p} style={presetBtn(p)} onClick={() => applyPreset(p)}>
                  {['היום','שבוע זה','חודש זה','מותאם'][i]}
                </button>
              ))}
              {(rPreset==='custom'||(!rPreset&&(rFrom||rTo))) && (
                <>
                  <input type="date" value={rFrom} onChange={e => { setRFrom(e.target.value); setRPreset('custom'); }} style={sel} />
                  <span style={{ fontSize:12, color: T.textFaint }}>עד</span>
                  <input type="date" value={rTo}   onChange={e => { setRTo(e.target.value);   setRPreset('custom'); }} style={sel} />
                </>
              )}
              {(rFrom||rTo) && (
                <button onClick={() => { setRFrom(''); setRTo(''); setRPreset(''); }}
                  style={{ padding:'5px 10px', borderRadius: T.radiusSm, border:`1px solid ${T.border}`, background: T.surface, fontSize:11, color: T.textSub, cursor:'pointer', fontFamily:'inherit' }}>
                  נקה
                </button>
              )}
            </div>
          )}

          {rLoading && <Spinner />}

          {/* byUser */}
          {!rLoading && Array.isArray(data) && rType === 'byUser' && (
            <div>
              <p style={{ fontSize:11, color: T.textFaint, marginBottom:8 }}>לחץ על שורה לפירוט</p>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse', minWidth:420 }}>
                  <thead><tr>{['עובד','צוות','שעות','דיווחים','פרויקטים','משימות'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.map(r => (
                      <Fragment key={r.id}>
                        <tr style={clickableRow(expandId===r.id)}
                          onClick={() => handleRowClick(r.id)}
                          onMouseEnter={e => { if (expandId!==r.id) e.currentTarget.style.background=T.surfaceAlt; }}
                          onMouseLeave={e => { if (expandId!==r.id) e.currentTarget.style.background='transparent'; }}>
                          <td style={td}>
                            <span style={{ fontWeight:600, color: T.text }}>{r.full_name}</span>
                            <span style={{ marginRight:6, color: T.textFaint }}><IcChevron s={11} up={expandId===r.id}/></span>
                          </td>
                          <td style={{ ...td, color: T.textSub }}>{r.team||'—'}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(r.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{r.entry_count}</td>
                          <td style={{ ...td, color: T.textSub }}>{r.project_count}</td>
                          <td style={{ ...td, color: T.textSub }}>{r.task_count}</td>
                        </tr>
                        {renderDetailPanel(r)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.length && <EmptyState text="אין נתונים" />}
            </div>
          )}

          {/* byProject */}
          {!rLoading && Array.isArray(data) && rType === 'byProject' && (
            <div>
              <p style={{ fontSize:11, color: T.textFaint, marginBottom:8 }}>לחץ על שורה לפירוט</p>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse', minWidth:360 }}>
                  <thead><tr>{['פרויקט','שעות','עובדים','משימות','דיווחים'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.map(r => (
                      <Fragment key={r.id}>
                        <tr style={clickableRow(expandId===r.id)}
                          onClick={() => handleRowClick(r.id)}
                          onMouseEnter={e => { if (expandId!==r.id) e.currentTarget.style.background=T.surfaceAlt; }}
                          onMouseLeave={e => { if (expandId!==r.id) e.currentTarget.style.background='transparent'; }}>
                          <td style={td}>
                            <span style={{ fontWeight:600, color: T.text }}>{r.project_name}</span>
                            <span style={{ marginRight:6, color: T.textFaint }}><IcChevron s={11} up={expandId===r.id}/></span>
                          </td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(r.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{r.user_count}</td>
                          <td style={{ ...td, color: T.textSub }}>{r.task_count}</td>
                          <td style={{ ...td, color: T.textSub }}>{r.entry_count}</td>
                        </tr>
                        {renderDetailPanel(r)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.length && <EmptyState text="אין נתונים" />}
            </div>
          )}

          {/* byTask */}
          {!rLoading && Array.isArray(data) && rType === 'byTask' && (
            <div>
              <p style={{ fontSize:11, color: T.textFaint, marginBottom:8 }}>לחץ על שורה לפירוט</p>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse', minWidth:380 }}>
                  <thead><tr>{['משימה','פרויקט','שעות','עובדים','פעילות אחרונה'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.map(r => (
                      <Fragment key={r.id}>
                        <tr style={clickableRow(expandId===r.id)}
                          onClick={() => handleRowClick(r.id)}
                          onMouseEnter={e => { if (expandId!==r.id) e.currentTarget.style.background=T.surfaceAlt; }}
                          onMouseLeave={e => { if (expandId!==r.id) e.currentTarget.style.background='transparent'; }}>
                          <td style={td}>
                            <span style={{ fontWeight:600, color: T.text }}>{r.task_name}</span>
                            <span style={{ marginRight:6, color: T.textFaint }}><IcChevron s={11} up={expandId===r.id}/></span>
                          </td>
                          <td style={{ ...td, color: T.textSub }}>{r.project_name}</td>
                          <td style={{ ...td, color: T.primary, fontWeight:700 }}>{fmtH(r.total_hours)}</td>
                          <td style={{ ...td, color: T.textSub }}>{r.user_count}</td>
                          <td style={{ ...td, color: T.textFaint }}>{r.last_activity||'—'}</td>
                        </tr>
                        {renderDetailPanel(r)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.length && <EmptyState text="אין נתונים" />}
            </div>
          )}

          {/* anomalies */}
          {!rLoading && data && rType === 'anomalies' && !Array.isArray(data) && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div>
                <SectionLabel icon={<IcWarn s={14}/>}><span style={{ color: T.error }}>דיווחים ארוכים (מעל 10 שעות)</span></SectionLabel>
                {data.longEntries?.length ? (
                  <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                    <thead><tr>{['תאריך','עובד','פרויקט','שעות'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{data.longEntries.map(e => (
                      <tr key={e.id}>
                        <td style={td}>{e.date}</td>
                        <td style={{ ...td, fontWeight:600 }}>{e.full_name}</td>
                        <td style={{ ...td, color: T.textSub }}>{e.project_name}</td>
                        <td style={{ ...td, color: T.error, fontWeight:700 }}>{fmt(e.duration_minutes)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: T.textFaint, fontSize:12 }}>אין חריגות</p>}
              </div>
              <div>
                <SectionLabel icon={<IcWarn s={14}/>}><span style={{ color: T.warning }}>עובדים לא פעילים (7+ ימים)</span></SectionLabel>
                {data.missingActivity?.length ? (
                  <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                    <thead><tr>{['עובד','צוות','דיווח אחרון'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{data.missingActivity.map(u => (
                      <tr key={u.id}>
                        <td style={{ ...td, fontWeight:600 }}>{u.full_name}</td>
                        <td style={{ ...td, color: T.textSub }}>{u.team||'—'}</td>
                        <td style={{ ...td, color: T.warning, fontWeight:600 }}>{u.last_entry_date||'מעולם לא'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: T.textFaint, fontSize:12 }}>כל העובדים פעילים</p>}
              </div>
              <div>
                <SectionLabel icon={<IcWarn s={14}/>}><span style={{ color: T.accent }}>דיווחים חופפים בזמן</span></SectionLabel>
                {data.overlappingEntries?.length ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse', minWidth:500 }}>
                      <thead><tr>{["עובד","תאריך","דיווח א'","דיווח ב'","פרויקט א'","פרויקט ב'"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>{data.overlappingEntries.map(e => (
                        <tr key={`${e.entry_a_id}-${e.entry_b_id}`}>
                          <td style={{ ...td, fontWeight:600 }}>{e.full_name}</td>
                          <td style={td}>{e.date}</td>
                          <td style={{ ...td, color: T.accent, fontFamily:'monospace' }}>{e.start_time?.slice(0,5)}–{e.end_time?.slice(0,5)}</td>
                          <td style={{ ...td, color: T.accent, fontFamily:'monospace' }}>{e.b_start_time?.slice(0,5)}–{e.b_end_time?.slice(0,5)}</td>
                          <td style={{ ...td, color: T.textSub }}>{e.project_a}</td>
                          <td style={{ ...td, color: T.textSub }}>{e.project_b}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: T.textFaint, fontSize:12 }}>אין חפיפות בזמן</p>}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Git commits ── */}
      {mainTab === 'commits' && (
        <Card>
          <SectionLabel icon={<IcGit s={14}/>}>Commits מקושרים לדיווחי שעות</SectionLabel>
          {cLoad && <Spinner />}
          {!cLoad && !commits.length && <EmptyState text="אין commits עדיין — הוסף commit בדף האינטגרציות" />}
          {commits.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:`1px solid ${T.borderLight}`, fontSize:12 }}>
              <code style={{ background: T.primaryMid, padding:'3px 8px', borderRadius:5, fontSize:10, flexShrink:0, fontFamily:'monospace', color: T.primary, fontWeight:700 }}>
                {c.commit_hash?.slice(0,7)}
              </code>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color: T.text, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.commit_message}</div>
                <div style={{ color: T.textFaint, fontSize:11, marginTop:2 }}>{c.repository} · {c.branch}</div>
              </div>
              <span style={{ color: T.textSub, whiteSpace:'nowrap' }}>{c.full_name||'—'}</span>
              <span style={{ color: T.textFaint, whiteSpace:'nowrap' }}>{c.commit_date?.slice(0,10)}</span>
            </div>
          ))}
        </Card>
      )}

      {/* ── Estimate vs Actual ── */}
      {mainTab === 'estimate' && (
        <Card>
          <SectionLabel icon={<IcTarget s={14}/>}>Estimate vs Actual לפי משימה</SectionLabel>
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <input type="date" value={evaFrom} onChange={e => setEvaFrom(e.target.value)} style={sel} />
            <span style={{ fontSize:12, color: T.textFaint }}>עד</span>
            <input type="date" value={evaTo}   onChange={e => setEvaTo(e.target.value)}   style={sel} />
            {(evaFrom||evaTo) && (
              <button onClick={() => { setEvaFrom(''); setEvaTo(''); }}
                style={{ padding:'6px 12px', borderRadius: T.radiusSm, border:`1px solid ${T.border}`, background: T.surface, fontSize:12, cursor:'pointer', color: T.textSub, fontFamily:'inherit' }}>
                נקה
              </button>
            )}
          </div>
          {evaLoading && <Spinner />}
          {!evaLoading && evaData.length === 0 && <EmptyState text="אין משימות עם הערכת שעות" />}
          {!evaLoading && evaData.length > 0 && (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:500 }}>
                <thead>
                  <tr>{["משימה","פרויקט","הערכה (ש')","בפועל (ש')","סטייה (ש')","סטייה %","מצב"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {evaData.map((r,i) => {
                    const over  = r.variance_hours > 0;
                    const under = r.variance_hours < 0;
                    const color = over ? T.error : under ? T.success : T.textSub;
                    const bg    = over ? T.errorBg : under ? T.successBg : 'transparent';
                    const label = over ? 'חריגה' : under ? 'בתקציב' : 'מדויק';
                    return (
                      <tr key={i} style={{ background: bg }}>
                        <td style={{ ...td, fontWeight:600 }}>{r.task_name}</td>
                        <td style={{ ...td, color: T.textSub }}>{r.project_name}</td>
                        <td style={{ ...td, color: T.primary, fontWeight:700 }}>{r.estimated_hours}</td>
                        <td style={{ ...td, fontWeight:700 }}>{r.actual_hours}</td>
                        <td style={{ ...td, color, fontWeight:700 }}>{r.variance_hours > 0 ? '+' : ''}{r.variance_hours}</td>
                        <td style={{ ...td, color }}>{r.variance_pct != null ? (r.variance_pct>0?'+':'')+r.variance_pct+'%' : '—'}</td>
                        <td style={{ ...td, color, fontWeight:600 }}>{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize:11, color: T.textFaint, marginTop:8 }}>
                {evaData.filter(r => r.variance_hours>0).length} חרגו · {evaData.filter(r => r.variance_hours<=0).length} בתקציב
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Export ── */}
      {mainTab === 'export' && (
        <Card>
          <SectionLabel icon={<IcDownload s={14}/>}>ייצוא נתונים ל-CSV</SectionLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { key:'te',        title:'ייצוא דיווחי שעות',  desc:'כל הדיווחים לפי פילטר תאריכים', fn:(f,t) => exportApi.timeEntries({ dateFrom:f, dateTo:t }) },
              { key:'byUser',    title:'דוח לפי עובד',        desc:'סיכום שעות לכל עובד',           fn:(f,t) => exportApi.reportByUser({ dateFrom:f, dateTo:t }) },
              { key:'byProject', title:'דוח לפי פרויקט',      desc:'סיכום שעות לכל פרויקט',         fn:(f,t) => exportApi.reportByProject({ dateFrom:f, dateTo:t }) },
            ].map(({ key, title, desc, fn }) => (
              <div key={key} style={{ padding:'14px 16px', border:`1px solid ${T.border}`, borderRadius: T.radiusLg, display:'flex', flexWrap:'wrap', gap:10, alignItems:'center' }}>
                <div style={{ flex:'2 1 180px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color: T.text }}>{title}</div>
                  <div style={{ fontSize:11, color: T.textFaint, marginTop:2 }}>{desc}</div>
                </div>
                <input type="date" value={expState[key].from} onChange={e => setExp(key,{from:e.target.value})} style={{ ...sel, flex:'1 1 120px' }} />
                <input type="date" value={expState[key].to}   onChange={e => setExp(key,{to:e.target.value})}   style={{ ...sel, flex:'1 1 120px' }} />
                <button disabled={expState[key].busy} onClick={() => runExport(key, fn)}
                  style={{ padding:'8px 18px', borderRadius: T.radius, background: T.primary, color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer', opacity:expState[key].busy?0.7:1, whiteSpace:'nowrap', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                  <IcDownload s={13}/> {expState[key].busy ? '...' : 'הורד CSV'}
                </button>
              </div>
            ))}
            {isAdmin && (
              <div style={{ padding:'14px 16px', border:`1px solid ${T.successBorder}`, borderRadius: T.radiusLg, display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', background: T.successBg }}>
                <div style={{ flex:'2 1 180px' }}>
                  <div style={{ fontSize:13, fontWeight:700, color: T.text }}>ייצוא שכר (Payroll)</div>
                  <div style={{ fontSize:11, color: T.textFaint, marginTop:2 }}>שעות אושרו × שכר לשעה לכל עובד</div>
                </div>
                <button onClick={() => exportApi.payroll({}).catch(err => addToast(err.message,'error'))}
                  style={{ padding:'8px 18px', borderRadius: T.radius, background: T.success, color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                  <IcDownload s={13}/> ייצוא שכר
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Reminders ── */}
      {mainTab === 'reminders' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
              <SectionLabel icon={<IcBell s={14}/>}>
                עובדים שטרם דיווחו היום ({missingUsers.length})
              </SectionLabel>
              <button
                disabled={reminderTriggering || missingUsers.length === 0}
                onClick={async () => {
                  setRTrig(true);
                  try {
                    const r = await remindersApi.trigger();
                    addToast(`תזכורת נשלחה ל-${r.sent} עובדים`, 'success');
                    remindersApi.missingToday().then(setMissingUsers).catch(() => {});
                  } catch (err) { addToast(err.message,'error'); }
                  finally { setRTrig(false); }
                }}
                style={{ padding:'7px 16px', borderRadius: T.radius, fontFamily:'inherit',
                  background: missingUsers.length ? T.warning : T.surfaceAlt,
                  color: missingUsers.length ? '#fff' : T.textFaint,
                  border:'none', fontSize:12, fontWeight:600,
                  cursor: missingUsers.length ? 'pointer' : 'default',
                  opacity: reminderTriggering ? 0.7 : 1,
                  display:'flex', alignItems:'center', gap:6,
                }}>
                <IcBell s={13}/> {reminderTriggering ? '...' : 'שלח תזכורות'}
              </button>
            </div>
            {missingUsers.length === 0
              ? <div style={{ display:'flex', alignItems:'center', gap:6, color: T.success, fontSize:12, fontWeight:600 }}><IcCheck s={14}/> כל העובדים דיווחו שעות היום</div>
              : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {missingUsers.map(u => (
                    <div key={u.id} style={{ padding:'4px 12px', borderRadius:20, background: T.warningBg, border:`1px solid ${T.warningBorder}`, fontSize:12, color: T.warning, fontWeight:600 }}>
                      {u.full_name}{u.team && <span style={{ opacity:0.7 }}> · {u.team}</span>}
                    </div>
                  ))}
                </div>
              )}
          </Card>

          {isAdmin && (
            <Card>
              <SectionLabel icon={<IcSettings s={14}/>}>הגדרות תזכורות אוטומטיות</SectionLabel>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEn(e.target.checked)} style={{ width:16, height:16 }} />
                  <span style={{ fontSize:13, color: T.text }}>הפעל תזכורות יומיות אוטומטיות</span>
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <label style={{ fontSize:12, color: T.textSub, minWidth:80 }}>שעת שליחה:</label>
                  <input type="number" min="0" max="23" value={reminderHour} onChange={e => setReminderHour(+e.target.value)}
                    style={{ ...sel, width:70 }} />
                  <span style={{ fontSize:12, color: T.textFaint }}>:00</span>
                </div>
                <button disabled={reminderSaving}
                  onClick={async () => {
                    setReminderSave(true);
                    try { await remindersApi.saveConfig({ enabled:reminderEnabled, hour:reminderHour }); addToast('הגדרות נשמרו','success'); }
                    catch (err) { addToast(err.message,'error'); }
                    finally { setReminderSave(false); }
                  }}
                  style={{ alignSelf:'flex-start', padding:'8px 22px', borderRadius: T.radius, background: T.primary, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', opacity:reminderSaving?0.7:1, fontFamily:'inherit' }}>
                  {reminderSaving ? 'שומר...' : 'שמור הגדרות'}
                </button>
                <p style={{ fontSize:11, color: T.textFaint, margin:0 }}>
                  עובדים שלא דיווחו עד השעה שנבחרה יקבלו התראה במערכת ובSlack (אם מוגדר).
                </p>
              </div>
            </Card>
          )}

          {isAdmin && (
            <Card>
              <SectionLabel icon={<IcSettings s={14}/>}>מדיניות דיווח רטרואקטיבי</SectionLabel>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={retroAllowed} onChange={e => setRetroAllowed(e.target.checked)} style={{ width:16, height:16 }} />
                  <span style={{ fontSize:13, color: T.text }}>אפשר לעובדים לדווח על תאריכים עבר</span>
                </label>
                {retroAllowed && (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <label style={{ fontSize:12, color: T.textSub, minWidth:120 }}>מקסימום ימים אחורה:</label>
                    <input type="number" min="1" max="365" value={retroMaxDays} onChange={e => setRetroMaxDays(+e.target.value)} style={{ ...sel, width:80 }} />
                    <span style={{ fontSize:12, color: T.textFaint }}>ימים</span>
                  </div>
                )}
                <button disabled={retroSaving}
                  onClick={async () => {
                    setRetroSaving(true);
                    try { await remindersApi.saveRetroConfig({ allowed:retroAllowed, maxDays:retroMaxDays }); addToast('מדיניות נשמרה','success'); }
                    catch (err) { addToast(err.message,'error'); }
                    finally { setRetroSaving(false); }
                  }}
                  style={{ alignSelf:'flex-start', padding:'8px 22px', borderRadius: T.radius, background: T.primary, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', opacity:retroSaving?0.7:1, fontFamily:'inherit' }}>
                  {retroSaving ? 'שומר...' : 'שמור מדיניות'}
                </button>
                <p style={{ fontSize:11, color: T.textFaint, margin:0 }}>
                  {retroAllowed ? `עובדים יכולים לדווח עד ${retroMaxDays} ימים אחורה.` : 'עובדים יכולים לדווח רק על תאריך היום.'}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Payroll ── */}
      {mainTab === 'payroll' && isAdmin && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <SectionLabel icon={<IcDollar s={14}/>}>חישוב שכר — שעות אושרו בלבד</SectionLabel>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input type="date" value={payrollFrom} onChange={e => setPayrollFrom(e.target.value)} style={sel} />
              <span style={{ fontSize:12, color: T.textFaint }}>עד</span>
              <input type="date" value={payrollTo}   onChange={e => setPayrollTo(e.target.value)}   style={sel} />
              <button onClick={() => exportApi.payroll({ dateFrom:payrollFrom, dateTo:payrollTo }).catch(err => addToast(err.message,'error'))}
                style={{ padding:'7px 14px', borderRadius: T.radius, background: T.success, color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                <IcDownload s={13}/> ייצוא CSV
              </button>
            </div>
          </div>
          {payrollLoad && <Spinner />}
          {!payrollLoad && payrollData.length === 0 && <EmptyState text="אין נתוני שכר" />}
          {!payrollLoad && payrollData.length > 0 && (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:500 }}>
                <thead>
                  <tr>{["עובד","צוות","שכר/שעה (₪)","שעות אושרו","שכר לתשלום (₪)",""].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {payrollData.map(u => (
                    <tr key={u.id}>
                      <td style={{ ...td, fontWeight:600 }}>{u.full_name}</td>
                      <td style={{ ...td, color: T.textSub }}>{u.team||'—'}</td>
                      <td style={td}>
                        <input type="number" min="0" step="0.5"
                          value={rateEdits[u.id] ?? u.hourly_rate}
                          onChange={e => setRateEdits(p => ({ ...p, [u.id]: e.target.value }))}
                          style={{ width:80, padding:'4px 6px', border:`1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize:12, fontFamily:'inherit' }} />
                      </td>
                      <td style={{ ...td, color: T.primary, fontWeight:700 }}>{u.total_hours}</td>
                      <td style={{ ...td, color: T.success, fontWeight:700, fontSize:13 }}>
                        ₪{((rateEdits[u.id] ?? u.hourly_rate) * u.total_hours).toFixed(2)}
                      </td>
                      <td style={td}>
                        {String(rateEdits[u.id]) !== String(u.hourly_rate) && (
                          <button disabled={rateSaving===u.id}
                            onClick={async () => {
                              setRateSaving(u.id);
                              try { await payrollApi.updateRate(u.id, rateEdits[u.id]); addToast('שכר עודכן','success'); loadPayroll(); }
                              catch (err) { addToast(err.message,'error'); }
                              finally { setRateSaving(null); }
                            }}
                            style={{ padding:'4px 12px', borderRadius: T.radiusSm, background: T.primary, color:'#fff', border:'none', fontSize:11, cursor:'pointer', opacity:rateSaving===u.id?0.7:1, fontFamily:'inherit' }}>
                            {rateSaving===u.id ? '...' : 'שמור'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: T.surfaceAlt, borderTop:`2px solid ${T.border}` }}>
                    <td colSpan={3} style={{ ...td, fontWeight:700 }}>סה״כ</td>
                    <td style={{ ...td, color: T.primary, fontWeight:700 }}>{payrollData.reduce((s,u) => s + +u.total_hours, 0).toFixed(2)}</td>
                    <td style={{ ...td, color: T.success, fontWeight:700, fontSize:13 }}>
                      ₪{payrollData.reduce((s,u) => s + ((rateEdits[u.id]??u.hourly_rate)*u.total_hours), 0).toFixed(2)}
                    </td>
                    <td style={td}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Slack ── */}
      {mainTab === 'slack' && isAdmin && (
        <Card>
          <SectionLabel icon={<IcSlack s={14}/>}>הגדרות Slack Webhook</SectionLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={lbl}>Webhook URL</label>
              <input type="url" value={slackUrl} onChange={e => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..." style={inp} />
              {slackConfig.configured && (
                <div style={{ fontSize:11, color: T.textFaint, marginTop:4 }}>מוגדר: {slackConfig.webhook_masked}</div>
              )}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <input type="checkbox" checked={slackEnabled} onChange={e => setSlackEnabled(e.target.checked)} style={{ width:16, height:16 }} />
              <span style={{ fontSize:13, color: T.text }}>הפעל Slack (שלח הודעות על אישור/דחיה ותזכורות)</span>
            </label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button disabled={slackSaving}
                onClick={async () => {
                  setSlackSaving(true);
                  try { await slackApi.saveConfig(slackUrl||undefined, slackEnabled); addToast('הגדרות Slack נשמרו','success'); slackApi.getConfig().then(setSlackConfig).catch(()=>{}); setSlackUrl(''); }
                  catch (err) { addToast(err.message,'error'); }
                  finally { setSlackSaving(false); }
                }}
                style={{ padding:'8px 22px', borderRadius: T.radius, background: T.primary, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', opacity:slackSaving?0.7:1, fontFamily:'inherit' }}>
                {slackSaving ? 'שומר...' : 'שמור'}
              </button>
              {slackConfig.configured && (
                <button disabled={slackTesting}
                  onClick={async () => {
                    setSlackTesting(true);
                    try { await slackApi.test(); addToast('הודעת בדיקה נשלחה ל-Slack!','success'); }
                    catch (err) { addToast(err.message,'error'); }
                    finally { setSlackTesting(false); }
                  }}
                  style={{ padding:'8px 22px', borderRadius: T.radius, background: T.surface, color: T.primary, border:`1px solid ${T.primaryBorder}`, fontSize:13, fontWeight:600, cursor:'pointer', opacity:slackTesting?0.7:1, fontFamily:'inherit' }}>
                  {slackTesting ? '...' : 'בדוק חיבור'}
                </button>
              )}
            </div>
            <div style={{ padding:'12px 14px', background: T.surfaceAlt, borderRadius: T.radius, fontSize:11, color: T.textSub }}>
              <div style={{ fontWeight:700, marginBottom:6, color: T.textMid }}>המערכת תשלח הודעות על:</div>
              <ul style={{ margin:0, paddingRight:18, lineHeight:2 }}>
                <li>דיווחים שאושרו / נדחו</li>
                <li>תזכורות שעות לעובדים</li>
                <li>עובדים חסרי דיווח (דוח יומי)</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* ── API Keys ── */}
      {mainTab === 'apikeys' && isAdmin && (
        <Card>
          <SectionLabel icon={<IcKey s={14}/>}>מפתחות API חיצוניים</SectionLabel>
          <p style={{ fontSize:11, color: T.textFaint, marginBottom:14 }}>
            מאפשרים למערכות חיצוניות לגשת לנתוני TimeIn עם header: <code style={{ background: T.surfaceAlt, padding:'1px 5px', borderRadius:4 }}>x-api-key: &lt;key&gt;</code>
          </p>

          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              placeholder="שם מפתח (לדוג׳: Payroll System)"
              style={{ ...inp, flex:'1 1 200px', width:'auto' }} />
            <button disabled={keyCreating||!newKeyName}
              onClick={async () => {
                setKeyCreating(true);
                try { const result = await apiKeysApi.create(newKeyName); setNewKeyValue(result.key); setNewKeyName(''); loadApiKeys(); }
                catch (err) { addToast(err.message,'error'); }
                finally { setKeyCreating(false); }
              }}
              style={{ padding:'8px 18px', borderRadius: T.radius, background: T.primary, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:newKeyName?'pointer':'default', opacity:(!newKeyName||keyCreating)?0.6:1, fontFamily:'inherit' }}>
              {keyCreating ? '...' : '+ צור מפתח'}
            </button>
          </div>

          {newKeyValue && (
            <div style={{ padding:'12px 14px', background: T.successBg, border:`1px solid ${T.successBorder}`, borderRadius: T.radius, marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color: T.success, marginBottom:6 }}>שמור את המפתח — לא יוצג שוב!</div>
              <code style={{ fontSize:11, color: T.success, wordBreak:'break-all' }}>{newKeyValue}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKeyValue); addToast('הועתק!','success'); }}
                style={{ display:'block', marginTop:8, padding:'4px 14px', borderRadius: T.radiusSm, background: T.success, color:'#fff', border:'none', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                העתק
              </button>
            </div>
          )}

          {apiKeysLoad && <Spinner />}
          {!apiKeysLoad && apiKeys.map(k => (
            <div key={k.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', borderBottom:`1px solid ${T.borderLight}`, opacity:k.is_active?1:0.5, flexWrap:'wrap' }}>
              <code style={{ background: T.primaryMid, padding:'3px 8px', borderRadius:5, fontSize:10, color: T.primary, flexShrink:0, fontFamily:'monospace', fontWeight:700 }}>{k.key_prefix}...</code>
              <div style={{ flex:'1 1 120px', minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color: T.text }}>{k.name}</div>
                <div style={{ fontSize:11, color: T.textFaint }}>
                  {k.owner_name && `${k.owner_name} · `}
                  {k.last_used ? `שימוש אחרון: ${k.last_used.slice(0,10)}` : 'טרם נוצל'}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={async () => { try { await apiKeysApi.toggle(k.id, !k.is_active); loadApiKeys(); } catch (err) { addToast(err.message,'error'); } }}
                  style={{ padding:'4px 10px', borderRadius: T.radiusSm, border:`1px solid ${T.border}`, background: T.surface, fontSize:11, cursor:'pointer', color: k.is_active ? T.error : T.success, fontWeight:600, fontFamily:'inherit' }}>
                  {k.is_active ? 'השבת' : 'הפעל'}
                </button>
                <button onClick={async () => { if (!window.confirm('למחוק מפתח?')) return; try { await apiKeysApi.remove(k.id); loadApiKeys(); } catch (err) { addToast(err.message,'error'); } }}
                  style={{ padding:'4px 10px', borderRadius: T.radiusSm, border:'none', background: T.errorBg, color: T.error, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                  <IcX s={12}/>
                </button>
              </div>
            </div>
          ))}
          {!apiKeysLoad && apiKeys.length === 0 && <EmptyState text="אין מפתחות API" />}

          <div style={{ marginTop:16, padding:'12px 14px', background: T.surfaceAlt, borderRadius: T.radius, fontSize:11, color: T.textSub }}>
            <div style={{ fontWeight:700, marginBottom:6, color: T.textMid }}>נקודות API זמינות:</div>
            <ul style={{ margin:0, paddingRight:18, lineHeight:2 }}>
              <li><code>GET /api/api-keys/public/time-entries</code> — רשימת דיווחים</li>
              <li><code>GET /api/api-keys/public/users</code> — רשימת משתמשים</li>
              <li><code>GET /api/api-keys/public/projects</code> — רשימת פרויקטים</li>
            </ul>
          </div>
        </Card>
      )}

      {/* ── Users ── */}
      {mainTab === 'users' && isAdmin && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <span style={{ fontSize:12, color: T.textSub, fontWeight:500 }}>{users.length} משתמשים רשומים</span>
            <button onClick={() => setShowAddForm(v => !v)} style={{
              padding:'8px 16px', borderRadius: T.radius,
              background: showAddForm ? T.surfaceAlt : T.primary,
              color: showAddForm ? T.textSub : '#fff',
              border: showAddForm ? `1px solid ${T.border}` : 'none',
              fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:6,
            }}>
              {showAddForm ? 'ביטול' : <><span style={{ fontSize:16, lineHeight:1 }}>+</span> הוסף משתמש</>}
            </button>
          </div>

          {showAddForm && (
            <Card style={{ marginBottom:16, border:`2px solid ${T.primaryBorder}`, background: T.primaryLight }}>
              <SectionLabel icon={<IcUser s={14}/>}>הוספת משתמש חדש</SectionLabel>
              <form onSubmit={handleAddUser} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:'1 1 180px' }}><label style={lbl}>שם מלא *</label><input value={newUser.fullName} onChange={e => setNewUser(p=>({...p,fullName:e.target.value}))} style={inp} placeholder="ישראל ישראלי" /></div>
                  <div style={{ flex:'1 1 180px' }}><label style={lbl}>אימייל *</label><input type="email" value={newUser.email} onChange={e => setNewUser(p=>({...p,email:e.target.value}))} style={inp} placeholder="email@example.com" /></div>
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:'1 1 180px' }}><label style={lbl}>סיסמה *</label><input type="password" value={newUser.password} onChange={e => setNewUser(p=>({...p,password:e.target.value}))} style={inp} placeholder="••••••••" /></div>
                  <div style={{ flex:'1 1 120px' }}><label style={lbl}>צוות</label><input value={newUser.team} onChange={e => setNewUser(p=>({...p,team:e.target.value}))} style={inp} placeholder="פיתוח" /></div>
                  <div style={{ flex:'1 1 120px' }}>
                    <label style={lbl}>תפקיד</label>
                    <select value={newUser.role} onChange={e => setNewUser(p=>({...p,role:e.target.value}))} style={inp}>
                      <option value="employee">עובד</option>
                      <option value="manager">מנהל</option>
                      <option value="admin">אדמין</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={addSaving}
                  style={{ alignSelf:'flex-start', padding:'9px 26px', borderRadius: T.radius, background: T.primary, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:'pointer', opacity:addSaving?0.7:1, fontFamily:'inherit' }}>
                  {addSaving ? 'יוצר...' : 'צור משתמש'}
                </button>
              </form>
            </Card>
          )}

          <Card>
            {usersLoading && <Spinner />}
            {!usersLoading && users.map(u => (
              <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:`1px solid ${T.borderLight}`, opacity:u.is_active?1:0.5 }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background: T.primaryMid, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color: T.primary, flexShrink:0 }}>
                  {u.full_name?.charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color: T.text }}>{u.full_name}</div>
                  <div style={{ fontSize:11, color: T.textFaint }}>{u.email}</div>
                  {u.team && <div style={{ fontSize:11, color: T.textSub, marginTop:1 }}>{u.team}</div>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <select value={roleMap[u.id]||u.role} onChange={e => setRoleMap(prev => ({...prev, [u.id]:e.target.value}))}
                    style={{ ...sel, fontSize:12, color: ROLE_COLORS[roleMap[u.id]||u.role], fontWeight:600 }}>
                    <option value="employee">עובד</option>
                    <option value="manager">מנהל</option>
                    <option value="admin">אדמין</option>
                  </select>
                  {roleMap[u.id] !== u.role && (
                    <button onClick={() => handleRoleChange(u.id)} disabled={savingId===u.id}
                      style={{ padding:'5px 12px', borderRadius: T.radiusSm, background: T.primary, color:'#fff', border:'none', fontSize:11, cursor:'pointer', fontWeight:600, opacity:savingId===u.id?0.7:1, fontFamily:'inherit' }}>
                      {savingId===u.id ? '...' : 'שמור'}
                    </button>
                  )}
                  <button onClick={() => handleToggleActive(u)}
                    style={{ padding:'5px 10px', borderRadius: T.radiusSm, border:`1px solid ${T.border}`, background: T.surface, fontSize:11, cursor:'pointer', color: u.is_active ? T.error : T.success, fontWeight:600, fontFamily:'inherit' }}>
                    {u.is_active ? 'השבת' : 'הפעל'}
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

