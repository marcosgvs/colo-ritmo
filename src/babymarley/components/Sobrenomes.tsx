import type { CSSProperties } from 'react';
import { SOBRENOMES, type Lado } from '../data';
import { CORES_LADO, ROTULO_LADO } from '../tema';
import { Eyebrow } from '@/components/atoms/Eyebrow';

interface Props {
  ordem: string[];
  onToggle: (nome: string) => void;
}

const LADOS: Lado[] = [1, 2];

function chipStyle(lado: Lado, ativo: boolean): CSSProperties {
  const c = CORES_LADO[lado];
  return {
    padding: '8px 16px',
    borderRadius: 'var(--r-pill)',
    border: `1px solid ${ativo ? c.borda : 'var(--line-2)'}`,
    background: ativo ? c.surface : 'var(--bg)',
    color: ativo ? c.ink : 'var(--ink-2)',
    font: '500 15px/1 var(--font-body)',
    cursor: 'pointer',
    transition: 'border-color 140ms ease, background 140ms ease, color 140ms ease',
  };
}

export function Sobrenomes({ ordem, onToggle }: Props) {
  return (
    <section aria-labelledby="sobrenomes-titulo" style={{ display: 'grid', gap: 16 }}>
      <Eyebrow style={{ display: 'block' }}>
        <span id="sobrenomes-titulo">sobrenomes</span>
      </Eyebrow>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {LADOS.map((lado) => {
          const c = CORES_LADO[lado];
          return (
            <div key={lado} style={{ display: 'grid', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  font: '400 13px/1 var(--font-body)',
                  color: 'var(--ink-3)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c.ink, opacity: 0.65 }} />
                {ROTULO_LADO[lado]}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SOBRENOMES.filter((s) => s.lado === lado).map((s) => {
                  const ativo = ordem.includes(s.nome);
                  return (
                    <button
                      key={s.nome}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => onToggle(s.nome)}
                      style={chipStyle(lado, ativo)}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
