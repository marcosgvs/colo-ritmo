import type { Bloco } from '@/types';
import { DOWS, HOJE, SEMANA, faixasRecuperacaoNaSemana } from '@/lib/data';
import { Hand } from '@/components/atoms';
import { DayColumn } from './DayColumn';
import { blocosDoDia, expandirBlocos } from './expandirBlocos';

const VIEW_INICIO = 0;
const VIEW_FIM = 24;
const VIEW_HORAS = VIEW_FIM - VIEW_INICIO;

interface WeekGridProps {
  blocos: Bloco[];
  density?: number;
  semanaLabel?: string;
  /** Lista de 7 dias ISO (segunda → domingo). Default: SEMANA constante. */
  semanaIso?: readonly string[];
  /** Dia a ser destacado como hoje. Default: HOJE constante. */
  hojeIso?: string;
  onSelectBloco?: (b: Bloco) => void;
}

/**
 * WeekGrid · grade de Semana com 24h por dia. Plantões noturnos viram
 * dois segmentos visuais via expandirBlocos. NowLine só aparece no dia
 * marcado como hojeIso. Density compactada de 32 → 24 px/h: agenda fica
 * em ~576px em vez de 768px.
 */
export function WeekGrid({
  blocos,
  density = 24,
  semanaLabel,
  semanaIso = SEMANA,
  hojeIso = HOJE,
  onSelectBloco,
}: WeekGridProps) {
  const totalH = VIEW_HORAS * density;
  const expandidos = expandirBlocos(blocos);
  const recPorDia = faixasRecuperacaoNaSemana(blocos, semanaIso);
  // Click num segmento (madrugada/início) deve abrir o bloco ORIGINAL
  // — sem isso, drawer mostra "00:00 → 07:00 · 7h" em vez de
  // "19:00 → 07:00 · 12h" do plantão noturno completo.
  const handleSelect = (b: Bloco) => {
    if (!onSelectBloco) return;
    const original = blocos.find((x) => x.id === b.id) ?? b;
    onSelectBloco(original);
  };

  return (
    <div
      style={{
        background: 'var(--bg)',
        borderRadius: 20,
        border: '1px solid var(--line)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '56px repeat(7, 1fr)',
          background: 'var(--bg-alt)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            padding: '12px 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-3)',
            textAlign: 'right',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {semanaLabel?.split(' ')[0] ?? ''}
        </div>
        {semanaIso.map((d, i) => {
          const isHoje = d === hojeIso;
          const dt = new Date(`${d}T12:00:00`);
          return (
            <div
              key={d}
              style={{
                padding: '10px 8px',
                textAlign: 'left',
                borderLeft: '1px solid var(--line)',
                background: isHoje ? 'var(--lavender-surface)' : 'transparent',
              }}
            >
              <div
                style={{
                  font: '700 10px/1 var(--font-body)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isHoje ? 'var(--lavender-ink)' : 'var(--ink-3)',
                  marginBottom: 4,
                }}
              >
                {DOWS[i]}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 20,
                    lineHeight: 1,
                    color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {dt.getDate()}
                </span>
                {isHoje && (
                  <Hand color="var(--lavender-ink)" size={13} style={{ marginBottom: 2 }}>
                    hoje
                  </Hand>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '56px repeat(7, 1fr)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: totalH,
            borderRight: '1px solid var(--line)',
          }}
        >
          {Array.from({ length: VIEW_HORAS }).map((_, i) => {
            const h = VIEW_INICIO + i;
            const major = h % 3 === 0;
            // No density compacto, só renderiza labels major pra não ficar abafado.
            if (!major) return null;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * density,
                  right: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--ink-3)',
                  lineHeight: 1,
                  paddingTop: 3,
                }}
              >
                {String(h).padStart(2, '0')}h
              </div>
            );
          })}
        </div>

        {semanaIso.map((d, idx) => (
          <DayColumn
            key={d}
            blocos={blocosDoDia(expandidos, d)}
            faixasRecuperacao={recPorDia.filter((r) => r.data === d)}
            density={density}
            isHoje={d === hojeIso}
            isLast={idx === 6}
            onSelectBloco={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
