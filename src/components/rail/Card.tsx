import type { ReactNode } from 'react';
import { Eyebrow } from '@/components/atoms';

interface CardProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}

export function Card({ title, eyebrow, children }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: '18px 20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 16,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </span>
        {eyebrow && <Eyebrow style={{ fontSize: 10 }}>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}
