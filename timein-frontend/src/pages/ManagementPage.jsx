
import { useState, useEffect } from 'react';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useReports }     from '../hooks/useReports';
import { useToast }       from '../context/ToastContext';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
const fmt = m => m ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '—';
export default function ManagementPage() {
  const { addToast } = useToast();
  const { data, loading:rLoading, fetch:fetchReport } = useReports();
  const [rType, setRType] = useState('byUser');
  const [f, setF] = useState({ status:'', date:'' });
  const { entries, loading, approve, reject } = useTimeEntries(Object.fromEntries(Object.entries(f).filter(([,v])=>v)));
  useEffect(() => { fetchReport(rType); }, [rType]);
  const handleReject = async (id) => {
    const reason = window.prompt('סיבת הדחייה:');
    try { await reject(id, reason); } catch(err) { addToast(err.message,'error'); }
  };
  const sel = { border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff' };
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}>ניהול</h2>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex',gap:8,marginBottom:14 }}>
          {[['byUser','לפי עובד'],['byProject','לפי פרויקט'],['byTask','לפי משימה'],['anomalies','חריגות']].map(([k,l]) => (
            <button key={k} onClick={() => setRType(k)} style={{ padding:'6px 14px',borderRadius:8,border:rType===k?'none':'1px solid #e2e8f0',background:rType===k?'#6366f1':'#fff',color:rType===k?'#fff':'#64748b',fontSize:12,cursor:'pointer',fontWeight:rType===k?500:400 }}>{l}</button>
          ))}
        </div>
        {rLoading && <Spinner />}
        {data && rType==='byUser' && (
          <table style={{ width:'100%',fontSize:12,borderCollapse:'collapse' }}>
            <thead><tr style={{ color:'#94a3b8' }}>{['עובד','צוות','שעות','דיווחים','פרויקטים'].map(h=><th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}>{h}</th>)}</tr></thead>
            <tbody>{data.map(r=><tr key={r.user_id} style={{ borderTop:'1px solid #f1f5f9' }}><td style={{ padding:'8px 0',fontWeight:500 }}>{r.full_name}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.team}</td><td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}>{r.total_hours}ש'</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.entry_count}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.project_count}</td></tr>)}</tbody>
          </table>
        )}
        {data && rType==='byProject' && (
          <table style={{ width:'100%',fontSize:12,borderCollapse:'collapse' }}>
            <thead><tr style={{ color:'#94a3b8' }}>{['פרויקט','שעות','עובדים','דיווחים'].map(h=><th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}>{h}</th>)}</tr></thead>
            <tbody>{data.map(r=><tr key={r.project_id} style={{ borderTop:'1px solid #f1f5f9' }}><td style={{ padding:'8px 0',fontWeight:500 }}>{r.project_name}</td><td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}>{r.total_hours}ש'</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.user_count}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.entry_count}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
      <Card>
        <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>אישור דיווחים</div>
        <div style={{ display:'flex',gap:10,marginBottom:12 }}>
          <select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} style={sel}><option value="">כל הסטטוסים</option><option value="submitted">ממתינים</option><option value="approved">אושרו</option><option value="rejected">נדחו</option></select>
          <input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={sel}/>
        </div>
        {loading && <Spinner />}
        {entries.map(e => (
          <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
            <div style={{ flex:1 }}><div style={{ fontWeight:500 }}>{e.user_name}</div><div style={{ color:'#64748b' }}>{e.project_name}</div></div>
            <span style={{ fontWeight:600,color:'#6366f1' }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status}/>
            {e.status==='submitted' && (
              <div style={{ display:'flex',gap:5 }}>
                <button onClick={() => approve(e.id).catch(err=>addToast(err.message,'error'))} style={{ padding:'4px 10px',borderRadius:6,background:'#d1fae5',color:'#065f46',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}>אשר</button>
                <button onClick={() => handleReject(e.id)} style={{ padding:'4px 10px',borderRadius:6,background:'#fee2e2',color:'#991b1b',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}>דחה</button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
