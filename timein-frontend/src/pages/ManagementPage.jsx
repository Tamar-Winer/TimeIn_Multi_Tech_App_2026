
import { useState, useEffect } from 'react';
import { useAuth }        from '../context/AuthContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useReports }     from '../hooks/useReports';
import { useToast }       from '../context/ToastContext';
import { usersApi }       from '../api/users';
import { useProjects }    from '../hooks/useProjects';
import { integrationsApi } from '../api/integrations';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';

const fmt = m => m ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '—';

const ROLE_COLORS = { employee: '#64748b', manager: '#6366f1', admin: '#dc2626' };

export default function ManagementPage() {
  const { user }      = useAuth();
  const { addToast }  = useToast();
  const isAdmin       = user?.role === 'admin';

  // ── טאב ראשי ────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState('approvals'); // 'approvals' | 'reports' | 'commits' | 'users'

  // ── פרויקטים ועובדים לפילטרים ───────────────────────────────
  const { projects } = useProjects();
  const [allUsers, setAllUsers] = useState([]);
  useEffect(() => { usersApi.list().then(setAllUsers).catch(() => {}); }, []);

  // ── דוחות ───────────────────────────────────────────────────
  const { data, loading: rLoading, fetch: fetchReport } = useReports();
  const [rType, setRType] = useState('byUser');
  const [f, setF]         = useState({ status:'', date:'', userId:'', projectId:'' });
  const { entries, loading, approve, reject } = useTimeEntries(
    Object.fromEntries(Object.entries(f).filter(([, v]) => v))
  );
  useEffect(() => { if (mainTab === 'reports') fetchReport(rType); }, [rType, mainTab]);

  // ── commits ──────────────────────────────────────────────────
  const [commits, setCommits]   = useState([]);
  const [cLoad, setCLoad]       = useState(false);
  useEffect(() => {
    if (mainTab !== 'commits') return;
    setCLoad(true);
    integrationsApi.getCommits().then(setCommits).catch(() => {}).finally(() => setCLoad(false));
  }, [mainTab]);

  // ── ניהול משתמשים (אדמין בלבד) ──────────────────────────────
  const [users, setUsers]           = useState([]);
  const [usersLoading, setUL]       = useState(false);
  const [savingId, setSavingId]     = useState(null);
  const [roleMap, setRoleMap]       = useState({});   // { userId: newRole }
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser]       = useState({ fullName:'', email:'', password:'', role:'manager' });
  const [addSaving, setAddSaving]   = useState(false);

  const loadUsers = async () => {
    setUL(true);
    try { const d = await usersApi.list(); setUsers(d); setRoleMap(Object.fromEntries(d.map(u => [u.id, u.role]))); }
    catch (err) { addToast(err.message, 'error'); }
    finally { setUL(false); }
  };

  useEffect(() => { if (mainTab === 'users' && isAdmin) loadUsers(); }, [mainTab]);

  const handleRoleChange = async (uid) => {
    setSavingId(uid);
    try {
      await usersApi.update(uid, { role: roleMap[uid] });
      setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: roleMap[uid] } : u));
      addToast('תפקיד עודכן', 'success');
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSavingId(null); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.fullName || !newUser.email || !newUser.password) { addToast('נא למלא את כל השדות', 'error'); return; }
    setAddSaving(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('timein_token') },
        body: JSON.stringify({ fullName: newUser.fullName, email: newUser.email, password: newUser.password, role: newUser.role }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'שגיאה'); }
      addToast(`משתמש "${newUser.fullName}" נוצר בהצלחה`, 'success');
      setNewUser({ fullName:'', email:'', password:'', role:'manager' });
      setShowAddForm(false);
      loadUsers();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setAddSaving(false); }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('סיבת הדחייה:');
    try { await reject(id, reason); } catch (err) { addToast(err.message, 'error'); }
  };

  // ── styles ───────────────────────────────────────────────────
  const sel = { border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',fontSize:12,background:'#fff' };
  const inp = { border:'1px solid #e2e8f0',borderRadius:8,padding:'8px 10px',fontSize:13,width:'100%',boxSizing:'border-box' };
  const lbl = { fontSize:12,color:'#64748b',fontWeight:500,display:'block',marginBottom:4 };
  const tabBtn = (active) => ({
    padding:'8px 16px', borderRadius:8, border: active ? 'none' : '1px solid #e2e8f0',
    background: active ? '#6366f1' : '#fff', color: active ? '#fff' : '#64748b',
    fontSize:13, cursor:'pointer', fontWeight: active ? 500 : 400,
  });

  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      <h2 style={{ fontSize:18,fontWeight:600,marginBottom:20,color:'#1e293b' }}>ניהול</h2>

      {/* טאבים ראשיים */}
      <div style={{ display:'flex',gap:8,marginBottom:20,flexWrap:'wrap' }}>
        <button style={tabBtn(mainTab==='approvals')} onClick={() => setMainTab('approvals')}>✔ אישור דיווחים</button>
        <button style={tabBtn(mainTab==='reports')}   onClick={() => setMainTab('reports')}>📊 דוחות</button>
        <button style={tabBtn(mainTab==='commits')}   onClick={() => setMainTab('commits')}>🔗 חיבורי Git</button>
        {isAdmin && <button style={tabBtn(mainTab==='users')} onClick={() => setMainTab('users')}>👥 ניהול משתמשים</button>}
      </div>

      {/* ── אישור דיווחים ── */}
      {mainTab === 'approvals' && (
        <Card>
          <div style={{ display:'flex',gap:8,marginBottom:12,flexWrap:'wrap' }}>
            <select value={f.userId} onChange={e=>setF(p=>({...p,userId:e.target.value}))} style={sel}>
              <option value="">כל העובדים</option>
              {allUsers.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <select value={f.projectId} onChange={e=>setF(p=>({...p,projectId:e.target.value}))} style={sel}>
              <option value="">כל הפרויקטים</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
            <select value={f.status} onChange={e=>setF(p=>({...p,status:e.target.value}))} style={sel}>
              <option value="">כל הסטטוסים</option>
              <option value="submitted">ממתינים</option>
              <option value="approved">אושרו</option>
              <option value="rejected">נדחו</option>
            </select>
            <input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={sel}/>
            {(f.userId||f.projectId||f.status||f.date) && <button onClick={()=>setF({status:'',date:'',userId:'',projectId:''})} style={{ padding:'7px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:12,cursor:'pointer' }}>נקה</button>}
          </div>
          {loading && <Spinner />}
          {entries.map(e => (
            <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
              <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500 }}>{e.user_name}</div>
                <div style={{ color:'#64748b' }}>{e.project_name}</div>
              </div>
              <span style={{ fontWeight:600,color:'#6366f1' }}>{fmt(e.duration_minutes)}</span>
              <Badge status={e.status}/>
              {e.status === 'submitted' && (
                <div style={{ display:'flex',gap:5 }}>
                  <button onClick={() => approve(e.id).catch(err=>addToast(err.message,'error'))} style={{ padding:'4px 10px',borderRadius:6,background:'#d1fae5',color:'#065f46',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}>אשר</button>
                  <button onClick={() => handleReject(e.id)} style={{ padding:'4px 10px',borderRadius:6,background:'#fee2e2',color:'#991b1b',border:'none',fontSize:11,cursor:'pointer',fontWeight:500 }}>דחה</button>
                </div>
              )}
            </div>
          ))}
          {!loading && !entries.length && <p style={{ color:'#94a3b8',textAlign:'center',padding:20 }}>אין דיווחים</p>}
        </Card>
      )}

      {/* ── דוחות ── */}
      {mainTab === 'reports' && (
        <Card>
          <div style={{ display:'flex',gap:8,marginBottom:14 }}>
            {[['byUser','לפי עובד'],['byProject','לפי פרויקט'],['byTask','לפי משימה'],['anomalies','חריגות']].map(([k,l]) => (
              <button key={k} onClick={() => setRType(k)} style={{ padding:'6px 14px',borderRadius:8,border:rType===k?'none':'1px solid #e2e8f0',background:rType===k?'#6366f1':'#fff',color:rType===k?'#fff':'#64748b',fontSize:12,cursor:'pointer',fontWeight:rType===k?500:400 }}>{l}</button>
            ))}
          </div>
          {rLoading && <Spinner />}
          {data && rType==='byUser' && (
            <table style={{ width:'100%',fontSize:12,borderCollapse:'collapse' }}>
              <thead><tr style={{ color:'#94a3b8' }}>{['עובד','צוות','שעות','דיווחים','פרויקטים'].map(h=><th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}>{h}</th>)}</tr></thead>
              <tbody>{data.map(r=><tr key={r.id} style={{ borderTop:'1px solid #f1f5f9' }}><td style={{ padding:'8px 0',fontWeight:500 }}>{r.full_name}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.team}</td><td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}>{r.total_hours}ש'</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.entry_count}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.project_count}</td></tr>)}</tbody>
            </table>
          )}
          {data && rType==='byProject' && (
            <table style={{ width:'100%',fontSize:12,borderCollapse:'collapse' }}>
              <thead><tr style={{ color:'#94a3b8' }}>{['פרויקט','שעות','עובדים','דיווחים'].map(h=><th key={h} style={{ textAlign:'right',padding:'6px 0',fontWeight:400 }}>{h}</th>)}</tr></thead>
              <tbody>{data.map(r=><tr key={r.project_id} style={{ borderTop:'1px solid #f1f5f9' }}><td style={{ padding:'8px 0',fontWeight:500 }}>{r.project_name}</td><td style={{ padding:'8px 0',color:'#6366f1',fontWeight:600 }}>{r.total_hours}ש'</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.user_count}</td><td style={{ padding:'8px 0',color:'#64748b' }}>{r.entry_count}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
      )}

      {/* ── חיבורי Git ── */}
      {mainTab === 'commits' && (
        <Card>
          <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>commits מקושרים לדיווחי שעות</div>
          {cLoad && <Spinner />}
          {!cLoad && !commits.length && <p style={{ color:'#94a3b8',textAlign:'center',padding:40 }}>אין commits עדיין — הוסף commit בדף האינטגרציות</p>}
          {commits.map(c => (
            <div key={c.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
              <code style={{ background:'#f1f5f9',padding:'3px 8px',borderRadius:4,fontSize:11,flexShrink:0 }}>{c.commit_hash?.slice(0,7)}</code>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ color:'#334155',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.commit_message}</div>
                <div style={{ color:'#94a3b8',fontSize:11,marginTop:2 }}>{c.repository} · {c.branch}</div>
              </div>
              <span style={{ color:'#64748b',whiteSpace:'nowrap' }}>{c.full_name||'—'}</span>
              <span style={{ color:'#94a3b8',whiteSpace:'nowrap' }}>{c.commit_date?.slice(0,10)}</span>
            </div>
          ))}
        </Card>
      )}

      {/* ── ניהול משתמשים (אדמין) ── */}
      {mainTab === 'users' && isAdmin && (
        <div>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
            <span style={{ fontSize:13,color:'#64748b' }}>{users.length} משתמשים רשומים</span>
            <button onClick={() => setShowAddForm(v=>!v)} style={{ padding:'8px 16px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}>
              {showAddForm ? 'ביטול' : '+ הוסף מנהל'}
            </button>
          </div>

          {/* טופס הוספת משתמש */}
          {showAddForm && (
            <Card style={{ marginBottom:16,border:'2px solid #e0e7ff' }}>
              <div style={{ fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:14 }}>הוספת משתמש חדש</div>
              <form onSubmit={handleAddUser} style={{ display:'flex',flexDirection:'column',gap:12 }}>
                <div style={{ display:'flex',gap:12 }}>
                  <div style={{ flex:1 }}><label style={lbl}>שם מלא</label><input value={newUser.fullName} onChange={e=>setNewUser(p=>({...p,fullName:e.target.value}))} style={inp} placeholder="ישראל ישראלי" /></div>
                  <div style={{ flex:1 }}><label style={lbl}>אימייל</label><input type="email" value={newUser.email} onChange={e=>setNewUser(p=>({...p,email:e.target.value}))} style={inp} placeholder="email@example.com" /></div>
                </div>
                <div style={{ display:'flex',gap:12 }}>
                  <div style={{ flex:1 }}><label style={lbl}>סיסמה</label><input type="password" value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))} style={inp} placeholder="••••••••" /></div>
                  <div style={{ flex:1 }}><label style={lbl}>תפקיד</label>
                    <select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))} style={inp}>
                      <option value="employee">עובד</option>
                      <option value="manager">מנהל</option>
                      <option value="admin">אדמין</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={addSaving} style={{ alignSelf:'flex-start',padding:'9px 24px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer',opacity:addSaving?0.7:1 }}>
                  {addSaving ? 'יוצר...' : 'צור משתמש'}
                </button>
              </form>
            </Card>
          )}

          {/* טבלת משתמשים */}
          <Card>
            {usersLoading && <Spinner />}
            {!usersLoading && users.map(u => (
              <div key={u.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid #f1f5f9' }}>
                <div style={{ width:36,height:36,borderRadius:'50%',background:'#e0e7ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,color:'#6366f1',flexShrink:0 }}>
                  {u.full_name?.charAt(0)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:500,color:'#1e293b' }}>{u.full_name}</div>
                  <div style={{ fontSize:11,color:'#94a3b8' }}>{u.email}</div>
                </div>
                <div style={{ fontSize:11,color:'#64748b' }}>{u.team || '—'}</div>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <select
                    value={roleMap[u.id] || u.role}
                    onChange={e => setRoleMap(prev => ({...prev, [u.id]: e.target.value}))}
                    style={{ ...sel, fontSize:12, color: ROLE_COLORS[roleMap[u.id] || u.role], fontWeight:500 }}
                  >
                    <option value="employee">עובד</option>
                    <option value="manager">מנהל</option>
                    <option value="admin">אדמין</option>
                  </select>
                  {roleMap[u.id] !== u.role && (
                    <button
                      onClick={() => handleRoleChange(u.id)}
                      disabled={savingId === u.id}
                      style={{ padding:'5px 12px',borderRadius:6,background:'#6366f1',color:'#fff',border:'none',fontSize:11,cursor:'pointer',fontWeight:500,opacity:savingId===u.id?0.7:1 }}
                    >
                      {savingId === u.id ? '...' : 'שמור'}
                    </button>
                  )}
                </div>
                <div style={{ width:8,height:8,borderRadius:'50%',background:u.is_active?'#22c55e':'#e2e8f0',flexShrink:0 }} title={u.is_active?'פעיל':'לא פעיל'} />
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
