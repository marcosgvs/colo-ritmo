import type { Bloco } from '@/types';
import { DOWS, HOJE, SEMANA } from '@/lib/data';
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
  onSelectBloco?: (b: Bloco) => void;
}

/**
 * WeekGrid · grade de Semana com 24h por dia. Plantões noturnos viram
 * dois segmentos visuais via expandirBlocos. NowLine só aparece no dia
 * marcado como HOJE.
 */
export function WeekGrid({
  blocos,
  density = 32,
  semanaLabel = '4–10 mai 2026',
  onSelectBloco,
}: WeekGridProps) {
  const totalH = VIEW_HORAS * density;
  const expandidos = expandirBlocos(blocos);
  const handleSelect = onSelectBloco ?? (() => {});

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
          gridTemplateColumns: '64px repeat(7, 1fr)',
          background: 'var(--bg-alt)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            padding: '14px 6px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-3)',
            textAlign: 'right',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {semanaLabel.split(' ')[0]}
        </div>
        {SEMANA.map((d, i) => {
          const isHoje = d === HOJE;
          const dt = new Date(`${d}T12:00:00`);
          return (
            <div
              key={d}
              style={{
                padding: '12px 8px',
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
                  marginBottom: 6,
                }}
              >
                {DOWS[i]}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 22,
                    lineHeight: 1,
                    color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {dt.getDate()}
                </span>
                {isHoje && (
                  <Hand color="var(--lavender-ink)" size={14} style={{ marginBottom: 2 }}>
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
          gridTemplateColumns: '64px repeat(7, 1fr)',
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
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * density,
                  right: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: major ? 10 : 9,
                  color: 'var(--ink-3)',
                  opacity: major ? 1 : 0.4,
                  lineHeight: 1,
                  paddingTop: 4,
                }}
              >
                {String(h).padStart(2, '0')}h
              </div>
            );
          })}
        </div>

        {SEMANA.map((d, idx) => (
          <DayColumn
            key={d}
            blocos={blocosDoDia(expandidos, d)}
            density={density}
            isHoje={d === HOJE}
            isLast={idx === 6}
            onSelectBloco={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}
