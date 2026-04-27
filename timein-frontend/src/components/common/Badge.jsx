
const M = { draft:['טיוטה','#f1f5f9','#64748b'], submitted:['הוגש','#dbeafe','#1d4ed8'], approved:['אושר','#d1fae5','#065f46'], rejected:['נדחה','#fee2e2','#991b1b'] };
export default function Badge({ status }) {
  const [l,bg,c] = M[status] || ['?','#f1f5f9','#64748b'];
  return <span style={{ fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:20,background:bg,color:c }}>{l}</span>;
}
