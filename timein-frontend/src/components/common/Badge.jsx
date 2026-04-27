
const M = {
  draft:       ['טיוטה',              '#f1f5f9','#64748b'],
  submitted:   ['הוגש',               '#dbeafe','#1d4ed8'],
  resubmitted: ['הוחזר לבדיקה נוספת','#fef3c7','#92400e'],
  approved:    ['אושר',               '#d1fae5','#065f46'],
  rejected:    ['נדחה',               '#fee2e2','#991b1b'],
};
export default function Badge({ status, resubmitted }) {
  const key = (resubmitted && status === 'submitted') ? 'resubmitted' : status;
  const [l,bg,c] = M[key] || ['?','#f1f5f9','#64748b'];
  return <span style={{ fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:20,background:bg,color:c }}>{l}</span>;
}
