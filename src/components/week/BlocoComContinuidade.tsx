import type { Bloco as BlocoT } from '@/types';
import { Bloco } from '@/components/atoms';
import { getHospital } from '@/lib/data';

interface BlocoComContinuidadeProps {
  b: BlocoT;
  density: number;
  onClick: () => void;
}

/**
 * Wrapper que adiciona a indicação visual de continuidade noturna:
 *   _seg='inicio' → faixa serrilhada no rodapé + seta pra baixo
 *   _seg='fim'    → faixa serrilhada no topo  + seta pra cima
 */
export function BlocoComContinuidade({ b, density, onClick }: BlocoComContinuidadeProps) {
  const seg = b._seg;
  const hosp = b.tipo === 'plantao' || b.tipo === 'cedido' ? getHospital(b.hospitalId) : undefined;
  const cor = hosp?.cor;
  const corInk = cor ? `var(--${cor}-ink)` : 'var(--ink-2)';
  const cortePattern = `linear-gradient(90deg, ${corInk} 0 6px, transparent 6px 12px)`;

  return (
    <div style={{ position: 'relative' }}>
      <Bloco b={b} density={density} onClick={onClick} />

      {seg === 'inicio' && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 8,
              background: cortePattern,
              backgroundSize: '12px 8px',
              opacity: 0.7,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              pointerEvents: 'none',
            }}
          />
          <div
            aria-label="entra na madrugada"
            title="entra na madrugada"
            style={{
              position: 'absolute',
              bottom: 4,
              right: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              background: corInk,
              color: 'var(--bg)',
              borderRadius: 999,
              pointerEvents: 'none',
              boxShadow: '0 1px 3px rgba(45,42,50,0.15)',
            }}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </>
      )}

      {seg === 'fim' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 8,
              background: cortePattern,
              backgroundSize: '12px 8px',
              opacity: 0.7,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              pointerEvents: 'none',
            }}
          />
          <div
            aria-label="vem de ontem"
            title="vem de ontem"
            style={{
              position: 'absolute',
              top: 4,
              right: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              background: corInk,
              color: 'var(--bg)',
              borderRadius: 999,
              pointerEvents: 'none',
              boxShadow: '0 1px 3px rgba(45,42,50,0.15)',
            }}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
