
export default function Avatar({ name, size=32 }) {
  const ini = name?.split(' ').map(w => w[0]).join('').slice(0,2) || '??';
  return <div style={{ width:size,height:size,borderRadius:'50%',background:'#e0e7ff',color:'#4f46e5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:500,flexShrink:0 }}>{ini}</div>;
}
