
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
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';

const fmt = m => m != null ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : '—';
const fmtH = h => h != null ? `${h}ש'` : '—';

const ROLE_COLORS = { employee: '#64748b', manager: '#6366f1', admin: '#dc2626' };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function ManagementPage() {
  const { user }     = useAuth();
  const { addToast } = useToast();
  const { isMobile } = useResponsive();
  const isAdmin      = user?.role === 'admin';

  const [mainTab, setMainTab] = useState('approvals');

  // ── פרויקטים ועובדים לפילטרים ───────────────────────────────
  const { projects } = useProjects();
  const [allUsers, setAllUsers] = useState([]);
  useEffect(() => { usersApi.list().then(setAllUsers).catch(() => {}); }, []);

  // ── אישור דיווחים ───────────────────────────────────────────
  const [f, setF] = useState({ status: '', dateFrom: '', dateTo: '', userId: '', projectId: '' });
  const { entries, loading, approve, reject } = useTimeEntries(
    Object.fromEntries(Object.entries(f).filter(([, v]) => v))
  );

  // ── דוחות ───────────────────────────────────────────────────
  const { data, loading: rLoading, fetch: fetchReport } = useReports();
  const [rType, setRType]   = useState('byUser');
  const [rFrom, setRFrom]   = useState('');
  const [rTo, setRTo]       = useState('');
  const [rPreset, setRPreset] = useState('');

  const [expandId, setExpandId]       = useState(null);
  const [detail, setDetail]           = useState(null);
  const [detailLoading, setDL]        = useState(false);
  const [detailTab, setDetailTab]     = useState('');

  // ── drill-down (רמה שנייה) ───────────────────────────────────
  const [drillDown, setDrillDown]     = useState(null); // { label, filters }
  const [drillEntries, setDrillEntries] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

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
    setExpandId(null);
    setDetail(null);
  }, [rType, rFrom, rTo, fetchReport]);

  useEffect(() => { if (mainTab === 'reports') doFetch(); }, [rType, rFrom, rTo, mainTab]);

  const handleRowClick = async (id) => {
    if (expandId === id) { setExpandId(null); setDetail(null); setDrillDown(null); return; }
    setExpandId(id);
    setDetail(null);
    setDrillDown(null);
    setDL(true);
    const params = {};
    if (rFrom) params.dateFrom = rFrom;
    if (rTo)   params.dateTo   = rTo;
    try {
      let d;
      if (rType === 'byUser')    { d = await reportsApi.byUserDetail(id, params);    setDetailTab('projects'); }
      if (rType === 'byProject') { d = await reportsApi.byProjectDetail(id, params); setDetailTab('employees'); }
      if (rType === 'byTask')    { d = await reportsApi.byTaskDetail(id, params);    setDetailTab('employees'); }
      setDetail(d);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setDL(false); }
  };

  const handleDrillDown = async (filters, label) => {
    setDrillDown({ label, filters });
    setDrillLoading(true);
    try {
      const params = { ...filters };
      if (rFrom) params.dateFrom = rFrom;
      if (rTo)   params.dateTo   = rTo;
      const rows = await timeEntriesApi.getAll(params);
      setDrillEntries(rows);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setDrillLoading(false); }
  };

  // ── commits ──────────────────────────────────────────────────
  const [commits, setCommits] = useState([]);
  const [cLoad, setCLoad]     = useState(false);
  useEffect(() => {
    if (mainTab !== 'commits') return;
    setCLoad(true);
    integrationsApi.getCommits().then(setCommits).catch(() => {}).finally(() => setCLoad(false));
  }, [mainTab]);

  // ── export panel ────────────────────────────────────────────
  const [expState, setExpState] = useState({
    te:        { from: '', to: '', busy: false },
    byUser:    { from: '', to: '', busy: false },
    byProject: { from: '', to: '', busy: false },
  });
  const setExp = (key, patch) => setExpState(p => ({ ...p, [key]: { ...p[key], ...patch } }));
  const runExport = async (key, fn) => {
    setExp(key, { busy: true });
    try { await fn(expState[key].from, expState[key].to); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setExp(key, { busy: false }); }
  };

  // ── estimate vs actual ───────────────────────────────────────
  const [evaData, setEvaData]     = useState([]);
  const [evaLoading, setEvaLoad]  = useState(false);
  const [evaFrom, setEvaFrom]     = useState('');
  const [evaTo, setEvaTo]         = useState('');
  useEffect(() => {
    if (mainTab !== 'estimate') return;
    setEvaLoad(true);
    reportsApi.estimateVsActual({ dateFrom: evaFrom, dateTo: evaTo })
      .then(setEvaData).catch(() => {}).finally(() => setEvaLoad(false));
  }, [mainTab, evaFrom, evaTo]);

  // ── payroll ──────────────────────────────────────────────────
  const [payrollData, setPayrollData]   = useState([]);
  const [payrollLoad, setPayrollLoad]   = useState(false);
  const [payrollFrom, setPayrollFrom]   = useState('');
  const [payrollTo, setPayrollTo]       = useState('');
  const [rateEdits, setRateEdits]       = useState({});
  const [rateSaving, setRateSaving]     = useState(null);
  const loadPayroll = useCallback(() => {
    setPayrollLoad(true);
    payrollApi.summary({ dateFrom: payrollFrom, dateTo: payrollTo })
      .then(rows => { setPayrollData(rows); setRateEdits(Object.fromEntries(rows.map(r => [r.id, r.hourly_rate]))); })
      .catch(() => {}).finally(() => setPayrollLoad(false));
  }, [payrollFrom, payrollTo]);
  useEffect(() => { if (mainTab === 'payroll') loadPayroll(); }, [mainTab, payrollFrom, payrollTo]);

  // ── slack ────────────────────────────────────────────────────
  const [slackConfig, setSlackConfig]   = useState({ configured: false, webhook_masked: '', enabled: false });
  const [slackUrl, setSlackUrl]         = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackSaving, setSlackSaving]   = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  useEffect(() => {
    if (mainTab !== 'slack') return;
    slackApi.getConfig().then(cfg => { setSlackConfig(cfg); setSlackEnabled(cfg.enabled); }).catch(() => {});
  }, [mainTab]);

  // ── reminders ────────────────────────────────────────────────
  const [reminderCfg, setReminderCfg]     = useState({ enabled: false, hour: 17 });
  const [reminderHour, setReminderHour]   = useState(17);
  const [reminderEnabled, setReminderEn]  = useState(false);
  const [reminderSaving, setReminderSave] = useState(false);
  const [missingUsers, setMissingUsers]   = useState([]);
  const [reminderTriggering, setRTrig]    = useState(false);
  const [retroAllowed, setRetroAllowed]   = useState(true);
  const [retroMaxDays, setRetroMaxDays]   = useState(30);
  const [retroSaving, setRetroSaving]     = useState(false);
  useEffect(() => {
    if (mainTab !== 'reminders') return;
    remindersApi.getConfig().then(cfg => { setReminderCfg(cfg); setReminderHour(cfg.hour); setReminderEn(cfg.enabled); }).catch(() => {});
    remindersApi.missingToday().then(setMissingUsers).catch(() => {});
    if (isAdmin) remindersApi.getRetroConfig().then(cfg => { setRetroAllowed(cfg.allowed); setRetroMaxDays(cfg.maxDays); }).catch(() => {});
  }, [mainTab]);

  // ── api keys ─────────────────────────────────────────────────
  const [apiKeys, setApiKeys]         = useState([]);
  const [apiKeysLoad, setAKLoad]      = useState(false);
  const [newKeyName, setNewKeyName]   = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [keyCreating, setKeyCreating] = useState(false);
  const loadApiKeys = () => {
    setAKLoad(true);
    apiKeysApi.list().then(setApiKeys).catch(() => {}).finally(() => setAKLoad(false));
  };
  useEffect(() => { if (mainTab === 'apikeys') loadApiKeys(); }, [mainTab]);

  // ── ניהול משתמשים (אדמין) ────────────────────────────────────
  const [users, setUsers]             = useState([]);
  const [usersLoading, setUL]         = useState(false);
  const [savingId, setSavingId]       = useState(null);
  const [roleMap, setRoleMap]         = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser]         = useState({ fullName: '', email: '', password: '', role: 'employee', team: '' });
  const [addSaving, setAddSaving]     = useState(false);

  const loadUsers = async () => {
    setUL(true);
    try {
      const d = await usersApi.list();
      setUsers(d);
      setRoleMap(Object.fromEntries(d.map(u => [u.id, u.role])));
    } catch (err) { addToast(err.message, 'error'); }
    finally { setUL(false); }
  };
  useEffect(() => { if (mainTab === 'users' && isAdmin) loadUsers(); }, [mainTab]);

  const handleRoleChange = async (uid) => {
    setSavingId(uid);
    try {
      await usersApi.update(uid, { role: roleMap[uid] });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: roleMap[uid] } : u));
      addToast('תפקיד עודכן', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSavingId(null); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.fullName || !newUser.email || !newUser.password) { addToast('נא למלא את כל השדות', 'error'); return; }
    setAddSaving(true);
    try {
      await usersApi.create({ fullName: newUser.fullName, email: newUser.email, password: newUser.password, role: newUser.role, team: newUser.team || undefined });
      addToast(`משתמש "${newUser.fullName}" נוצר בהצלחה`, 'success');
      setNewUser({ fullName: '', email: '', password: '', role: 'employee', team: '' });
      setShowAddForm(false);
      loadUsers();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setAddSaving(false); }
  };

  const handleToggleActive = async (u) => {
    try {
      await usersApi.update(u.id, { isActive: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
      addToast(u.is_active ? 'משתמש הושבת' : 'משתמש הופעל מחדש', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('סיבת הדחייה:');
    try { await reject(id, reason); } catch (err) { addToast(err.message, 'error'); }
  };

  // ── styles ───────────────────────────────────────────────────
  const sel = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 12, background: '#fff' };
  const inp = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 4 };
  const tabBtn = (active) => ({
    padding: '8px 16px', borderRadius: 8, border: active ? 'none' : '1px solid #e2e8f0',
    background: active ? '#6366f1' : '#fff', color: active ? '#fff' : '#64748b',
    fontSize: 13, cursor: 'pointer', fontWeight: active ? 500 : 400,
  });
  const presetBtn = (p) => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    border: rPreset === p ? 'none' : '1px solid #e2e8f0',
    background: rPreset === p ? '#e0e7ff' : '#fff',
    color: rPreset === p ? '#4338ca' : '#64748b',
    fontWeight: rPreset === p ? 600 : 400,
  });
  const th = { textAlign: 'right', padding: '6px 8px', fontWeight: 500, fontSize: 11, color: '#94a3b8', borderBottom: '2px solid #f1f5f9' };
  const td = { padding: '9px 8px', fontSize: 12, borderBottom: '1px solid #f8fafc' };
  const clickableRow = (isExpanded) => ({
    cursor: 'pointer',
    background: isExpanded ? '#f5f3ff' : 'transparent',
    transition: 'background 0.15s',
  });
  const detailTabBtn = (active) => ({
    padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none',
    background: active ? '#6366f1' : '#e2e8f0', color: active ? '#fff' : '#64748b', fontWeight: active ? 600 : 400,
  });

  // ── drill-down entries display ───────────────────────────────
  const renderDrillEntries = () => (
    <div style={{ padding: '12px 16px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setDrillDown(null)} style={{ background: '#e0e7ff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#4f46e5', fontWeight: 500 }}>
          ← חזור
        </button>
        <span style={{ fontSize: 11, color: '#64748b' }}>{drillDown?.label}</span>
      </div>
      {drillLoading && <Spinner />}
      {!drillLoading && drillEntries.length === 0 && (
        <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין דיווחים בטווח זה</p>
      )}
      {!drillLoading && drillEntries.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 380 }}>
            <thead>
              <tr>
                <th style={th}>תאריך</th>
                <th style={th}>עובד</th>
                <th style={th}>פרויקט</th>
                <th style={th}>משימה</th>
                <th style={th}>שעות:דקות</th>
                <th style={th}>סטטוס</th>
                <th style={th}>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {drillEntries.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>{e.date}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{e.user_name}</td>
                  <td style={{ ...td, color: '#64748b' }}>{e.project_name || '—'}</td>
                  <td style={{ ...td, color: '#64748b' }}>{e.task_name || '—'}</td>
                  <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmt(e.duration_minutes)}</td>
                  <td style={td}><Badge status={e.status} resubmitted={!!e.rejection_reason} /></td>
                  <td style={{ ...td, color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, textAlign: 'left' }}>
            {drillEntries.length} דיווחים · סה״כ {fmt(drillEntries.reduce((s, e) => s + (e.duration_minutes || 0), 0))}
          </div>
        </div>
      )}
    </div>
  );

  // ── helper renderers ─────────────────────────────────────────
  const drillRowStyle = { cursor: 'pointer', transition: 'background 0.12s' };

  const renderDetailPanel = (row) => {
    if (expandId !== row.id) return null;
    return (
      <tr>
        <td colSpan={10} style={{ padding: 0, background: '#f8f7ff', borderBottom: '2px solid #e0e7ff' }}>
          {detailLoading && <div style={{ padding: 16 }}><Spinner /></div>}

          {/* ── drill-down view (רמה שנייה) ── */}
          {drillDown && renderDrillEntries()}

          {/* ── aggregate view (רמה ראשונה) ── */}
          {!drillDown && detail && rType === 'byUser' && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {[['projects', 'פרויקטים'], ['tasks', 'משימות'], ['daily', 'יומי']].map(([k, l]) => (
                  <button key={k} style={detailTabBtn(detailTab === k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'projects' && (
                detail.projects.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr><th style={th}>פרויקט</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.projects.map((p, i) => (
                        <tr key={i} style={drillRowStyle}
                          onMouseEnter={e => e.currentTarget.style.background='#ede9fe'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                          onClick={() => handleDrillDown({ userId: row.id, projectId: p.id }, `${row.full_name} ← ${p.project_name}`)}>
                          <td style={td}>{p.project_name}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(p.total_hours)}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{p.entry_count}</td>
                          <td style={{ ...td, color: '#a5b4fc', fontSize: 10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין פרויקטים בטווח זה</p>
              )}
              {detailTab === 'tasks' && (
                detail.tasks.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr><th style={th}>משימה</th><th style={th}>פרויקט</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.tasks.map((t, i) => (
                        <tr key={i} style={drillRowStyle}
                          onMouseEnter={e => e.currentTarget.style.background='#ede9fe'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                          onClick={() => handleDrillDown({ userId: row.id, taskId: t.id }, `${row.full_name} ← ${t.task_name}`)}>
                          <td style={td}>{t.task_name}</td>
                          <td style={{ ...td, color: '#64748b' }}>{t.project_name}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(t.total_hours)}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{t.entry_count}</td>
                          <td style={{ ...td, color: '#a5b4fc', fontSize: 10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין משימות בטווח זה</p>
              )}
              {detailTab === 'daily' && (
                detail.daily.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr><th style={th}>תאריך</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.daily.map((d, i) => (
                        <tr key={i} style={drillRowStyle}
                          onMouseEnter={e => e.currentTarget.style.background='#ede9fe'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                          onClick={() => handleDrillDown({ userId: row.id, dateFrom: d.date, dateTo: d.date }, `${row.full_name} ← ${d.date}`)}>
                          <td style={td}>{d.date}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(d.total_hours)}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{d.entry_count}</td>
                          <td style={{ ...td, color: '#a5b4fc', fontSize: 10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין נתונים יומיים בטווח זה</p>
              )}
            </div>
          )}

          {!drillDown && detail && rType === 'byProject' && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {[['employees', 'עובדים'], ['tasks', 'משימות']].map(([k, l]) => (
                  <button key={k} style={detailTabBtn(detailTab === k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'employees' && (
                detail.employees.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr><th style={th}>עובד</th><th style={th}>צוות</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.employees.map((e, i) => (
                        <tr key={i} style={drillRowStyle}
                          onMouseEnter={ev => ev.currentTarget.style.background='#ede9fe'}
                          onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
                          onClick={() => handleDrillDown({ projectId: row.id, userId: e.id }, `${row.project_name} ← ${e.full_name}`)}>
                          <td style={td}>{e.full_name}</td>
                          <td style={{ ...td, color: '#64748b' }}>{e.team || '—'}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(e.total_hours)}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{e.entry_count}</td>
                          <td style={{ ...td, color: '#a5b4fc', fontSize: 10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין עובדים בטווח זה</p>
              )}
              {detailTab === 'tasks' && (
                detail.tasks.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr><th style={th}>משימה</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.tasks.map((t, i) => (
                        <tr key={i} style={drillRowStyle}
                          onMouseEnter={e => e.currentTarget.style.background='#ede9fe'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                          onClick={() => handleDrillDown({ projectId: row.id, taskId: t.id }, `${row.project_name} ← ${t.task_name}`)}>
                          <td style={td}>{t.task_name}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(t.total_hours)}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{t.entry_count}</td>
                          <td style={{ ...td, color: '#a5b4fc', fontSize: 10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין משימות בטווח זה</p>
              )}
            </div>
          )}

          {!drillDown && detail && rType === 'byTask' && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {[['employees', 'עובדים'], ['dates', 'תאריכי עבודה']].map(([k, l]) => (
                  <button key={k} style={detailTabBtn(detailTab === k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'employees' && (
                detail.employees.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr><th style={th}>עובד</th><th style={th}>שעות</th><th style={th}>דיווחים</th><th style={th}></th></tr></thead>
                      <tbody>{detail.employees.map((e, i) => (
                        <tr key={i} style={drillRowStyle}
                          onMouseEnter={ev => ev.currentTarget.style.background='#ede9fe'}
                          onMouseLeave={ev => ev.currentTarget.style.background='transparent'}
                          onClick={() => handleDrillDown({ taskId: row.id, userId: e.id }, `${row.task_name} ← ${e.full_name}`)}>
                          <td style={td}>{e.full_name}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(e.total_hours)}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{e.entry_count}</td>
                          <td style={{ ...td, color: '#a5b4fc', fontSize: 10 }}>פרט ▶</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין עובדים בטווח זה</p>
              )}
              {detailTab === 'dates' && (
                detail.dates.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr><th style={th}>תאריך</th><th style={th}>עובד</th><th style={th}>שעות:דקות</th></tr></thead>
                      <tbody>{detail.dates.map((d, i) => (
                        <tr key={i}><td style={td}>{d.date}</td><td style={{ ...td, color: '#64748b' }}>{d.full_name}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmt(d.duration_minutes)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין תאריכים בטווח זה</p>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'system-ui,sans-serif' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: '#1e293b' }}>ניהול</h2>

      {/* טאבים ראשיים */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button style={tabBtn(mainTab === 'approvals')} onClick={() => setMainTab('approvals')}>✔ אישור</button>
        <button style={tabBtn(mainTab === 'reports')}   onClick={() => setMainTab('reports')}>📊 דוחות</button>
        <button style={tabBtn(mainTab === 'estimate')}  onClick={() => setMainTab('estimate')}>🎯 Estimate</button>
        <button style={tabBtn(mainTab === 'export')}    onClick={() => setMainTab('export')}>⬇ ייצוא</button>
        <button style={tabBtn(mainTab === 'commits')}   onClick={() => setMainTab('commits')}>🔗 Git</button>
        <button style={tabBtn(mainTab === 'reminders')} onClick={() => setMainTab('reminders')}>🔔 תזכורות</button>
        {isAdmin && <button style={tabBtn(mainTab === 'payroll')}  onClick={() => setMainTab('payroll')}>💰 שכר</button>}
        {isAdmin && <button style={tabBtn(mainTab === 'slack')}    onClick={() => setMainTab('slack')}>💬 Slack</button>}
        {isAdmin && <button style={tabBtn(mainTab === 'apikeys')}  onClick={() => setMainTab('apikeys')}>🔑 API</button>}
        {isAdmin && <button style={tabBtn(mainTab === 'users')}    onClick={() => setMainTab('users')}>👥 משתמשים</button>}
      </div>

      {/* ── אישור דיווחים ── */}
      {mainTab === 'approvals' && (
        <Card>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <select value={f.userId} onChange={e => setF(p => ({ ...p, userId: e.target.value }))} style={sel}>
              <option value="">כל העובדים</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <select value={f.projectId} onChange={e => setF(p => ({ ...p, projectId: e.target.value }))} style={sel}>
              <option value="">כל הפרויקטים</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
            <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))} style={sel}>
              <option value="">כל הסטטוסים</option>
              <option value="submitted">ממתינים</option>
              <option value="approved">אושרו</option>
              <option value="rejected">נדחו</option>
            </select>
            <input type="date" value={f.dateFrom} onChange={e => setF(p => ({ ...p, dateFrom: e.target.value }))} style={sel} title="מתאריך" />
            <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center' }}>עד</span>
            <input type="date" value={f.dateTo} onChange={e => setF(p => ({ ...p, dateTo: e.target.value }))} style={sel} title="עד תאריך" />
            {(f.userId || f.projectId || f.status || f.dateFrom || f.dateTo) && (
              <button onClick={() => setF({ status: '', dateFrom: '', dateTo: '', userId: '', projectId: '' })}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}>נקה</button>
            )}
          </div>
          {loading && <Spinner />}
          {entries.map(e => (
            <div key={e.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <span style={{ color: '#94a3b8', whiteSpace: 'nowrap', fontSize: 11 }}>{e.date}</span>
              <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.user_name}</div>
                <div style={{ color: '#64748b', fontSize: 11 }}>{e.project_name}</div>
              </div>
              <span style={{ fontWeight: 600, color: '#6366f1', whiteSpace: 'nowrap' }}>{fmt(e.duration_minutes)}</span>
              <Badge status={e.status} resubmitted={!!e.rejection_reason} />
              {e.status === 'submitted' && (
                <div style={{ display: 'flex', gap: 5, flexBasis: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                  <button onClick={() => approve(e.id).catch(err => addToast(err.message, 'error'))}
                    style={{ padding: '4px 10px', borderRadius: 6, background: '#d1fae5', color: '#065f46', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>אשר</button>
                  <button onClick={() => handleReject(e.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>דחה</button>
                </div>
              )}
            </div>
          ))}
          {!loading && !entries.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין דיווחים</p>}
        </Card>
      )}

      {/* ── דוחות ── */}
      {mainTab === 'reports' && (
        <Card>
          {/* סוג דוח */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {[['byUser', 'לפי עובד'], ['byProject', 'לפי פרויקט'], ['byTask', 'לפי משימה'], ['anomalies', 'חריגות']].map(([k, l]) => (
              <button key={k} onClick={() => setRType(k)}
                style={{ padding: '6px 14px', borderRadius: 8, border: rType === k ? 'none' : '1px solid #e2e8f0', background: rType === k ? '#6366f1' : '#fff', color: rType === k ? '#fff' : '#64748b', fontSize: 12, cursor: 'pointer', fontWeight: rType === k ? 500 : 400 }}>{l}</button>
            ))}
          </div>

          {/* פילטר טווח זמן */}
          {rType !== 'anomalies' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>טווח זמן:</span>
              <button style={presetBtn('today')}  onClick={() => applyPreset('today')}>היום</button>
              <button style={presetBtn('week')}   onClick={() => applyPreset('week')}>שבוע זה</button>
              <button style={presetBtn('month')}  onClick={() => applyPreset('month')}>חודש זה</button>
              <button style={presetBtn('custom')} onClick={() => applyPreset('custom')}>מותאם אישית</button>
              {(rPreset === 'custom' || (!rPreset && (rFrom || rTo))) && (
                <>
                  <input type="date" value={rFrom} onChange={e => { setRFrom(e.target.value); setRPreset('custom'); }} style={{ ...sel, marginRight: 4 }} title="מתאריך" />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>עד</span>
                  <input type="date" value={rTo} onChange={e => { setRTo(e.target.value); setRPreset('custom'); }} style={sel} title="עד תאריך" />
                </>
              )}
              {(rFrom || rTo) && (
                <button onClick={() => { setRFrom(''); setRTo(''); setRPreset(''); }}
                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, color: '#64748b', cursor: 'pointer' }}>נקה</button>
              )}
            </div>
          )}

          {rLoading && <Spinner />}

          {/* לפי עובד */}
          {!rLoading && Array.isArray(data) && rType === 'byUser' && (
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>לחץ על שורה לפירוט פרויקטים, משימות ופירוט יומי</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr>{['עובד', 'צוות', 'שעות', 'דיווחים', 'פרויקטים', 'משימות'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.map(r => (
                      <Fragment key={r.id}>
                        <tr style={clickableRow(expandId === r.id)} onClick={() => handleRowClick(r.id)}>
                          <td style={td}><span style={{ fontWeight: 500 }}>{r.full_name}</span> {expandId === r.id ? '▲' : '▼'}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.team || '—'}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(r.total_hours)}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.entry_count}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.project_count}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.task_count}</td>
                        </tr>
                        {renderDetailPanel(r)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין נתונים</p>}
            </div>
          )}

          {/* לפי פרויקט */}
          {!rLoading && Array.isArray(data) && rType === 'byProject' && (
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>לחץ על שורה לפירוט עובדים ומשימות</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 360 }}>
                  <thead>
                    <tr>{['פרויקט', 'שעות', 'עובדים', 'משימות', 'דיווחים'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.map(r => (
                      <Fragment key={r.id}>
                        <tr style={clickableRow(expandId === r.id)} onClick={() => handleRowClick(r.id)}>
                          <td style={td}><span style={{ fontWeight: 500 }}>{r.project_name}</span> {expandId === r.id ? '▲' : '▼'}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(r.total_hours)}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.user_count}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.task_count}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.entry_count}</td>
                        </tr>
                        {renderDetailPanel(r)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין נתונים</p>}
            </div>
          )}

          {/* לפי משימה */}
          {!rLoading && Array.isArray(data) && rType === 'byTask' && (
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>לחץ על שורה לפירוט עובדים ותאריכי עבודה</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 380 }}>
                  <thead>
                    <tr>{['משימה', 'פרויקט', 'שעות', 'עובדים', 'פעילות אחרונה'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.map(r => (
                      <Fragment key={r.id}>
                        <tr style={clickableRow(expandId === r.id)} onClick={() => handleRowClick(r.id)}>
                          <td style={td}><span style={{ fontWeight: 500 }}>{r.task_name}</span> {expandId === r.id ? '▲' : '▼'}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.project_name}</td>
                          <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(r.total_hours)}</td>
                          <td style={{ ...td, color: '#64748b' }}>{r.user_count}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{r.last_activity || '—'}</td>
                        </tr>
                        {renderDetailPanel(r)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין נתונים</p>}
            </div>
          )}

          {/* חריגות */}
          {!rLoading && data && rType === 'anomalies' && !Array.isArray(data) && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>
                  דיווחים ארוכים במיוחד (מעל 10 שעות)
                </div>
                {data.longEntries?.length ? (
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead><tr>{['תאריך', 'עובד', 'פרויקט', 'שעות:דקות'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{data.longEntries.map(e => (
                      <tr key={e.id}>
                        <td style={td}>{e.date}</td>
                        <td style={{ ...td, fontWeight: 500 }}>{e.full_name}</td>
                        <td style={{ ...td, color: '#64748b' }}>{e.project_name}</td>
                        <td style={{ ...td, color: '#dc2626', fontWeight: 600 }}>{fmt(e.duration_minutes)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12 }}>אין חריגות</p>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 10 }}>
                  עובדים לא פעילים (7+ ימים ללא דיווח)
                </div>
                {data.missingActivity?.length ? (
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead><tr>{['עובד', 'צוות', 'דיווח אחרון'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{data.missingActivity.map(u => (
                      <tr key={u.id}>
                        <td style={{ ...td, fontWeight: 500 }}>{u.full_name}</td>
                        <td style={{ ...td, color: '#64748b' }}>{u.team || '—'}</td>
                        <td style={{ ...td, color: '#f59e0b' }}>{u.last_entry_date || 'מעולם לא'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12 }}>כל העובדים פעילים</p>}
              </div>
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6', marginBottom: 10 }}>
                  דיווחים חופפים בזמן
                </div>
                {data.overlappingEntries?.length ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 500 }}>
                      <thead><tr>{['עובד', 'תאריך', 'דיווח א\'', 'דיווח ב\'', 'פרויקט א\'', 'פרויקט ב\''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                      <tbody>{data.overlappingEntries.map(e => (
                        <tr key={`${e.entry_a_id}-${e.entry_b_id}`}>
                          <td style={{ ...td, fontWeight: 500 }}>{e.full_name}</td>
                          <td style={td}>{e.date}</td>
                          <td style={{ ...td, color: '#8b5cf6', fontFamily: 'monospace' }}>{e.start_time?.slice(0,5)}–{e.end_time?.slice(0,5)}</td>
                          <td style={{ ...td, color: '#8b5cf6', fontFamily: 'monospace' }}>{e.b_start_time?.slice(0,5)}–{e.b_end_time?.slice(0,5)}</td>
                          <td style={{ ...td, color: '#64748b' }}>{e.project_a}</td>
                          <td style={{ ...td, color: '#64748b' }}>{e.project_b}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p style={{ color: '#94a3b8', fontSize: 12 }}>אין חפיפות בזמן</p>}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── חיבורי Git ── */}
      {mainTab === 'commits' && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#64748b', marginBottom: 12 }}>commits מקושרים לדיווחי שעות</div>
          {cLoad && <Spinner />}
          {!cLoad && !commits.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>אין commits עדיין — הוסף commit בדף האינטגרציות</p>}
          {commits.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 4, fontSize: 11, flexShrink: 0 }}>{c.commit_hash?.slice(0, 7)}</code>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.commit_message}</div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{c.repository} · {c.branch}</div>
              </div>
              <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{c.full_name || '—'}</span>
              <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{c.commit_date?.slice(0, 10)}</span>
            </div>
          ))}
        </Card>
      )}

      {/* ── Estimate vs Actual ── */}
      {mainTab === 'estimate' && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>השוואה: Estimate vs Actual לפי משימה</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" value={evaFrom} onChange={e => setEvaFrom(e.target.value)} style={sel} title="מתאריך" />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>עד</span>
            <input type="date" value={evaTo}   onChange={e => setEvaTo(e.target.value)}   style={sel} title="עד תאריך" />
            {(evaFrom || evaTo) && (
              <button onClick={() => { setEvaFrom(''); setEvaTo(''); }}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}>נקה</button>
            )}
          </div>
          {evaLoading && <Spinner />}
          {!evaLoading && evaData.length === 0 && (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין משימות עם הערכת שעות</p>
          )}
          {!evaLoading && evaData.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                <thead>
                  <tr>
                    {['משימה', 'פרויקט', 'הערכה (ש\')', 'בפועל (ש\')', 'סטייה (ש\')', 'סטייה %', 'מצב'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evaData.map((r, i) => {
                    const over  = r.variance_hours > 0;
                    const under = r.variance_hours < 0;
                    const color = over ? '#dc2626' : under ? '#16a34a' : '#64748b';
                    const bg    = over ? '#fef2f2' : under ? '#f0fdf4' : 'transparent';
                    const label = over ? '⚠ חריגה' : under ? '✓ בתקציב' : '= מדויק';
                    return (
                      <tr key={i} style={{ background: bg }}>
                        <td style={{ ...td, fontWeight: 500 }}>{r.task_name}</td>
                        <td style={{ ...td, color: '#64748b' }}>{r.project_name}</td>
                        <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{r.estimated_hours}</td>
                        <td style={{ ...td, color: '#1e293b', fontWeight: 600 }}>{r.actual_hours}</td>
                        <td style={{ ...td, color, fontWeight: 600 }}>
                          {r.variance_hours > 0 ? '+' : ''}{r.variance_hours}
                        </td>
                        <td style={{ ...td, color }}>
                          {r.variance_pct != null ? (r.variance_pct > 0 ? '+' : '') + r.variance_pct + '%' : '—'}
                        </td>
                        <td style={{ ...td, color, fontWeight: 500 }}>{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
                {evaData.filter(r => r.variance_hours > 0).length} משימות חרגו ·{' '}
                {evaData.filter(r => r.variance_hours <= 0).length} בתקציב
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── ייצוא CSV ── */}
      {mainTab === 'export' && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>ייצוא נתונים ל-CSV</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ייצוא דיווחי שעות */}
            {[
              { key: 'te',        title: 'ייצוא דיווחי שעות',  desc: 'כל הדיווחים לפי פילטר תאריכים', fn: (f, t) => exportApi.timeEntries({ dateFrom: f, dateTo: t }) },
              { key: 'byUser',    title: 'דוח לפי עובד',        desc: 'סיכום שעות לכל עובד',           fn: (f, t) => exportApi.reportByUser({ dateFrom: f, dateTo: t }) },
              { key: 'byProject', title: 'דוח לפי פרויקט',      desc: 'סיכום שעות לכל פרויקט',         fn: (f, t) => exportApi.reportByProject({ dateFrom: f, dateTo: t }) },
            ].map(({ key, title, desc, fn }) => (
              <div key={key} style={{ padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: '2 1 180px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{desc}</div>
                </div>
                <input type="date" value={expState[key].from} onChange={e => setExp(key, { from: e.target.value })} style={{ ...sel, flex: '1 1 120px' }} title="מתאריך" />
                <input type="date" value={expState[key].to}   onChange={e => setExp(key, { to: e.target.value })}   style={{ ...sel, flex: '1 1 120px' }} title="עד תאריך" />
                <button disabled={expState[key].busy} onClick={() => runExport(key, fn)}
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: expState[key].busy ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                  {expState[key].busy ? '...' : '⬇ הורד CSV'}
                </button>
              </div>
            ))}

            {isAdmin && (
              <div style={{ padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: '2 1 180px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>ייצוא שכר (Payroll)</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>שעות אושרו × שכר לשעה לכל עובד</div>
                </div>
                <button onClick={() => exportApi.payroll({}).catch(err => addToast(err.message, 'error'))}
                  style={{ padding: '8px 18px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ⬇ ייצוא שכר
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── תזכורות ── */}
      {mainTab === 'reminders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* מי לא דיווח היום */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                עובדים שטרם דיווחו היום ({missingUsers.length})
              </div>
              <button
                disabled={reminderTriggering || missingUsers.length === 0}
                onClick={async () => {
                  setRTrig(true);
                  try {
                    const r = await remindersApi.trigger();
                    addToast(`תזכורת נשלחה ל-${r.sent} עובדים`, 'success');
                    remindersApi.missingToday().then(setMissingUsers).catch(() => {});
                  } catch (err) { addToast(err.message, 'error'); }
                  finally { setRTrig(false); }
                }}
                style={{ padding: '7px 16px', borderRadius: 8, background: missingUsers.length ? '#f59e0b' : '#e2e8f0', color: missingUsers.length ? '#fff' : '#94a3b8', border: 'none', fontSize: 12, fontWeight: 500, cursor: missingUsers.length ? 'pointer' : 'default', opacity: reminderTriggering ? 0.7 : 1 }}>
                {reminderTriggering ? '...' : '🔔 שלח תזכורות'}
              </button>
            </div>
            {missingUsers.length === 0
              ? <p style={{ color: '#16a34a', fontSize: 12, margin: 0 }}>✓ כל העובדים דיווחו שעות היום</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {missingUsers.map(u => (
                    <div key={u.id} style={{ padding: '4px 10px', borderRadius: 20, background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
                      {u.full_name} {u.team && <span style={{ color: '#a16207' }}>· {u.team}</span>}
                    </div>
                  ))}
                </div>
              )}
          </Card>

          {/* הגדרות תזכורות (אדמין) */}
          {isAdmin && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 14 }}>הגדרות תזכורות אוטומטיות</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={reminderEnabled} onChange={e => setReminderEn(e.target.checked)}
                    style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: '#1e293b' }}>הפעל תזכורות יומיות אוטומטיות</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 12, color: '#64748b', minWidth: 80 }}>שעת שליחה:</label>
                  <input type="number" min="0" max="23" value={reminderHour} onChange={e => setReminderHour(+e.target.value)}
                    style={{ ...sel, width: 70 }} />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>:00</span>
                </div>
                <button disabled={reminderSaving}
                  onClick={async () => {
                    setReminderSave(true);
                    try {
                      await remindersApi.saveConfig({ enabled: reminderEnabled, hour: reminderHour });
                      addToast('הגדרות נשמרו', 'success');
                    } catch (err) { addToast(err.message, 'error'); }
                    finally { setReminderSave(false); }
                  }}
                  style={{ alignSelf: 'flex-start', padding: '8px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: reminderSaving ? 0.7 : 1 }}>
                  {reminderSaving ? 'שומר...' : 'שמור הגדרות'}
                </button>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                  כשהתזכורת מופעלת, עובדים שלא דיווחו עד השעה שנבחרה יקבלו התראה במערכת ובSlack (אם מוגדר).
                </p>
              </div>
            </Card>
          )}

          {/* מדיניות דיווח רטרואקטיבי (אדמין) */}
          {isAdmin && (
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 14 }}>מדיניות דיווח רטרואקטיבי</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={retroAllowed} onChange={e => setRetroAllowed(e.target.checked)}
                    style={{ width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: '#1e293b' }}>אפשר לעובדים לדווח על תאריכים עבר</span>
                </label>
                {retroAllowed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 12, color: '#64748b', minWidth: 120 }}>מקסימום ימים אחורה:</label>
                    <input type="number" min="1" max="365" value={retroMaxDays}
                      onChange={e => setRetroMaxDays(+e.target.value)}
                      style={{ ...sel, width: 80 }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>ימים</span>
                  </div>
                )}
                <button disabled={retroSaving}
                  onClick={async () => {
                    setRetroSaving(true);
                    try {
                      await remindersApi.saveRetroConfig({ allowed: retroAllowed, maxDays: retroMaxDays });
                      addToast('מדיניות רטרואקטיבי נשמרה', 'success');
                    } catch (err) { addToast(err.message, 'error'); }
                    finally { setRetroSaving(false); }
                  }}
                  style={{ alignSelf: 'flex-start', padding: '8px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: retroSaving ? 0.7 : 1 }}>
                  {retroSaving ? 'שומר...' : 'שמור מדיניות'}
                </button>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                  {retroAllowed
                    ? `עובדים יכולים לדווח על תאריכים עד ${retroMaxDays} ימים אחורה.`
                    : 'עובדים יכולים לדווח רק על תאריך היום.'}
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── שכר (Payroll) — אדמין ── */}
      {mainTab === 'payroll' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>חישוב שכר — שעות אושרו בלבד</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={payrollFrom} onChange={e => setPayrollFrom(e.target.value)} style={sel} title="מתאריך" />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>עד</span>
                <input type="date" value={payrollTo}   onChange={e => setPayrollTo(e.target.value)}   style={sel} title="עד תאריך" />
                <button onClick={() => exportApi.payroll({ dateFrom: payrollFrom, dateTo: payrollTo }).catch(err => addToast(err.message, 'error'))}
                  style={{ padding: '7px 14px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ⬇ ייצוא CSV
                </button>
              </div>
            </div>
            {payrollLoad && <Spinner />}
            {!payrollLoad && payrollData.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                  <thead>
                    <tr>{['עובד', 'צוות', 'שכר/שעה (₪)', 'שעות אושרו', 'שכר לתשלום (₪)', 'פעולה'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {payrollData.map(u => (
                      <tr key={u.id}>
                        <td style={{ ...td, fontWeight: 500 }}>{u.full_name}</td>
                        <td style={{ ...td, color: '#64748b' }}>{u.team || '—'}</td>
                        <td style={td}>
                          <input type="number" min="0" step="0.5"
                            value={rateEdits[u.id] ?? u.hourly_rate}
                            onChange={e => setRateEdits(p => ({ ...p, [u.id]: e.target.value }))}
                            style={{ width: 80, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                        </td>
                        <td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{u.total_hours}</td>
                        <td style={{ ...td, color: '#059669', fontWeight: 700, fontSize: 13 }}>
                          ₪{((rateEdits[u.id] ?? u.hourly_rate) * u.total_hours).toFixed(2)}
                        </td>
                        <td style={td}>
                          {String(rateEdits[u.id]) !== String(u.hourly_rate) && (
                            <button disabled={rateSaving === u.id}
                              onClick={async () => {
                                setRateSaving(u.id);
                                try {
                                  await payrollApi.updateRate(u.id, rateEdits[u.id]);
                                  addToast('שכר עודכן', 'success');
                                  loadPayroll();
                                } catch (err) { addToast(err.message, 'error'); }
                                finally { setRateSaving(null); }
                              }}
                              style={{ padding: '4px 10px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', opacity: rateSaving === u.id ? 0.7 : 1 }}>
                              {rateSaving === u.id ? '...' : 'שמור'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td colSpan={3} style={{ ...td, fontWeight: 600 }}>סה״כ</td>
                      <td style={{ ...td, color: '#6366f1', fontWeight: 700 }}>{payrollData.reduce((s, u) => s + +u.total_hours, 0).toFixed(2)}</td>
                      <td style={{ ...td, color: '#059669', fontWeight: 700, fontSize: 13 }}>
                        ₪{payrollData.reduce((s, u) => s + ((rateEdits[u.id] ?? u.hourly_rate) * u.total_hours), 0).toFixed(2)}
                      </td>
                      <td style={td}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {!payrollLoad && payrollData.length === 0 && (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין נתוני שכר</p>
            )}
          </Card>
        </div>
      )}

      {/* ── Slack ── */}
      {mainTab === 'slack' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>הגדרות Slack Webhook</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Webhook URL</label>
                <input
                  type="url"
                  value={slackUrl}
                  onChange={e => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  style={inp}
                />
                {slackConfig.configured && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    מוגדר: {slackConfig.webhook_masked}
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={slackEnabled} onChange={e => setSlackEnabled(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: '#1e293b' }}>הפעל Slack (שלח הודעות על אישור/דחיה ותזכורות)</span>
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button disabled={slackSaving}
                  onClick={async () => {
                    setSlackSaving(true);
                    try {
                      await slackApi.saveConfig(slackUrl || undefined, slackEnabled);
                      addToast('הגדרות Slack נשמרו', 'success');
                      slackApi.getConfig().then(setSlackConfig).catch(() => {});
                      setSlackUrl('');
                    } catch (err) { addToast(err.message, 'error'); }
                    finally { setSlackSaving(false); }
                  }}
                  style={{ padding: '8px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: slackSaving ? 0.7 : 1 }}>
                  {slackSaving ? 'שומר...' : 'שמור'}
                </button>
                {slackConfig.configured && (
                  <button disabled={slackTesting}
                    onClick={async () => {
                      setSlackTesting(true);
                      try {
                        await slackApi.test();
                        addToast('הודעת בדיקה נשלחה ל-Slack!', 'success');
                      } catch (err) { addToast(err.message, 'error'); }
                      finally { setSlackTesting(false); }
                    }}
                    style={{ padding: '8px 20px', borderRadius: 8, background: '#f8fafc', color: '#6366f1', border: '1px solid #6366f1', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: slackTesting ? 0.7 : 1 }}>
                    {slackTesting ? '...' : 'בדוק חיבור'}
                  </button>
                )}
              </div>
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#64748b' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>המערכת תשלח לSlack הודעות על:</div>
                <ul style={{ margin: 0, paddingRight: 18, lineHeight: 1.8 }}>
                  <li>דיווחים שאושרו / נדחו</li>
                  <li>תזכורות שעות לעובדים</li>
                  <li>עובדים חסרי דיווח (דוח יומי)</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── API Keys ── */}
      {mainTab === 'apikeys' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 14 }}>מפתחות API חיצוניים</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
              מפתחות API מאפשרים למערכות חיצוניות לגשת לנתוני TimeIn דרך HTTP עם header: <code>x-api-key: &lt;key&gt;</code>
            </div>

            {/* Create new key */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="שם מפתח (לדוג׳: Payroll System)"
                style={{ ...inp, flex: '1 1 200px', width: 'auto' }}
              />
              <button disabled={keyCreating || !newKeyName}
                onClick={async () => {
                  setKeyCreating(true);
                  try {
                    const result = await apiKeysApi.create(newKeyName);
                    setNewKeyValue(result.key);
                    setNewKeyName('');
                    loadApiKeys();
                  } catch (err) { addToast(err.message, 'error'); }
                  finally { setKeyCreating(false); }
                }}
                style={{ padding: '8px 18px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: newKeyName ? 'pointer' : 'default', opacity: (!newKeyName || keyCreating) ? 0.6 : 1 }}>
                {keyCreating ? '...' : '+ צור מפתח'}
              </button>
            </div>

            {/* Show newly created key (once) */}
            {newKeyValue && (
              <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 6 }}>⚠ שמור את המפתח — לא יוצג שוב!</div>
                <code style={{ fontSize: 11, color: '#166534', wordBreak: 'break-all' }}>{newKeyValue}</code>
                <button onClick={() => { navigator.clipboard.writeText(newKeyValue); addToast('הועתק!', 'success'); }}
                  style={{ display: 'block', marginTop: 8, padding: '4px 12px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer' }}>
                  העתק
                </button>
              </div>
            )}

            {/* Keys list */}
            {apiKeysLoad && <Spinner />}
            {!apiKeysLoad && apiKeys.map(k => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9', opacity: k.is_active ? 1 : 0.5, flexWrap: 'wrap' }}>
                <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 4, fontSize: 11, color: '#4338ca', flexShrink: 0 }}>{k.key_prefix}...</code>
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{k.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {k.owner_name && `${k.owner_name} · `}
                    {k.last_used ? `שימוש אחרון: ${k.last_used.slice(0, 10)}` : 'טרם נוצל'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={async () => {
                    try { await apiKeysApi.toggle(k.id, !k.is_active); loadApiKeys(); } catch (err) { addToast(err.message, 'error'); }
                  }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, cursor: 'pointer', color: k.is_active ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
                    {k.is_active ? 'השבת' : 'הפעל'}
                  </button>
                  <button onClick={async () => {
                    if (!window.confirm('למחוק מפתח?')) return;
                    try { await apiKeysApi.remove(k.id); loadApiKeys(); } catch (err) { addToast(err.message, 'error'); }
                  }} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
            {!apiKeysLoad && apiKeys.length === 0 && (
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין מפתחות API</p>
            )}

            {/* Docs */}
            <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#64748b' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>נקודות API זמינות:</div>
              <ul style={{ margin: 0, paddingRight: 18, lineHeight: 2 }}>
                <li><code>GET /api/api-keys/public/time-entries</code> — רשימת דיווחים</li>
                <li><code>GET /api/api-keys/public/users</code> — רשימת משתמשים</li>
                <li><code>GET /api/api-keys/public/projects</code> — רשימת פרויקטים</li>
              </ul>
              <div style={{ marginTop: 6 }}>פרמטרים: <code>dateFrom</code>, <code>dateTo</code>, <code>userId</code>, <code>projectId</code>, <code>status</code></div>
            </div>
          </Card>
        </div>
      )}

      {/* ── ניהול משתמשים (אדמין) ── */}
      {mainTab === 'users' && isAdmin && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{users.length} משתמשים רשומים</span>
            <button onClick={() => setShowAddForm(v => !v)}
              style={{ padding: '8px 16px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {showAddForm ? 'ביטול' : '+ הוסף משתמש'}
            </button>
          </div>

          {showAddForm && (
            <Card style={{ marginBottom: 16, border: '2px solid #e0e7ff' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 14 }}>הוספת משתמש חדש</div>
              <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 180px' }}><label style={lbl}>שם מלא *</label><input value={newUser.fullName} onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))} style={inp} placeholder="ישראל ישראלי" /></div>
                  <div style={{ flex: '1 1 180px' }}><label style={lbl}>אימייל *</label><input type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="email@example.com" /></div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 180px' }}><label style={lbl}>סיסמה *</label><input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} style={inp} placeholder="••••••••" /></div>
                  <div style={{ flex: '1 1 120px' }}><label style={lbl}>צוות</label><input value={newUser.team} onChange={e => setNewUser(p => ({ ...p, team: e.target.value }))} style={inp} placeholder="פיתוח" /></div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={lbl}>תפקיד</label>
                    <select value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))} style={inp}>
                      <option value="employee">עובד</option>
                      <option value="manager">מנהל</option>
                      <option value="admin">אדמין</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={addSaving}
                  style={{ alignSelf: 'flex-start', padding: '9px 24px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: addSaving ? 0.7 : 1 }}>
                  {addSaving ? 'יוצר...' : 'צור משתמש'}
                </button>
              </form>
            </Card>
          )}

          <Card>
            {usersLoading && <Spinner />}
            {!usersLoading && users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9', opacity: u.is_active ? 1 : 0.5 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#6366f1', flexShrink: 0 }}>
                  {u.full_name?.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{u.full_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.email}</div>
                  {u.team && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{u.team}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <select
                    value={roleMap[u.id] || u.role}
                    onChange={e => setRoleMap(prev => ({ ...prev, [u.id]: e.target.value }))}
                    style={{ ...sel, fontSize: 12, color: ROLE_COLORS[roleMap[u.id] || u.role], fontWeight: 500 }}>
                    <option value="employee">עובד</option>
                    <option value="manager">מנהל</option>
                    <option value="admin">אדמין</option>
                  </select>
                  {roleMap[u.id] !== u.role && (
                    <button onClick={() => handleRoleChange(u.id)} disabled={savingId === u.id}
                      style={{ padding: '5px 12px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 500, opacity: savingId === u.id ? 0.7 : 1 }}>
                      {savingId === u.id ? '...' : 'שמור'}
                    </button>
                  )}
                  <button onClick={() => handleToggleActive(u)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, cursor: 'pointer', color: u.is_active ? '#dc2626' : '#16a34a', fontWeight: 500 }}>
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
