import type { CSSProperties, ReactNode } from 'react';

export type PillKind = 'ok' | 'warn' | 'err' | 'info' | 'neutral' | 'lavender' | 'aqua';

interface PillProps {
  children: ReactNode;
  kind?: PillKind;
  style?: CSSProperties;
  dot?: boolean;
}

const KINDS: Record<PillKind, { bg: string; ink: string }> = {
  ok:       { bg: 'var(--sage-surface)',     ink: 'var(--sage-ink)' },
  warn:     { bg: 'var(--sand-surface)',     ink: '#B8884A' },
  err:      { bg: 'var(--coral-surface)',    ink: 'var(--coral-ink)' },
  info:     { bg: 'var(--blue-surface)',     ink: 'var(--blue-text)' },
  neutral:  { bg: 'var(--bg-alt)',           ink: 'var(--ink-2)' },
  lavender: { bg: 'var(--lavender-surface)', ink: 'var(--lavender-ink)' },
  aqua:     { bg: 'var(--aqua-surface)',     ink: '#3D7884' },
};

export function Pill({ children, kind = 'neutral', style, dot = true }: PillProps) {
  const c = KINDS[kind];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 'var(--r-pill)',
        padding: '6px 12px',
        font: '700 11px/1 var(--font-body)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: c.bg,
        color: c.ink,
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: 'currentColor',
            opacity: 0.7,
          }}
        />
      )}
      {children}
    </span>
  );
}
