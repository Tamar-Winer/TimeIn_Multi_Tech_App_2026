
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useProjects }    from '../hooks/useProjects';
import { useToast }       from '../context/ToastContext';
import { useAuth }        from '../context/AuthContext';
import { useResponsive }  from '../hooks/useResponsive';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';

const fmt = m => Math.floor(m/60) + ':' + String(m%60).padStart(2,'0');

export default function MyEntriesPage() {
  const navigate     = useNavigate();
  const { addToast } = useToast();
  const { user }     = useAuth();
  const { projects } = useProjects();
  const { isMobile } = useResponsive();
  const [f, setF] = useState({ projectId:'', status:'', date:'' });
  const filters = { userId: user?.id, ...Object.fromEntries(Object.entries(f).filter(([,v])=>v)) };
  const { entries, loading, submit, remove } = useTimeEntries(filters);

  const sel = { border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px', fontSize:12, background:'#fff' };

  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <h2 style={{ fontSize:18, fontWeight:600, margin:0, color:'#1e293b' }}>הדיווחים שלי</h2>
        <button onClick={() => navigate('/report')} style={{ padding:'7px 16px', borderRadius:8, background:'#1E3A8A', color:'#fff', border:'none', fontSize:13, fontWeight:500, cursor:'pointer' }}>
          + דיווח חדש
        </button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <select value={f.projectId} onChange={e=>setF(p=>({...p,projectId:e.target.value}))} style={sel}>
            <option value="">כל הפרויקטים</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
          <select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} style={sel}>
            <option value="">כל הסטטוסים</option>
            <option value="draft">טיוטה</option>
            <option value="submitted">הוגש</option>
            <option value="approved">אושר</option>
            <option value="rejected">נדחה</option>
          </select>
          <input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={sel}/>
          <button onClick={() => setF({projectId:'',status:'',date:''})} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'#fff', fontSize:12, cursor:'pointer' }}>נקה</button>
        </div>
      </Card>

      {/* Entry list */}
      <Card>
        {loading && <Spinner />}
        {!loading && !entries.length && <p style={{ textAlign:'center', color:'#94a3b8', padding:40 }}>אין דיווחים</p>}
        {entries.map(e => (
          <div key={e.id} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, padding:'11px 0', borderBottom:'1px solid #f1f5f9', fontSize:12 }}>
            {/* Info row */}
            <span style={{ color:'#94a3b8', whiteSpace:'nowrap', fontSize:11 }}>{e.date}</span>
            <div style={{ flex:'1 1 120px', minWidth:0 }}>
              <div style={{ fontWeight:500, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.project_name}</div>
              {e.description && <div style={{ color:'#64748b', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description}</div>}
              {e.related_commit_ids?.length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:3 }}>
                  {e.related_commit_ids.map(h => (
                    <code key={h} style={{ fontSize:10, background:'#DBEAFE', color:'#1E3A8A', padding:'1px 5px', borderRadius:3 }}>{h.slice(0,7)}</code>
                  ))}
                </div>
              )}
            </div>
            <span style={{ fontWeight:600, color:'#1E3A8A', whiteSpace:'nowrap' }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status} resubmitted={!!e.rejection_reason}/>

            {/* Action buttons — full width on mobile */}
            <div style={{ display:'flex', gap:5, flexBasis: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
              {e.status==='draft' && <>
                <button onClick={() => submit(e.id).catch(err=>addToast(err.message,'error'))} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}>הגש</button>
                <button onClick={() => navigate('/report/'+e.id)} style={{ padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}>✏</button>
                <button onClick={() => { if(window.confirm('למחוק?')) remove(e.id); }} style={{ padding:'4px 8px',borderRadius:6,border:'none',background:'#fee2e2',color:'#dc2626',fontSize:11,cursor:'pointer' }}>✕</button>
              </>}
              {e.status==='rejected' && (
                <button onClick={() => navigate('/report/'+e.id)} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #fca5a5',color:'#dc2626',background:'#fff',fontSize:11,cursor:'pointer' }}>תקן</button>
              )}
              <button onClick={() => navigate('/report', { state: { copyFrom: e } })} style={{ padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }} title="העתק דיווח">📋</button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
