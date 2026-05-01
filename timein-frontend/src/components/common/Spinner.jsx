
export default function Spinner({ fullPage }) {
  const wrap = fullPage
    ? { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(249,250,251,0.9)', zIndex: 999 }
    : { display: 'flex', justifyContent: 'center', padding: 40 };
  return (
    <div style={wrap}>
      <div style={{
        width: 32, height: 32,
        border: '3px solid #E5E7EB',
        borderTop: '3px solid #1E3A8A',
        borderRadius: '50%',
        animation: 'ti-spin 0.7s linear infinite',
      }} />
      <style>{'@keyframes ti-spin { to { transform: rotate(360deg) } }'}</style>
    </div>
  );
}
