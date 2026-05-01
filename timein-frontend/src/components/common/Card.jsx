
import { T } from '../../theme';

export default function Card({ children, style = {} }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: T.radiusLg,
      padding: '20px 24px',
      boxShadow: T.shadow,
      ...style,
    }}>
      {children}
    </div>
  );
}
