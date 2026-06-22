import type { CSSProperties } from 'react';
import { Eyebrow } from '@/components/atoms/Eyebrow';

interface Props {
  nomeCompleto: string;
  apelido: string | null;
  copiado: boolean;
  onCopiar: () => void;
}

const card: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-md)',
  padding: '28px 24px',
  textAlign: 'center',
};

export function NomeMontado({ nomeCompleto, apelido, copiado, onCopiar }: Props) {
  const temNome = nomeCompleto.trim().length > 0;

  return (
    <section aria-label="nome completo" style={card}>
      <Eyebrow style={{ display: 'block' }}>nome completo</Eyebrow>

      <p
        aria-live="polite"
        style={{
          marginTop: 12,
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(26px, 6.5vw, 42px)',
          fontWeight: 500,
          lineHeight: 1.08,
          letterSpacing: '-0.015em',
          color: temNome ? 'var(--ink)' : 'var(--ink-3)',
        }}
      >
        {temNome ? nomeCompleto : 'seu nome vai aparecer aqui'}
      </p>

      {apelido && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ font: '400 13px/1 var(--font-body)', color: 'var(--ink-3)' }}>apelido</span>
          <span style={{ font: '700 26px/0.9 var(--font-handwritten)', color: 'var(--lavender-ink)' }}>
            {apelido}
          </span>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onCopiar}
          disabled={!temNome}
          style={{
            padding: '10px 22px',
            borderRadius: 999,
            border: '1px solid var(--line-2)',
            background: 'var(--bg)',
            color: 'var(--ink)',
            font: '600 14px/1 var(--font-body)',
            cursor: temNome ? 'pointer' : 'not-allowed',
            opacity: temNome ? 1 : 0.45,
            transition: 'border-color 140ms ease, opacity 140ms ease',
          }}
        >
          {copiado ? 'copiado ✓' : 'copiar'}
        </button>
      </div>
    </section>
  );
}
