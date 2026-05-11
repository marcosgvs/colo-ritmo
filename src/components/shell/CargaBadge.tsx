import { nivelCarga } from '@/lib/data';

interface CargaBadgeProps {
  horas: number;
  big?: boolean;
  /** Sem o texto "esta sem." · usado em mobile pra economizar largura. */
  compact?: boolean;
}

const TOKENS = {
  ok:   { bg: 'var(--sage-surface)',  ink: 'var(--sage-ink)',  marca: 'var(--sage)' },
  warn: { bg: 'var(--sand-surface)',  ink: '#B8884A',          marca: '#D9A85A' },
  err:  { bg: 'var(--coral-surface)', ink: 'var(--coral-ink)', marca: 'var(--coral)' },
} as const;

export function CargaBadge({ horas, big = false, compact = false }: CargaBadgeProps) {
  const tokens = TOKENS[nivelCarga(horas)];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: big ? 10 : compact ? 6 : 8,
        padding: big ? '8px 14px 8px 10px' : compact ? '5px 10px 5px 8px' : '5px 12px 5px 8px',
        background: tokens.bg,
        borderRadius: 999,
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: big ? 8 : 6,
          height: big ? 8 : 6,
          borderRadius: 999,
          background: tokens.marca,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: big ? 18 : 14,
          color: tokens.ink,
          letterSpacing: '-0.01em',
        }}
      >
        {horas}h
      </span>
      {!compact && (
        <span
          style={{
            font: '600 10px/1 var(--font-body)',
            color: tokens.ink,
            opacity: 0.75,
            textTransform: 'lowercase',
            letterSpacing: '0.02em',
          }}
        >
          esta sem.
        </span>
      )}
    </div>
  );
}
