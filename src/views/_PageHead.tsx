import type { ReactNode } from 'react';
import { Eyebrow, Hand } from '@/components/atoms';

interface PageHeadProps {
  eyebrow?: string;
  titulo: string;
  hand?: string;
  /** Ações ou switchers no canto direito · sentence case minúsculo. */
  direita?: ReactNode;
}

export function PageHead({ eyebrow, titulo, hand, direita }: PageHeadProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
        marginBottom: 28,
      }}
    >
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(34px, 4vw, 44px)',
            letterSpacing: '-0.02em',
            margin: '8px 0 0',
            color: 'var(--ink)',
          }}
        >
          {titulo}
        </h1>
        {hand && (
          <Hand color="var(--lavender-ink)" size={22} style={{ display: 'block', marginTop: 10 }}>
            {hand}
          </Hand>
        )}
      </div>
      {direita && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {direita}
        </div>
      )}
    </div>
  );
}
