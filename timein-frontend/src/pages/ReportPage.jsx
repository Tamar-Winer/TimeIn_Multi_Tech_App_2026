
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

const today = new Date().toISOString().slice(0,10);
const fmtElapsed = s => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

const Ic = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display:'block', flexShrink:0 }}>
    {children}
  </svg>
);
const IcClock  = ({ s=16 }) => <Ic size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>;
const IcEdit   = ({ s=16 }) => <Ic size={s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Ic>;
const IcGit    = ({ s=16 }) => <Ic size={s}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></Ic>;
const IcPlay   = ({ s=16 }) => <Ic size={s}><polygon points="5 3 19 12 5 21 5 3"/></Ic>;
const IcPause  = ({ s=16 }) => <Ic size={s}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></Ic>;
const IcStop   = ({ s=16 }) => <Ic size={s}><rect x="3" y="3" width="18" height="18" rx="2"/></Ic>;
const IcReset  = ({ s=16 }) => <Ic size={s}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></Ic>;
const IcSend   = ({ s=16 }) => <Ic size={s}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Ic>;
const IcSave   = ({ s=16 }) => <Ic size={s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Ic>;

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

export default function ReportPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { addToast } = useToast();
  const { isMobile } = useResponsive();
  const { projects }                        = useProjects();
  const { entries, create, update, submit } = useTimeEntries();
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
  const [showCommitSuggest, setShowCommitSuggest] = useState(false);

  useEffect(() => {
    clickupApi.getTasks({ search: cuSearch }).then(setCuTasks).catch(() => {});
  }, [cuSearch]);

  useEffect(() => {
    if (id) return;
    integrationsApi.getCommits({ dateFrom: form.date, dateTo: form.date, linked: 'false' })
      .then(rows => { setGitSuggestions(rows || []); })
      .catch(() => setGitSuggestions([]));
  }, [form.date, id]);

  const handleCuSelect = (task) => {
    setCuSelected(task); setForm(p => ({ ...p, clickUpTaskId: task.clickup_task_id }));
    setCuOpen(false); setCuSearch('');
  };
  const handleCuClear = () => { setCuSelected(null); setForm(p => ({ ...p, clickUpTaskId: '' })); };

  useEffect(() => {
    if (!id && projects.length === 1) {
      setForm(p => p.projectId ? p : { ...p, projectId: String(projects[0].id) });
    }
  }, [projects]); // eslint-disable-line

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

  const buildPayload = () => ({
    projectId: +form.projectId, taskId: form.taskId ? +form.taskId : null,
    date: form.date, startTime: form.startTime||null, endTime: form.endTime||null,
    durationMinutes: form.durationMinutes ? +form.durationMinutes : null,
    workType: form.workType, description: form.description,
    relatedCommitIds: form.commitHash ? [form.commitHash] : [],
    relatedClickupTaskId: form.clickUpTaskId || null,
  });

  const handleSaveDraft = async () => {
    if (!form.projectId || !form.date) { addToast('חובה לבחור פרויקט ותאריך','error'); return; }
    setSaving('draft');
    try {
      if (id) await update(+id, buildPayload()); else await create(buildPayload());
      navigate('/my-entries');
    } catch (err) {
      const msg = err.message?.includes('חפיפה') || err.message?.includes('overlap')
        ? 'חפיפה בזמן! הדיווח מתחפף עם דיווח אחר — שנה את השעות'
        : err.message;
      addToast(msg, 'error');
    } finally { setSaving(false); }
  };

  const handleSubmitForApproval = async () => {
    if (!form.projectId || !form.date) { addToast('חובה לבחור פרויקט ותאריך','error'); return; }
    setSaving('submit');
    try {
      let entryId = id ? +id : null;
      if (id) await update(+id, buildPayload(), { silent: true });
      else { const e = await create(buildPayload(), { silent: true }); entryId = e.id; }
      await submit(entryId, { silent: true });
      addToast('הדיווח נשלח לאישור המנהל', 'success');
      navigate('/my-entries');
    } catch (err) {
      const msg = err.message?.includes('חפיפה') || err.message?.includes('overlap')
        ? 'חפיפה בזמן! הדיווח מתחפף עם דיווח אחר — שנה את השעות'
        : err.message;
      addToast(msg, 'error');
    } finally { setSaving(false); }
  };

  const handleTimerStart = () => {
    if (!form.projectId) { addToast('יש לבחור פרויקט לפני הפעלת הטיימר', 'error'); return; }
    const proj = projects.find(p => String(p.id) === String(form.projectId));
    const task = tasks.find(t => String(t.id) === String(form.taskId));
    start(form.projectId, form.taskId, proj?.project_name||'', task?.task_name||'');
  };

  const isRunning = timer.status === 'running';
  const isPaused  = timer.status === 'paused';
  const isIdle    = timer.status === 'idle';
  const pageTitle = id ? 'עריכת דיווח' : location.state?.copyFrom ? 'העתקת דיווח' : 'דיווח שעות חדש';

  const WORK_TYPES = [
    ['development','פיתוח'],['design','עיצוב'],['review','ריביו'],
    ['devops','DevOps'],['meeting','פגישה'],['qa','QA'],['other','אחר'],
  ];

  return (
    <div dir="rtl" style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '16px 0' : '24px 16px',
      fontFamily: 'inherit',
    }}>
      <style>{`
        @keyframes ti-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        .ti-field:focus-within label { color: ${T.primary}; }
        .ti-input:focus { outline:none; border-color:${T.primary}; box-shadow:0 0 0 3px ${T.primary}18; }
      `}</style>

      <div style={{ width:'100%', maxWidth: isMobile ? '100%' : 820 }}>

        {/* ── Header ───────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{
            width:42, height:42, borderRadius:12,
            background:`linear-gradient(135deg, ${T.primary}, ${T.accent})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', boxShadow:`0 4px 16px ${T.primary}40`, flexShrink:0,
          }}>
            {id ? <IcEdit s={20} /> : <IcClock s={20} />}
          </div>
          <div>
            <h2 style={{ fontSize:20, fontWeight:800, margin:0, color:T.text, letterSpacing:'-0.4px' }}>{pageTitle}</h2>
            <p style={{ margin:'2px 0 0', fontSize:12, color:T.textFaint }}>
              {id ? 'עדכן פרטי הדיווח הקיים' : 'מלא את הפרטים ושלח לאישור המנהל'}
            </p>
          </div>
        </div>

        {/* ── Timer bar (new entries only) ─────────────── */}
        {!id && (
          <div style={{
            marginBottom:16, borderRadius:T.radiusLg, overflow:'hidden',
            background: isIdle ? T.surface : 'linear-gradient(135deg, #0A1628 0%, #0E1F3A 100%)',
            border:`1px solid ${isIdle ? T.border : 'rgba(59,130,246,0.3)'}`,
            boxShadow: isIdle ? T.shadow : '0 6px 24px rgba(30,58,138,0.25)',
          }}>
            <div style={{
              display:'flex', alignItems:'center', gap:12, padding:'14px 20px',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}>
              {/* Status dot + label */}
              <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:90 }}>
                <div style={{
                  width:8, height:8, borderRadius:'50%',
                  background: isRunning ? T.accent : isPaused ? T.warning : T.border,
                  boxShadow: isRunning ? `0 0 0 3px ${T.accent}33` : 'none',
                  animation: isRunning ? 'ti-pulse 1.5s ease-in-out infinite' : 'none',
                  flexShrink:0,
                }}/>
                <span style={{
                  fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
                  color: isRunning ? '#60A5FA' : isPaused ? T.warning : T.textFaint,
                }}>
                  {isRunning ? 'פעיל' : isPaused ? 'מושהה' : 'טיימר'}
                </span>
              </div>

              {/* Elapsed */}
              <div style={{
                fontSize: 28, fontWeight:800, fontFamily:'monospace', letterSpacing:'0.06em',
                color: isRunning ? '#93C5FD' : isPaused ? T.warning : T.border,
                transition:'color .25s', flex:1, textAlign:'center',
                textShadow: isRunning ? '0 0 30px rgba(59,130,246,0.35)' : 'none',
              }}>
                {fmtElapsed(timer.elapsed)}
              </div>

              {/* Project/task shown when active */}
              {!isIdle && (
                <div style={{ fontSize:12, color: isRunning ? '#93C5FD' : T.warning, textAlign:'right', flex:1 }}>
                  <div style={{ fontWeight:600 }}>{timer.projectName||'—'}</div>
                  {timer.taskName && <div style={{ fontSize:11, opacity:0.75, marginTop:1 }}>{timer.taskName}</div>}
                </div>
              )}

              {/* Controls */}
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {isIdle && (
                  <button onClick={handleTimerStart} disabled={!form.projectId} style={{
                    padding:'8px 18px', borderRadius:T.radius,
                    background: form.projectId ? `linear-gradient(135deg, ${T.primary}, ${T.accent})` : T.border,
                    color:'#fff', border:'none', fontSize:12, fontWeight:700,
                    cursor: form.projectId ? 'pointer' : 'not-allowed',
                    boxShadow: form.projectId ? `0 3px 10px ${T.primary}40` : 'none',
                    display:'flex', alignItems:'center', gap:6, fontFamily:'inherit',
                  }}>
                    <IcPlay s={12}/> התחל
                  </button>
                )}
                {isRunning && (<>
                  <button onClick={pause} style={{ padding:'7px 14px', borderRadius:T.radius, background:'rgba(217,119,6,0.2)', color:'#FCD34D', border:'1px solid rgba(217,119,6,0.3)', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit' }}>
                    <IcPause s={12}/> השהה
                  </button>
                  <button onClick={stop} style={{ padding:'7px 14px', borderRadius:T.radius, background:'rgba(220,38,38,0.18)', color:'#F87171', border:'1px solid rgba(220,38,38,0.3)', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit' }}>
                    <IcStop s={12}/> עצור
                  </button>
                </>)}
                {isPaused && (<>
                  <button onClick={resume} style={{ padding:'7px 14px', borderRadius:T.radius, background:'rgba(59,130,246,0.2)', color:'#93C5FD', border:'1px solid rgba(59,130,246,0.3)', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit' }}>
                    <IcPlay s={12}/> המשך
                  </button>
                  <button onClick={stop} style={{ padding:'7px 12px', borderRadius:T.radius, background:'rgba(220,38,38,0.18)', color:'#F87171', border:'1px solid rgba(220,38,38,0.3)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit' }}>
                    <IcStop s={12}/>
                  </button>
                  <button onClick={reset} style={{ padding:'7px 10px', borderRadius:T.radius, background:'rgba(255,255,255,0.06)', color:'#93C5FD', border:'1px solid rgba(255,255,255,0.1)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', fontFamily:'inherit' }}>
                    <IcReset s={12}/>
                  </button>
                </>)}
              </div>
            </div>
          </div>
        )}

        {/* ── Main card ────────────────────────────────── */}
        <div style={{
          background: T.surface, borderRadius: T.radiusLg,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowLg,
          overflow:'hidden',
        }}>
          {/* Card body */}
          <div style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>

            {/* ROW 1: Project + Task */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14, marginBottom:16 }}>
              <div className="ti-field">
                <label style={lbl}>פרויקט *</label>
                <select className="ti-input" value={form.projectId}
                  onChange={e => setForm(p => ({...p, projectId:e.target.value, taskId:''}))} style={inp}>
                  <option value="">בחר פרויקט</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div className="ti-field">
                <label style={lbl}>משימה</label>
                <select className="ti-input" value={form.taskId} onChange={set('taskId')} style={inp} disabled={!form.projectId}>
                  <option value="">ללא משימה</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.task_name}</option>)}
                </select>
              </div>
            </div>

            {/* ROW 2: Date + Work type */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14, marginBottom:16 }}>
              <div className="ti-field">
                <label style={lbl}>תאריך *</label>
                <input className="ti-input" type="date" value={form.date} onChange={set('date')} style={inp} />
              </div>
              <div className="ti-field">
                <label style={lbl}>סוג עבודה</label>
                <select className="ti-input" value={form.workType} onChange={set('workType')} style={inp}>
                  {WORK_TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* ROW 3: Start + End + Duration */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap:14, marginBottom:16 }}>
              <div className="ti-field">
                <label style={lbl}>שעת התחלה</label>
                <input className="ti-input" type="time" value={form.startTime} onChange={set('startTime')} style={inp} />
              </div>
              <div className="ti-field">
                <label style={lbl}>שעת סיום</label>
                <input className="ti-input" type="time" value={form.endTime} onChange={set('endTime')} style={inp} />
              </div>
              <div className="ti-field" style={ isMobile ? { gridColumn:'1 / -1' } : {} }>
                <label style={lbl}>משך (דקות)</label>
                <input className="ti-input" type="number" min="1" value={form.durationMinutes}
                  onChange={set('durationMinutes')} placeholder="90" style={inp} />
              </div>
            </div>

            {/* ROW 4: Description */}
            <div className="ti-field" style={{ marginBottom:16 }}>
              <label style={lbl}>תיאור</label>
              <textarea className="ti-input" value={form.description} onChange={set('description')} rows={3}
                placeholder="מה עשית? תאר בקצרה את העבודה שביצעת..."
                style={{...inp, resize:'vertical', fontFamily:'inherit', lineHeight:1.6}} />
            </div>

            {/* ROW 5: Integrations */}
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14, marginBottom:4 }}>
              {/* Git commit */}
              <div className="ti-field">
                <label style={lbl}>
                  <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <IcGit s={10}/> Git Commit Hash
                    {!id && gitSuggestions.length > 0 && (
                      <button onClick={() => setShowCommitSuggest(v => !v)} style={{
                        marginRight:'auto', fontSize:10, fontWeight:600, color:T.primary,
                        background:T.primaryLight, border:`1px solid ${T.primaryBorder}`,
                        borderRadius:4, padding:'1px 7px', cursor:'pointer', fontFamily:'inherit',
                      }}>
                        {gitSuggestions.length} הצעות {showCommitSuggest ? '▲' : '▼'}
                      </button>
                    )}
                  </span>
                </label>
                <input className="ti-input" value={form.commitHash} onChange={set('commitHash')} placeholder="abc1234" style={inp} />
                {showCommitSuggest && gitSuggestions.length > 0 && (
                  <div style={{
                    marginTop:4, borderRadius:T.radius, border:`1px solid ${T.border}`,
                    background:T.surface, boxShadow:T.shadowLg, overflow:'hidden', maxHeight:160, overflowY:'auto',
                  }}>
                    {gitSuggestions.map(c => (
                      <div key={c.id}
                        style={{ padding:'8px 10px', cursor:'pointer', borderBottom:`1px solid ${T.borderLight}`, transition:'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => {
                          setForm(p => ({ ...p, commitHash:c.commit_hash, description:p.description||c.commit_message?.slice(0,200)||'' }));
                          setShowCommitSuggest(false); addToast('Commit הוכנס לדיווח','success');
                        }}>
                        <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                          <code style={{ fontSize:10, background:T.primaryMid, padding:'1px 6px', borderRadius:3, color:T.primary, fontWeight:700, flexShrink:0 }}>
                            {c.commit_hash?.slice(0,7)}
                          </code>
                          <span style={{ fontSize:11, color:T.textMid, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{c.commit_message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ClickUp */}
              <div className="ti-field">
                <label style={lbl}>משימת ClickUp</label>
                {cuSelected ? (
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 12px', border:`1px solid ${T.primaryBorder}`, borderRadius:T.radius, background:T.primaryLight, fontSize:13 }}>
                    <span style={{ flex:1, color:T.primary, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cuSelected.task_name}</span>
                    <span style={{ fontSize:10, color:T.textFaint, fontFamily:'monospace', flexShrink:0 }}>{cuSelected.clickup_task_id}</span>
                    <button onClick={handleCuClear} style={{ background:'none', border:'none', cursor:'pointer', color:T.textFaint, fontSize:14, lineHeight:1 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position:'relative' }}>
                    <input className="ti-input" value={cuSearch}
                      onChange={e => { setCuSearch(e.target.value); setCuOpen(true); }}
                      onFocus={() => setCuOpen(true)}
                      placeholder="חפש משימה..." style={inp} />
                    {cuOpen && cuTasks.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', right:0, left:0, zIndex:100, background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.radiusLg, boxShadow:T.shadowLg, maxHeight:180, overflowY:'auto', marginTop:4 }}>
                        {cuTasks.slice(0,10).map(t => (
                          <div key={t.clickup_task_id} onClick={() => handleCuSelect(t)}
                            style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, borderBottom:`1px solid ${T.borderLight}`, transition:'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div style={{ fontWeight:500, color:T.text }}>{t.task_name}</div>
                            <div style={{ color:T.textFaint, fontSize:11, marginTop:1 }}>{t.list_name} · {t.status}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Action bar ───────────────────────────────── */}
          <div style={{
            padding: isMobile ? '16px' : '18px 32px',
            borderTop:`1px solid ${T.borderLight}`,
            background: T.surfaceAlt,
            display:'flex', gap:10, alignItems:'center',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}>
            {/* Primary: submit for approval */}
            <button onClick={handleSubmitForApproval} disabled={!!saving} style={{
              flex:1, minWidth: isMobile ? '100%' : 'auto',
              padding:'11px 20px', borderRadius:T.radius,
              background: saving ? T.border : `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
              color:'#fff', border:'none', fontSize:14, fontWeight:700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : `0 4px 14px ${T.primary}35`,
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              opacity: saving ? 0.75 : 1, fontFamily:'inherit', transition:'opacity 0.15s',
            }}>
              <IcSend s={14}/>
              {saving === 'submit' ? 'שולח...' : id ? 'עדכן ושלח לאישור' : 'שלח לאישור המנהל'}
            </button>

            {/* Secondary: save draft */}
            <button onClick={handleSaveDraft} disabled={!!saving} style={{
              padding:'11px 18px', borderRadius:T.radius,
              background:'transparent', color:T.textSub,
              border:`1px solid ${T.border}`, fontSize:13, fontWeight:500,
              cursor: saving ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', gap:7,
              opacity: saving ? 0.6 : 1, fontFamily:'inherit', transition:'background 0.12s, color 0.12s',
              whiteSpace:'nowrap',
            }}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background=T.surface; e.currentTarget.style.color=T.text; } }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=T.textSub; }}>
              <IcSave s={13}/>
              {saving === 'draft' ? 'שומר...' : 'שמור כטיוטה'}
            </button>

            {/* Cancel */}
            <button onClick={() => navigate('/my-entries')} disabled={!!saving} style={{
              padding:'11px 16px', borderRadius:T.radius,
              background:'transparent', color:T.textFaint,
              border:`1px solid ${T.borderLight}`, fontSize:13,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1, fontFamily:'inherit',
              whiteSpace:'nowrap',
            }}>
              בטל
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
