
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }        from '../context/AuthContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { useTimer }       from '../context/TimerContext';
import { useResponsive }  from '../hooks/useResponsive';
import { reportsApi }     from '../api/reports';
import { tasksApi }       from '../api/tasks';
import { T }              from '../theme';
import Card    from '../components/common/Card';
import Badge   from '../components/common/Badge';
import Spinner from '../components/common/Spinner';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const fmt = m => m ? Math.floor(m/60) + ':' + String(m%60).padStart(2,'0') : '0:00';
const fmtElapsed = s => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

// ── SVG icon engine ───────────────────────────────────────────────
const Ic = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ display:'block' }}>
    {children}
  </svg>
);

const IcClock    = ({ s=18 }) => <Ic size={s}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Ic>;
const IcCalendar = ({ s=18 }) => <Ic size={s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Ic>;
const IcActivity = ({ s=18 }) => <Ic size={s}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ic>;
const IcFile     = ({ s=18 }) => <Ic size={s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></Ic>;
const IcPlay     = ({ s=18 }) => <Ic size={s}><polygon points="5 3 19 12 5 21 5 3"/></Ic>;
const IcPause    = ({ s=18 }) => <Ic size={s}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></Ic>;
const IcStop     = ({ s=18 }) => <Ic size={s}><rect x="3" y="3" width="18" height="18" rx="2"/></Ic>;
const IcCheck    = ({ s=18 }) => <Ic size={s}><polyline points="20 6 9 17 4 12"/></Ic>;

// ── Tooltip ───────────────────────────────────────────────────────
const NavyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.sidebarBg, borderRadius: 9, padding:'9px 15px', boxShadow: T.shadowLg, border:`1px solid ${T.sidebarBorder}` }}>
      {label && <div style={{ color: '#93C5FD', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color:'#E2EBFF', fontSize: 13, fontWeight: 700 }}>{p.value} {p.name || ''}</div>
      ))}
    </div>
  );
};

// ── Stat card ─────────────────────────────────────────────────────
function StatCard({ label, value, color, sub, icon }) {
  return (
    <Card style={{ flex:'1 1 120px', minWidth:0, padding:'18px 20px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize: 10, color: T.textFaint, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:700 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: color || T.primary, margin:'8px 0 4px', letterSpacing:'-1px', fontVariantNumeric:'tabular-nums' }}>
            {value ?? '—'}
          </div>
          {sub && <div style={{ fontSize: 11, color: T.textFaint, fontWeight:500 }}>{sub}</div>}
        </div>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0, marginTop: 2,
            background: (color || T.primary) + '18',
            display:'flex', alignItems:'center', justifyContent:'center',
            color: color || T.primary,
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Active timer widget ───────────────────────────────────────────
function ActiveTimerWidget({ navigate }) {
  const { timer, pause, resume, stop } = useTimer();
  if (timer.status === 'idle') return null;
  const isRunning = timer.status === 'running';
  return (
    <div style={{
      marginBottom: 22,
      borderRadius: T.radiusLg,
      padding: '18px 22px',
      background: isRunning
        ? 'linear-gradient(135deg, #0E1B36 0%, #132040 100%)'
        : T.warningBg,
      border: `1px solid ${isRunning ? 'rgba(59,130,246,0.3)' : T.warningBorder}`,
      boxShadow: isRunning ? '0 4px 20px rgba(30,58,138,0.2)' : T.shadowMd,
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{
            fontSize: 10, letterSpacing:'0.12em', fontWeight:700, textTransform:'uppercase', marginBottom:8,
            display:'flex', alignItems:'center', gap:6,
            color: isRunning ? '#60A5FA' : T.warning,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius:'50%',
              background: isRunning ? '#3B82F6' : T.warning,
              display:'inline-block',
              boxShadow: isRunning ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none',
              animation: isRunning ? 'ti-pulse 1.5s ease-in-out infinite' : 'none',
            }}/>
            {isRunning ? 'טיימר פעיל' : 'טיימר מושהה'}
          </div>
          <div style={{ fontSize:38, fontWeight:800, fontFamily:'monospace', color: isRunning ? '#fff' : T.warning, letterSpacing:'0.06em', lineHeight:1 }}>
            {fmtElapsed(timer.elapsed)}
          </div>
          {timer.projectName && (
            <div style={{ fontSize:12, color: isRunning ? '#93C5FD' : T.textSub, marginTop:8, fontWeight:500 }}>
              {timer.projectName}{timer.taskName ? ` · ${timer.taskName}` : ''}
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {isRunning ? (
            <button onClick={pause} style={{ padding:'9px 18px', borderRadius:T.radius, background:'rgba(217,119,6,0.18)', color:'#FCD34D', border:'1px solid rgba(217,119,6,0.35)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
              <IcPause s={14}/> השהה
            </button>
          ) : (
            <button onClick={resume} style={{ padding:'9px 18px', borderRadius:T.radius, background:'rgba(59,130,246,0.2)', color:'#93C5FD', border:'1px solid rgba(59,130,246,0.35)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
              <IcPlay s={14}/> המשך
            </button>
          )}
          <button onClick={() => { stop(); navigate('/report'); }}
            style={{ padding:'9px 18px', borderRadius:T.radius, background:'rgba(220,38,38,0.15)', color:'#F87171', border:'1px solid rgba(220,38,38,0.3)', fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:'inherit' }}>
            <IcStop s={14}/> עצור ודווח
          </button>
        </div>
      </div>
      <style>{`@keyframes ti-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Manager charts ────────────────────────────────────────────────
function ManagerCharts() {
  const { isMobile, isTablet } = useResponsive();
  const [userReport,    setUR] = useState([]);
  const [projectReport, setPR] = useState([]);
  const [loading, setLoad]     = useState(true);

  useEffect(() => {
    Promise.all([reportsApi.byUser(), reportsApi.byProject()])
      .then(([u, p]) => {
        setUR(u.slice(0,7).map(r => ({ ...r, total_hours: Number(r.total_hours) })));
        setPR(p.slice(0,7).map(r => ({ ...r, total_hours: Number(r.total_hours) })));
      })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, []);

  if (loading) return <Spinner />;

  const totalHours  = userReport.reduce((s, r) => s + Number(r.total_hours || 0), 0).toFixed(1);
  const activeUsers = userReport.filter(r => r.entry_count > 0).length;
  const chartBasis  = isMobile ? '100%' : isTablet ? '45%' : '340px';

  return (
    <>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <StatCard label="סה״כ שעות צוות"  value={totalHours + 'ש\''} color={T.primary}  icon={<IcActivity />} />
        <StatCard label="עובדים פעילים"    value={activeUsers}         color={T.success}  icon={<IcCheck />} />
        <StatCard label="פרויקטים פעילים"  value={projectReport.filter(p => p.entry_count > 0).length} color={T.accent} icon={<IcCalendar />} />
      </div>

      <div style={{ display:'flex', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        <Card style={{ flex:`1 1 ${chartBasis}`, minWidth:0 }}>
          <SectionLabel>שעות לפי עובד</SectionLabel>
          {!userReport.length
            ? <EmptyState text="אין נתונים בטווח זה" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart layout="vertical" data={userReport} margin={{ left:8, right:16 }}>
                  <XAxis type="number" tick={{ fontSize:10, fill: T.textFaint }} tickFormatter={v => v+'ש\''} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="full_name" tick={{ fontSize:10, fill: T.textSub }} width={68} axisLine={false} tickLine={false} />
                  <Tooltip content={<NavyTooltip />} />
                  <Bar dataKey="total_hours" radius={[0,6,6,0]} isAnimationActive={false}>
                    {userReport.map((_, i) => <Cell key={i} fill={T.blues[i % T.blues.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </Card>

        <Card style={{ flex:`1 1 ${chartBasis}`, minWidth:0 }}>
          <SectionLabel>שעות לפי פרויקט</SectionLabel>
          {!projectReport.length
            ? <EmptyState text="אין נתונים בטווח זה" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={projectReport} dataKey="total_hours" nameKey="project_name" cx="50%" cy="45%" outerRadius={70} isAnimationActive={false}
                    label={({ percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''} labelLine={false}>
                    {projectReport.map((_, i) => <Cell key={i} fill={T.blues[i % T.blues.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v + ' שעות', n]} contentStyle={{ borderRadius:9, border:`1px solid ${T.border}`, fontSize:12, boxShadow: T.shadowMd }} />
                  <Legend iconType="circle" iconSize={8} formatter={name => <span style={{ fontSize:10, color: T.textSub }}>{name}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </Card>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
      <span style={{ width:3, height:14, background: T.primary, borderRadius:2, display:'inline-block', flexShrink:0 }}/>
      <span style={{ fontSize:13, fontWeight:700, color: T.text }}>{children}</span>
    </div>
  );
}

function EmptyState({ text, icon = '📭' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'32px 16px', color: T.textFaint }}>
      <span style={{ fontSize:28, marginBottom:8, opacity:0.5 }}>{icon}</span>
      <p style={{ margin:0, fontSize:12, fontWeight:500 }}>{text}</p>
    </div>
  );
}

const P_COLOR = { low: T.textFaint, medium: T.warning, high: T.error, urgent:'#7C3AED' };
const P_LABEL = { low:'נמוך', medium:'בינוני', high:'גבוה', urgent:'דחוף' };
const T_COLOR = { todo: T.textSub, in_progress: T.primary, review: T.warning, done: T.success, cancelled: T.textFaint };
const T_LABEL = { todo:'לביצוע', in_progress:'בעבודה', review:'בסקירה', done:'הושלם', cancelled:'בוטל' };

function MyProjectBreakdown({ entries }) {
  const breakdown = useMemo(() => {
    const map = {};
    entries.forEach(e => { const k = e.project_name || 'ללא פרויקט'; map[k] = (map[k]||0) + (e.duration_minutes||0); });
    return Object.entries(map).map(([name, m]) => ({ name, hours: +(m/60).toFixed(1) })).sort((a,b) => b.hours - a.hours).slice(0,7);
  }, [entries]);
  if (!breakdown.length) return null;
  return (
    <Card style={{ marginBottom:20 }}>
      <SectionLabel>שעות לפי פרויקט — החודש</SectionLabel>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart layout="vertical" data={breakdown} margin={{ left:8, right:24 }}>
          <XAxis type="number" tick={{ fontSize:10, fill: T.textFaint }} tickFormatter={v => v+'ש\''} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill: T.textSub }} width={86} axisLine={false} tickLine={false} />
          <Tooltip content={<NavyTooltip />} />
          <Bar dataKey="hours" radius={[0,6,6,0]} isAnimationActive={false}>
            {breakdown.map((_, i) => <Cell key={i} fill={T.blues[i % T.blues.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function MyTaskBreakdown() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    reportsApi.myTaskBreakdown()
      .then(rows => setData(rows.map(r => ({ ...r, total_hours: Number(r.total_hours) }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <Spinner />;
  if (!data.length) return null;
  return (
    <Card style={{ marginBottom:20 }}>
      <SectionLabel>שעות לפי משימה — החודש</SectionLabel>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart layout="vertical" data={data} margin={{ left:8, right:24 }}>
          <XAxis type="number" tick={{ fontSize:10, fill: T.textFaint }} tickFormatter={v => v+'ש\''} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="task_name" tick={{ fontSize:10, fill: T.textSub }} width={96} axisLine={false} tickLine={false} />
          <Tooltip content={<NavyTooltip />} />
          <Bar dataKey="total_hours" radius={[0,6,6,0]} isAnimationActive={false}>
            {data.map((_, i) => <Cell key={i} fill={T.blues[(i+2) % T.blues.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

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
      <SectionLabel>המשימות שלי ({tasks.length})</SectionLabel>
      {tasks.map(t => {
        const overdue = t.due_date && new Date(t.due_date) < new Date();
        return (
          <div key={t.id} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, padding:'10px 0', borderBottom:`1px solid ${T.borderLight}`, fontSize:12 }}>
            <div style={{ flex:'1 1 140px' }}>
              <div style={{ fontWeight:600, color: T.text }}>{t.task_name}</div>
              <div style={{ fontSize:11, color: T.textFaint, marginTop:2 }}>{t.project_name}</div>
            </div>
            {t.due_date && <span style={{ fontSize:11, color: overdue ? T.error : T.textFaint, whiteSpace:'nowrap', fontWeight: overdue ? 600 : 400 }}>{overdue ? '⚠ ' : ''}{t.due_date?.slice(0,10)}</span>}
            <span style={{ fontSize:11, color: P_COLOR[t.priority], fontWeight:600, whiteSpace:'nowrap' }}>{P_LABEL[t.priority]}</span>
            <span style={{ fontSize:11, color: T_COLOR[t.status], background: T_COLOR[t.status]+'18', padding:'2px 8px', borderRadius:20, fontWeight:600, whiteSpace:'nowrap' }}>{T_LABEL[t.status]}</span>
          </div>
        );
      })}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { entries, loading } = useTimeEntries();
  const [summary, setSummary] = useState(null);
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  useEffect(() => { reportsApi.summary().then(setSummary).catch(() => {}); }, []);

  return (
    <div dir="rtl" style={{ fontFamily:'inherit' }}>

      {/* ── Greeting ──────────────────────────────── */}
      <div style={{ marginBottom:26 }}>
        <p style={{ color: T.textFaint, fontSize:11, margin:'0 0 5px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>
          {new Date().toLocaleDateString('he-IL',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
        <h2 style={{ fontSize:24, fontWeight:800, margin:0, color: T.text, letterSpacing:'-0.5px' }}>
          שלום, {user?.full_name?.split(' ')[0]} 👋
        </h2>
      </div>

      {user?.role === 'employee' && <ActiveTimerWidget navigate={navigate} />}

      {/* ── Stat cards ────────────────────────────── */}
      <div style={{ display:'flex', gap:12, marginBottom:22, flexWrap:'wrap' }}>
        <StatCard label="היום"   value={summary?.today_minutes  != null ? fmt(+summary.today_minutes)+'ש\'' : null}  color={T.primary}  icon={<IcClock />} />
        <StatCard label="השבוע"  value={summary?.week_minutes   != null ? fmt(+summary.week_minutes)+'ש\''  : null}  color={T.accent}   icon={<IcCalendar />} />
        <StatCard label="החודש"  value={summary?.month_minutes  != null ? fmt(+summary.month_minutes)+'ש\'' : null}  color={T.success}  icon={<IcActivity />} />
        <StatCard label="טיוטות" value={summary?.draft_count    != null ? summary.draft_count               : null}  color={T.warning}  icon={<IcFile />} />
      </div>

      {user?.role === 'employee' && <MyTasks userId={user.id} />}
      {user?.role === 'employee' && !loading && <MyProjectBreakdown entries={entries} />}
      {user?.role === 'employee' && <MyTaskBreakdown />}

      {/* ── Manager section ───────────────────────── */}
      {isManager && (
        <div style={{ marginBottom:8 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            fontSize:15, fontWeight:700, color: T.text,
            marginBottom:18, paddingBottom:12,
            borderBottom:`1px solid ${T.border}`,
          }}>
            <span style={{ width:3, height:18, background: T.primary, borderRadius:2, display:'inline-block', flexShrink:0 }}/>
            סטטיסטיקות צוות
          </div>
          <ManagerCharts />
        </div>
      )}

      {/* ── Recent entries ────────────────────────── */}
      <Card>
        <SectionLabel>הדיווחים האחרונים שלי</SectionLabel>
        {loading && <Spinner />}
        {!loading && !entries.length && <EmptyState text="אין דיווחים עדיין" icon="📋" />}
        {entries.slice(0,5).map(e => (
          <div key={e.id} style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8, padding:'11px 0', borderBottom:`1px solid ${T.borderLight}`, fontSize:12 }}>
            <span style={{ color: T.textFaint, whiteSpace:'nowrap', fontSize:11, fontWeight:500 }}>{e.date}</span>
            <span style={{ flex:'1 1 100px', color: T.textMid, fontWeight:600, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.project_name}</span>
            <span style={{ fontWeight:800, color: T.primary, whiteSpace:'nowrap', fontFamily:'monospace', fontSize:13, letterSpacing:'0.03em' }}>{fmt(e.duration_minutes)}</span>
            <Badge status={e.status} resubmitted={!!e.rejection_reason} />
          </div>
        ))}
        <button onClick={() => navigate('/report')} style={{
          marginTop:16, width:'100%', padding:'11px 0',
          borderRadius: T.radius,
          background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
          color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer',
          letterSpacing:'0.03em',
          boxShadow:'0 4px 14px rgba(30,58,138,0.3)',
          transition:'opacity 0.15s, transform 0.12s',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          fontFamily:'inherit',
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity='0.9'; e.currentTarget.style.transform='translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='translateY(0)'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          דיווח שעות חדש
        </button>
      </Card>
    </div>
  );
}
