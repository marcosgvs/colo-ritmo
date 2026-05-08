import type { ReactNode } from 'react';
import { Eyebrow, Hand } from '@/components/atoms';

interface EmptyStateProps {
  eyebrow?: string;
  titulo: string;
  /** Texto humano em handwritten/italic. */
  recado?: string;
  /** CTA opcional · um único botão. */
  acao?: { label: string; onClick: () => void };
  ilustra?: ReactNode;
}

/**
 * EmptyState · respira mais que ocupa espaço. Toca o tom: nem "vazio",
 * nem "ainda não". Usa Hand (italic Fraunces) pra deixar humano.
 */
export function EmptyState({ eyebrow, titulo, recado, acao, ilustra }: EmptyStateProps) {
  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        border: '1px dashed var(--line-2)',
        borderRadius: 'var(--r-xl)',
        padding: '48px 32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {ilustra}
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 24,
          letterSpacing: '-0.01em',
          margin: 0,
          color: 'var(--ink)',
        }}
      >
        {titulo}
      </h3>
      {recado && (
        <Hand color="var(--ink-2)" size={18} style={{ display: 'block', maxWidth: 340 }}>
          {recado}
        </Hand>
      )}
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          style={{
            marginTop: 8,
            font: '600 13px/1 var(--font-body)',
            padding: '10px 22px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--ink)',
            color: 'var(--bg)',
            cursor: 'pointer',
          }}
        >
          {acao.label}
        </button>
      )}
    </div>
  );
}
