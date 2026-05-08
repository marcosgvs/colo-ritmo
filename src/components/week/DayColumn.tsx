import type { Bloco } from '@/types';
import type { FaixaRecuperacaoNoDia } from '@/lib/data';
import { BlocoComContinuidade } from './BlocoComContinuidade';
import { NowLine } from './NowLine';

const VIEW_INICIO = 0;
const VIEW_FIM = 24;
const VIEW_HORAS = VIEW_FIM - VIEW_INICIO;

interface DayColumnProps {
  blocos: Bloco[];
  faixasRecuperacao?: FaixaRecuperacaoNoDia[];
  density: number;
  isHoje: boolean;
  isLast: boolean;
  onSelectBloco: (b: Bloco) => void;
}

export function DayColumn({
  blocos,
  faixasRecuperacao = [],
  density,
  isHoje,
  isLast,
  onSelectBloco,
}: DayColumnProps) {
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

      {/* recuperação invadida · só aparece quando há plantão depois consumindo a janela pós-noite */}
      {faixasRecuperacao.map((f, i) => {
        const top = (Math.max(VIEW_INICIO, f.iniHora) - VIEW_INICIO) * density;
        const h = (Math.min(VIEW_FIM, f.iniHora + f.duracao) - Math.max(VIEW_INICIO, f.iniHora)) * density;
        if (h <= 0) return null;
        return (
          <div
            key={`rec-${f.plantaoId}-${i}`}
            aria-label="recuperação pós-noite"
            title="recuperação pós-plantão noturno · invadida pelo próximo plantão"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top,
              height: h,
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(58,46,42,0.06) 0 6px, transparent 6px 14px)',
              backgroundColor: 'rgba(58,46,42,0.04)',
              borderTop: '1px dashed rgba(58,46,42,0.18)',
              borderBottom: '1px dashed rgba(58,46,42,0.18)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        );
      })}

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
