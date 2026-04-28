
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }    from '../context/AuthContext';
import { useToast }   from '../context/ToastContext';
import { useProjects } from '../hooks/useProjects';
import { integrationsApi } from '../api/integrations';
import { clickupApi }      from '../api/clickup';
import { usersApi }        from '../api/users';
import Card    from '../components/common/Card';
import Spinner from '../components/common/Spinner';

// ── helpers ──────────────────────────────────────────────────────
const PROVIDERS = [
  { value: 'github',    label: 'GitHub' },
  { value: 'gitlab',    label: 'GitLab' },
  { value: 'bitbucket', label: 'Bitbucket' },
];
const CONF_COLORS = { high: '#10b981', medium: '#f59e0b', low: '#94a3b8' };
const CONF_LABELS = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' };
const PROV_ICON   = { github: '🐙', gitlab: '🦊', bitbucket: '🪣' };

function todayStr()      { return new Date().toISOString().slice(0, 10); }
function monthStartStr() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

// ── styles ────────────────────────────────────────────────────────
const sel = { border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px', fontSize:12, background:'#fff' };
const inp = { border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', fontSize:13, width:'100%', boxSizing:'border-box' };
const lbl = { fontSize:12, color:'#64748b', fontWeight:500, display:'block', marginBottom:4 };
const th  = { textAlign:'right', padding:'6px 8px', fontWeight:500, fontSize:11, color:'#94a3b8', borderBottom:'2px solid #f1f5f9' };
const td  = { padding:'9px 8px', fontSize:12, borderBottom:'1px solid #f8fafc' };
const tabBtn = (active) => ({
  padding:'8px 16px', borderRadius:8, border: active ? 'none' : '1px solid #e2e8f0',
  background: active ? '#6366f1' : '#fff', color: active ? '#fff' : '#64748b',
  fontSize:13, cursor:'pointer', fontWeight: active ? 500 : 400,
});

// ── CommitRow: single commit with expand for suggestions ──────────
function CommitRow({ commit, onLink, navigate }) {
  const [open, setOpen]         = useState(false);
  const [sugg, setSugg]         = useState(null);
  const [sLoad, setSLoad]       = useState(false);
  const [linking, setLinking]   = useState(false);
  const { addToast }            = useToast();

  const loadSuggestions = async () => {
    if (sugg) { setOpen(v => !v); return; }
    setOpen(true);
    setSLoad(true);
    try {
      const res = await integrationsApi.getCommitSuggestions(commit.id);
      setSugg(res.suggestions);
    } catch { setSugg([]); }
    finally { setSLoad(false); }
  };

  const handleLink = async (taskId) => {
    setLinking(true);
    try {
      await integrationsApi.linkCommit(commit.id, { taskId });
      addToast('המשימה שויכה לקומיט', 'success');
      onLink(commit.id, taskId);
      setOpen(false);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLinking(false); }
  };

  const isLinked = !!commit.linked_time_entry_id || !!commit.linked_task_id;

  return (
    <div style={{ borderBottom:'1px solid #f1f5f9' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', fontSize:12 }}>
        <code style={{ background:'#f1f5f9', padding:'3px 8px', borderRadius:4, fontSize:11, flexShrink:0, fontFamily:'monospace' }}>
          {commit.commit_hash?.slice(0, 7)}
        </code>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:500, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {commit.commit_message}
          </div>
          <div style={{ color:'#94a3b8', fontSize:11, marginTop:2 }}>
            {commit.repository}
            {commit.branch ? ` · ${commit.branch}` : ''}
            {commit.commit_date ? ` · ${commit.commit_date?.slice(0, 10)}` : ''}
          </div>
          {commit.task_name && (
            <div style={{ color:'#6366f1', fontSize:11, marginTop:1 }}>
              משימה: {commit.task_name}
            </div>
          )}
        </div>
        {commit.full_name && (
          <span style={{ color:'#64748b', whiteSpace:'nowrap', fontSize:11 }}>{commit.full_name}</span>
        )}
        {isLinked
          ? <span style={{ fontSize:11, color:'#10b981', fontWeight:500, whiteSpace:'nowrap' }}>✓ משויך</span>
          : (
            <button onClick={loadSuggestions}
              style={{ padding:'4px 10px', borderRadius:6, background:'#e0e7ff', color:'#4338ca', border:'none', fontSize:11, cursor:'pointer', fontWeight:500, whiteSpace:'nowrap' }}>
              {open ? '▲ סגור' : '▼ שייך משימה'}
            </button>
          )
        }
        <button
          onClick={() => navigate(`/report?date=${commit.commit_date?.slice(0,10)}&commitId=${commit.id}`)}
          style={{ padding:'4px 10px', borderRadius:6, background:'#f0fdf4', color:'#16a34a', border:'none', fontSize:11, cursor:'pointer', fontWeight:500, whiteSpace:'nowrap' }}>
          + דיווח
        </button>
      </div>

      {open && !isLinked && (
        <div style={{ margin:'0 0 10px 20px', padding:'10px 12px', background:'#f8f7ff', borderRadius:8, fontSize:12 }}>
          {sLoad && <Spinner />}
          {sugg && !sugg.length && <p style={{ color:'#94a3b8', margin:0 }}>לא נמצאו הצעות אוטומטיות</p>}
          {sugg && sugg.length > 0 && (
            <>
              <div style={{ fontWeight:500, color:'#4338ca', marginBottom:8 }}>הצעות משימה אוטומטיות:</div>
              {sugg.map(s => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #ede9fe' }}>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:500 }}>{s.task_name}</span>
                    {s.project_name && <span style={{ color:'#64748b' }}> · {s.project_name}</span>}
                    <span style={{ marginRight:8, fontSize:11, color:CONF_COLORS[s.confidence], fontWeight:600 }}>
                      [{CONF_LABELS[s.confidence]}]
                    </span>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{s.reason}</div>
                  </div>
                  <button onClick={() => handleLink(s.id)} disabled={linking}
                    style={{ padding:'4px 10px', borderRadius:6, background:'#6366f1', color:'#fff', border:'none', fontSize:11, cursor:'pointer', opacity:linking?0.7:1 }}>
                    שייך
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Repo Configs ─────────────────────────────────────────────
function RepoConfigsTab({ projects }) {
  const { addToast } = useToast();
  const [configs, setConfigs]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name:'', provider:'github', owner:'', repoName:'', token:'', projectId:'' });
  const [saving, setSaving]     = useState(false);
  const [fetchId, setFetchId]   = useState(null);
  const [fetchForm, setFF]      = useState({ dateFrom: monthStartStr(), dateTo: todayStr(), branch:'' });
  const [fetching, setFetching] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setConfigs(await integrationsApi.getRepoConfigs()); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.owner || !form.repoName) { addToast('owner ו-repo name נדרשים', 'error'); return; }
    setSaving(true);
    try {
      await integrationsApi.addRepoConfig({ ...form, repoName: form.repoName });
      addToast('מאגר נוסף', 'success');
      setForm({ name:'', provider:'github', owner:'', repoName:'', token:'', projectId:'' });
      setShowForm(false);
      load();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק את הגדרת המאגר?')) return;
    try { await integrationsApi.deleteRepoConfig(id); load(); addToast('נמחק', 'success'); }
    catch (err) { addToast(err.message, 'error'); }
  };

  const handleFetch = async (id) => {
    setFetching(id);
    try {
      const res = await integrationsApi.fetchRepo(id, fetchForm);
      addToast(`נמשכו ${res.saved} commits חדשים (${res.skipped} כפולים מדולגים)`, 'success');
      setFetchId(null);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setFetching(null); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <span style={{ fontSize:13, color:'#64748b' }}>
          הוסף כאן מאגרי Git כדי למשוך commits אוטומטית
        </span>
        <button onClick={() => setShowForm(v => !v)}
          style={{ padding:'8px 16px', borderRadius:8, background:'#6366f1', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>
          {showForm ? 'ביטול' : '+ הוסף מאגר'}
        </button>
      </div>

      {showForm && (
        <Card style={{ marginBottom:16, border:'2px solid #e0e7ff' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:12 }}>הוספת מאגר חדש</div>
          <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 140px' }}>
                <label style={lbl}>ספק</label>
                <select value={form.provider} onChange={e=>setForm(p=>({...p,provider:e.target.value}))} style={inp}>
                  {PROVIDERS.map(pr => <option key={pr.value} value={pr.value}>{pr.label}</option>)}
                </select>
              </div>
              <div style={{ flex:'2 1 180px' }}>
                <label style={lbl}>שם תצוגה (אופציונלי)</label>
                <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={inp} placeholder="My Repo" />
              </div>
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 160px' }}>
                <label style={lbl}>Owner / Organization *</label>
                <input value={form.owner} onChange={e=>setForm(p=>({...p,owner:e.target.value}))} style={inp} placeholder="my-org" required />
              </div>
              <div style={{ flex:'1 1 160px' }}>
                <label style={lbl}>Repository Name *</label>
                <input value={form.repoName} onChange={e=>setForm(p=>({...p,repoName:e.target.value}))} style={inp} placeholder="my-repo" required />
              </div>
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:'2 1 220px' }}>
                <label style={lbl}>
                  Access Token
                  <span style={{ fontWeight:400, color:'#94a3b8', marginRight:4 }}>
                    (נדרש למאגרים פרטיים)
                  </span>
                </label>
                <input type="password" value={form.token} onChange={e=>setForm(p=>({...p,token:e.target.value}))} style={inp} placeholder="ghp_..." />
              </div>
              <div style={{ flex:'1 1 160px' }}>
                <label style={lbl}>פרויקט קשור</label>
                <select value={form.projectId} onChange={e=>setForm(p=>({...p,projectId:e.target.value}))} style={inp}>
                  <option value="">ללא</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={saving}
              style={{ alignSelf:'flex-start', padding:'9px 24px', borderRadius:8, background:'#6366f1', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer', opacity:saving?0.7:1 }}>
              {saving ? 'שומר...' : 'הוסף מאגר'}
            </button>
          </form>
        </Card>
      )}

      <Card>
        {loading && <Spinner />}
        {!loading && !configs.length && (
          <p style={{ color:'#94a3b8', textAlign:'center', padding:30 }}>
            אין מאגרים מוגדרים עדיין
          </p>
        )}
        {configs.map(cfg => (
          <div key={cfg.id} style={{ padding:'12px 0', borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>{PROV_ICON[cfg.provider] || '📦'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{cfg.name}</div>
                <div style={{ fontSize:11, color:'#94a3b8' }}>
                  {cfg.owner}/{cfg.repo_name}
                  {cfg.project_name ? ` · פרויקט: ${cfg.project_name}` : ''}
                  {cfg.has_token ? ' · 🔑 token מוגדר' : ' · ללא token (ציבורי)'}
                </div>
              </div>
              <button onClick={() => setFetchId(fetchId === cfg.id ? null : cfg.id)}
                style={{ padding:'5px 12px', borderRadius:6, background:'#e0e7ff', color:'#4338ca', border:'none', fontSize:12, cursor:'pointer', fontWeight:500 }}>
                {fetchId === cfg.id ? 'ביטול' : '⬇ משוך commits'}
              </button>
              <button onClick={() => handleDelete(cfg.id)}
                style={{ padding:'5px 10px', borderRadius:6, background:'#fee2e2', color:'#991b1b', border:'none', fontSize:12, cursor:'pointer' }}>
                מחק
              </button>
            </div>

            {fetchId === cfg.id && (
              <div style={{ marginTop:10, padding:'10px 12px', background:'#f8fafc', borderRadius:8, display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div>
                  <label style={lbl}>מתאריך</label>
                  <input type="date" value={fetchForm.dateFrom} onChange={e=>setFF(p=>({...p,dateFrom:e.target.value}))} style={sel} />
                </div>
                <div>
                  <label style={lbl}>עד תאריך</label>
                  <input type="date" value={fetchForm.dateTo} onChange={e=>setFF(p=>({...p,dateTo:e.target.value}))} style={sel} />
                </div>
                <div>
                  <label style={lbl}>branch (אופציונלי)</label>
                  <input value={fetchForm.branch} onChange={e=>setFF(p=>({...p,branch:e.target.value}))} style={{ ...sel, width:120 }} placeholder="main" />
                </div>
                <button onClick={() => handleFetch(cfg.id)} disabled={!!fetching}
                  style={{ padding:'7px 16px', borderRadius:8, background:'#6366f1', color:'#fff', border:'none', fontSize:12, cursor:'pointer', fontWeight:500, opacity:fetching?0.7:1 }}>
                  {fetching === cfg.id ? 'מושך...' : 'משוך'}
                </button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Tab: My Commits ───────────────────────────────────────────────
function MyCommitsTab({ userId }) {
  const navigate     = useNavigate();
  const { addToast } = useToast();
  const [commits, setCommits]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [dateFrom, setDateFrom] = useState(monthStartStr());
  const [dateTo,   setDateTo]   = useState(todayStr());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await integrationsApi.getCommits({ userId, dateFrom, dateTo });
      setCommits(data);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [userId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleLink = (commitId, taskId) => {
    setCommits(prev => prev.map(c => c.id === commitId ? { ...c, linked_task_id: taskId } : c));
  };

  const unlinked = commits.filter(c => !c.linked_time_entry_id && !c.linked_task_id);
  const linked   = commits.filter(c => c.linked_time_entry_id || c.linked_task_id);

  return (
    <div>
      <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#92400e' }}>
        ℹ️ commits הם <strong>כלי תומך בלבד</strong> — לא תחליף לדיווח שעות. לא כל עבודה מתבטאת בקומיט.
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:'#64748b' }}>טווח:</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={sel} />
        <span style={{ fontSize:12, color:'#94a3b8' }}>עד</span>
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={sel} />
      </div>

      {loading && <Spinner />}

      {!loading && !commits.length && (
        <Card><p style={{ color:'#94a3b8', textAlign:'center', padding:30 }}>אין commits בטווח זה — ודא שהאימייל שלך משויך לקומיטים</p></Card>
      )}

      {!loading && unlinked.length > 0 && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#dc2626', marginBottom:8 }}>
            ⚠ {unlinked.length} commits ללא שיוך לדיווח שעות
          </div>
          {unlinked.map(c => (
            <CommitRow key={c.id} commit={c} onLink={handleLink} navigate={navigate} />
          ))}
        </Card>
      )}

      {!loading && linked.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:500, color:'#10b981', marginBottom:8 }}>
            ✓ {linked.length} commits משויכים
          </div>
          {linked.map(c => (
            <CommitRow key={c.id} commit={c} onLink={handleLink} navigate={navigate} />
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Tab: All Commits (manager) ────────────────────────────────────
function AllCommitsTab({ allUsers }) {
  const navigate     = useNavigate();
  const { addToast } = useToast();
  const [commits, setCommits]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [userId,  setUserId]      = useState('');
  const [dateFrom, setDateFrom]   = useState(monthStartStr());
  const [dateTo,   setDateTo]     = useState(todayStr());
  const [linked,   setLinked]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (userId)   params.userId   = userId;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo)   params.dateTo   = dateTo;
    if (linked)   params.linked   = linked;
    try { setCommits(await integrationsApi.getCommits(params)); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [userId, dateFrom, dateTo, linked]);

  useEffect(() => { load(); }, [load]);

  const handleLink = (commitId, taskId) => {
    setCommits(prev => prev.map(c => c.id === commitId ? { ...c, linked_task_id: taskId } : c));
  };

  const unlinkedCount = commits.filter(c => !c.linked_time_entry_id && !c.linked_task_id).length;

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', padding:'10px 12px', background:'#f8fafc', borderRadius:8 }}>
        <select value={userId} onChange={e=>setUserId(e.target.value)} style={sel}>
          <option value="">כל העובדים</option>
          {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={sel} />
        <span style={{ fontSize:12, color:'#94a3b8', alignSelf:'center' }}>עד</span>
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={sel} />
        <select value={linked} onChange={e=>setLinked(e.target.value)} style={sel}>
          <option value="">כל הקומיטים</option>
          <option value="true">משויכים בלבד</option>
          <option value="false">לא משויכים</option>
        </select>
      </div>

      {unlinkedCount > 0 && (
        <div style={{ background:'#fee2e2', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#991b1b' }}>
          ⚠ {unlinkedCount} commits ללא שיוך לדיווח שעות
        </div>
      )}

      {loading && <Spinner />}
      <Card>
        {!loading && !commits.length && (
          <p style={{ color:'#94a3b8', textAlign:'center', padding:30 }}>אין commits בטווח זה</p>
        )}
        {commits.map(c => (
          <CommitRow key={c.id} commit={c} onLink={handleLink} navigate={navigate} />
        ))}
      </Card>
    </div>
  );
}

// ── Tab: Gaps ─────────────────────────────────────────────────────
function GapsTab() {
  const { addToast } = useToast();
  const [gaps,    setGaps]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(monthStartStr());
  const [dateTo,   setDateTo]   = useState(todayStr());

  const load = useCallback(async () => {
    setLoading(true);
    try { setGaps(await integrationsApi.getGaps({ dateFrom, dateTo })); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#0369a1' }}>
        ℹ️ כאן מוצגים ימים שבהם לעובד יש commits אבל <strong>אין דיווח שעות</strong> — ייתכן שיש עבודה שלא דווחה.
      </div>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:'#64748b' }}>טווח:</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={sel} />
        <span style={{ fontSize:12, color:'#94a3b8' }}>עד</span>
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={sel} />
      </div>

      {loading && <Spinner />}

      <Card>
        {!loading && !gaps.length && (
          <p style={{ color:'#10b981', textAlign:'center', padding:30 }}>
            ✓ אין פערים בטווח זה — כל הימים עם commits מכוסים בדיווחי שעות
          </p>
        )}
        {!loading && gaps.length > 0 && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['עובד', 'צוות', 'תאריך', 'מספר commits', 'מאגרים'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gaps.map((g, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight:500 }}>{g.full_name}</td>
                  <td style={{ ...td, color:'#64748b' }}>{g.team || '—'}</td>
                  <td style={{ ...td, color:'#dc2626', fontWeight:500 }}>{g.commit_day}</td>
                  <td style={{ ...td, color:'#64748b' }}>{g.commit_count}</td>
                  <td style={{ ...td, color:'#94a3b8', fontSize:11 }}>{g.repositories}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── Tab: ClickUp ──────────────────────────────────────────────────
const STATUS_COLORS = {
  'to do': '#94a3b8', 'in progress': '#6366f1', 'done': '#10b981',
  'closed': '#64748b', 'review': '#f59e0b',
};
const PRIORITY_COLORS = { urgent: '#dc2626', high: '#ef4444', normal: '#6366f1', low: '#94a3b8' };

function ClickUpTab() {
  const { addToast } = useToast();

  // config
  const [config,      setConfig]      = useState(null);
  const [configLoad,  setConfigLoad]  = useState(true);
  const [apiKey,      setApiKey]      = useState('');
  const [saving,      setSaving]      = useState(false);

  // navigation: teams → spaces → lists
  const [teams,       setTeams]       = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [spaces,      setSpaces]      = useState([]);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [lists,       setLists]       = useState([]);
  const [listsLoad,   setListsLoad]   = useState(false);
  const [syncing,     setSyncing]     = useState(null); // listId or 'space'

  // synced tasks
  const [tasks,       setTasks]       = useState([]);
  const [tasksLoad,   setTasksLoad]   = useState(false);
  const [search,      setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadConfig = useCallback(async () => {
    setConfigLoad(true);
    try {
      const cfg = await clickupApi.getConfig();
      setConfig(cfg);
      if (cfg) {
        const teams = await clickupApi.getTeams();
        setTeams(teams);
        if (cfg.team_id) {
          setSelectedTeam(cfg.team_id);
          const spaces = await clickupApi.getSpaces(cfg.team_id);
          setSpaces(spaces);
        }
      }
    } catch { setConfig(null); }
    finally { setConfigLoad(false); }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const loadTasks = useCallback(async () => {
    setTasksLoad(true);
    try {
      const params = {};
      if (search)       params.search = search;
      if (filterStatus) params.status = filterStatus;
      setTasks(await clickupApi.getTasks(params));
    } catch (err) { addToast(err.message, 'error'); }
    finally { setTasksLoad(false); }
  }, [search, filterStatus]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) { addToast('נא להזין API Key', 'error'); return; }
    setSaving(true);
    try {
      const cfg = await clickupApi.saveConfig({ apiKey: apiKey.trim(), teamId: selectedTeam || undefined });
      setConfig(cfg);
      setApiKey('');
      addToast('ClickUp מחובר בהצלחה', 'success');
      loadConfig();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteConfig = async () => {
    if (!window.confirm('לנתק את ClickUp?')) return;
    try {
      await clickupApi.deleteConfig();
      setConfig(null); setTeams([]); setSpaces([]); setLists([]);
      addToast('ClickUp נותק', 'success');
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleSelectTeam = async (teamId) => {
    setSelectedTeam(teamId);
    setSpaces([]); setSelectedSpace(''); setLists([]);
    if (!teamId) return;
    try {
      setSpaces(await clickupApi.getSpaces(teamId));
    } catch (err) { addToast(err.message, 'error'); }
  };

  const handleSelectSpace = async (spaceId) => {
    setSelectedSpace(spaceId);
    setLists([]);
    if (!spaceId) return;
    setListsLoad(true);
    try { setLists(await clickupApi.getLists(spaceId)); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setListsLoad(false); }
  };

  const handleSyncSpace = async () => {
    if (!selectedSpace) return;
    setSyncing('space');
    try {
      const res = await clickupApi.syncSpace(selectedSpace);
      addToast(`סונכרנו ${res.saved} משימות מ-${res.lists} רשימות`, 'success');
      loadTasks();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSyncing(null); }
  };

  const handleSyncList = async (listId) => {
    setSyncing(listId);
    try {
      const res = await clickupApi.syncList(listId);
      addToast(`סונכרנו ${res.saved} משימות מ-"${res.listName}"`, 'success');
      loadTasks();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSyncing(null); }
  };

  const allStatuses = [...new Set(tasks.map(t => t.status).filter(Boolean))];

  if (configLoad) return <Spinner />;

  return (
    <div>
      {/* ── הגדרת חיבור ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
          🔗 חיבור ל-ClickUp
        </div>
        {!config ? (
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              צור Personal API Token ב-ClickUp: Settings → Apps → API Token
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="pk_xxxxxxxxxxxxxxxx"
                style={{ ...inp, flex: '1 1 260px' }}
              />
              <button type="submit" disabled={saving}
                style={{ padding: '8px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'מתחבר...' : 'התחבר'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ ClickUp מחובר</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>עודכן {config.updated_at?.slice(0, 10)}</span>
            <button onClick={handleDeleteConfig}
              style={{ padding: '5px 12px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', border: 'none', fontSize: 12, cursor: 'pointer' }}>
              נתק
            </button>
          </div>
        )}
      </Card>

      {/* ── בחירת צוות + מרחב + סנכרון ── */}
      {config && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>⬇ סנכרון משימות</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <label style={lbl}>צוות (Workspace)</label>
              <select value={selectedTeam} onChange={e => handleSelectTeam(e.target.value)} style={sel}>
                <option value="">בחר צוות</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {spaces.length > 0 && (
              <div>
                <label style={lbl}>מרחב (Space)</label>
                <select value={selectedSpace} onChange={e => handleSelectSpace(e.target.value)} style={sel}>
                  <option value="">בחר מרחב</option>
                  {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {selectedSpace && (
              <div style={{ alignSelf: 'flex-end' }}>
                <button onClick={handleSyncSpace} disabled={!!syncing}
                  style={{ padding: '7px 16px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: syncing ? 0.7 : 1 }}>
                  {syncing === 'space' ? 'מסנכרן...' : '⬇ סנכרן כל המרחב'}
                </button>
              </div>
            )}
          </div>

          {listsLoad && <Spinner />}
          {lists.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>רשימות במרחב — לחץ לסנכרן רשימה ספציפית:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {lists.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12 }}>
                    <span style={{ color: '#334155' }}>{l.name}</span>
                    {l.folder && <span style={{ color: '#94a3b8', fontSize: 11 }}>({l.folder})</span>}
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{l.task_count} משימות</span>
                    <button onClick={() => handleSyncList(l.id)} disabled={!!syncing}
                      style={{ padding: '2px 8px', borderRadius: 4, background: '#e0e7ff', color: '#4338ca', border: 'none', fontSize: 11, cursor: 'pointer', opacity: syncing ? 0.7 : 1 }}>
                      {syncing === l.id ? '...' : 'סנכרן'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── משימות מסונכרנות ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
            📋 משימות מסונכרנות ({tasks.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש משימה..."
              style={{ ...sel, width: 180 }}
            />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
              <option value="">כל הסטטוסים</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {tasksLoad && <Spinner />}
        {!tasksLoad && !tasks.length && (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 30, fontSize: 12 }}>
            {config ? 'אין משימות — בצע סנכרון כדי למשוך משימות מ-ClickUp' : 'חבר את ClickUp כדי לראות משימות'}
          </p>
        )}
        {!tasksLoad && tasks.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['משימה', 'רשימה', 'סטטוס', 'עדיפות', 'אחראי', 'זמן מוערך', 'תאריך יעד'].map(h => (
                  <th key={h} style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 500, fontSize: 11, color: '#94a3b8', borderBottom: '2px solid #f1f5f9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.clickup_task_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '8px', fontWeight: 500, color: '#1e293b' }}>
                    {t.clickup_url
                      ? <a href={t.clickup_url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none' }}>{t.task_name}</a>
                      : t.task_name}
                    <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{t.clickup_task_id}</div>
                  </td>
                  <td style={{ padding: '8px', color: '#64748b' }}>{t.list_name || '—'}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: (STATUS_COLORS[t.status] || '#94a3b8') + '20', color: STATUS_COLORS[t.status] || '#94a3b8', fontWeight: 500 }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: PRIORITY_COLORS[t.priority] || '#64748b', fontSize: 11 }}>
                    {t.priority || '—'}
                  </td>
                  <td style={{ padding: '8px', color: '#64748b' }}>{t.assigned_user_name || t.assignee_email || '—'}</td>
                  <td style={{ padding: '8px', color: '#64748b' }}>
                    {t.estimated_time ? `${Math.round(t.estimated_time / 60)}ש'` : '—'}
                  </td>
                  <td style={{ padding: '8px', color: t.due_date && new Date(t.due_date) < new Date() ? '#ef4444' : '#64748b' }}>
                    {t.due_date || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── Tab: Sync Status ──────────────────────────────────────────────
function StatusTab() {
  const { addToast }          = useToast();
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    clickupApi.getStatus()
      .then(setStatus)
      .catch(err => addToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const StatCard = ({ title, icon, items, ok }) => (
    <Card style={{ flex:'1 1 280px', minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <span style={{ fontSize:14, fontWeight:600, color:'#1e293b' }}>{title}</span>
        <span style={{
          marginRight:'auto', fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:12,
          background: ok ? '#d1fae5' : '#fee2e2',
          color:       ok ? '#065f46' : '#991b1b',
        }}>
          {ok ? '✓ פעיל' : '✗ לא מחובר'}
        </span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {items.map(({ label, value, warn }) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}>
            <span style={{ color:'#64748b' }}>{label}</span>
            <span style={{ fontWeight:600, color: warn ? '#dc2626' : '#1e293b' }}>{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );

  if (loading) return <Spinner />;
  if (!status) return null;

  const { git, clickup } = status;
  const gitUnlinked = git.totalCommits - git.linkedCommits;

  return (
    <div>
      <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:12, color:'#0369a1' }}>
        ℹ️ מצב סנכרון נכון לרגע זה — לחץ רענון לעדכון.
        <button onClick={() => {
          setLoading(true);
          clickupApi.getStatus().then(setStatus).catch(() => {}).finally(() => setLoading(false));
        }} style={{ marginRight:10, padding:'2px 10px', borderRadius:6, background:'#e0f2fe', color:'#0369a1', border:'none', fontSize:11, cursor:'pointer' }}>
          רענן
        </button>
      </div>

      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <StatCard
          title="Git"
          icon="🐙"
          ok={git.repoCount > 0}
          items={[
            { label: 'מאגרים מוגדרים',   value: git.repoCount },
            { label: 'סה"כ commits',       value: git.totalCommits },
            { label: 'commits משויכים',    value: git.linkedCommits },
            { label: 'commits ללא שיוך',  value: gitUnlinked, warn: gitUnlinked > 0 },
            { label: 'סנכרון אחרון',       value: git.lastSync ? new Date(git.lastSync).toLocaleString('he-IL') : '—' },
          ]}
        />
        <StatCard
          title="ClickUp"
          icon="📋"
          ok={clickup.connected}
          items={[
            { label: 'חיבור',              value: clickup.connected ? 'מחובר' : 'לא מחובר', warn: !clickup.connected },
            { label: 'סה"כ משימות',         value: clickup.totalTasks },
            { label: 'משימות פתוחות',       value: clickup.openTasks },
            { label: 'סנכרון אחרון',        value: clickup.lastSync ? new Date(clickup.lastSync).toLocaleString('he-IL') : '—' },
          ]}
        />
      </div>
    </div>
  );
}

// ── Tab: Mapping ──────────────────────────────────────────────────
function MappingTab({ projects: sysProjects }) {
  const { addToast } = useToast();

  // users mapping
  const [userMap,   setUserMap]   = useState(null);
  const [uLoad,     setULoad]     = useState(true);
  const [uSaving,   setUSaving]   = useState(null); // email being saved

  // projects mapping
  const [projMap,   setProjMap]   = useState(null);
  const [pLoad,     setPLoad]     = useState(true);
  const [pSaving,   setPSaving]   = useState(null); // listId being saved

  const loadUserMap = useCallback(async () => {
    setULoad(true);
    try { setUserMap(await clickupApi.getMappingUsers()); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setULoad(false); }
  }, []);

  const loadProjMap = useCallback(async () => {
    setPLoad(true);
    try { setProjMap(await clickupApi.getMappingProjects()); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setPLoad(false); }
  }, []);

  useEffect(() => { loadUserMap(); loadProjMap(); }, [loadUserMap, loadProjMap]);

  const handleUserChange = async (email, userId) => {
    setUSaving(email);
    try {
      await clickupApi.saveMappingUser({ email, userId: userId || null });
      setUserMap(prev => ({
        ...prev,
        mappings: prev.mappings.map(m =>
          m.assignee_email === email
            ? { ...m, assigned_user_id: userId || null, full_name: prev.users.find(u => u.id == userId)?.full_name || null }
            : m
        ),
      }));
      addToast('מיפוי עודכן', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setUSaving(null); }
  };

  const handleProjChange = async (listId, projectId) => {
    setPSaving(listId);
    try {
      await clickupApi.saveMappingProject({ listId, projectId: projectId || null });
      setProjMap(prev => ({
        ...prev,
        mappings: prev.mappings.map(m =>
          m.list_id === listId
            ? { ...m, project_id: projectId || null, project_name: prev.projects.find(p => p.id == projectId)?.project_name || null }
            : m
        ),
      }));
      addToast('מיפוי עודכן', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setPSaving(null); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* User mapping */}
      <Card>
        <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:4 }}>👤 מיפוי משתמשים — ClickUp ↔ מערכת</div>
        <p style={{ fontSize:12, color:'#64748b', margin:'0 0 12px' }}>
          קבע לאיזה משתמש מערכת שייך כל כתובת אימייל של ClickUp. שינוי ישפיע על כל המשימות המשויכות לאימייל זה.
        </p>
        {uLoad && <Spinner />}
        {!uLoad && (!userMap?.mappings?.length) && (
          <p style={{ color:'#94a3b8', textAlign:'center', padding:20, fontSize:12 }}>
            אין נתוני אימייל ב-ClickUp — בצע סנכרון משימות תחילה
          </p>
        )}
        {!uLoad && userMap?.mappings?.length > 0 && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['אימייל ב-ClickUp', 'משתמש במערכת', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userMap.mappings.map(m => (
                <tr key={m.assignee_email}>
                  <td style={td}>
                    <span style={{ fontFamily:'monospace', fontSize:11 }}>{m.assignee_email}</span>
                    {!m.assigned_user_id && (
                      <span style={{ marginRight:6, fontSize:10, color:'#dc2626', fontWeight:600 }}>⚠ לא משויך</span>
                    )}
                  </td>
                  <td style={td}>
                    <select
                      value={m.assigned_user_id || ''}
                      onChange={e => handleUserChange(m.assignee_email, e.target.value)}
                      disabled={uSaving === m.assignee_email}
                      style={{ ...sel, minWidth:160 }}
                    >
                      <option value="">— ללא שיוך —</option>
                      {userMap.users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    {uSaving === m.assignee_email && <Spinner />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Project mapping */}
      <Card>
        <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:4 }}>📁 מיפוי רשימות — ClickUp ↔ פרויקט</div>
        <p style={{ fontSize:12, color:'#64748b', margin:'0 0 12px' }}>
          קבע לאיזה פרויקט במערכת שייכת כל רשימת ClickUp. שינוי ישפיע על כל המשימות ברשימה זו.
        </p>
        {pLoad && <Spinner />}
        {!pLoad && (!projMap?.mappings?.length) && (
          <p style={{ color:'#94a3b8', textAlign:'center', padding:20, fontSize:12 }}>
            אין רשימות מסונכרנות — בצע סנכרון משימות תחילה
          </p>
        )}
        {!pLoad && projMap?.mappings?.length > 0 && (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['רשימה ב-ClickUp', 'פרויקט במערכת', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projMap.mappings.map(m => (
                <tr key={m.list_id}>
                  <td style={td}>
                    <div style={{ fontWeight:500 }}>{m.list_name || m.list_id}</div>
                    <div style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>{m.list_id}</div>
                  </td>
                  <td style={td}>
                    <select
                      value={m.project_id || ''}
                      onChange={e => handleProjChange(m.list_id, e.target.value)}
                      disabled={pSaving === m.list_id}
                      style={{ ...sel, minWidth:180 }}
                    >
                      <option value="">— ללא שיוך —</option>
                      {(projMap.projects || sysProjects || []).map(p => (
                        <option key={p.id} value={p.id}>{p.project_name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    {pSaving === m.list_id && <Spinner />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const { user }     = useAuth();
  const isManager    = ['manager','admin'].includes(user?.role);
  const { projects } = useProjects();

  const [tab,      setTab]      = useState('my-commits');
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (isManager) usersApi.list().then(setAllUsers).catch(() => {});
  }, [isManager]);

  const tabs = [
    { key:'my-commits', label:'Commits שלי' },
    { key:'status',     label:'📊 סטטוס סנכרון' },
    ...(isManager ? [
      { key:'all-commits', label:'כל ה-Commits' },
      { key:'gaps',        label:'🔍 פערים' },
      { key:'repos',       label:'⚙ מאגרי Git' },
      { key:'clickup',     label:'📋 ClickUp' },
      { key:'mapping',     label:'🗺 מיפוי' },
    ] : []),
  ];

  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:4, color:'#1e293b' }}>אינטגרציות</h2>
      <p style={{ fontSize:12, color:'#94a3b8', marginBottom:20 }}>
        Git (GitHub / GitLab / Bitbucket) · ClickUp
      </p>

      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} style={tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'my-commits'  && <MyCommitsTab  userId={user?.id} />}
      {tab === 'status'      && <StatusTab />}
      {tab === 'all-commits' && isManager && <AllCommitsTab allUsers={allUsers} />}
      {tab === 'gaps'        && isManager && <GapsTab />}
      {tab === 'repos'       && isManager && <RepoConfigsTab projects={projects} />}
      {tab === 'clickup'     && isManager && <ClickUpTab />}
      {tab === 'mapping'     && isManager && <MappingTab projects={projects} />}
    </div>
  );
}
