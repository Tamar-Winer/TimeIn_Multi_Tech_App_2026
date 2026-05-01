
export default function Avatar({ name, size = 32, dark = false }) {
  const ini = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: dark ? 'rgba(59,130,246,0.2)' : '#DBEAFE',
      color:      dark ? '#93C5FD'               : '#1E3A8A',
      border:     dark ? '1px solid rgba(59,130,246,0.3)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
      letterSpacing: '-0.3px',
    }}>
      {ini}
    </div>
  );
}
