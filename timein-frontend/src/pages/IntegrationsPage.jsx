
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }    from '../context/AuthContext';
import { useToast }   from '../context/ToastContext';
import { useProjects } from '../hooks/useProjects';
import { integrationsApi } from '../api/integrations';
import { clickupApi }      from '../api/clickup';
import { usersApi }        from '../api/users';
import { T }               from '../theme';
import Card    from '../components/common/Card';
import Spinner from '../components/common/Spinner';

// ── helpers ───────────────────────────────────────────────────────
const PROVIDERS = [
  { value: 'github',    label: 'GitHub' },
  { value: 'gitlab',    label: 'GitLab' },
  { value: 'bitbucket', label: 'Bitbucket' },
];
const CONF_COLORS = { high: T.success, medium: T.warning, low: T.textFaint };
const CONF_LABELS = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' };

function todayStr()      { return new Date().toISOString().slice(0, 10); }
function monthStartStr() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

// ── SVG icon engine ───────────────────────────────────────────────
const Ic = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display:'block', flexShrink:0 }}>
    {children}
  </svg>
);
const IcGit      = ({ s=16 }) => <Ic size={s}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></Ic>;
const IcLink     = ({ s=16 }) => <Ic size={s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Ic>;
const IcCheck    = ({ s=16 }) => <Ic size={s}><polyline points="20 6 9 17 4 12"/></Ic>;
const IcWarn     = ({ s=16 }) => <Ic size={s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></Ic>;
const IcSettings = ({ s=16 }) => <Ic size={s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Ic>;
const IcActivity = ({ s=16 }) => <Ic size={s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ic>;
const IcSearch   = ({ s=16 }) => <Ic size={s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Ic>;
const IcUsers    = ({ s=16 }) => <Ic size={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Ic>;
const IcMap      = ({ s=16 }) => <Ic size={s}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></Ic>;
const IcList     = ({ s=16 }) => <Ic size={s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></Ic>;
const IcReport   = ({ s=16 }) => <Ic size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></Ic>;

// ── Shared style helpers (all from theme) ─────────────────────────
const sel = {
  border:`1px solid ${T.border}`, borderRadius: T.radiusSm,
  padding:'7px 10px', fontSize:12, background: T.surface, color: T.text,
  fontFamily:'inherit',
};
const inp = {
  border:`1px solid ${T.border}`, borderRadius: T.radius,
  padding:'8px 12px', fontSize:13, width:'100%', boxSizing:'border-box',
  background: T.surface, color: T.text, fontFamily:'inherit',
};
const lbl = { fontSize:11, color: T.textSub, fontWeight:600, display:'block', marginBottom:4, letterSpacing:'0.03em', textTransform:'uppercase' };
const th  = { textAlign:'right', padding:'8px 10px', fontWeight:600, fontSize:10, color: T.textFaint, borderBottom:`2px solid ${T.borderLight}`, letterSpacing:'0.06em', textTransform:'uppercase' };
const td  = { padding:'10px 10px', fontSize:12, borderBottom:`1px solid ${T.borderLight}` };

function SectionLabel({ icon, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
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

function InfoBanner({ color = 'blue', children }) {
  const colors = {
    blue:   { bg: T.primaryLight,  border: T.primaryBorder, text: T.primary },
    yellow: { bg: T.warningBg,     border: T.warningBorder, text: T.warning },
    red:    { bg: T.errorBg,       border: T.errorBorder,   text: T.error },
  };
  const c = colors[color] || colors.blue;
  return (
    <div style={{ background: c.bg, border:`1px solid ${c.border}`, borderRadius: T.radius, padding:'10px 14px', marginBottom:16, fontSize:12, color: c.text, display:'flex', gap:8, alignItems:'flex-start' }}>
      <span style={{ flexShrink:0, marginTop:1 }}><IcWarn s={13}/></span>
      <span>{children}</span>
    </div>
  );
}

// ── CommitRow ─────────────────────────────────────────────────────
function CommitRow({ commit, onLink, navigate }) {
  const [open, setOpen]       = useState(false);
  const [sugg, setSugg]       = useState(null);
  const [sLoad, setSLoad]     = useState(false);
  const [linking, setLinking] = useState(false);
  const { addToast }          = useToast();

  const loadSuggestions = async () => {
    if (sugg) { setOpen(v => !v); return; }
    setOpen(true); setSLoad(true);
    try { const res = await integrationsApi.getCommitSuggestions(commit.id); setSugg(res.suggestions); }
    catch { setSugg([]); }
    finally { setSLoad(false); }
  };

  const handleLink = async (taskId) => {
    setLinking(true);
    try {
      await integrationsApi.linkCommit(commit.id, { taskId });
      addToast('המשימה שויכה לקומיט', 'success');
      onLink(commit.id, taskId); setOpen(false);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setLinking(false); }
  };

  const isLinked = !!commit.linked_time_entry_id || !!commit.linked_task_id;

  return (
    <div style={{ borderBottom:`1px solid ${T.borderLight}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 0', fontSize:12 }}>
        <code style={{ background: T.primaryMid, padding:'3px 8px', borderRadius:5, fontSize:10, flexShrink:0, fontFamily:'monospace', color: T.primary, fontWeight:700 }}>
          {commit.commit_hash?.slice(0, 7)}
        </code>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, color: T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {commit.commit_message}
          </div>
          <div style={{ color: T.textFaint, fontSize:11, marginTop:2 }}>
            {commit.repository}{commit.branch ? ` · ${commit.branch}` : ''}{commit.commit_date ? ` · ${commit.commit_date?.slice(0, 10)}` : ''}
          </div>
          {commit.task_name && (
            <div style={{ color: T.accent, fontSize:11, marginTop:1 }}>משימה: {commit.task_name}</div>
          )}
        </div>
        {commit.full_name && (
          <span style={{ color: T.textSub, whiteSpace:'nowrap', fontSize:11 }}>{commit.full_name}</span>
        )}
        {isLinked
          ? <span style={{ fontSize:11, color: T.success, fontWeight:600, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}><IcCheck s={12}/> משויך</span>
          : (
            <button onClick={loadSuggestions} style={{ padding:'4px 10px', borderRadius: T.radiusSm, background: T.primaryMid, color: T.primary, border:'none', fontSize:11, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', fontFamily:'inherit' }}>
              {open ? '▲ סגור' : '▼ שייך'}
            </button>
          )
        }
        <button
          onClick={() => navigate(`/report?date=${commit.commit_date?.slice(0,10)}&commitId=${commit.id}`)}
          style={{ padding:'4px 10px', borderRadius: T.radiusSm, background: T.successBg, color: T.success, border:'none', fontSize:11, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', fontFamily:'inherit' }}>
          + דיווח
        </button>
      </div>

      {open && !isLinked && (
        <div style={{ margin:'0 0 10px 20px', padding:'12px 14px', background: T.primaryLight, borderRadius: T.radius, fontSize:12 }}>
          {sLoad && <Spinner />}
          {sugg && !sugg.length && <p style={{ color: T.textFaint, margin:0 }}>לא נמצאו הצעות אוטומטיות</p>}
          {sugg && sugg.length > 0 && (
            <>
              <div style={{ fontWeight:700, color: T.primary, marginBottom:8 }}>הצעות משימה אוטומטיות:</div>
              {sugg.map(s => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:`1px solid ${T.primaryBorder}` }}>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:600, color: T.text }}>{s.task_name}</span>
                    {s.project_name && <span style={{ color: T.textSub }}> · {s.project_name}</span>}
                    <span style={{ marginRight:8, fontSize:11, color: CONF_COLORS[s.confidence], fontWeight:700 }}>
                      [{CONF_LABELS[s.confidence]}]
                    </span>
                    <div style={{ fontSize:11, color: T.textFaint }}>{s.reason}</div>
                  </div>
                  <button onClick={() => handleLink(s.id)} disabled={linking}
                    style={{ padding:'5px 12px', borderRadius: T.radiusSm, background: T.primary, color:'#fff', border:'none', fontSize:11, cursor:'pointer', opacity:linking?0.7:1, fontFamily:'inherit', fontWeight:600 }}>
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

  const PROV_ICON = {
    github:    <IcGit s={18}/>,
    gitlab:    <IcGit s={18}/>,
    bitbucket: <IcGit s={18}/>,
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.owner || !form.repoName) { addToast('owner ו-repo name נדרשים', 'error'); return; }
    setSaving(true);
    try {
      await integrationsApi.addRepoConfig({ ...form, repoName: form.repoName });
      addToast('מאגר נוסף', 'success');
      setForm({ name:'', provider:'github', owner:'', repoName:'', token:'', projectId:'' });
      setShowForm(false); load();
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:12, color: T.textSub }}>הוסף מאגרי Git כדי למשוך commits אוטומטית</span>
        <button onClick={() => setShowForm(v => !v)} style={{
          padding:'8px 16px', borderRadius: T.radius,
          background: showForm ? T.surfaceAlt : T.primary,
          color: showForm ? T.textSub : '#fff',
          border: showForm ? `1px solid ${T.border}` : 'none',
          fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          display:'flex', alignItems:'center', gap:6,
        }}>
          {showForm ? 'ביטול' : <><span style={{ fontSize:16, lineHeight:1 }}>+</span> הוסף מאגר</>}
        </button>
      </div>

      {showForm && (
        <Card style={{ marginBottom:16, border:`2px solid ${T.primaryBorder}`, background: T.primaryLight }}>
          <SectionLabel icon={<IcGit s={14}/>}>הוספת מאגר חדש</SectionLabel>
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
                <label style={lbl}>Access Token <span style={{ fontWeight:400, color: T.textFaint }}>(נדרש למאגרים פרטיים)</span></label>
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
            <button type="submit" disabled={saving} style={{
              alignSelf:'flex-start', padding:'9px 24px', borderRadius: T.radius,
              background: T.primary, color:'#fff', border:'none', fontSize:13,
              fontWeight:600, cursor:'pointer', opacity:saving?0.7:1, fontFamily:'inherit',
            }}>
              {saving ? 'שומר...' : 'הוסף מאגר'}
            </button>
          </form>
        </Card>
      )}

      <Card>
        {loading && <Spinner />}
        {!loading && !configs.length && (
          <div style={{ textAlign:'center', padding:'40px 20px', color: T.textFaint }}>
            <div style={{ marginBottom:8, opacity:0.4 }}><IcGit s={32}/></div>
            <p style={{ margin:0, fontSize:13, fontWeight:500 }}>אין מאגרים מוגדרים עדיין</p>
          </div>
        )}
        {configs.map(cfg => (
          <div key={cfg.id} style={{ padding:'14px 0', borderBottom:`1px solid ${T.borderLight}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background: T.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', color: T.primary, flexShrink:0 }}>
                {PROV_ICON[cfg.provider] || <IcGit s={18}/>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13, color: T.text }}>{cfg.name}</div>
                <div style={{ fontSize:11, color: T.textFaint, marginTop:2 }}>
                  {cfg.owner}/{cfg.repo_name}
                  {cfg.project_name ? ` · ${cfg.project_name}` : ''}
                  {cfg.has_token ? ' · token מוגדר' : ' · ציבורי'}
                </div>
              </div>
              <button onClick={() => setFetchId(fetchId === cfg.id ? null : cfg.id)} style={{
                padding:'5px 12px', borderRadius: T.radiusSm, background: T.primaryMid, color: T.primary, border:'none', fontSize:11, cursor:'pointer', fontWeight:600, fontFamily:'inherit',
              }}>
                {fetchId === cfg.id ? 'ביטול' : 'משוך commits'}
              </button>
              <button onClick={() => handleDelete(cfg.id)} style={{
                padding:'5px 10px', borderRadius: T.radiusSm, background: T.errorBg, color: T.error, border:'none', fontSize:11, cursor:'pointer', fontFamily:'inherit',
              }}>
                מחק
              </button>
            </div>

            {fetchId === cfg.id && (
              <div style={{ marginTop:10, padding:'12px 14px', background: T.surfaceAlt, borderRadius: T.radius, display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div><label style={lbl}>מתאריך</label><input type="date" value={fetchForm.dateFrom} onChange={e=>setFF(p=>({...p,dateFrom:e.target.value}))} style={sel} /></div>
                <div><label style={lbl}>עד תאריך</label><input type="date" value={fetchForm.dateTo} onChange={e=>setFF(p=>({...p,dateTo:e.target.value}))} style={sel} /></div>
                <div><label style={lbl}>branch (אופציונלי)</label><input value={fetchForm.branch} onChange={e=>setFF(p=>({...p,branch:e.target.value}))} style={{ ...sel, width:120 }} placeholder="main" /></div>
                <button onClick={() => handleFetch(cfg.id)} disabled={!!fetching} style={{
                  padding:'7px 18px', borderRadius: T.radius, background: T.primary, color:'#fff', border:'none', fontSize:12, cursor:'pointer', fontWeight:600, opacity:fetching?0.7:1, fontFamily:'inherit',
                }}>
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
    try { setCommits(await integrationsApi.getCommits({ userId, dateFrom, dateTo })); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setLoading(false); }
  }, [userId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleLink = (commitId, taskId) =>
    setCommits(prev => prev.map(c => c.id === commitId ? { ...c, linked_task_id: taskId } : c));

  const unlinked = commits.filter(c => !c.linked_time_entry_id && !c.linked_task_id);
  const linked   = commits.filter(c => c.linked_time_entry_id || c.linked_task_id);

  return (
    <div>
      <InfoBanner color="yellow">
        commits הם <strong>כלי תומך בלבד</strong> — לא תחליף לדיווח שעות. לא כל עבודה מתבטאת בקומיט.
      </InfoBanner>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color: T.textSub, fontWeight:500 }}>טווח:</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={sel} />
        <span style={{ fontSize:12, color: T.textFaint }}>עד</span>
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={sel} />
      </div>

      {loading && <Spinner />}

      {!loading && !commits.length && (
        <Card>
          <div style={{ textAlign:'center', padding:'40px 20px', color: T.textFaint }}>
            <div style={{ marginBottom:8, opacity:0.4 }}><IcGit s={32}/></div>
            <p style={{ margin:0, fontSize:13 }}>אין commits בטווח זה — ודא שהאימייל שלך משויך לקומיטים</p>
          </div>
        </Card>
      )}

      {!loading && unlinked.length > 0 && (
        <Card style={{ marginBottom:16, borderRight:`3px solid ${T.error}` }}>
          <SectionLabel icon={<IcWarn s={14}/>}>
            <span style={{ color: T.error }}>{unlinked.length} commits ללא שיוך</span>
          </SectionLabel>
          {unlinked.map(c => <CommitRow key={c.id} commit={c} onLink={handleLink} navigate={navigate} />)}
        </Card>
      )}

      {!loading && linked.length > 0 && (
        <Card style={{ borderRight:`3px solid ${T.success}` }}>
          <SectionLabel icon={<IcCheck s={14}/>}>
            <span style={{ color: T.success }}>{linked.length} commits משויכים</span>
          </SectionLabel>
          {linked.map(c => <CommitRow key={c.id} commit={c} onLink={handleLink} navigate={navigate} />)}
        </Card>
      )}
    </div>
  );
}

// ── Tab: All Commits ──────────────────────────────────────────────
function AllCommitsTab({ allUsers }) {
  const navigate     = useNavigate();
  const { addToast } = useToast();
  const [commits, setCommits]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [userId,  setUserId]    = useState('');
  const [dateFrom, setDateFrom] = useState(monthStartStr());
  const [dateTo,   setDateTo]   = useState(todayStr());
  const [linked,   setLinked]   = useState('');

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

  const handleLink = (commitId, taskId) =>
    setCommits(prev => prev.map(c => c.id === commitId ? { ...c, linked_task_id: taskId } : c));

  const unlinkedCount = commits.filter(c => !c.linked_time_entry_id && !c.linked_task_id).length;

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', padding:'12px 14px', background: T.surfaceAlt, borderRadius: T.radius }}>
        <select value={userId} onChange={e=>setUserId(e.target.value)} style={sel}>
          <option value="">כל העובדים</option>
          {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={sel} />
        <span style={{ fontSize:12, color: T.textFaint, alignSelf:'center' }}>עד</span>
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={sel} />
        <select value={linked} onChange={e=>setLinked(e.target.value)} style={sel}>
          <option value="">כל הקומיטים</option>
          <option value="true">משויכים בלבד</option>
          <option value="false">לא משויכים</option>
        </select>
      </div>

      {unlinkedCount > 0 && (
        <div style={{ background: T.errorBg, borderRadius: T.radius, padding:'8px 12px', marginBottom:12, fontSize:12, color: T.error, display:'flex', alignItems:'center', gap:6 }}>
          <IcWarn s={13}/> {unlinkedCount} commits ללא שיוך לדיווח שעות
        </div>
      )}

      {loading && <Spinner />}
      <Card>
        {!loading && !commits.length && (
          <div style={{ textAlign:'center', padding:'40px 20px', color: T.textFaint }}>
            <p style={{ margin:0, fontSize:13 }}>אין commits בטווח זה</p>
          </div>
        )}
        {commits.map(c => <CommitRow key={c.id} commit={c} onLink={handleLink} navigate={navigate} />)}
      </Card>
    </div>
  );
}

// ── Tab: Gaps ─────────────────────────────────────────────────────
function GapsTab() {
  const { addToast } = useToast();
  const [gaps,    setGaps]      = useState([]);
  const [loading, setLoading]   = useState(false);
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
      <InfoBanner color="blue">
        ימים שבהם לעובד יש commits אבל <strong>אין דיווח שעות</strong> — ייתכן שיש עבודה שלא דווחה.
      </InfoBanner>

      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color: T.textSub, fontWeight:500 }}>טווח:</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={sel} />
        <span style={{ fontSize:12, color: T.textFaint }}>עד</span>
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={sel} />
      </div>

      {loading && <Spinner />}
      <Card>
        {!loading && !gaps.length && (
          <div style={{ textAlign:'center', padding:'36px 20px', color: T.success }}>
            <div style={{ marginBottom:8 }}><IcCheck s={28}/></div>
            <p style={{ margin:0, fontSize:13, fontWeight:600 }}>אין פערים בטווח זה</p>
            <p style={{ margin:'4px 0 0', fontSize:12, color: T.textFaint }}>כל הימים עם commits מכוסים בדיווחי שעות</p>
          </div>
        )}
        {!loading && gaps.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['עובד', 'צוות', 'תאריך', 'commits', 'מאגרים'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {gaps.map((g, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight:600, color: T.text }}>{g.full_name}</td>
                    <td style={{ ...td, color: T.textSub }}>{g.team || '—'}</td>
                    <td style={{ ...td, color: T.error, fontWeight:600 }}>{g.commit_day}</td>
                    <td style={{ ...td, color: T.textSub }}>{g.commit_count}</td>
                    <td style={{ ...td, color: T.textFaint, fontSize:11 }}>{g.repositories}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Tab: ClickUp ──────────────────────────────────────────────────
const STATUS_COLORS = {
  'to do': T.textFaint, 'in progress': T.accent, 'done': T.success,
  'closed': T.textSub, 'review': T.warning,
};
const PRIORITY_COLORS = { urgent: T.error, high: '#EF4444', normal: T.accent, low: T.textFaint };

function ClickUpTab() {
  const { addToast } = useToast();
  const [config,       setConfig]      = useState(null);
  const [configLoad,   setConfigLoad]  = useState(true);
  const [apiKey,       setApiKey]      = useState('');
  const [saving,       setSaving]      = useState(false);
  const [teams,        setTeams]       = useState([]);
  const [selectedTeam, setSelectedTeam]= useState('');
  const [spaces,       setSpaces]      = useState([]);
  const [selectedSpace,setSelectedSpace]= useState('');
  const [lists,        setLists]       = useState([]);
  const [listsLoad,    setListsLoad]   = useState(false);
  const [syncing,      setSyncing]     = useState(null);
  const [tasks,        setTasks]       = useState([]);
  const [tasksLoad,    setTasksLoad]   = useState(false);
  const [search,       setSearch]      = useState('');
  const [filterStatus, setFilterStatus]= useState('');

  const loadConfig = useCallback(async () => {
    setConfigLoad(true);
    try {
      const cfg = await clickupApi.getConfig();
      setConfig(cfg);
      if (cfg) {
        const t = await clickupApi.getTeams();
        setTeams(t);
        if (cfg.team_id) {
          setSelectedTeam(cfg.team_id);
          setSpaces(await clickupApi.getSpaces(cfg.team_id));
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
      setConfig(cfg); setApiKey('');
      addToast('ClickUp מחובר בהצלחה', 'success'); loadConfig();
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
    setSelectedTeam(teamId); setSpaces([]); setSelectedSpace(''); setLists([]);
    if (!teamId) return;
    try { setSpaces(await clickupApi.getSpaces(teamId)); }
    catch (err) { addToast(err.message, 'error'); }
  };

  const handleSelectSpace = async (spaceId) => {
    setSelectedSpace(spaceId); setLists([]);
    if (!spaceId) return;
    setListsLoad(true);
    try { setLists(await clickupApi.getLists(spaceId)); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setListsLoad(false); }
  };

  const handleSyncSpace = async () => {
    if (!selectedSpace) return;
    setSyncing('space');
    try { const r = await clickupApi.syncSpace(selectedSpace); addToast(`סונכרנו ${r.saved} משימות מ-${r.lists} רשימות`, 'success'); loadTasks(); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setSyncing(null); }
  };

  const handleSyncList = async (listId) => {
    setSyncing(listId);
    try { const r = await clickupApi.syncList(listId); addToast(`סונכרנו ${r.saved} משימות מ-"${r.listName}"`, 'success'); loadTasks(); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setSyncing(null); }
  };

  const allStatuses = [...new Set(tasks.map(t => t.status).filter(Boolean))];
  if (configLoad) return <Spinner />;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Connection card */}
      <Card>
        <SectionLabel icon={<IcLink s={14}/>}>חיבור ל-ClickUp</SectionLabel>
        {!config ? (
          <form onSubmit={handleSaveConfig} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <p style={{ fontSize:12, color: T.textSub, margin:0 }}>
              צור Personal API Token ב-ClickUp: Settings → Apps → API Token
            </p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)}
                placeholder="pk_xxxxxxxxxxxxxxxx" style={{ ...inp, flex:'1 1 260px' }} />
              <button type="submit" disabled={saving} style={{
                padding:'8px 22px', borderRadius: T.radius, background: T.primary, color:'#fff',
                border:'none', fontSize:13, fontWeight:600, cursor:'pointer', opacity:saving?0.7:1, fontFamily:'inherit',
              }}>
                {saving ? 'מתחבר...' : 'התחבר'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:20, background: T.successBg, color: T.success }}>
              <IcCheck s={13}/> <span style={{ fontSize:12, fontWeight:700 }}>ClickUp מחובר</span>
            </div>
            <span style={{ fontSize:11, color: T.textFaint }}>עודכן {config.updated_at?.slice(0,10)}</span>
            <button onClick={handleDeleteConfig} style={{
              padding:'5px 12px', borderRadius: T.radiusSm, background: T.errorBg, color: T.error, border:'none', fontSize:12, cursor:'pointer', fontFamily:'inherit',
            }}>
              נתק
            </button>
          </div>
        )}
      </Card>

      {/* Sync card */}
      {config && (
        <Card>
          <SectionLabel icon={<IcActivity s={14}/>}>סנכרון משימות</SectionLabel>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
            <div>
              <label style={lbl}>צוות (Workspace)</label>
              <select value={selectedTeam} onChange={e=>handleSelectTeam(e.target.value)} style={inp}>
                <option value="">בחר צוות</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {spaces.length > 0 && (
              <div>
                <label style={lbl}>מרחב (Space)</label>
                <select value={selectedSpace} onChange={e=>handleSelectSpace(e.target.value)} style={inp}>
                  <option value="">בחר מרחב</option>
                  {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {selectedSpace && (
              <div style={{ alignSelf:'flex-end' }}>
                <button onClick={handleSyncSpace} disabled={!!syncing} style={{
                  padding:'8px 18px', borderRadius: T.radius, background: T.primary, color:'#fff',
                  border:'none', fontSize:12, fontWeight:600, cursor:'pointer', opacity:syncing?0.7:1, fontFamily:'inherit',
                }}>
                  {syncing === 'space' ? 'מסנכרן...' : 'סנכרן כל המרחב'}
                </button>
              </div>
            )}
          </div>
          {listsLoad && <Spinner />}
          {lists.length > 0 && (
            <div>
              <div style={{ fontSize:12, color: T.textSub, marginBottom:8 }}>רשימות במרחב — לחץ לסנכרן:</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {lists.map(l => (
                  <div key={l.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius: T.radiusSm, background: T.surfaceAlt, border:`1px solid ${T.border}`, fontSize:12 }}>
                    <span style={{ color: T.text }}>{l.name}</span>
                    {l.folder && <span style={{ color: T.textFaint, fontSize:11 }}>({l.folder})</span>}
                    <span style={{ color: T.textFaint, fontSize:11 }}>{l.task_count} משימות</span>
                    <button onClick={() => handleSyncList(l.id)} disabled={!!syncing} style={{
                      padding:'2px 8px', borderRadius:4, background: T.primaryMid, color: T.primary, border:'none', fontSize:11, cursor:'pointer', opacity:syncing?0.7:1, fontFamily:'inherit',
                    }}>
                      {syncing === l.id ? '...' : 'סנכרן'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Tasks card */}
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <SectionLabel icon={<IcList s={14}/>}>משימות מסונכרנות ({tasks.length})</SectionLabel>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="חיפוש משימה..." style={{ ...sel, width:180 }} />
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={sel}>
              <option value="">כל הסטטוסים</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {tasksLoad && <Spinner />}
        {!tasksLoad && !tasks.length && (
          <div style={{ textAlign:'center', padding:'36px 20px', color: T.textFaint }}>
            <p style={{ margin:0, fontSize:13 }}>
              {config ? 'אין משימות — בצע סנכרון' : 'חבר את ClickUp כדי לראות משימות'}
            </p>
          </div>
        )}
        {!tasksLoad && tasks.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['משימה','רשימה','סטטוס','עדיפות','אחראי','זמן מוערך','תאריך יעד'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.clickup_task_id} style={{ transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...td, fontWeight:600, color: T.text }}>
                      {t.clickup_url
                        ? <a href={t.clickup_url} target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>{t.task_name}</a>
                        : t.task_name}
                      <div style={{ fontSize:10, color: T.textFaint, fontFamily:'monospace' }}>{t.clickup_task_id}</div>
                    </td>
                    <td style={{ ...td, color: T.textSub }}>{t.list_name || '—'}</td>
                    <td style={{ ...td }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, background:(STATUS_COLORS[t.status]||T.textFaint)+'18', color:STATUS_COLORS[t.status]||T.textFaint, fontWeight:600 }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ ...td, color: PRIORITY_COLORS[t.priority]||T.textSub, fontSize:11, fontWeight:600 }}>{t.priority || '—'}</td>
                    <td style={{ ...td, color: T.textSub }}>{t.assigned_user_name || t.assignee_email || '—'}</td>
                    <td style={{ ...td, color: T.textSub }}>{t.estimated_time ? `${Math.round(t.estimated_time/60)}ש'` : '—'}</td>
                    <td style={{ ...td, color: t.due_date && new Date(t.due_date) < new Date() ? T.error : T.textSub }}>{t.due_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Tab: Sync Status ──────────────────────────────────────────────
function StatusTab() {
  const { addToast }        = useToast();
  const [status,  setStatus]= useState(null);
  const [loading, setLoading]= useState(true);

  const load = () => {
    setLoading(true);
    clickupApi.getStatus().then(setStatus).catch(err => addToast(err.message,'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const StatWidget = ({ title, icon, items, ok }) => (
    <Card style={{ flex:'1 1 280px', minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:36, height:36, borderRadius:10, background: ok ? T.successBg : T.errorBg, display:'flex', alignItems:'center', justifyContent:'center', color: ok ? T.success : T.error, flexShrink:0 }}>
          {icon}
        </div>
        <span style={{ fontSize:14, fontWeight:700, color: T.text, flex:1 }}>{title}</span>
        <span style={{
          fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
          background: ok ? T.successBg : T.errorBg, color: ok ? T.success : T.error,
        }}>
          {ok ? 'פעיל' : 'לא מחובר'}
        </span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {items.map(({ label, value, warn }) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${T.borderLight}` }}>
            <span style={{ fontSize:12, color: T.textSub }}>{label}</span>
            <span style={{ fontSize:13, fontWeight:700, color: warn ? T.error : T.text }}>{value}</span>
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, padding:'10px 14px', background: T.primaryLight, border:`1px solid ${T.primaryBorder}`, borderRadius: T.radius }}>
        <span style={{ fontSize:12, color: T.primary }}>מצב סנכרון נכון לרגע זה</span>
        <button onClick={load} style={{ padding:'4px 12px', borderRadius: T.radiusSm, background: T.primaryMid, color: T.primary, border:'none', fontSize:11, cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>
          רענן
        </button>
      </div>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <StatWidget title="Git" icon={<IcGit s={18}/>} ok={git.repoCount > 0}
          items={[
            { label:'מאגרים מוגדרים',  value: git.repoCount },
            { label:'סה"כ commits',      value: git.totalCommits },
            { label:'commits משויכים',   value: git.linkedCommits },
            { label:'commits ללא שיוך', value: gitUnlinked, warn: gitUnlinked > 0 },
            { label:'סנכרון אחרון',      value: git.lastSync ? new Date(git.lastSync).toLocaleString('he-IL') : '—' },
          ]}
        />
        <StatWidget title="ClickUp" icon={<IcList s={18}/>} ok={clickup.connected}
          items={[
            { label:'חיבור',           value: clickup.connected ? 'מחובר' : 'לא מחובר', warn: !clickup.connected },
            { label:'סה"כ משימות',      value: clickup.totalTasks },
            { label:'משימות פתוחות',    value: clickup.openTasks },
            { label:'סנכרון אחרון',     value: clickup.lastSync ? new Date(clickup.lastSync).toLocaleString('he-IL') : '—' },
          ]}
        />
      </div>
    </div>
  );
}

// ── Tab: Mapping ──────────────────────────────────────────────────
function MappingTab({ projects: sysProjects }) {
  const { addToast } = useToast();
  const [userMap, setUserMap] = useState(null);
  const [uLoad,   setULoad]   = useState(true);
  const [uSaving, setUSaving] = useState(null);
  const [projMap, setProjMap] = useState(null);
  const [pLoad,   setPLoad]   = useState(true);
  const [pSaving, setPSaving] = useState(null);

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
      setUserMap(prev => ({ ...prev, mappings: prev.mappings.map(m =>
        m.assignee_email === email ? { ...m, assigned_user_id: userId || null, full_name: prev.users.find(u => u.id == userId)?.full_name || null } : m
      )}));
      addToast('מיפוי עודכן', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setUSaving(null); }
  };

  const handleProjChange = async (listId, projectId) => {
    setPSaving(listId);
    try {
      await clickupApi.saveMappingProject({ listId, projectId: projectId || null });
      setProjMap(prev => ({ ...prev, mappings: prev.mappings.map(m =>
        m.list_id === listId ? { ...m, project_id: projectId || null, project_name: prev.projects.find(p => p.id == projectId)?.project_name || null } : m
      )}));
      addToast('מיפוי עודכן', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setPSaving(null); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <Card>
        <SectionLabel icon={<IcUsers s={14}/>}>מיפוי משתמשים — ClickUp ↔ מערכת</SectionLabel>
        <p style={{ fontSize:12, color: T.textSub, margin:'0 0 14px' }}>
          קבע לאיזה משתמש מערכת שייך כל כתובת אימייל של ClickUp.
        </p>
        {uLoad && <Spinner />}
        {!uLoad && !userMap?.mappings?.length && (
          <p style={{ color: T.textFaint, textAlign:'center', padding:20, fontSize:12 }}>אין נתוני אימייל — בצע סנכרון משימות תחילה</p>
        )}
        {!uLoad && userMap?.mappings?.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>{['אימייל ב-ClickUp','משתמש במערכת',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {userMap.mappings.map(m => (
                  <tr key={m.assignee_email}>
                    <td style={td}>
                      <span style={{ fontFamily:'monospace', fontSize:11, color: T.text }}>{m.assignee_email}</span>
                      {!m.assigned_user_id && <span style={{ marginRight:6, fontSize:10, color: T.error, fontWeight:700 }}>לא משויך</span>}
                    </td>
                    <td style={td}>
                      <select value={m.assigned_user_id||''} onChange={e=>handleUserChange(m.assignee_email,e.target.value)}
                        disabled={uSaving===m.assignee_email} style={{ ...sel, minWidth:160 }}>
                        <option value="">— ללא שיוך —</option>
                        {userMap.users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                      </select>
                    </td>
                    <td style={td}>{uSaving===m.assignee_email && <Spinner />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionLabel icon={<IcMap s={14}/>}>מיפוי רשימות — ClickUp ↔ פרויקט</SectionLabel>
        <p style={{ fontSize:12, color: T.textSub, margin:'0 0 14px' }}>
          קבע לאיזה פרויקט במערכת שייכת כל רשימת ClickUp.
        </p>
        {pLoad && <Spinner />}
        {!pLoad && !projMap?.mappings?.length && (
          <p style={{ color: T.textFaint, textAlign:'center', padding:20, fontSize:12 }}>אין רשימות מסונכרנות — בצע סנכרון משימות תחילה</p>
        )}
        {!pLoad && projMap?.mappings?.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>{['רשימה ב-ClickUp','פרויקט במערכת',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {projMap.mappings.map(m => (
                  <tr key={m.list_id}>
                    <td style={td}>
                      <div style={{ fontWeight:600, color: T.text }}>{m.list_name || m.list_id}</div>
                      <div style={{ fontSize:10, color: T.textFaint, fontFamily:'monospace' }}>{m.list_id}</div>
                    </td>
                    <td style={td}>
                      <select value={m.project_id||''} onChange={e=>handleProjChange(m.list_id,e.target.value)}
                        disabled={pSaving===m.list_id} style={{ ...sel, minWidth:180 }}>
                        <option value="">— ללא שיוך —</option>
                        {(projMap.projects||sysProjects||[]).map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </td>
                    <td style={td}>{pSaving===m.list_id && <Spinner />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    { key:'my-commits', label:'Commits שלי',     icon:<IcGit s={13}/> },
    { key:'status',     label:'סטטוס סנכרון',   icon:<IcActivity s={13}/> },
    ...(isManager ? [
      { key:'all-commits', label:'כל ה-Commits',  icon:<IcUsers s={13}/> },
      { key:'gaps',        label:'פערים',          icon:<IcSearch s={13}/> },
      { key:'repos',       label:'מאגרי Git',      icon:<IcSettings s={13}/> },
      { key:'clickup',     label:'ClickUp',         icon:<IcList s={13}/> },
      { key:'mapping',     label:'מיפוי',           icon:<IcMap s={13}/> },
    ] : []),
  ];

  return (
    <div dir="rtl" style={{ fontFamily:'inherit' }}>
      {/* Page header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${T.primary}, ${T.accent})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 4px 12px ${T.primary}40` }}>
            <IcLink s={18}/>
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, margin:0, color: T.text, letterSpacing:'-0.5px' }}>אינטגרציות</h2>
        </div>
        <p style={{ margin:'0 0 0 46px', fontSize:12, color: T.textFaint, fontWeight:500 }}>
          Git (GitHub / GitLab / Bitbucket) · ClickUp
        </p>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

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
