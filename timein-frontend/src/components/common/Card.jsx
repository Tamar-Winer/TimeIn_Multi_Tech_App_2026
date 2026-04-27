
export default function Card({ children, style={} }) {
  return <div style={{ background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 20px',...style }}>{children}</div>;
}
