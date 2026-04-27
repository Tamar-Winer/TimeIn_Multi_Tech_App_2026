
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useTasks }    from '../hooks/useTasks';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useToast }    from '../context/ToastContext';
import Card from '../components/common/Card';
const today = new Date().toISOString().slice(0,10);
export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { projects } = useProjects();
  const { entries, create, update } = useTimeEntries();
  const [form, setForm] = useState({ projectId:'',taskId:'',date:today,startTime:'',endTime:'',durationMinutes:'',workType:'development',description:'',commitHash:'',clickUpTaskId:'' });
  const [saving, setSaving] = useState(false);
  const { tasks } = useTasks({ projectId: form.projectId || undefined });
  useEffect(() => {
    if (!id) return;
    const e = entries.find(x => x.id === +id);
    if (!e) return;
    setForm({ projectId:String(e.project_id),taskId:String(e.task_id||''),date:e.date,startTime:e.start_time?.slice(0,5)||'',endTime:e.end_time?.slice(0,5)||'',durationMinutes:String(e.duration_minutes),workType:e.work_type||'development',description:e.description||'',commitHash:e.related_commit_ids?.[0]||'',clickUpTaskId:e.related_clickup_task_id||'' });
  }, [id, entries]);
  const set = f => e => setForm(p => ({...p,[f]:e.target.value}));
  const inp = { border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 10px',fontSize:13,width:'100%',boxSizing:'border-box',background:'#fff' };
  const lbl = { fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 };
  const handleSave = async () => {
    if (!form.projectId || !form.date) { addToast('חובה לבחור פרויקט ותאריך','error'); return; }
    setSaving(true);
    try {
      const payload = { projectId:+form.projectId,taskId:form.taskId?+form.taskId:null,date:form.date,startTime:form.startTime||null,endTime:form.endTime||null,durationMinutes:form.durationMinutes?+form.durationMinutes:null,workType:form.workType,description:form.description,relatedCommitIds:form.commitHash?[form.commitHash]:[],relatedClickupTaskId:form.clickUpTaskId||null };
      if (id) await update(+id, payload); else await create(payload);
      navigate('/my-entries');
    } catch(err) { addToast(err.message,'error'); } finally { setSaving(false); }
  };
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}>{id?'עריכת דיווח':'דיווח שעות'}</h2>
      <Card style={{ maxWidth:560 }}>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div><label style={lbl}>פרויקט *</label><select value={form.projectId} onChange={e=>setForm(p=>({...p,projectId:e.target.value,taskId:''}))} style={inp}><option value="">בחר פרויקט</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select></div>
          <div><label style={lbl}>משימה</label><select value={form.taskId} onChange={set('taskId')} style={inp}><option value="">בחר משימה</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.task_name}</option>)}</select></div>
          <div><label style={lbl}>תאריך *</label><input type="date" value={form.date} onChange={set('date')} style={inp}/></div>
          <div style={{ display:'flex',gap:10 }}>
            <div style={{ flex:1 }}><label style={lbl}>שעת התחלה</label><input type="time" value={form.startTime} onChange={set('startTime')} style={inp}/></div>
            <div style={{ flex:1 }}><label style={lbl}>שעת סיום</label><input type="time" value={form.endTime} onChange={set('endTime')} style={inp}/></div>
          </div>
          <div><label style={lbl}>או משך (דקות)</label><input type="number" min="1" value={form.durationMinutes} onChange={set('durationMinutes')} placeholder="90" style={inp}/></div>
          <div><label style={lbl}>סוג עבודה</label><select value={form.workType} onChange={set('workType')} style={inp}>{[['development','פיתוח'],['design','עיצוב'],['review','ריביו'],['devops','DevOps'],['meeting','פגישה'],['qa','QA'],['other','אחר']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
          <div><label style={lbl}>תיאור</label><textarea value={form.description} onChange={set('description')} rows={3} placeholder="מה עשית?" style={{...inp,resize:'vertical',fontFamily:'inherit'}}/></div>
          <div style={{ display:'flex',gap:10 }}>
            <div style={{ flex:1 }}><label style={lbl}>Git Commit Hash</label><input value={form.commitHash} onChange={set('commitHash')} placeholder="abc123" style={inp}/></div>
            <div style={{ flex:1 }}><label style={lbl}>ClickUp Task ID</label><input value={form.clickUpTaskId} onChange={set('clickUpTaskId')} placeholder="CU-T001" style={inp}/></div>
          </div>
          <div style={{ display:'flex',gap:10 }}>
            <button onClick={handleSave} disabled={saving} style={{ flex:1,padding:10,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:14,fontWeight:500,cursor:'pointer',opacity:saving?0.7:1 }}>{saving?'שומר...':id?'עדכן':'שמור כטיוטה'}</button>
            <button onClick={() => navigate('/my-entries')} style={{ padding:'10px 18px',borderRadius:8,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',fontSize:14,cursor:'pointer' }}>בטל</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
