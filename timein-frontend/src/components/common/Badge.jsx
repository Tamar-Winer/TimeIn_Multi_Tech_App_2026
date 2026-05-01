
const M = {
  draft:       ['טיוטה',         '#F3F4F6', '#6B7280'],
  submitted:   ['הוגש',          '#EFF6FF', '#1E3A8A'],
  resubmitted: ['הוחזר לבדיקה', '#FFFBEB', '#D97706'],
  approved:    ['אושר',          '#ECFDF5', '#059669'],
  rejected:    ['נדחה',          '#FEF2F2', '#DC2626'],
};

export default function Badge({ status, resubmitted }) {
  const key = (resubmitted && status === 'submitted') ? 'resubmitted' : status;
  const [l, bg, c] = M[key] || ['?', '#F3F4F6', '#6B7280'];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: '3px 10px', borderRadius: 20,
      background: bg, color: c,
      letterSpacing: '0.02em', whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {l}
    </span>
  );
}
