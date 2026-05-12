import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bloco, HospitaisMap } from '@/types';
import {
  DOWS,
  diaSemanaBR,
  fmtRange,
  fromISO,
  getHospital,
  HOJE,
  MESES,
  semanaDe,
} from '@/lib/data';
import { Eyebrow, Hand, Mono } from '@/components/atoms';

interface ListaDaSemanaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onSelectBloco: (b: Bloco) => void;
}

const HOUR_PX = 22;
const DAY_PX = 24 * HOUR_PX;
const RAIL_W = 48;
const N_DIAS = 7;

/**
 * Semana mobile · timeline linear vertical contínua. O tempo flui de
 * cima pra baixo num único eixo (7 dias × 24h = 3696px). Plantões
 * noturnos são UM bloco que atravessa naturalmente a divisão dos dias
 * — sem precisar partir/duplicar/marcar.
 *
 * Orientação espacial vem de 3 camadas:
 *   1. Chips de dia sticky no topo · tap = scrollTo
 *   2. Rail lateral à esquerda · régua de fundo + badge sticky do dia
 *      atualmente visível (clamp dentro do bloco do dia)
 *   3. Divisor de dia atravessando a timeline com pílula nomeando o dia
 */
export function ListaDoDia({ blocos, hospitais: _h, onSelectBloco }: ListaDaSemanaProps) {
  const [refIso, setRefIso] = useState<string>(HOJE);
  const semana = useMemo(() => semanaDe(refIso), [refIso]);
  const hojeIdx = semana.indexOf(HOJE);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [currentDay, setCurrentDay] = useState<number>(hojeIdx >= 0 ? hojeIdx : 0);
  const [agora, setAgora] = useState<number>(horaDecimalAgora());

  // Atualiza "agora" a cada minuto enquanto a view está aberta
  useEffect(() => {
    const t = setInterval(() => setAgora(horaDecimalAgora()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Scroll inicial: se hoje está na semana, abre próximo do "agora";
  // senão, abre no início do primeiro dia.
  useEffect(() => {
    if (!scrollRef.current) return;
    if (hojeIdx >= 0) {
      const nowTop = (hojeIdx * 24 + agora) * HOUR_PX;
      scrollRef.current.scrollTop = Math.max(0, nowTop - 200);
    } else {
      scrollRef.current.scrollTop = 0;
    }
    setCurrentDay(hojeIdx >= 0 ? hojeIdx : 0);
    // não depende de `agora` · só queremos o scroll inicial na mudança
    // de semana de referência
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refIso]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const t = e.currentTarget.scrollTop;
    setScrollTop(t);
    const probe = t + 120;
    const d = Math.max(0, Math.min(N_DIAS - 1, Math.floor(probe / DAY_PX)));
    setCurrentDay(d);
  }

  function scrollToDay(i: number) {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: i * DAY_PX - 8, behavior: 'smooth' });
  }

  const items = useMemo(
    () =>
      blocos.filter((b) => {
        if (b.tipo === 'deslocamento') return false;
        // Inclui blocos cujo dia de início está na semana visível
        return semana.includes(b.data);
      }),
    [blocos, semana],
  );

  const inicioSemana = semana[0]!;
  const fimSemana = semana[6]!;

  return (
    <div
      style={{
        // anula o padding do main pra ocupar full-bleed mobile
        margin: '-32px -28px -120px',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        background: 'var(--bg)',
      }}
    >
      <HeaderSemana
        inicio={inicioSemana}
        fim={fimSemana}
        refIso={refIso}
        setRefIso={setRefIso}
      />

      <DayChips
        semana={semana}
        currentDay={currentDay}
        hojeIdx={hojeIdx}
        items={items}
        onPick={scrollToDay}
      />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
          background: 'var(--bg)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Timeline
          semana={semana}
          items={items}
          hojeIdx={hojeIdx}
          currentDay={currentDay}
          scrollTop={scrollTop}
          agora={agora}
          onSelectBloco={onSelectBloco}
        />
      </div>
    </div>
  );
}

function HeaderSemana({
  inicio,
  fim,
  refIso,
  setRefIso,
}: {
  inicio: string;
  fim: string;
  refIso: string;
  setRefIso: (i: string) => void;
}) {
  const titulo = labelRangeSemana(inicio, fim);
  const inicioHoje = semanaDe(HOJE)[0];
  const ehAtual = semanaDe(refIso)[0] === inicioHoje;
  return (
    <div
      style={{
        padding: '14px 18px 8px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Eyebrow style={{ fontSize: 10 }}>sua semana</Eyebrow>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            marginTop: 2,
            color: 'var(--ink)',
          }}
        >
          {titulo}
        </h2>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          aria-label="semana anterior"
          onClick={() => setRefIso(adicionaDiaISO(inicio, -7))}
          style={navBtn}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="semana próxima"
          onClick={() => setRefIso(adicionaDiaISO(inicio, 7))}
          style={navBtn}
        >
          ›
        </button>
        {!ehAtual && (
          <button
            type="button"
            onClick={() => setRefIso(HOJE)}
            style={{
              font: '600 12px/1 var(--font-body)',
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'var(--bg-alt)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              textTransform: 'lowercase',
            }}
          >
            hoje
          </button>
        )}
      </div>
    </div>
  );
}

interface DayChipsProps {
  semana: readonly string[];
  currentDay: number;
  hojeIdx: number;
  items: Bloco[];
  onPick: (i: number) => void;
}

function DayChips({ semana, currentDay, hojeIdx, items, onPick }: DayChipsProps) {
  const temPlantao = (i: number) =>
    items.some((b) => semana.indexOf(b.data) === i && (b.tipo === 'plantao' || b.tipo === 'cedido'));

  return (
    <div
      style={{
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-alt)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '8px 6px',
        }}
      >
        {semana.map((d, i) => {
          const isActive = i === currentDay;
          const isHoje = i === hojeIdx;
          const tp = temPlantao(i);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(i)}
              style={{
                position: 'relative',
                border: 'none',
                background: 'transparent',
                padding: '6px 0 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  font: '700 9px/1 var(--font-body)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isHoje ? 'var(--lavender-ink)' : 'var(--ink-3)',
                }}
              >
                {DOWS[diaSemanaBR(d)]}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 18,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
                  width: 26,
                  height: 26,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  background: isActive
                    ? isHoje
                      ? 'var(--lavender-surface)'
                      : 'var(--bg)'
                    : 'transparent',
                  outline: isActive
                    ? `1.5px solid ${isHoje ? 'var(--lavender-ink)' : 'var(--ink)'}`
                    : 'none',
                  transition: 'all 160ms ease',
                }}
              >
                {fromISO(d).getDate()}
              </span>
              <span
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: tp
                    ? isHoje
                      ? 'var(--lavender-ink)'
                      : 'var(--ink-3)'
                    : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TimelineProps {
  semana: readonly string[];
  items: Bloco[];
  hojeIdx: number;
  currentDay: number;
  scrollTop: number;
  agora: number;
  onSelectBloco: (b: Bloco) => void;
}

function Timeline({
  semana,
  items,
  hojeIdx,
  currentDay,
  scrollTop,
  agora,
  onSelectBloco,
}: TimelineProps) {
  const total = N_DIAS * DAY_PX;
  const nowTop = hojeIdx >= 0 ? (hojeIdx * 24 + agora) * HOUR_PX : null;

  return (
    <div
      style={{
        position: 'relative',
        height: total + 80,
        minHeight: total + 80,
        paddingBottom: 60,
      }}
    >
      <HourGrid />
      {/* faixas de madrugada (00–06h de cada dia) */}
      {Array.from({ length: N_DIAS }).map((_, i) => (
        <span
          key={`mad-${i}`}
          aria-hidden
          style={{
            position: 'absolute',
            left: RAIL_W,
            right: 0,
            top: i * DAY_PX,
            height: 6 * HOUR_PX,
            background:
              'linear-gradient(180deg, rgba(58,46,42,0.04), rgba(58,46,42,0.015) 70%, transparent)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* divisores de dia */}
      {Array.from({ length: N_DIAS }).map((_, i) => (
        <DayDivider key={`div-${i}`} semana={semana} idx={i} hojeIdx={hojeIdx} />
      ))}

      <SideRail
        semana={semana}
        currentDay={currentDay}
        scrollTop={scrollTop}
        hojeIdx={hojeIdx}
      />

      {nowTop != null && <NowLine top={nowTop} agora={agora} />}

      {items.map((b) => (
        <BlocoLinear
          key={`${b.id}-${b.data}`}
          b={b}
          semana={semana}
          onClick={() => onSelectBloco(b)}
        />
      ))}

      {/* fim da semana */}
      <div
        style={{
          position: 'absolute',
          top: total + 12,
          left: RAIL_W + 12,
          right: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ height: 1, flex: 1, background: 'var(--line-2)' }} />
        <Mono style={{ color: 'var(--ink-3)' }}>próxima semana</Mono>
        <span style={{ height: 1, flex: 1, background: 'var(--line-2)' }} />
      </div>
    </div>
  );
}

function HourGrid() {
  const linhas: React.ReactNode[] = [];
  for (let d = 0; d < N_DIAS; d++) {
    for (let h = 1; h < 24; h++) {
      const top = d * DAY_PX + h * HOUR_PX;
      const major = h % 6 === 0;
      linhas.push(
        <span
          key={`l-${d}-${h}`}
          aria-hidden
          style={{
            position: 'absolute',
            left: RAIL_W,
            right: 0,
            top,
            height: 1,
            background: 'var(--line)',
            opacity: major ? 0.9 : 0.35,
          }}
        />,
      );
      if (major) {
        linhas.push(
          <span
            key={`hl-${d}-${h}`}
            style={{
              position: 'absolute',
              left: RAIL_W + 6,
              top: top - 6,
              fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
              fontSize: 9,
              color: 'var(--ink-3)',
              background: 'var(--bg)',
              padding: '0 4px',
            }}
          >
            {String(h).padStart(2, '0')}h
          </span>,
        );
      }
    }
  }
  return <>{linhas}</>;
}

function DayDivider({
  semana,
  idx,
  hojeIdx,
}: {
  semana: readonly string[];
  idx: number;
  hojeIdx: number;
}) {
  const top = idx * DAY_PX;
  const data = semana[idx]!;
  const isHoje = idx === hojeIdx;
  const dt = fromISO(data);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top,
        height: 28,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        zIndex: 4,
      }}
    >
      <div style={{ width: RAIL_W }} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 4,
          paddingRight: 14,
        }}
      >
        <span
          style={{
            font: '700 10px/1 var(--font-body)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: isHoje ? 'var(--lavender-ink)' : 'var(--ink-3)',
            background: 'var(--bg)',
            padding: '4px 8px',
            borderRadius: 999,
            border: `1px solid ${isHoje ? 'var(--lavender)' : 'var(--line-2)'}`,
          }}
        >
          {DOWS[diaSemanaBR(data)]} {dt.getDate()}
          {isHoje ? ' · hoje' : ''}
        </span>
        <span
          aria-hidden
          style={{
            flex: 1,
            height: 1,
            borderTop: `1.5px dashed ${isHoje ? 'var(--lavender)' : 'var(--line-2)'}`,
          }}
        />
      </div>
    </div>
  );
}

function SideRail({
  semana,
  currentDay,
  scrollTop,
  hojeIdx,
}: {
  semana: readonly string[];
  currentDay: number;
  scrollTop: number;
  hojeIdx: number;
}) {
  const total = N_DIAS * DAY_PX;
  const dayTop = currentDay * DAY_PX;
  const dayBot = dayTop + DAY_PX;
  const stickyTop = scrollTop + 8;
  const railBadgeY = Math.max(dayTop + 12, Math.min(stickyTop, dayBot - 90));
  const data = semana[currentDay]!;
  const isHoje = currentDay === hojeIdx;
  const dt = fromISO(data);

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: RAIL_W,
          height: total,
          borderRight: '1px solid var(--line)',
          background: 'var(--bg-alt)',
        }}
      />

      {/* régua de fundo · cada dia mostra sigla + número discretos */}
      {semana.map((d, i) => {
        const dDt = fromISO(d);
        const dEhHoje = i === hojeIdx;
        return (
          <div
            key={`mk-${d}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: i * DAY_PX,
              width: RAIL_W,
              height: DAY_PX,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 40,
                left: 0,
                right: 6,
                textAlign: 'center',
                font: '700 9px/1 var(--font-body)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: dEhHoje ? 'var(--lavender-ink)' : 'var(--ink-3)',
                opacity: 0.6,
              }}
            >
              {DOWS[diaSemanaBR(d)]}
            </span>
            <span
              style={{
                position: 'absolute',
                top: 56,
                left: 0,
                right: 6,
                textAlign: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1,
                color: dEhHoje ? 'var(--lavender-ink)' : 'var(--ink-2)',
                letterSpacing: '-0.02em',
                opacity: 0.7,
              }}
            >
              {dDt.getDate()}
            </span>
          </div>
        );
      })}

      {/* badge sticky · dia atual em destaque */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 4,
          top: railBadgeY,
          width: RAIL_W - 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0 10px',
          background: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
          color: 'var(--bg)',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(58,46,42,0.18)',
          transition: 'top 240ms cubic-bezier(.2,.7,.2,1), background 200ms',
          zIndex: 5,
        }}
      >
        <span
          style={{
            font: '700 9px/1 var(--font-body)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.7,
          }}
        >
          {DOWS[diaSemanaBR(data)]}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 22,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            marginTop: 4,
          }}
        >
          {dt.getDate()}
        </span>
        {isHoje && (
          <span
            style={{
              fontFamily: 'var(--font-handwritten, "Caveat", cursive)',
              fontSize: 13,
              lineHeight: 1,
              marginTop: 4,
              opacity: 0.95,
            }}
          >
            hoje
          </span>
        )}
      </div>
    </>
  );
}

function NowLine({ top, agora }: { top: number; agora: number }) {
  const hh = Math.floor(agora);
  const mm = Math.floor((agora - hh) * 60);
  const label = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: RAIL_W,
        right: 0,
        top,
        height: 0,
        borderTop: '2px solid var(--lavender-ink)',
        zIndex: 6,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: -1,
          top: -5,
          width: 10,
          height: 10,
          borderRadius: 999,
          background: 'var(--lavender-ink)',
          boxShadow: '0 0 0 3px var(--bg)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: 8,
          top: -16,
          font: '700 9px/1 var(--font-body)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--lavender-ink)',
          background: 'var(--bg)',
          padding: '2px 6px',
          borderRadius: 999,
          border: '1px solid var(--lavender)',
        }}
      >
        agora · {label}
      </span>
    </div>
  );
}

function BlocoLinear({
  b,
  semana,
  onClick,
}: {
  b: Bloco;
  semana: readonly string[];
  onClick: () => void;
}) {
  const dIdx = semana.indexOf(b.data);
  if (dIdx < 0) return null;
  const top = (dIdx * 24 + b.horaInicio) * HOUR_PX;
  const height = b.duracao * HOUR_PX;
  const cruza = b.horaInicio + b.duracao > 24;
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: RAIL_W + 14,
    right: 14,
    top,
    height,
    boxSizing: 'border-box',
    cursor: 'pointer',
    overflow: 'hidden',
  };

  if (b.tipo === 'plantao') {
    const hosp = getHospital(b.hospitalId);
    if (!hosp) return null;
    const ate24px = (24 - b.horaInicio) * HOUR_PX;
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: `var(--${hosp.cor}-surface)`,
          borderLeft: `4px solid var(--${hosp.cor})`,
          borderRadius: 14,
          padding: '10px 12px',
          boxShadow: '0 1px 2px rgba(58,46,42,0.06)',
          textAlign: 'left',
          color: 'var(--ink)',
          zIndex: 3,
        }}
      >
        {b.conflito && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 14,
              border: '2px solid var(--coral-ink)',
              pointerEvents: 'none',
              animation: 'colo-pulse-conflict 2.4s ease-in-out infinite',
            }}
          />
        )}
        {b.viaTroca && (
          <span
            aria-hidden
            title="recebido em troca"
            style={{
              position: 'absolute',
              top: 8,
              right: 10,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--lavender)',
              boxShadow: '0 0 0 2px var(--bg)',
            }}
          />
        )}

        <Eyebrow color={`var(--${hosp.cor}-ink)`}>{hosp.abrev}</Eyebrow>
        <div style={{ font: '600 14px/1.15 var(--font-body)', color: 'var(--ink)', marginTop: 4 }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
            fontSize: 11,
            color: 'var(--ink-2)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {b.duracao}h
          {cruza && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                background: 'var(--bg)',
                borderRadius: 999,
                border: `1px solid var(--${hosp.cor})`,
                color: `var(--${hosp.cor}-ink)`,
                font: '700 9px/1 var(--font-body)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              ⌄ vira o dia
            </span>
          )}
        </div>

        {cruza && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: ate24px - 1,
              height: 2,
              background: `repeating-linear-gradient(90deg, var(--${hosp.cor}-ink) 0 4px, transparent 4px 8px)`,
              opacity: 0.55,
              pointerEvents: 'none',
            }}
          />
        )}

        {height > 100 && b.viaTroca && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 12,
              font: '500 11px/1.2 var(--font-body)',
              color: 'var(--lavender-ink)',
              fontStyle: 'italic',
            }}
          >
            via troca
          </div>
        )}
      </button>
    );
  }

  if (b.tipo === 'sono') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: 'var(--sage-surface)',
          borderRadius: 14,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'left',
          border: 'none',
          zIndex: 2,
        }}
      >
        <Hand color="var(--sage-ink)" size={height > 80 ? 18 : 14}>
          sono protegido
        </Hand>
        {height > 56 && (
          <Mono style={{ color: 'var(--sage-ink)', opacity: 0.8, marginTop: 4 }}>
            {b.duracao}h livres
          </Mono>
        )}
      </button>
    );
  }

  if (b.tipo === 'bloqueio') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background:
            'repeating-linear-gradient(135deg, var(--bg-alt), var(--bg-alt) 6px, var(--bg) 6px, var(--bg) 12px)',
          border: '1px dashed rgba(58,46,42,0.18)',
          borderRadius: 14,
          padding: '10px 12px',
          textAlign: 'left',
          color: 'var(--ink-2)',
          zIndex: 2,
        }}
      >
        <Eyebrow>bloqueio</Eyebrow>
        {b.motivo && (
          <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink-2)', marginTop: 4 }}>
            {b.motivo}
          </div>
        )}
      </button>
    );
  }

  if (b.tipo === 'cedido') {
    const hosp = getHospital(b.hospitalId);
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background:
            'repeating-linear-gradient(135deg, var(--sand-surface), var(--sand-surface) 5px, transparent 5px, transparent 10px)',
          opacity: 0.75,
          borderRadius: 14,
          padding: '8px 12px',
          textAlign: 'left',
          border: 'none',
          zIndex: 2,
        }}
      >
        <Eyebrow
          style={{ textDecoration: 'line-through' }}
          color={hosp ? `var(--${hosp.cor}-ink)` : undefined}
        >
          cedido · {b.cedidoPara}
        </Eyebrow>
        <Mono style={{ color: 'var(--ink-3)', marginTop: 3 }}>
          {fmtRange(b.horaInicio, b.duracao)} · não soma
        </Mono>
      </button>
    );
  }

  if (b.tipo === 'consulta') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: 'var(--bg)',
          border: '1px solid var(--coral)',
          borderLeft: '4px solid var(--coral-ink)',
          borderRadius: 14,
          padding: '10px 12px',
          textAlign: 'left',
          color: 'var(--ink)',
          zIndex: 2,
        }}
      >
        <Eyebrow color="var(--coral-ink)">consulta{b.local ? ` · ${b.local}` : ''}</Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', marginTop: 4 }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
      </button>
    );
  }

  if (b.tipo === 'estudo') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: 'var(--blue-surface)',
          borderLeft: '4px solid var(--blue-ink)',
          borderRadius: 14,
          padding: '10px 12px',
          textAlign: 'left',
          color: 'var(--ink)',
          border: '1px solid transparent',
          zIndex: 2,
        }}
      >
        <Eyebrow color="var(--blue-ink)">
          estudo{b.titulo ? ` · ${b.titulo}` : ''}
        </Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', marginTop: 4 }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
      </button>
    );
  }

  if (b.tipo === 'pessoal') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: 'var(--sand-surface)',
          borderLeft: '4px solid var(--sand-ink)',
          borderRadius: 14,
          padding: '10px 12px',
          textAlign: 'left',
          color: 'var(--ink)',
          border: '1px solid transparent',
          zIndex: 2,
        }}
      >
        <Eyebrow color="var(--sand-ink)">pessoal</Eyebrow>
        <div style={{ font: '500 13px/1.3 var(--font-body)', marginTop: 4 }}>
          {b.titulo || 'compromisso'}
        </div>
        {height > 60 && (
          <Mono style={{ color: 'var(--ink-3)', marginTop: 3 }}>
            {fmtRange(b.horaInicio, b.duracao)}
          </Mono>
        )}
      </button>
    );
  }

  if (b.tipo === 'outros') {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...baseStyle,
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderLeft: '4px solid var(--ink-3)',
          borderRadius: 14,
          padding: '10px 12px',
          textAlign: 'left',
          color: 'var(--ink)',
          zIndex: 2,
        }}
      >
        <Eyebrow>{b.titulo ? 'evento' : 'outros'}</Eyebrow>
        <div style={{ font: '500 13px/1.3 var(--font-body)', marginTop: 4 }}>
          {b.titulo || 'evento'}
        </div>
        {height > 60 && (
          <Mono style={{ color: 'var(--ink-3)', marginTop: 3 }}>
            {fmtRange(b.horaInicio, b.duracao)}
          </Mono>
        )}
      </button>
    );
  }

  return null;
}

function horaDecimalAgora(): number {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function adicionaDiaISO(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function labelRangeSemana(inicio: string, fim: string): string {
  const dIni = fromISO(inicio);
  const dFim = fromISO(fim);
  const mesIni = MESES[dIni.getMonth()];
  const mesFim = MESES[dFim.getMonth()];
  if (mesIni === mesFim) return `${dIni.getDate()}–${dFim.getDate()} ${mesIni}`;
  return `${dIni.getDate()} ${mesIni} – ${dFim.getDate()} ${mesFim}`;
}

const navBtn: React.CSSProperties = {
  font: '600 16px/1 var(--font-body)',
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg-alt)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};
