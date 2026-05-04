
import { useState, useEffect, useCallback } from 'react';
import { useToast }    from '../context/ToastContext';
import { useResponsive } from '../hooks/useResponsive';
import { teamsApi }   from '../api/teams';
import { usersApi }   from '../api/users';
import { projectsApi } from '../api/projects';
import Card    from '../components/common/Card';
import Spinner from '../components/common/Spinner';

const ROLE_HE = { employee: 'עובד', manager: 'מנהל', admin: 'מנהל מערכת' };

const inp = { border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', fontSize:13, width:'100%', boxSizing:'border-box', background:'#fff' };
const lbl = { fontSize:12, color:'#64748b', fontWeight:500, display:'block', marginBottom:4 };

const emptyForm = { name:'', managerId:'' };

export default function TeamsPage() {
  const { addToast }  = useToast();
  const { isMobile }  = useResponsive();

  const [teams,    setTeams]    = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const [editTeam, setEditTeam] = useState(null);
  const [form,     setForm]     = useState(emptyForm);

  const [expandedId,   setExpandedId]   = useState(null);
  const [members,      setMembers]      = useState({});
  const [loadingMem,   setLoadingMem]   = useState(false);
  const [addingUser,   setAddingUser]   = useState('');
  const [addingProject,setAddingProject]= useState('');
  const [deletingId,   setDeletingId]   = useState(null);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await teamsApi.list();
      setTeams(data);
    } catch { addToast('שגיאה בטעינת הצוותים', 'error'); }
    finally  { setLoading(false); }
  }, [addToast]);

  useEffect(() => {
    loadTeams();
    usersApi.list().then(setAllUsers).catch(() => {});
    projectsApi.getAll().then(setProjects).catch(() => {});
  }, [loadTeams]);

  // ── Expand / load members ──────────────────────────────────────────
  const toggleExpand = async (teamId) => {
    if (expandedId === teamId) { setExpandedId(null); return; }
    setExpandedId(teamId);
    setAddingUser('');
    setAddingProject('');
    if (members[teamId]) return;
    setLoadingMem(true);
    try {
      const data = await teamsApi.listMembers(teamId);
      setMembers(m => ({ ...m, [teamId]: data }));
    } catch { addToast('שגיאה בטעינת עובדים', 'error'); }
    finally  { setLoadingMem(false); }
  };

  const refreshMembers = async (teamId) => {
    try {
      const data = await teamsApi.listMembers(teamId);
      setMembers(m => ({ ...m, [teamId]: data }));
    } catch {}
  };

  // ── Team CRUD ─────────────────────────────────────────────────────
  const openNew  = () => { setForm(emptyForm); setEditTeam('new'); };
  const openEdit = (t) => {
    setForm({ name: t.name, managerId: String(t.manager_id || '') });
    setEditTeam(t);
  };

  const saveTeam = async () => {
    if (!form.name.trim()) { addToast('נא למלא שם צוות', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        name:      form.name.trim(),
        managerId: form.managerId ? Number(form.managerId) : null,
      };
      if (editTeam === 'new') {
        await teamsApi.create(payload);
        addToast('צוות נוצר בהצלחה', 'success');
      } else {
        await teamsApi.update(editTeam.id, payload);
        addToast('צוות עודכן בהצלחה', 'success');
      }
      setEditTeam(null);
      await loadTeams();
    } catch (err) { addToast(err.message || 'שגיאה בשמירה', 'error'); }
    finally { setSaving(false); }
  };

  const deleteTeam = async (t) => {
    if (!window.confirm(`למחוק את הצוות "${t.name}"? כל העובדים ישוחררו מהצוות.`)) return;
    setDeletingId(t.id);
    try {
      await teamsApi.remove(t.id);
      addToast('צוות נמחק', 'success');
      setExpandedId(null);
      await loadTeams();
    } catch (err) { addToast(err.message || 'שגיאה במחיקה', 'error'); }
    finally { setDeletingId(null); }
  };

  // ── Member management ─────────────────────────────────────────────
  const addMember = async (teamId) => {
    if (!addingUser) return;
    try {
      await teamsApi.addMember(teamId, Number(addingUser));
      setAddingUser('');
      await refreshMembers(teamId);
      await loadTeams();
      addToast('עובד נוסף לצוות', 'success');
    } catch (err) { addToast(err.message || 'שגיאה בהוספת עובד', 'error'); }
  };

  const removeMember = async (teamId, userId) => {
    try {
      await teamsApi.removeMember(teamId, userId);
      await refreshMembers(teamId);
      await loadTeams();
      addToast('עובד הוסר מהצוות', 'success');
    } catch (err) { addToast(err.message || 'שגיאה בהסרה', 'error'); }
  };

  // ── Project management ────────────────────────────────────────────
  const addProject = async (teamId) => {
    if (!addingProject) return;
    try {
      await teamsApi.addProject(teamId, Number(addingProject));
      setAddingProject('');
      await loadTeams();
      addToast('פרויקט נוסף לצוות', 'success');
    } catch (err) { addToast(err.message || 'שגיאה בהוספת פרויקט', 'error'); }
  };

  const removeProject = async (teamId, projectId) => {
    try {
      await teamsApi.removeProject(teamId, projectId);
      await loadTeams();
      addToast('פרויקט הוסר מהצוות', 'success');
    } catch (err) { addToast(err.message || 'שגיאה בהסרת פרויקט', 'error'); }
  };

  // ── Helpers ────────────────────────────────────────────────────────
  const availableToAdd = (teamId) => {
    const teamMemberIds = new Set((members[teamId] || []).map(m => m.id));
    return allUsers.filter(u => u.is_active && !teamMemberIds.has(u.id));
  };

  const availableProjectsToAdd = (team) => {
    const assigned = new Set((team.projects || []).map(p => p.id));
    return projects.filter(p => p.status === 'active' && !assigned.has(p.id));
  };

  // ── Styles ────────────────────────────────────────────────────────
  const btn = (bg, fg, extra = {}) => ({
    padding:'7px 14px', borderRadius:8, background:bg, color:fg,
    border:'none', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', ...extra,
  });

  const badge = (bg, fg) => ({
    display:'inline-block', padding:'2px 10px', borderRadius:99,
    background:bg, color:fg, fontSize:11, fontWeight:600,
  });

  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:8 }}>
        <h2 style={{ fontSize:18, fontWeight:700, margin:0, color:'#1e293b' }}>ניהול צוותים</h2>
        <button onClick={openNew} style={btn('#1E3A8A','#fff',{ padding:'9px 18px', fontSize:13 })}>
          + צוות חדש
        </button>
      </div>

      {/* ── Team form ── */}
      {editTeam && (
        <Card style={{ marginBottom:16, border:'2px solid #e0e7ff' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:14 }}>
            {editTeam === 'new' ? 'צוות חדש' : `עריכת צוות — ${editTeam.name}`}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:'2 1 180px' }}>
                <label style={lbl}>שם הצוות *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name:e.target.value }))}
                  style={inp}
                  placeholder="לדוגמה: צוות פרונטאנד"
                  autoFocus
                />
              </div>
              <div style={{ flex:'1 1 160px' }}>
                <label style={lbl}>מנהל צוות</label>
                <select
                  value={form.managerId}
                  onChange={e => setForm(f => ({ ...f, managerId:e.target.value }))}
                  style={inp}
                >
                  <option value="">ללא מנהל</option>
                  {allUsers.filter(u => (u.role === 'manager' || u.role === 'admin') && u.is_active).map(u =>
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  )}
                </select>
              </div>
            </div>
            {editTeam === 'new' && (
              <div style={{ fontSize:11, color:'#94a3b8', padding:'6px 0' }}>
                לאחר יצירת הצוות ניתן להוסיף פרויקטים ועובדים דרך כפתור "פרטים"
              </div>
            )}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={saveTeam} disabled={saving} style={btn('#1E3A8A','#fff',{ opacity:saving?0.7:1 })}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button onClick={() => setEditTeam(null)} style={btn('#f1f5f9','#64748b',{ border:'1px solid #e2e8f0' })}>
                בטל
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Team list ── */}
      {loading ? (
        <Card><Spinner /></Card>
      ) : !teams.length ? (
        <Card>
          <div style={{ textAlign:'center', padding:'48px 20px', color:'#94a3b8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <div style={{ fontSize:14, fontWeight:500 }}>אין צוותים עדיין</div>
            <div style={{ fontSize:12, marginTop:6 }}>לחץ על "צוות חדש" כדי להתחיל</div>
          </div>
        </Card>
      ) : (
        teams.map(team => {
          const isExpanded    = expandedId === team.id;
          const teamMembers   = members[team.id] || [];
          const teamProjects  = team.projects || [];
          const available     = availableToAdd(team.id);
          const availableProj = availableProjectsToAdd(team);

          return (
            <Card key={team.id} style={{ marginBottom:12 }}>
              {/* ── Team header row ── */}
              <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:10 }}>
                <div style={{ flex:'1 1 200px', minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>{team.name}</span>
                    {teamProjects.length > 0
                      ? teamProjects.map(p => (
                          <span key={p.id} style={badge('#dbeafe','#1d4ed8')}>{p.name}</span>
                        ))
                      : <span style={badge('#f1f5f9','#94a3b8')}>ללא פרויקטים</span>
                    }
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>
                    {team.manager_name ? `מנהל: ${team.manager_name}` : 'ללא מנהל מוגדר'}
                    {' · '}
                    {Number(team.member_count)} עובדים
                    {' · '}
                    {teamProjects.length} פרויקטים
                  </div>
                </div>

                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button
                    onClick={() => toggleExpand(team.id)}
                    style={btn(isExpanded ? '#e0e7ff' : '#f8fafc', isExpanded ? '#1E3A8A' : '#64748b', { border:`1px solid ${isExpanded ? '#c7d2fe':'#e2e8f0'}` })}
                  >
                    {isExpanded ? 'סגור ▲' : 'פרטים ▼'}
                  </button>
                  <button onClick={() => openEdit(team)} style={btn('#f1f5f9','#64748b',{ border:'1px solid #e2e8f0' })}>✏ ערוך</button>
                  <button
                    onClick={() => deleteTeam(team)}
                    disabled={deletingId === team.id}
                    style={btn('#fee2e2','#dc2626',{ border:'1px solid #fecaca', opacity:deletingId===team.id?0.7:1 })}
                  >
                    {deletingId === team.id ? '...' : 'מחק'}
                  </button>
                </div>
              </div>

              {/* ── Expanded panel ── */}
              {isExpanded && (
                <div style={{ marginTop:14, borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
                  {loadingMem && !teamMembers.length ? <Spinner /> : (
                    <>
                      {/* ── Projects section ── */}
                      <div style={{ marginBottom:18 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                          <span>📁</span> פרויקטים ({teamProjects.length})
                        </div>

                        {teamProjects.length === 0 ? (
                          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:10 }}>אין פרויקטים משויכים לצוות זה</div>
                        ) : (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                            {teamProjects.map(p => (
                              <div key={p.id} style={{
                                display:'flex', alignItems:'center', gap:6,
                                padding:'5px 10px', borderRadius:8,
                                background:'#eff6ff', border:'1px solid #bfdbfe',
                              }}>
                                <span style={{ fontSize:12, fontWeight:600, color:'#1d4ed8' }}>{p.name}</span>
                                <button
                                  onClick={() => removeProject(team.id, p.id)}
                                  style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:13, lineHeight:1, padding:0 }}
                                  title="הסר פרויקט"
                                >✕</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {availableProj.length > 0 && (
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                            <select
                              value={addingProject}
                              onChange={e => setAddingProject(e.target.value)}
                              style={{ ...inp, flex:'1 1 180px', width:'auto', fontSize:12 }}
                            >
                              <option value="">בחר פרויקט להוספה</option>
                              {availableProj.map(p => (
                                <option key={p.id} value={p.id}>{p.project_name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => addProject(team.id)}
                              disabled={!addingProject}
                              style={btn('#1E3A8A','#fff',{ opacity:!addingProject?0.5:1 })}
                            >
                              + הוסף פרויקט
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── Members section ── */}
                      <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                          <span>👤</span> עובדים ({Number(team.member_count)})
                        </div>

                        {teamMembers.length === 0 ? (
                          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:12 }}>אין עובדים בצוות זה עדיין</div>
                        ) : (
                          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                            {teamMembers.map(m => (
                              <div key={m.id} style={{
                                display:'flex', alignItems:'center', gap:10,
                                padding:'7px 12px', borderRadius:8,
                                background:'#f8fafc', border:'1px solid #f1f5f9',
                              }}>
                                <div style={{
                                  width:30, height:30, borderRadius:'50%',
                                  background:'#e0e7ff', display:'flex', alignItems:'center',
                                  justifyContent:'center', fontSize:13, fontWeight:700, color:'#1E3A8A',
                                  flexShrink:0,
                                }}>
                                  {m.full_name?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, fontWeight:500, color:'#1e293b' }}>{m.full_name}</div>
                                  <div style={{ fontSize:11, color:'#94a3b8' }}>
                                    {m.email} · {ROLE_HE[m.role] || m.role}
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeMember(team.id, m.id)}
                                  style={btn('transparent','#ef4444',{ border:'none', padding:'4px 8px', fontSize:13 })}
                                  title="הסר מהצוות"
                                >✕</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {available.length > 0 && (
                          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                            <select
                              value={addingUser}
                              onChange={e => setAddingUser(e.target.value)}
                              style={{ ...inp, flex:'1 1 180px', width:'auto', fontSize:12 }}
                            >
                              <option value="">בחר עובד להוספה</option>
                              {available.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.full_name} ({ROLE_HE[u.role] || u.role})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => addMember(team.id)}
                              disabled={!addingUser}
                              style={btn('#1E3A8A','#fff',{ opacity:!addingUser?0.5:1 })}
                            >
                              + הוסף עובד
                            </button>
                          </div>
                        )}
                        {available.length === 0 && (
                          <div style={{ fontSize:12, color:'#94a3b8' }}>כל העובדים הפעילים כבר בצוות</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
