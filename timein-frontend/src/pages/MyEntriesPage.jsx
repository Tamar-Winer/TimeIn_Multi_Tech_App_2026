
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useProjects }    from '../hooks/useProjects';
import { useToast }       from '../context/ToastContext';
import { useAuth }        from '../context/AuthContext';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
const fmt = m => Math.floor(m/60) + ':' + String(m%60).padStart(2,'0');
export default function MyEntriesPage() {
  const navigate   = useNavigate();
  const { addToast } = useToast();
  const { user }   = useAuth();
  const { projects } = useProjects();
  const [f, setF] = useState({ projectId:'', status:'', date:'' });
  const filters = { userId: user?.id, ...Object.fromEntries(Object.entries(f).filter(([,v])=>v)) };
  const { entries, loading, submit, remove } = useTimeEntries(filters);
  const sel = { border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff' };
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
        <h2 style={{ fontSize:18,fontWeight:600,margin:0,color:'#1e293b' }}>הדיווחים שלי</h2>
        <button onClick={() => navigate('/report')} style={{ padding:'7px 16px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}>+ דיווח חדש</button>
      </div>
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
          <select value={f.projectId} onChange={e=>setF(p=>({...p,projectId:e.target.value}))} style={sel}><option value="">כל הפרויקטים</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select>
          <select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} style={sel}><option value="">כל הסטטוסים</option><option value="draft">טיוטה</option><option value="submitted">הוגש</option><option value="approved">אושר</option><option value="rejected">נדחה</option></select>
          <input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={sel}/>
          <button onClick={() => setF({projectId:'',status:'',date:''})} style={{ padding:'7px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer' }}>נקה</button>
        </div>
      </Card>
      <Card>
        {loading && <Spinner />}
        {!loading && !entries.length && <p style={{ textAlign:'center',color:'#94a3b8',padding:40 }}>אין דיווחים</p>}
        {entries.map(e => (
          <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
            <div style={{ flex:1 }}><div style={{ fontWeight:500,color:'#1e293b' }}>{e.project_name}</div><div style={{ color:'#64748b' }}>{e.description}</div></div>
            <span style={{ fontWeight:600,color:'#6366f1',minWidth:48 }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status}/>
            <div style={{ display:'flex',gap:5 }}>
              {e.status==='draft' && <>
                <button onClick={() => submit(e.id).catch(err=>addToast(err.message,'error'))} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}>הגש</button>
                <button onClick={() => navigate('/report/'+e.id)} style={{ padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }}>✏</button>
                <button onClick={() => { if(window.confirm('למחוק?')) remove(e.id); }} style={{ padding:'4px 8px',borderRadius:6,border:'none',background:'#fee2e2',color:'#dc2626',fontSize:11,cursor:'pointer' }}>✕</button>
              </>}
              {e.status==='rejected' && <button onClick={() => navigate('/report/'+e.id)} style={{ padding:'4px 10px',borderRadius:6,border:'1px solid #fca5a5',color:'#dc2626',background:'#fff',fontSize:11,cursor:'pointer' }}>תקן</button>}
              <button onClick={() => navigate('/report', { state: { copyFrom: e } })} style={{ padding:'4px 8px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',fontSize:11,cursor:'pointer' }} title="העתק דיווח">📋</button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
