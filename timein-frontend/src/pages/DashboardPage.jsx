
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useTimer } from '../context/TimerContext';
import { reportsApi } from '../api/reports';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { tasksApi } from '../api/tasks';

const fmt = m => m ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '0:00';
const fmtElapsed = s => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const PIE_COLORS = ['#6366f1','#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899'];

function StatCard({ label, value, color, sub }) {
  return (
    <Card style={{ flex:1,minWidth:0 }}>
      <div style={{ fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontSize:26,fontWeight:700,color,margin:'6px 0 2px' }}>{value != null ? value : '—'}</div>
      {sub && <div style={{ fontSize:11,color:'#94a3b8' }}>{sub}</div>}
    </Card>
  );
}

// ── ווידג'ט טיימר פעיל ───────────────────────────────────────
function ActiveTimerWidget({ navigate }) {
  const { timer, pause, resume, stop } = useTimer();
  if (timer.status === 'idle') return null;

  const isRunning = timer.status === 'running';
  const borderColor = isRunning ? '#6366f1' : '#f59e0b';
  const clockColor  = isRunning ? '#6366f1' : '#f59e0b';

  const handleStopAndReport = () => { stop(); navigate('/report'); };

  return (
    <Card style={{ marginBottom:20, border:`2px solid ${borderColor}`, background: isRunning ? '#fafafe' : '#fffbeb' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:11,color:'#94a3b8',marginBottom:4 }}>
            {isRunning ? 'טיימר פעיל' : 'טיימר מושהה'}
          </div>
          <div style={{ fontSize:36,fontWeight:700,fontFamily:'monospace',color:clockColor,letterSpacing:'0.04em' }}>
            {fmtElapsed(timer.elapsed)}
          </div>
          {timer.projectName && (
            <div style={{ fontSize:12,color:'#64748b',marginTop:4 }}>
              {timer.projectName}{timer.taskName ? ` · ${timer.taskName}` : ''}
            </div>
          )}
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          {isRunning ? (
            <button onClick={pause} style={{ padding:'9px 18px',borderRadius:8,background:'#f59e0b',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer' }}>
              ⏸ השהה
            </button>
          ) : (
            <button onClick={resume} style={{ padding:'9px 18px',borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer' }}>
              ▶ המשך
            </button>
          )}
          <button onClick={handleStopAndReport} style={{ padding:'9px 18px',borderRadius:8,background:'#ef4444',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer' }}>
            ■ עצור ודווח
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── גרפי מנהל ────────────────────────────────────────────────
function ManagerCharts() {
  const [userReport,    setUR] = useState([]);
  const [projectReport, setPR] = useState([]);
  const [loading,    setLoad]  = useState(true);

  useEffect(() => {
    Promise.all([reportsApi.byUser(), reportsApi.byProject()])
      .then(([u, p]) => { setUR(u.slice(0,7)); setPR(p.slice(0,7)); })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, []);

  const totalHours  = userReport.reduce((s, r) => s + Number(r.total_hours || 0), 0).toFixed(1);
  const activeUsers = userReport.filter(r => r.entry_count > 0).length;

  if (loading) return <Spinner />;

  return (
    <>
      <div style={{ display:'flex',gap:12,marginBottom:20 }}>
        <StatCard label="סה״כ שעות צוות"  value={totalHours + 'ש\''} color="#6366f1" />
        <StatCard label="עובדים פעילים"    value={activeUsers}         color="#10b981" />
        <StatCard label="פרויקטים פעילים"  value={projectReport.length} color="#3b82f6" />
      </div>

      <div style={{ display:'flex',gap:16,marginBottom:20,flexWrap:'wrap' }}>
        <Card style={{ flex:'1 1 340px',minWidth:0 }}>
          <div style={{ fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:16 }}>שעות לפי עובד</div>
          {userReport.length === 0
            ? <p style={{ color:'#94a3b8',textAlign:'center',padding:20,fontSize:12 }}>אין נתונים</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart layout="vertical" data={userReport} margin={{ left:8, right:16 }}>
                  <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={v => v+'ש\''} />
                  <YAxis type="category" dataKey="full_name" tick={{ fontSize:11 }} width={72} />
                  <Tooltip formatter={v => [v + ' שעות', 'שעות']} />
                  <Bar dataKey="total_hours" radius={[0,4,4,0]} isAnimationActive={false}>
                    {userReport.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </Card>

        <Card style={{ flex:'1 1 300px',minWidth:0 }}>
          <div style={{ fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:16 }}>שעות לפי פרויקט</div>
          {projectReport.length === 0
            ? <p style={{ color:'#94a3b8',textAlign:'center',padding:20,fontSize:12 }}>אין נתונים</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={projectReport} dataKey="total_hours" nameKey="project_name" cx="50%" cy="45%" outerRadius={80} isAnimationActive={false}
                    label={({ percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''} labelLine={false}>
                    {projectReport.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v + ' שעות', n]} />
                  <Legend iconType="circle" iconSize={8} formatter={name => <span style={{ fontSize:11 }}>{name}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </Card>

        <Card style={{ flex:'1 1 340px',minWidth:0 }}>
          <div style={{ fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:16 }}>דיווחים לפי עובד</div>
          {userReport.length === 0
            ? <p style={{ color:'#94a3b8',textAlign:'center',padding:20,fontSize:12 }}>אין נתונים</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={userReport} margin={{ left:0, right:8, bottom:24 }}>
                  <XAxis dataKey="full_name" tick={{ fontSize:10 }} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize:10 }} />
                  <Tooltip formatter={v => [v + ' דיווחים', 'דיווחים']} />
                  <Bar dataKey="entry_count" radius={[4,4,0,0]} isAnimationActive={false}>
                    {userReport.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </Card>
      </div>
    </>
  );
}

// ── חלוקה אישית לפי פרויקט (עובד) ──────────────────────────
function MyProjectBreakdown({ entries }) {
  const breakdown = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      const k = e.project_name || 'ללא פרויקט';
      map[k] = (map[k] || 0) + (e.duration_minutes || 0);
    });
    return Object.entries(map)
      .map(([name, minutes]) => ({ name, hours: +(minutes / 60).toFixed(1) }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 7);
  }, [entries]);

  if (!breakdown.length) return null;

  return (
    <Card style={{ marginBottom:20 }}>
      <div style={{ fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:16 }}>שעות לפי פרויקט</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart layout="vertical" data={breakdown} margin={{ left:8, right:24 }}>
          <XAxis type="number" tick={{ fontSize:10 }} tickFormatter={v => v+'ש\''} />
          <YAxis type="category" dataKey="name" tick={{ fontSize:11 }} width={90} />
          <Tooltip formatter={v => [v + ' שעות', 'שעות']} />
          <Bar dataKey="hours" radius={[0,4,4,0]} isAnimationActive={false}>
            {breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── המשימות שלי (עובד) ───────────────────────────────────────
const P_COLOR = { low:'#94a3b8', medium:'#f59e0b', high:'#ef4444', urgent:'#dc2626' };
const P_LABEL = { low:'נמוך', medium:'בינוני', high:'גבוה', urgent:'דחוף' };
const T_COLOR = { todo:'#64748b', in_progress:'#6366f1', review:'#f59e0b', done:'#10b981', cancelled:'#94a3b8' };
const T_LABEL = { todo:'לביצוע', in_progress:'בעבודה', review:'בסקירה', done:'הושלם', cancelled:'בוטל' };

function MyTasks({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    tasksApi.getAll({ assignedUserId: userId })
      .then(data => setTasks(data.filter(t => t.status !== 'done' && t.status !== 'cancelled')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);
  if (loading) return <Spinner />;
  if (!tasks.length) return null;
  return (
    <Card style={{ marginBottom:20 }}>
      <div style={{ fontSize:13,fontWeight:600,color:'#1e293b',marginBottom:12 }}>המשימות שלי ({tasks.length})</div>
      {tasks.map(t => {
        const overdue = t.due_date && new Date(t.due_date) < new Date();
        return (
          <div key={t.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:500,color:'#1e293b' }}>{t.task_name}</div>
              <div style={{ fontSize:11,color:'#94a3b8',marginTop:2 }}>{t.project_name}</div>
            </div>
            {t.due_date && <span style={{ fontSize:11,color:overdue?'#ef4444':'#94a3b8' }}>{overdue?'⚠ ':''}{t.due_date?.slice(0,10)}</span>}
            <span style={{ fontSize:11,color:P_COLOR[t.priority],fontWeight:500 }}>{P_LABEL[t.priority]}</span>
            <span style={{ fontSize:11,color:T_COLOR[t.status],background:T_COLOR[t.status]+'18',padding:'2px 8px',borderRadius:4,fontWeight:500 }}>{T_LABEL[t.status]}</span>
          </div>
        );
      })}
    </Card>
  );
}

// ── דף ראשי ──────────────────────────────────────────────────
export default function DashboardPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const { entries, loading } = useTimeEntries();
  const [summary, setSummary] = useState(null);
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  useEffect(() => { reportsApi.summary().then(setSummary).catch(() => {}); }, []);

  return (
    <div dir="rtl" style={{ fontFamily:'system-ui,sans-serif' }}>

      {/* כותרת */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,margin:0,color:'#1e293b' }}>שלום, {user?.full_name?.split(' ')[0]}</h2>
        <p style={{ color:'#94a3b8',fontSize:13,marginTop:4 }}>
          {new Date().toLocaleDateString('he-IL',{ weekday:'long',year:'numeric',month:'long',day:'numeric' })}
        </p>
      </div>

      {/* טיימר פעיל – עובד בלבד */}
      {user?.role === 'employee' && <ActiveTimerWidget navigate={navigate} />}

      {/* כרטיסי סיכום אישי */}
      <div style={{ display:'flex',gap:12,marginBottom:20 }}>
        {[
          ['היום',   summary?.today_minutes,  '#6366f1', fmt(+summary?.today_minutes)],
          ['השבוע',  summary?.week_minutes,   '#3b82f6', fmt(+summary?.week_minutes)],
          ['החודש',  summary?.month_minutes,  '#10b981', fmt(+summary?.month_minutes)],
          ['טיוטות', summary?.draft_count,    '#f59e0b', summary?.draft_count],
        ].map(([l, v, c, display]) => (
          <StatCard key={l} label={l} value={v != null ? display : null} color={c} />
        ))}
      </div>

      {/* המשימות שלי – עובד בלבד */}
      {user?.role === 'employee' && <MyTasks userId={user.id} />}

      {/* חלוקה לפי פרויקט – עובד בלבד */}
      {user?.role === 'employee' && !loading && <MyProjectBreakdown entries={entries} />}

      {/* גרפי מנהל / אדמין */}
      {isManager && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:15,fontWeight:600,color:'#1e293b',marginBottom:16,paddingBottom:8,borderBottom:'1px solid #f1f5f9' }}>
            סטטיסטיקות צוות
          </div>
          <ManagerCharts />
        </div>
      )}

      {/* דיווחים אחרונים */}
      <Card>
        <div style={{ fontSize:13,fontWeight:500,color:'#64748b',marginBottom:12 }}>הדיווחים האחרונים שלי</div>
        {loading && <Spinner />}
        {entries.slice(0,5).map(e => (
          <div key={e.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12 }}>
            <span style={{ color:'#94a3b8',minWidth:80 }}>{e.date}</span>
            <span style={{ flex:1,color:'#334155',fontWeight:500 }}>{e.project_name}</span>
            <span style={{ color:'#64748b' }}>{e.description}</span>
            <span style={{ fontWeight:600,color:'#6366f1' }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status} resubmitted={!!e.rejection_reason}/>
          </div>
        ))}
        {!loading && !entries.length && <p style={{ color:'#94a3b8',textAlign:'center',padding:20 }}>אין דיווחים עדיין</p>}
        <button onClick={() => navigate('/report')} style={{ marginTop:12,width:'100%',padding:8,borderRadius:8,background:'#6366f1',color:'#fff',border:'none',fontSize:13,fontWeight:500,cursor:'pointer' }}>
          + דיווח חדש
        </button>
      </Card>
    </div>
  );
}
