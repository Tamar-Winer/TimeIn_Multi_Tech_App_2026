
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { reportsApi } from '../api/reports';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
const fmt = m => m ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '0:00';
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { entries, loading } = useTimeEntries();
  const [summary, setSummary] = useState(null);
  useEffect(() => { reportsApi.summary().then(setSummary).catch(()=>{}); }, []);
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,margin:0,color:'#1e293b' }}>שלום, {user?.full_name?.split(' ')[0]}</h2>
        <p style={{ color:'#94a3b8',fontSize:13,marginTop:4 }}>{new Date().toLocaleDateString('he-IL',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>
      <div style={{ display:'flex',gap:12,marginBottom:20 }}>
        {[['היום',summary?.today_minutes,'#6366f1'],['השבוע',summary?.week_minutes,'#3b82f6'],['החודש',summary?.month_minutes,'#10b981'],['טיוטות',summary?.draft_count,'#f59e0b']].map(([l,v,c]) => (
          <Card key={l} style={{ flex:1 }}>
            <div style={{ fontSize:10,color:'#94a3b8',textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:24,fontWeight:600,color:c,margin:'4px 0' }}>{v!=null?(l==='טיוטות'?v:fmt(+v)):'—'}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>דיווחים אחרונים</div>
        {loading && <Spinner />}
        {entries.slice(0,5).map(e => (
          <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
            <span style={{ flex:1,color:'#334155',fontWeight:500 }}>{e.project_name}</span>
            <span style={{ color:'#64748b' }}>{e.description}</span>
            <span style={{ fontWeight:600,color:'#6366f1' }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status} />
          </div>
        ))}
        {!loading && !entries.length && <p style={{ color:'#94a3b8',textAlign:'center',padding:20 }}>אין דיווחים עדיין</p>}
        <button onClick={() => navigate('/report')} style={{ marginTop:12,width:'100%',padding:8,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}>+ דיווח חדש</button>
      </Card>
    </div>
  );
}
