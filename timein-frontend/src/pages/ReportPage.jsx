
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useProjects }    from '../hooks/useProjects';
import { useTasks }       from '../hooks/useTasks';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useToast }       from '../context/ToastContext';
import { useTimer }       from '../context/TimerContext';
import { useResponsive }  from '../hooks/useResponsive';
import { clickupApi }      from '../api/clickup';
import { integrationsApi } from '../api/integrations';
import { T }               from '../theme';
import Card from '../components/common/Card';

const today = new Date().toISOString().slice(0,10);
const fmtElapsed = s => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ── SVG icon engine ───────────────────────────────────────────────
const Ic = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display:'block', flexShrink:0 }}>
    {children}
  </svg>
);
const IcFolder   = ({ s=16 }) => <Ic size={s}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></Ic>;
const IcClock    = ({ s=16 }) => <Ic size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>;
const IcEdit     = ({ s=16 }) => <Ic size={s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Ic>;
const IcGit      = ({ s=16 }) => <Ic size={s}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></Ic>;
const IcLink     = ({ s=16 }) => <Ic size={s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></Ic>;
const IcPlay     = ({ s=16 }) => <Ic size={s}><polygon points="5 3 19 12 5 21 5 3"/></Ic>;
const IcPause    = ({ s=16 }) => <Ic size={s}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></Ic>;
const IcStop     = ({ s=16 }) => <Ic size={s}><rect x="3" y="3" width="18" height="18" rx="2"/></Ic>;
const IcReset    = ({ s=16 }) => <Ic size={s}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></Ic>;
const IcStar     = ({ s=16 }) => <Ic size={s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Ic>;

const inp = {
  border: `1px solid ${T.border}`, borderRadius: T.radius,
  padding: '9px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box',
  background: T.surface, color: T.text, fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};
const lbl = {
  fontSize: 11, color: T.textSub, fontWeight: 600,
  display:'block', marginBottom: 5, letterSpacing:'0.04em', textTransform:'uppercase',
};

function SectionLabel({ icon, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:10, borderBottom:`1px solid ${T.borderLight}` }}>
      <div style={{ width:28, height:28, borderRadius:8, background: T.primaryLight, display:'flex', alignItems:'center', justifyContent:'center', color: T.primary, flexShrink:0 }}>
        {icon}
      </div>
      <span style={{ fontSize:12, fontWeight:700, color: T.textMid, letterSpacing:'0.04em', textTransform:'uppercase' }}>{children}</span>
    </div>
  );
}

export default function ReportPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { addToast } = useToast();
  const { isMobile } = useResponsive();
  const { projects }                    = useProjects();
  const { entries, create, update }     = useTimeEntries();
  const { timer, start, pause, resume, stop, reset, clearResult } = useTimer();

  const [form, setForm] = useState({
    projectId:'', taskId:'', date:today,
    startTime:'', endTime:'', durationMinutes:'',
    workType:'development', description:'',
    commitHash:'', clickUpTaskId:'',
  });
  const [saving, setSaving] = useState(false);
  const { tasks } = useTasks({ projectId: form.projectId || undefined });

  const [cuTasks,    setCuTasks]    = useState([]);
  const [cuSearch,   setCuSearch]   = useState('');
  const [cuOpen,     setCuOpen]     = useState(false);
  const [cuSelected, setCuSelected] = useState(null);
  const [gitSuggestions, setGitSuggestions] = useState([]);
  const [suggestOpen,    setSuggestOpen]    = useState(false);

  useEffect(() => {
    clickupApi.getTasks({ search: cuSearch }).then(setCuTasks).catch(() => {});
  }, [cuSearch]);

  useEffect(() => {
    if (id) return;
    integrationsApi.getCommits({ dateFrom: form.date, dateTo: form.date, linked: 'false' })
      .then(rows => { setGitSuggestions(rows || []); if (rows?.length) setSuggestOpen(true); })
      .catch(() => setGitSuggestions([]));
  }, [form.date, id]);

  const handleCuSelect = (task) => {
    setCuSelected(task); setForm(p => ({ ...p, clickUpTaskId: task.clickup_task_id }));
    setCuOpen(false); setCuSearch('');
  };
  const handleCuClear = () => { setCuSelected(null); setForm(p => ({ ...p, clickUpTaskId: '' })); };

  useEffect(() => {
    const cf = location.state?.copyFrom;
    if (cf && !id) {
      setForm({ projectId:String(cf.project_id||''), taskId:String(cf.task_id||''), date:today,
        startTime:cf.start_time?.slice(0,5)||'', endTime:cf.end_time?.slice(0,5)||'',
        durationMinutes:String(cf.duration_minutes||''), workType:cf.work_type||'development',
        description:cf.description||'', commitHash:'', clickUpTaskId:'' });
    }
  // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (timer.lastResult && !id) {
      const r = timer.lastResult;
      setForm(prev => ({ ...prev, date:r.date, startTime:r.startTime, endTime:r.endTime,
        durationMinutes:r.durationMinutes, projectId:r.projectId||prev.projectId, taskId:r.taskId||prev.taskId }));
      clearResult();
    }
  }, [timer.lastResult]); // eslint-disable-line

  useEffect(() => {
    if (!id) return;
    const e = entries.find(x => x.id === +id);
    if (!e) return;
    setForm({ projectId:String(e.project_id), taskId:String(e.task_id||''), date:e.date,
      startTime:e.start_time?.slice(0,5)||'', endTime:e.end_time?.slice(0,5)||'',
      durationMinutes:String(e.duration_minutes), workType:e.work_type||'development',
      description:e.description||'', commitHash:e.related_commit_ids?.[0]||'',
      clickUpTaskId:e.related_clickup_task_id||'' });
  }, [id, entries]);

  const set = f => e => setForm(p => ({...p, [f]: e.target.value}));

  const handleSave = async () => {
    if (!form.projectId || !form.date) { addToast('חובה לבחור פרויקט ותאריך','error'); return; }
    setSaving(true);
    try {
      const payload = {
        projectId: +form.projectId, taskId: form.taskId ? +form.taskId : null,
        date: form.date, startTime: form.startTime||null, endTime: form.endTime||null,
        durationMinutes: form.durationMinutes ? +form.durationMinutes : null,
        workType: form.workType, description: form.description,
        relatedCommitIds: form.commitHash ? [form.commitHash] : [],
        relatedClickupTaskId: form.clickUpTaskId || null,
      };
      if (id) await update(+id, payload); else await create(payload);
      navigate('/my-entries');
    } catch (err) {
      const msg = err.message?.includes('חפיפה') || err.message?.includes('overlap')
        ? 'חפיפה בזמן! הדיווח מתחפף עם דיווח אחר — שנה את השעות'
        : err.message;
      addToast(msg, 'error');
    }
    finally { setSaving(false); }
  };

  const handleStart = () => {
    if (!form.projectId) { addToast('יש לבחור פרויקט לפני הפעלת הטיימר', 'error'); return; }
    const proj = projects.find(p => String(p.id) === String(form.projectId));
    const task = tasks.find(t => String(t.id) === String(form.taskId));
    start(form.projectId, form.taskId, proj?.project_name||'', task?.task_name||'');
  };

  const isRunning = timer.status === 'running';
  const isPaused  = timer.status === 'paused';
  const isIdle    = timer.status === 'idle';

  const pageTitle = id ? 'עריכת דיווח' : location.state?.copyFrom ? 'העתקת דיווח' : 'דיווח שעות חדש';

  return (
    <div dir="rtl" style={{ fontFamily:'inherit' }}>

      {/* ── Page header ─────────────────────────────── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${T.primary}, ${T.accent})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', boxShadow:`0 4px 12px ${T.primary}40` }}>
            {id ? <IcEdit s={18} /> : <IcClock s={18} />}
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, margin:0, color: T.text, letterSpacing:'-0.5px' }}>{pageTitle}</h2>
        </div>
        <p style={{ margin:'0 0 0 46px', fontSize:12, color: T.textFaint, fontWeight:500 }}>
          {id ? 'עדכן פרטי הדיווח הקיים' : 'הגש דיווח שעות חדש לאישור המנהל'}
        </p>
      </div>

      <div style={{ maxWidth: isMobile ? '100%' : 580 }}>

        {/* ── Timer card ─────────────────────────────── */}
        {!id && (
          <div style={{
            borderRadius: T.radiusLg,
            marginBottom: 16,
            background: isIdle ? T.surface : 'linear-gradient(135deg, #0A1628 0%, #0E1F3A 100%)',
            border: `1px solid ${isIdle ? T.border : 'rgba(59,130,246,0.25)'}`,
            boxShadow: isIdle ? T.shadow : '0 8px 32px rgba(30,58,138,0.2), 0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}>
            {/* Header strip */}
            <div style={{
              padding:'12px 20px',
              borderBottom: `1px solid ${isIdle ? T.borderLight : 'rgba(255,255,255,0.06)'}`,
              display:'flex', alignItems:'center', gap:8,
              background: isIdle ? T.surfaceAlt : 'rgba(255,255,255,0.03)',
            }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: isRunning ? T.accent : isPaused ? T.warning : T.border,
                boxShadow: isRunning ? `0 0 0 3px ${T.accent}33` : 'none',
                animation: isRunning ? 'ti-pulse 1.5s ease-in-out infinite' : 'none' }} />
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase',
                color: isRunning ? '#60A5FA' : isPaused ? T.warning : T.textFaint }}>
                {isRunning ? 'טיימר פעיל' : isPaused ? 'טיימר מושהה' : 'טיימר'}
              </span>
            </div>

            <div style={{ padding:'20px 20px 22px' }}>
              {/* Project select (idle only) */}
              {isIdle && (
                <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
                  <div>
                    <label style={lbl}>פרויקט *</label>
                    <select className="ti-input" value={form.projectId}
                      onChange={e => setForm(p => ({...p, projectId:e.target.value, taskId:''}))} style={inp}>
                      <option value="">בחר פרויקט</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>משימה</label>
                    <select className="ti-input" value={form.taskId} onChange={set('taskId')} style={inp} disabled={!form.projectId}>
                      <option value="">בחר משימה</option>
                      {tasks.map(t => <option key={t.id} value={t.id}>{t.task_name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Active project info */}
              {!isIdle && (
                <div style={{ marginBottom:18, padding:'10px 14px', background:'rgba(59,130,246,0.1)', borderRadius: T.radius, border:'1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize:10, color:'#60A5FA', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>פרויקט פעיל</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#E2EBFF' }}>{timer.projectName||'—'}</div>
                  {timer.taskName && <div style={{ fontSize:11, color:'#93C5FD', marginTop:2 }}>{timer.taskName}</div>}
                </div>
              )}

              {/* Big elapsed display */}
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div style={{
                  fontSize: isMobile ? 48 : 60, fontWeight:800, fontFamily:'monospace',
                  letterSpacing:'0.06em', lineHeight:1,
                  color: isRunning ? '#93C5FD' : isPaused ? T.warning : T.border,
                  transition:'color .25s',
                  textShadow: isRunning ? '0 0 40px rgba(59,130,246,0.3)' : 'none',
                }}>
                  {fmtElapsed(timer.elapsed)}
                </div>
                {!isIdle && (
                  <div style={{ fontSize:11, marginTop:8, color: isRunning ? '#60A5FA' : T.warning, fontWeight:500 }}>
                    {isRunning ? 'הטיימר פעיל גם בדפים אחרים' : 'מושהה — לחץ המשך להמשיך'}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                {isIdle && (
                  <button onClick={handleStart} disabled={!form.projectId} style={{
                    padding:'10px 32px', borderRadius: T.radius,
                    background: form.projectId ? `linear-gradient(135deg, ${T.primary}, ${T.accent})` : T.border,
                    color:'#fff', border:'none', fontSize:14, fontWeight:700,
                    cursor: form.projectId ? 'pointer' : 'not-allowed',
                    boxShadow: form.projectId ? `0 4px 14px ${T.primary}40` : 'none',
                    display:'flex', alignItems:'center', gap:8, fontFamily:'inherit',
                    transition:'all .15s',
                  }}>
                    <IcPlay s={14} /> התחל
                  </button>
                )}
                {isRunning && (<>
                  <button onClick={pause} style={{ padding:'10px 20px', borderRadius:T.radius, background:'rgba(217,119,6,0.2)', color:'#FCD34D', border:'1px solid rgba(217,119,6,0.3)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
                    <IcPause s={14}/> השהה
                  </button>
                  <button onClick={stop} style={{ padding:'10px 20px', borderRadius:T.radius, background:'rgba(220,38,38,0.18)', color:'#F87171', border:'1px solid rgba(220,38,38,0.3)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
                    <IcStop s={14}/> עצור
                  </button>
                </>)}
                {isPaused && (<>
                  <button onClick={resume} style={{ padding:'10px 20px', borderRadius:T.radius, background:'rgba(59,130,246,0.2)', color:'#93C5FD', border:'1px solid rgba(59,130,246,0.3)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
                    <IcPlay s={14}/> המשך
                  </button>
                  <button onClick={stop} style={{ padding:'10px 20px', borderRadius:T.radius, background:'rgba(220,38,38,0.18)', color:'#F87171', border:'1px solid rgba(220,38,38,0.3)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
                    <IcStop s={14}/> עצור
                  </button>
                  <button onClick={reset} style={{ padding:'10px 14px', borderRadius:T.radius, background:'rgba(255,255,255,0.06)', color:'#93C5FD', border:'1px solid rgba(255,255,255,0.1)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
                    <IcReset s={14}/>
                  </button>
                </>)}
              </div>
            </div>
            <style>{`@keyframes ti-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
          </div>
        )}

        {/* ── Git suggestions ────────────────────────── */}
        {!id && gitSuggestions.length > 0 && (
          <div style={{
            marginBottom:16, borderRadius: T.radiusLg,
            background: T.primaryLight, border:`1px solid ${T.primaryBorder}`,
            boxShadow: T.shadow, overflow:'hidden',
          }}>
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'12px 16px', cursor:'pointer',
              background: T.primaryMid, borderBottom:`1px solid ${T.primaryBorder}`,
            }} onClick={() => setSuggestOpen(v => !v)}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <IcStar s={14} style={{ color: T.primary }} />
                <span style={{ fontSize:13, fontWeight:700, color: T.primary }}>
                  הצעות אוטומטיות ({gitSuggestions.length})
                </span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round">
                {suggestOpen ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
              </svg>
            </div>
            {suggestOpen && (
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color: T.textSub, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>
                  Git Commits — {form.date}
                </div>
                {gitSuggestions.map(c => (
                  <div key={c.id}
                    style={{ padding:'10px 12px', borderRadius: T.radius, border:`1px solid ${T.border}`, background: T.surface, cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = T.surface}
                    onClick={() => {
                      setForm(p => ({ ...p, commitHash: c.commit_hash, description: p.description || c.commit_message?.slice(0,200)||'' }));
                      setSuggestOpen(false); addToast('Commit הוכנס לדיווח','success');
                    }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <code style={{ fontSize:10, background: T.primaryMid, padding:'2px 7px', borderRadius:4, color: T.primary, fontWeight:700, flexShrink:0 }}>
                        {c.commit_hash?.slice(0,7)}
                      </code>
                      <span style={{ fontSize:12, color: T.textMid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{c.commit_message}</span>
                      <span style={{ fontSize:10, color: T.textFaint, whiteSpace:'nowrap' }}>{c.repository}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Main form card ─────────────────────────── */}
        <Card style={{ padding:'24px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

            {/* Section 1: Project & Task */}
            <div>
              <SectionLabel icon={<IcFolder />}>פרויקט ומשימה</SectionLabel>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={lbl}>פרויקט *</label>
                  <select className="ti-input" value={form.projectId} onChange={e => setForm(p => ({...p, projectId:e.target.value, taskId:''}))} style={inp}>
                    <option value="">בחר פרויקט</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>משימה</label>
                  <select className="ti-input" value={form.taskId} onChange={set('taskId')} style={inp} disabled={!form.projectId}>
                    <option value="">ללא משימה</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.task_name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Time */}
            <div>
              <SectionLabel icon={<IcClock />}>זמן</SectionLabel>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={lbl}>תאריך *</label>
                  <input className="ti-input" type="date" value={form.date} onChange={set('date')} style={inp} />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <label style={lbl}>שעת התחלה</label>
                    <input className="ti-input" type="time" value={form.startTime} onChange={set('startTime')} style={inp} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={lbl}>שעת סיום</label>
                    <input className="ti-input" type="time" value={form.endTime} onChange={set('endTime')} style={inp} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>משך (דקות)</label>
                  <input className="ti-input" type="number" min="1" value={form.durationMinutes} onChange={set('durationMinutes')} placeholder="90" style={inp} />
                </div>
              </div>
            </div>

            {/* Section 3: Details */}
            <div>
              <SectionLabel icon={<IcEdit />}>פרטים</SectionLabel>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={lbl}>סוג עבודה</label>
                  <select className="ti-input" value={form.workType} onChange={set('workType')} style={inp}>
                    {[['development','פיתוח'],['design','עיצוב'],['review','ריביו'],['devops','DevOps'],['meeting','פגישה'],['qa','QA'],['other','אחר']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>תיאור</label>
                  <textarea className="ti-input" value={form.description} onChange={set('description')} rows={3}
                    placeholder="מה עשית?" style={{...inp, resize:'vertical', fontFamily:'inherit', lineHeight:1.6}} />
                </div>
              </div>
            </div>

            {/* Section 4: Integrations */}
            <div>
              <SectionLabel icon={<IcLink />}>אינטגרציות</SectionLabel>
              <div style={{ display:'flex', gap:10, flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ flex:1 }}>
                  <label style={lbl}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <IcGit s={11} /> Git Commit Hash
                    </div>
                  </label>
                  <input className="ti-input" value={form.commitHash} onChange={set('commitHash')} placeholder="abc1234" style={inp} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={lbl}>משימת ClickUp</label>
                  {cuSelected ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 12px', border:`1px solid ${T.primaryBorder}`, borderRadius: T.radius, background: T.primaryLight, fontSize:13 }}>
                      <span style={{ flex:1, color: T.primary, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cuSelected.task_name}</span>
                      <span style={{ fontSize:10, color: T.textFaint, fontFamily:'monospace', flexShrink:0 }}>{cuSelected.clickup_task_id}</span>
                      <button onClick={handleCuClear} style={{ background:'none', border:'none', cursor:'pointer', color: T.textFaint, fontSize:14, lineHeight:1 }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ position:'relative' }}>
                      <input className="ti-input" value={cuSearch}
                        onChange={e => { setCuSearch(e.target.value); setCuOpen(true); }}
                        onFocus={() => setCuOpen(true)}
                        placeholder="חפש משימה..." style={inp} />
                      {cuOpen && cuTasks.length > 0 && (
                        <div style={{ position:'absolute', top:'100%', right:0, left:0, zIndex:100, background: T.surface, border:`1px solid ${T.border}`, borderRadius: T.radiusLg, boxShadow: T.shadowLg, maxHeight:200, overflowY:'auto', marginTop:4 }}>
                          {cuTasks.slice(0,10).map(t => (
                            <div key={t.clickup_task_id} onClick={() => handleCuSelect(t)}
                              style={{ padding:'9px 14px', cursor:'pointer', fontSize:12, borderBottom:`1px solid ${T.borderLight}`, transition:'background 0.1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <div style={{ fontWeight:500, color: T.text }}>{t.task_name}</div>
                              <div style={{ color: T.textFaint, fontSize:11, marginTop:2 }}>{t.list_name} · {t.status}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:10, paddingTop:4, borderTop:`1px solid ${T.borderLight}` }}>
              <button onClick={handleSave} disabled={saving} style={{
                flex:1, padding:'12px 0', borderRadius: T.radius,
                background: saving ? T.border : `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
                color:'#fff', border:'none', fontSize:14, fontWeight:700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving ? 'none' : `0 4px 14px ${T.primary}35`,
                letterSpacing:'0.02em', transition:'opacity 0.15s',
                opacity: saving ? 0.75 : 1, fontFamily:'inherit',
              }}>
                {saving ? 'שומר...' : id ? 'עדכן דיווח' : 'שמור כטיוטה'}
              </button>
              <button onClick={() => navigate('/my-entries')} style={{
                padding:'12px 22px', borderRadius: T.radius,
                background: 'transparent', color: T.textSub,
                border: `1px solid ${T.border}`, fontSize:14, cursor:'pointer',
                fontWeight:500, transition:'background 0.12s, color 0.12s', fontFamily:'inherit',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceAlt; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.textSub; }}>
                בטל
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
