
import { useEffect, useState } from 'react';
import { integrationsApi } from '../api/integrations';
import Card from '../components/common/Card';
export default function IntegrationsPage() {
  const [status,  setStatus]  = useState(null);
  const [commits, setCommits] = useState([]);
  useEffect(() => {
    integrationsApi.getStatus().then(setStatus).catch(()=>{});
    integrationsApi.getCommits().then(setCommits).catch(()=>{});
  }, []);
  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}>אינטגרציות</h2>
      <div style={{ display:'flex',gap:16,flexWrap:'wrap',marginBottom:16 }}>
        <Card style={{ flex:1,minWidth:240 }}>
          <div style={{ fontWeight:500,marginBottom:8 }}>Git</div>
          <div style={{ fontSize:12,color:'#64748b' }}>סטטוס: {status?.git?.status||'בודק...'}</div>
          <div style={{ fontSize:12,color:'#64748b' }}>commits שמורים: {status?.git?.count||0}</div>
        </Card>
        <Card style={{ flex:1,minWidth:240 }}>
          <div style={{ fontWeight:500,marginBottom:8 }}>ClickUp</div>
          <div style={{ fontSize:12,color:'#64748b' }}>סטטוס: {status?.clickup?.status||'בודק...'}</div>
          <div style={{ fontSize:12,color:'#64748b' }}>משימות: {status?.clickup?.count||0}</div>
        </Card>
      </div>
      <Card>
        <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>commits אחרונים</div>
        {!commits.length && <p style={{ color:'#94a3b8',fontSize:12,textAlign:'center',padding:20 }}>אין commits עדיין</p>}
        {commits.map(c => (
          <div key={c.id} style={{ display:'flex',gap:10,padding:'8px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <code style={{ background:'#f1f5f9',padding:'2px 8px',borderRadius:4 }}>{c.commit_hash?.slice(0,7)}</code>
            <span style={{ flex:1,color:'#334155' }}>{c.commit_message}</span>
            <span style={{ color:'#94a3b8' }}>{c.full_name}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
