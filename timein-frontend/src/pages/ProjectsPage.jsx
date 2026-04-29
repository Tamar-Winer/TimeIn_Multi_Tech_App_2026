
import { useState, useEffect } from 'react';
import { useAuth }     from '../context/AuthContext';
import { useProjects } from '../hooks/useProjects';
import { useTasks }    from '../hooks/useTasks';
import { useToast }    from '../context/ToastContext';
import { useResponsive } from '../hooks/useResponsive';
import { usersApi }    from '../api/users';
import { tasksApi }    from '../api/tasks';
import Card    from '../components/common/Card';
import Spinner from '../components/common/Spinner';

const S_COLOR = { active:'#10b981', archived:'#94a3b8', completed:'#6366f1' };
const S_LABEL = { active:'פעיל', archived:'ארכיון', completed:'הושלם' };
const P_COLOR = { low:'#94a3b8', medium:'#f59e0b', high:'#ef4444', urgent:'#dc2626' };
const P_LABEL = { low:'נמוך', medium:'בינוני', high:'גבוה', urgent:'דחוף' };
const T_LABEL = { todo:'לביצוע', in_progress:'בעבודה', review:'בסקירה', done:'הושלם', cancelled:'בוטל' };

export default function ProjectsPage() {
  const { user }     = useAuth();
  const { addToast } = useToast();
  const { isMobile } = useResponsive();
  const isAdmin   = user?.role === 'admin';
  const isManager = user?.role === 'manager' || isAdmin;

  const [tab, setTab]               = useState('projects');
  const [allUsers, setAllUsers]     = useState([]);
  const [projectFilter, setPFilter] = useState('');
  const [editProject, setEditP]     = useState(null);
  const [editTask, setEditT]        = useState(null);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDelId]      = useState(null);

  const { projects, loading: pLoad, create: cProject, update: uProject } = useProjects();
  const { tasks, loading: tLoad, create: cTask, update: uTask, refetch: rTasks } = useTasks(
    projectFilter ? { projectId: projectFilter } : {}
  );

  const [pF, setPF] = useState({ projectName:'', description:'', managerId:'', gitRepositoryName:'', gitRepositoryUrl:'', clickupSpaceId:'' });
  const [tF, setTF] = useState({ taskName:'', description:'', projectId:'', assignedUserId:'', priority:'medium', estimatedHours:'', dueDate:'', clickupTaskId:'' });

  useEffect(() => {
    if (isManager) usersApi.list().then(setAllUsers).catch(() => {});
  }, [isManager]);

  const openNewProject = () => { setPF({ projectName:'', description:'', managerId:'', gitRepositoryName:'', gitRepositoryUrl:'', clickupSpaceId:'' }); setEditP('new'); };
  const openEditProject = (p) => { setPF({ projectName:p.project_name, description:p.description||'', managerId:String(p.manager_id||''), gitRepositoryName:p.git_repository_name||'', gitRepositoryUrl:p.git_repository_url||'', clickupSpaceId:p.clickup_space_id||'' }); setEditP(p); };

  const saveProject = async () => {
    if (!pF.projectName.trim()) { addToast('נא למלא שם פרויקט', 'error'); return; }
    setSaving(true);
    try {
      const payload = { projectName:pF.projectName.trim(), description:pF.description, managerId:pF.managerId||null, gitRepositoryName:pF.gitRepositoryName, gitRepositoryUrl:pF.gitRepositoryUrl, clickupSpaceId:pF.clickupSpaceId };
      if (editProject === 'new') { await cProject(payload); addToast('פרויקט נוצר', 'success'); }
      else { await uProject(editProject.id, { projectName:payload.projectName, description:payload.description, managerId:payload.managerId }); addToast('פרויקט עודכן', 'success'); }
      setEditP(null);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const toggleArchive = async (p) => {
    try { await uProject(p.id, { status: p.status === 'active' ? 'archived' : 'active' }); }
    catch (err) { addToast(err.message, 'error'); }
  };

  const openNewTask = () => { setTF({ taskName:'', description:'', projectId:projectFilter||'', assignedUserId:'', priority:'medium', estimatedHours:'', dueDate:'', clickupTaskId:'' }); setEditT('new'); };
  const openEditTask = (t) => { setTF({ taskName:t.task_name, description:t.description||'', projectId:String(t.project_id), assignedUserId:String(t.assigned_user_id||''), priority:t.priority||'medium', estimatedHours:String(t.estimated_hours||''), dueDate:t.due_date?.slice(0,10)||'', clickupTaskId:t.clickup_task_id||'' }); setEditT(t); };

  const saveTask = async () => {
    if (!tF.taskName.trim() || !tF.projectId) { addToast('נא למלא שם ופרויקט', 'error'); return; }
    setSaving(true);
    try {
      const payload = { taskName:tF.taskName.trim(), description:tF.description, projectId:+tF.projectId, assignedUserId:tF.assignedUserId||null, priority:tF.priority, estimatedHours:tF.estimatedHours||null, dueDate:tF.dueDate||null, clickupTaskId:tF.clickupTaskId||null };
      if (editTask === 'new') { await cTask(payload); addToast('משימה נוצרה', 'success'); }
      else { await uTask(editTask.id, { taskName:payload.taskName, assignedUserId:payload.assignedUserId, priority:payload.priority, estimatedHours:payload.estimatedHours }); addToast('משימה עודכנה', 'success'); }
      setEditT(null);
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const changeTaskStatus = async (t, status) => {
    try { await uTask(t.id, { status }); }
    catch (err) { addToast(err.message, 'error'); }
  };

  const deleteTask = async (t) => {
    if (!window.confirm(`למחוק את "${t.task_name}"?`)) return;
    setDelId(t.id);
    try { await tasksApi.delete(t.id); rTasks(); addToast('משימה נמחקה'); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setDelId(null); }
  };

  const inp = { border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', fontSize:13, width:'100%', boxSizing:'border-box', background:'#fff' };
  const lbl = { fontSize:12, color:'#64748b', fontWeight:500, display:'block', marginBottom:4 };
  const sel = { border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px', fontSize:12, background:'#fff' };
  const tabBtn = (a) => ({ padding:'8px 16px', borderRadius:8, border: a?'none':'1px solid #e2e8f0', background: a?'#6366f1':'#fff', color: a?'#fff':'#64748b', fontSize:13, cursor:'pointer', fontWeight: a?500:400 });
  const actionBtn = (bg, color) => ({ padding:'4px 10px', borderRadius:6, background:bg, color, border:'none', fontSize:11, cursor:'pointer', fontWeight:500 });

  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:8 }}>
        <h2 style={{ fontSize:18, fontWeight:600, margin:0, color:'#1e293b' }}>פרויקטים ומשימות</h2>
        <div style={{ display:'flex', gap:8 }}>
          {tab==='projects' && isAdmin   && <button onClick={openNewProject} style={{ padding:'8px 16px', borderRadius:8, background:'#6366f1', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>+ פרויקט חדש</button>}
          {tab==='tasks'    && isManager && <button onClick={openNewTask}    style={{ padding:'8px 16px', borderRadius:8, background:'#6366f1', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>+ משימה חדשה</button>}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <button style={tabBtn(tab==='projects')} onClick={() => setTab('projects')}>📁 פרויקטים ({projects.length})</button>
        <button style={tabBtn(tab==='tasks')}    onClick={() => setTab('tasks')}>✓ משימות ({tasks.length})</button>
      </div>

      {/* ═══ PROJECTS ═══ */}
      {tab === 'projects' && (
        <>
          {editProject && (
            <Card style={{ marginBottom:16, border:'2px solid #e0e7ff' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:14 }}>{editProject==='new'?'פרויקט חדש':'עריכת פרויקט'}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Name + Manager — wrap on mobile */}
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:'2 1 180px' }}><label style={lbl}>שם הפרויקט *</label><input value={pF.projectName} onChange={e=>setPF(p=>({...p,projectName:e.target.value}))} style={inp} placeholder="שם הפרויקט" /></div>
                  <div style={{ flex:'1 1 140px' }}>
                    <label style={lbl}>מנהל</label>
                    <select value={pF.managerId} onChange={e=>setPF(p=>({...p,managerId:e.target.value}))} style={inp}>
                      <option value="">בחר מנהל</option>
                      {allUsers.filter(u=>u.role==='manager'||u.role==='admin').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={lbl}>תיאור</label><textarea value={pF.description} onChange={e=>setPF(p=>({...p,description:e.target.value}))} rows={2} style={{...inp,resize:'vertical',fontFamily:'inherit'}} /></div>
                {editProject==='new' && (
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    <div style={{ flex:'1 1 160px' }}><label style={lbl}>Git Repository</label><input value={pF.gitRepositoryName} onChange={e=>setPF(p=>({...p,gitRepositoryName:e.target.value}))} style={inp} placeholder="my-repo" /></div>
                    <div style={{ flex:'1 1 160px' }}><label style={lbl}>ClickUp Space ID</label><input value={pF.clickupSpaceId} onChange={e=>setPF(p=>({...p,clickupSpaceId:e.target.value}))} style={inp} placeholder="abc123" /></div>
                  </div>
                )}
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={saveProject} disabled={saving} style={{ padding:'9px 24px', borderRadius:8, background:'#6366f1', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer', opacity:saving?0.7:1 }}>{saving?'שומר...':'שמור'}</button>
                  <button onClick={() => setEditP(null)} style={{ padding:'9px 16px', borderRadius:8, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', fontSize:13, cursor:'pointer' }}>בטל</button>
                </div>
              </div>
            </Card>
          )}

          <Card>
            {pLoad && <Spinner />}
            {!pLoad && !projects.length && <p style={{ textAlign:'center', color:'#94a3b8', padding:40 }}>אין פרויקטים — צור פרויקט ראשון</p>}
            {projects.map(p => (
              <div key={p.id} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, padding:'13px 0', borderBottom:'1px solid #f1f5f9' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:S_COLOR[p.status]||'#94a3b8', flexShrink:0 }} />
                <div style={{ flex:'1 1 120px', minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>{p.project_name}</div>
                  {p.description && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description}</div>}
                </div>
                {!isMobile && <div style={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>{p.manager_name||'—'}</div>}
                {!isMobile && p.git_repository_name && <code style={{ fontSize:10, background:'#f1f5f9', padding:'2px 6px', borderRadius:4, whiteSpace:'nowrap' }}>{p.git_repository_name}</code>}
                <span style={{ fontSize:11, color:S_COLOR[p.status], fontWeight:500, whiteSpace:'nowrap' }}>{S_LABEL[p.status]}</span>
                <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                  <button onClick={() => { setTab('tasks'); setPFilter(String(p.id)); }} style={actionBtn('#e0e7ff','#4f46e5')}>משימות</button>
                  {isManager && <button onClick={() => openEditProject(p)} style={actionBtn('#f1f5f9','#64748b')}>✏</button>}
                  {isAdmin   && <button onClick={() => toggleArchive(p)} style={actionBtn(p.status==='active'?'#fee2e2':'#f0fdf4', p.status==='active'?'#dc2626':'#16a34a')}>{p.status==='active'?'ארכב':'הפעל'}</button>}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* ═══ TASKS ═══ */}
      {tab === 'tasks' && (
        <>
          {editTask && (
            <Card style={{ marginBottom:16, border:'2px solid #e0e7ff' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:14 }}>{editTask==='new'?'משימה חדשה':'עריכת משימה'}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* Name + Project — wrap on mobile */}
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:'2 1 180px' }}><label style={lbl}>שם המשימה *</label><input value={tF.taskName} onChange={e=>setTF(t=>({...t,taskName:e.target.value}))} style={inp} placeholder="שם המשימה" autoFocus /></div>
                  <div style={{ flex:'1 1 140px' }}>
                    <label style={lbl}>פרויקט *</label>
                    <select value={tF.projectId} onChange={e=>setTF(t=>({...t,projectId:e.target.value}))} style={inp}>
                      <option value="">בחר פרויקט</option>
                      {projects.filter(p=>p.status==='active').map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                  </div>
                </div>
                <div><label style={lbl}>תיאור</label><textarea value={tF.description} onChange={e=>setTF(t=>({...t,description:e.target.value}))} rows={2} style={{...inp,resize:'vertical',fontFamily:'inherit'}} /></div>
                {/* User + Priority + Hours — wrap on mobile */}
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:'1 1 150px' }}>
                    <label style={lbl}>הקצה לעובד</label>
                    <select value={tF.assignedUserId} onChange={e=>setTF(t=>({...t,assignedUserId:e.target.value}))} style={inp}>
                      <option value="">ללא הקצאה</option>
                      {allUsers.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:'1 1 110px' }}>
                    <label style={lbl}>עדיפות</label>
                    <select value={tF.priority} onChange={e=>setTF(t=>({...t,priority:e.target.value}))} style={inp}>
                      {Object.entries(P_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:'1 1 110px' }}><label style={lbl}>שעות משוערות</label><input type="number" min="0.5" step="0.5" value={tF.estimatedHours} onChange={e=>setTF(t=>({...t,estimatedHours:e.target.value}))} style={inp} placeholder="8" /></div>
                </div>
                {/* Date + ClickUp — wrap on mobile */}
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:'1 1 150px' }}><label style={lbl}>תאריך יעד</label><input type="date" value={tF.dueDate} onChange={e=>setTF(t=>({...t,dueDate:e.target.value}))} style={inp}/></div>
                  <div style={{ flex:'1 1 150px' }}><label style={lbl}>ClickUp Task ID</label><input value={tF.clickupTaskId} onChange={e=>setTF(t=>({...t,clickupTaskId:e.target.value}))} style={inp} placeholder="CU-T001" /></div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={saveTask} disabled={saving} style={{ padding:'9px 24px', borderRadius:8, background:'#6366f1', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer', opacity:saving?0.7:1 }}>{saving?'שומר...':'שמור'}</button>
                  <button onClick={() => setEditT(null)} style={{ padding:'9px 16px', borderRadius:8, background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', fontSize:13, cursor:'pointer' }}>בטל</button>
                </div>
              </div>
            </Card>
          )}

          <Card style={{ marginBottom:12 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <select value={projectFilter} onChange={e=>setPFilter(e.target.value)} style={sel}>
                <option value="">כל הפרויקטים</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
              {projectFilter && <button onClick={()=>setPFilter('')} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, cursor:'pointer' }}>נקה</button>}
            </div>
          </Card>

          <Card>
            {tLoad && <Spinner />}
            {!tLoad && !tasks.length && <p style={{ textAlign:'center', color:'#94a3b8', padding:40 }}>אין משימות{projectFilter?' בפרויקט זה':''}</p>}
            {tasks.map(t => {
              const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' && t.status !== 'cancelled';
              return (
                <div key={t.id} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, padding:'12px 0', borderBottom:'1px solid #f1f5f9', fontSize:12 }}>
                  <div style={{ flex:'1 1 140px', minWidth:0 }}>
                    <div style={{ fontWeight:500, color:'#1e293b' }}>{t.task_name}</div>
                    <div style={{ color:'#94a3b8', fontSize:11, marginTop:2 }}>{t.project_name}</div>
                  </div>
                  {!isMobile && <div style={{ color:'#64748b', whiteSpace:'nowrap', fontSize:11 }}>{t.assigned_user_name || 'לא הוקצה'}</div>}
                  <span style={{ fontSize:11, color:P_COLOR[t.priority], fontWeight:500, whiteSpace:'nowrap' }}>{P_LABEL[t.priority]}</span>
                  {t.due_date && <span style={{ fontSize:11, color:overdue?'#ef4444':'#94a3b8', whiteSpace:'nowrap' }}>{overdue?'⚠ ':''}{t.due_date?.slice(0,10)}</span>}
                  <select value={t.status} onChange={e=>changeTaskStatus(t,e.target.value)} style={{ ...sel, fontSize:11, color: t.status==='done'?'#10b981':t.status==='cancelled'?'#94a3b8':'#1e293b' }}>
                    {Object.entries(T_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                  {isManager && (
                    <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                      <button onClick={() => openEditTask(t)} style={actionBtn('#f1f5f9','#64748b')}>✏</button>
                      <button onClick={() => deleteTask(t)} disabled={deletingId===t.id} style={actionBtn('#fee2e2','#dc2626')}>{deletingId===t.id?'...':'✕'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </>
      )}
    </div>
  );
}
