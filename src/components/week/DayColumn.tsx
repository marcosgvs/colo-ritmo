import type { Bloco } from '@/types';
import { BlocoComContinuidade } from './BlocoComContinuidade';
import { NowLine } from './NowLine';

const VIEW_INICIO = 0;
const VIEW_FIM = 24;
const VIEW_HORAS = VIEW_FIM - VIEW_INICIO;

interface DayColumnProps {
  blocos: Bloco[];
  density: number;
  isHoje: boolean;
  isLast: boolean;
  onSelectBloco: (b: Bloco) => void;
}

export function DayColumn({ blocos, density, isHoje, isLast, onSelectBloco }: DayColumnProps) {
  const totalH = VIEW_HORAS * density;
  return (
    <div
      style={{
        position: 'relative',
        height: totalH,
        borderRight: isLast ? 'none' : '1px solid var(--line)',
        background: isHoje ? 'rgba(162,153,203,0.04)' : 'transparent',
      }}
    >
      {Array.from({ length: VIEW_HORAS + 1 }).map((_, i) => {
        const h = VIEW_INICIO + i;
        const major = h % 6 === 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: i * density,
              height: 1,
              background: major ? 'var(--line-2)' : 'var(--line)',
              opacity: major ? 1 : 0.4,
            }}
          />
        );
      })}

      {/* faixa madrugada (0-6h) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 6 * density,
          background: 'rgba(45,42,50,0.025)',
          pointerEvents: 'none',
        }}
      />
      {/* faixa noite (22-24h) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 22 * density,
          height: 2 * density,
          background: 'rgba(45,42,50,0.025)',
          pointerEvents: 'none',
        }}
      />

      {blocos.map((b, i) => {
        const start = Math.max(VIEW_INICIO, b.horaInicio);
        const end = Math.min(VIEW_FIM, b.horaInicio + b.duracao);
        const top = (start - VIEW_INICIO) * density;
        const h = (end - start) * density;
        if (h <= 0) return null;
        const adjusted = { ...b, duracao: end - start } as Bloco;
        return (
          <div
            key={`${b.id}-${b._seg}-${i}`}
            style={{ position: 'absolute', top, left: 4, right: 4 }}
          >
            <BlocoComContinuidade
              b={adjusted}
              density={density}
              onClick={() => onSelectBloco(b)}
            />
          </div>
        );
      })}

      {isHoje && <NowLine density={density} />}
    </div>
  );
}
