
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useAuth }        from '../context/AuthContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useReports }     from '../hooks/useReports';
import { useToast }       from '../context/ToastContext';
import { usersApi }       from '../api/users';
import { useProjects }    from '../hooks/useProjects';
import { integrationsApi } from '../api/integrations';
import { reportsApi }     from '../api/reports';
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
    if (expandId === id) { setExpandId(null); setDetail(null); return; }
    setExpandId(id);
    setDetail(null);
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

  // ── commits ──────────────────────────────────────────────────
  const [commits, setCommits] = useState([]);
  const [cLoad, setCLoad]     = useState(false);
  useEffect(() => {
    if (mainTab !== 'commits') return;
    setCLoad(true);
    integrationsApi.getCommits().then(setCommits).catch(() => {}).finally(() => setCLoad(false));
  }, [mainTab]);

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

  // ── helper renderers ─────────────────────────────────────────
  const renderDetailPanel = (row) => {
    if (expandId !== row.id) return null;
    return (
      <tr>
        <td colSpan={10} style={{ padding: 0, background: '#f8f7ff', borderBottom: '2px solid #e0e7ff' }}>
          {detailLoading && <div style={{ padding: 16 }}><Spinner /></div>}
          {detail && rType === 'byUser' && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[['projects', 'פרויקטים'], ['tasks', 'משימות'], ['daily', 'יומי']].map(([k, l]) => (
                  <button key={k} style={detailTabBtn(detailTab === k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'projects' && (
                detail.projects.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr><th style={th}>פרויקט</th><th style={th}>שעות</th><th style={th}>דיווחים</th></tr></thead>
                    <tbody>{detail.projects.map((p, i) => (
                      <tr key={i}><td style={td}>{p.project_name}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(p.total_hours)}</td><td style={{ ...td, color: '#94a3b8' }}>{p.entry_count}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין פרויקטים בטווח זה</p>
              )}
              {detailTab === 'tasks' && (
                detail.tasks.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr><th style={th}>משימה</th><th style={th}>פרויקט</th><th style={th}>שעות</th><th style={th}>דיווחים</th></tr></thead>
                    <tbody>{detail.tasks.map((t, i) => (
                      <tr key={i}><td style={td}>{t.task_name}</td><td style={{ ...td, color: '#64748b' }}>{t.project_name}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(t.total_hours)}</td><td style={{ ...td, color: '#94a3b8' }}>{t.entry_count}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין משימות בטווח זה</p>
              )}
              {detailTab === 'daily' && (
                detail.daily.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr><th style={th}>תאריך</th><th style={th}>שעות</th><th style={th}>דיווחים</th></tr></thead>
                    <tbody>{detail.daily.map((d, i) => (
                      <tr key={i}><td style={td}>{d.date}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(d.total_hours)}</td><td style={{ ...td, color: '#94a3b8' }}>{d.entry_count}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין נתונים יומיים בטווח זה</p>
              )}
            </div>
          )}
          {detail && rType === 'byProject' && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[['employees', 'עובדים'], ['tasks', 'משימות']].map(([k, l]) => (
                  <button key={k} style={detailTabBtn(detailTab === k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'employees' && (
                detail.employees.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr><th style={th}>עובד</th><th style={th}>צוות</th><th style={th}>שעות</th><th style={th}>דיווחים</th></tr></thead>
                    <tbody>{detail.employees.map((e, i) => (
                      <tr key={i}><td style={td}>{e.full_name}</td><td style={{ ...td, color: '#64748b' }}>{e.team || '—'}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(e.total_hours)}</td><td style={{ ...td, color: '#94a3b8' }}>{e.entry_count}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין עובדים בטווח זה</p>
              )}
              {detailTab === 'tasks' && (
                detail.tasks.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr><th style={th}>משימה</th><th style={th}>שעות</th><th style={th}>דיווחים</th></tr></thead>
                    <tbody>{detail.tasks.map((t, i) => (
                      <tr key={i}><td style={td}>{t.task_name}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(t.total_hours)}</td><td style={{ ...td, color: '#94a3b8' }}>{t.entry_count}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין משימות בטווח זה</p>
              )}
            </div>
          )}
          {detail && rType === 'byTask' && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[['employees', 'עובדים'], ['dates', 'תאריכי עבודה']].map(([k, l]) => (
                  <button key={k} style={detailTabBtn(detailTab === k)} onClick={() => setDetailTab(k)}>{l}</button>
                ))}
              </div>
              {detailTab === 'employees' && (
                detail.employees.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr><th style={th}>עובד</th><th style={th}>שעות</th><th style={th}>דיווחים</th></tr></thead>
                    <tbody>{detail.employees.map((e, i) => (
                      <tr key={i}><td style={td}>{e.full_name}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmtH(e.total_hours)}</td><td style={{ ...td, color: '#94a3b8' }}>{e.entry_count}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>אין עובדים בטווח זה</p>
              )}
              {detailTab === 'dates' && (
                detail.dates.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr><th style={th}>תאריך</th><th style={th}>עובד</th><th style={th}>שעות:דקות</th></tr></thead>
                    <tbody>{detail.dates.map((d, i) => (
                      <tr key={i}><td style={td}>{d.date}</td><td style={{ ...td, color: '#64748b' }}>{d.full_name}</td><td style={{ ...td, color: '#6366f1', fontWeight: 600 }}>{fmt(d.duration_minutes)}</td></tr>
                    ))}</tbody>
                  </table>
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
        <button style={tabBtn(mainTab === 'approvals')} onClick={() => setMainTab('approvals')}>✔ אישור דיווחים</button>
        <button style={tabBtn(mainTab === 'reports')}   onClick={() => setMainTab('reports')}>📊 דוחות</button>
        <button style={tabBtn(mainTab === 'commits')}   onClick={() => setMainTab('commits')}>🔗 חיבורי Git</button>
        {isAdmin && <button style={tabBtn(mainTab === 'users')} onClick={() => setMainTab('users')}>👥 ניהול משתמשים</button>}
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
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
              <span style={{ color: '#94a3b8', minWidth: 80 }}>{e.date}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{e.user_name}</div>
                <div style={{ color: '#64748b' }}>{e.project_name}</div>
              </div>
              <span style={{ fontWeight: 600, color: '#6366f1' }}>{fmt(e.duration_minutes)}</span>
              <Badge status={e.status} resubmitted={!!e.rejection_reason} />
              {(e.status === 'submitted' || e.status === 'draft') && (
                <div style={{ display: 'flex', gap: 5 }}>
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
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
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
              {!data.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין נתונים</p>}
            </div>
          )}

          {/* לפי פרויקט */}
          {!rLoading && Array.isArray(data) && rType === 'byProject' && (
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>לחץ על שורה לפירוט עובדים ומשימות</p>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
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
              {!data.length && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>אין נתונים</p>}
            </div>
          )}

          {/* לפי משימה */}
          {!rLoading && Array.isArray(data) && rType === 'byTask' && (
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>לחץ על שורה לפירוט עובדים ותאריכי עבודה</p>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
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
