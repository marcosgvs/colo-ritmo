import type { ReactNode } from 'react';
import { Eyebrow, Hand } from '@/components/atoms';
import { useIsMobile } from '@/hooks/useIsMobile';

interface PageHeadProps {
  eyebrow?: string;
  titulo: string;
  hand?: string;
  /** Ações ou switchers no canto direito · sentence case minúsculo. */
  direita?: ReactNode;
}

export function PageHead({ eyebrow, titulo, hand, direita }: PageHeadProps) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: isMobile ? 14 : 24,
        flexWrap: 'wrap',
        marginBottom: isMobile ? 18 : 28,
      }}
    >
      <div style={{ minWidth: 0, flex: '1 1 auto', maxWidth: '100%' }}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            // mobile · escala suave de 26px (iphone) até 44px (desktop)
            fontSize: 'clamp(26px, 7vw, 44px)',
            letterSpacing: '-0.02em',
            margin: '8px 0 0',
            color: 'var(--ink)',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {titulo}
        </h1>
        {hand && (
          <Hand
            color="var(--lavender-ink)"
            size={isMobile ? 16 : 22}
            style={{ display: 'block', marginTop: isMobile ? 8 : 10 }}
          >
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
