
export default function Spinner({ fullPage }) {
  const w = fullPage
    ? { position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.8)',zIndex:999 }
    : { display:'flex',justifyContent:'center',padding:32 };
  return (
    <div style={w}>
      <div style={{ width:28,height:28,border:'3px solid #e2e8f0',borderTop:'3px solid #6366f1',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
