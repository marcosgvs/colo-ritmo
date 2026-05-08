import type { CSSProperties, ReactNode } from 'react';

interface EyebrowProps {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}

export function Eyebrow({ children, color, style }: EyebrowProps) {
  return (
    <span
      style={{
        font: '700 11px/1 var(--font-body)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: color || 'var(--ink-3)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
