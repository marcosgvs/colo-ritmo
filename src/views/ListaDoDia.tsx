import { useMemo, useState } from 'react';
import type { Bloco, HospitaisMap } from '@/types';
import {
  adicionaDia,
  diaSemanaBR,
  DOWS_LONG,
  fmtDate,
  fmtRange,
  fromISO,
  getHospital,
  HOJE,
  inicioDaSemana,
  MESES,
  semanaDe,
} from '@/lib/data';
import { Eyebrow, Hand, IconConflito, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';

interface ListaDaSemanaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onSelectBloco: (b: Bloco) => void;
}

/**
 * Lista da semana · view linear, dia a dia, ordenada cronologicamente.
 * Cada dia da semana vira um header e os blocos do dia aparecem embaixo.
 * Dias sem nada mostram um separador sutil "aberto".
 */
export function ListaDoDia({ blocos, hospitais: _h, onSelectBloco }: ListaDaSemanaProps) {
  const [refIso, setRefIso] = useState<string>(HOJE);
  const semana = useMemo(() => semanaDe(refIso), [refIso]);
  const inicio = semana[0]!;
  const fim = semana[6]!;
  const label = formatRangeSemana(inicio, fim);

  const blocosPorDia = useMemo(() => {
    const m = new Map<string, Bloco[]>();
    for (const dia of semana) m.set(dia, []);
    for (const b of blocos) {
      if (!semana.includes(b.data)) continue;
      m.get(b.data)!.push(b);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.horaInicio - b.horaInicio);
    }
    return m;
  }, [blocos, semana]);

  const totalBlocos = Array.from(blocosPorDia.values()).reduce((s, a) => s + a.length, 0);

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <Eyebrow>semana · {label}</Eyebrow>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(28px, 3.5vw, 40px)',
            letterSpacing: '-0.02em',
            margin: '8px 0 0',
            color: 'var(--ink)',
          }}
        >
          a semana em lista.
        </h1>
        <Hand color="var(--lavender-ink)" size={20} style={{ display: 'block', marginTop: 8 }}>
          {totalBlocos === 0
            ? 'semana enxuta · nada agendado'
            : `${totalBlocos} ${totalBlocos === 1 ? 'item' : 'itens'} pra olhar`}
        </Hand>
      </div>

      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <NavSemanaLista refIso={refIso} setRefIso={setRefIso} />
      </div>

      {totalBlocos === 0 ? (
        <EmptyState
          titulo="semana aberta."
          recado="nada agendado por enquanto · vale aproveitar pra dormir adiantado."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {semana.map((dia) => {
            const items = blocosPorDia.get(dia) ?? [];
            const dt = fromISO(dia);
            const dow = DOWS_LONG[diaSemanaBR(dia)];
            const isHoje = dia === HOJE;
            return (
              <section key={dia}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    paddingBottom: 6,
                    marginBottom: 8,
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 22,
                      letterSpacing: '-0.01em',
                      color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
                    }}
                  >
                    {dt.getDate()} {MESES[dt.getMonth()]}
                  </span>
                  <span
                    style={{
                      font: '500 13px/1 var(--font-body)',
                      color: 'var(--ink-3)',
                      textTransform: 'lowercase',
                    }}
                  >
                    {dow}
                  </span>
                  {isHoje && (
                    <Hand color="var(--lavender-ink)" size={14}>
                      hoje
                    </Hand>
                  )}
                  <span style={{ flex: 1 }} />
                  <Mono style={{ color: 'var(--ink-3)' }}>
                    {items.length === 0
                      ? 'sem itens'
                      : `${items.length} ${items.length === 1 ? 'item' : 'itens'}`}
                  </Mono>
                </div>

                <TimelineDia dia={dia} blocos={blocos} />

                {items.length === 0 ? (
                  <Mono style={{ color: 'var(--ink-3)', display: 'block', padding: '4px 4px 8px' }}>
                    aberto
                  </Mono>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((b) => (
                      <ItemLinha key={`${b.id}-${b.data}`} b={b} onClick={() => onSelectBloco(b)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * Mini-timeline horizontal de 24h pra cada dia · plantão que cruza
 * meia-noite aparece também no dia seguinte (em 0-Xh), com cantos retos
 * do lado em que continua. Ajuda a ver "o sábado tá tomado até as 7h"
 * sem precisar repetir o item na lista.
 */
function TimelineDia({ dia, blocos }: { dia: string; blocos: Bloco[] }) {
  const segmentos = segmentosDoDia(blocos, dia);
  if (segmentos.length === 0) return null;

  return (
    <div
      style={{
        position: 'relative',
        height: 14,
        background: 'var(--bg-alt)',
        borderRadius: 4,
        marginBottom: 10,
        overflow: 'hidden',
      }}
    >
      {/* marcadores 6h / 12h / 18h */}
      {[6, 12, 18].map((h) => (
        <span
          key={h}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${(h / 24) * 100}%`,
            width: 1,
            background: 'var(--line-2)',
            opacity: 0.6,
          }}
        />
      ))}
      {segmentos.map((s, i) => {
        const hosp =
          s.bloco.tipo === 'plantao' || s.bloco.tipo === 'cedido'
            ? getHospital(s.bloco.hospitalId)
            : undefined;
        const cor = hosp ? `var(--${hosp.cor})` : 'var(--ink-3)';
        const ehCedido = s.bloco.tipo === 'cedido';
        return (
          <span
            key={`${s.bloco.id}-${i}`}
            title={tooltipSegmento(s)}
            style={{
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: `${(s.startHora / 24) * 100}%`,
              width: `${(s.durHora / 24) * 100}%`,
              background: cor,
              opacity: ehCedido ? 0.4 : 0.85,
              borderTopLeftRadius: s.continuaAntes ? 0 : 3,
              borderBottomLeftRadius: s.continuaAntes ? 0 : 3,
              borderTopRightRadius: s.continuaDepois ? 0 : 3,
              borderBottomRightRadius: s.continuaDepois ? 0 : 3,
              ...(ehCedido
                ? {
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent 0 3px, rgba(255,255,255,0.5) 3px 5px)',
                  }
                : null),
            }}
          />
        );
      })}
    </div>
  );
}

interface SegmentoDia {
  bloco: Bloco;
  /** 0-24 · hora local de início do segmento naquele dia. */
  startHora: number;
  /** Em horas · sempre dentro de [0, 24-startHora]. */
  durHora: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
}

/**
 * Retorna segmentos visíveis na timeline do `dia`. Considera apenas
 * tipos com horário (plantão/cedido/sono/bloqueio). Plantão noturno do
 * dia anterior vira segmento `continuaAntes=true` em 0-Xh deste dia.
 */
function segmentosDoDia(blocos: Bloco[], dia: string): SegmentoDia[] {
  const out: SegmentoDia[] = [];
  for (const b of blocos) {
    if (b.tipo === 'deslocamento') continue;
    const inicioH = b.horaInicio + 24 * diffDias(b.data, dia) * -1;
    // simplificado: trabalha em "horas relativas ao dia"
    const ini = b.horaInicio - 24 * diffDias(dia, b.data);
    const fim = ini + b.duracao;
    if (fim <= 0 || ini >= 24) continue;
    void inicioH;
    const startHora = Math.max(0, ini);
    const endHora = Math.min(24, fim);
    out.push({
      bloco: b,
      startHora,
      durHora: endHora - startHora,
      continuaAntes: ini < 0,
      continuaDepois: fim > 24,
    });
  }
  return out.sort((a, b) => a.startHora - b.startHora);
}

/** Diferença em dias entre dois ISOs (a-b). */
function diffDias(a: string, b: string): number {
  const da = fromISO(a).getTime();
  const db = fromISO(b).getTime();
  return Math.round((da - db) / (24 * 3600 * 1000));
}

function tooltipSegmento(s: SegmentoDia): string {
  const b = s.bloco;
  if (b.tipo === 'plantao' || b.tipo === 'cedido') {
    const hosp = getHospital(b.hospitalId);
    const prefixo = b.tipo === 'cedido' ? 'cedido · ' : '';
    return `${prefixo}${hosp?.abrev ?? '?'} · ${fmtRange(b.horaInicio, b.duracao)}`;
  }
  return `${b.tipo} · ${fmtRange(b.horaInicio, b.duracao)}`;
}

function ItemLinha({ b, onClick }: { b: Bloco; onClick: () => void }) {
  const hosp =
    b.tipo === 'plantao' || b.tipo === 'cedido' ? getHospital(b.hospitalId) : undefined;
  const cor = hosp?.cor ?? null;
  const titulo =
    b.tipo === 'plantao' && hosp
      ? hosp.abrev
      : b.tipo === 'sono'
        ? 'sono protegido'
        : b.tipo === 'bloqueio'
          ? `bloqueio${b.motivo ? ` · ${b.motivo}` : ''}`
          : b.tipo === 'cedido' && hosp
            ? `cedido · ${b.cedidoPara}`
            : b.tipo;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: cor ? `var(--${cor}-surface)` : 'var(--bg)',
        borderLeft: cor ? `3px solid var(--${cor})` : '3px solid var(--line-2)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '12px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        font: '500 14px/1.3 var(--font-body)',
        color: 'var(--ink)',
        width: '100%',
      }}
    >
      <Mono style={{ color: 'var(--ink-2)', minWidth: 110 }}>
        {fmtRange(b.horaInicio, b.duracao)}
      </Mono>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 17,
          letterSpacing: '-0.005em',
        }}
      >
        {titulo}
      </span>
      <span style={{ flex: 1 }} />
      <Mono style={{ color: 'var(--ink-3)' }}>{b.duracao}h</Mono>
      {b.tipo === 'plantao' && b.viaTroca && <Pill kind="lavender">via troca</Pill>}
      {b.tipo === 'plantao' && b.conflito && <IconConflito />}
    </button>
  );
}

function NavSemanaLista({ refIso, setRefIso }: { refIso: string; setRefIso: (i: string) => void }) {
  const seg = inicioDaSemana(refIso);
  const ehAtual = seg === inicioDaSemana(HOJE);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--bg-alt)',
        borderRadius: 999,
        padding: 4,
        border: '1px solid var(--line)',
      }}
    >
      <button type="button" aria-label="semana anterior" onClick={() => setRefIso(adicionaDia(seg, -7))} style={iconBtn}>
        ‹
      </button>
      <button
        type="button"
        onClick={() => setRefIso(HOJE)}
        disabled={ehAtual}
        style={{
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: 'none',
          cursor: ehAtual ? 'default' : 'pointer',
          background: ehAtual ? 'var(--bg)' : 'transparent',
          color: ehAtual ? 'var(--ink)' : 'var(--ink-2)',
          boxShadow: ehAtual ? 'var(--shadow-sm)' : 'none',
          textTransform: 'lowercase',
        }}
      >
        hoje
      </button>
      <button type="button" aria-label="semana próxima" onClick={() => setRefIso(adicionaDia(seg, 7))} style={iconBtn}>
        ›
      </button>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  font: '600 14px/1 var(--font-body)',
  width: 32,
  height: 32,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};

function formatRangeSemana(inicio: string, fim: string): string {
  const dIni = fromISO(inicio);
  const dFim = fromISO(fim);
  const mesIni = MESES[dIni.getMonth()];
  const mesFim = MESES[dFim.getMonth()];
  if (mesIni === mesFim) return `${dIni.getDate()}–${dFim.getDate()} ${mesIni} ${dIni.getFullYear()}`;
  return `${dIni.getDate()} ${mesIni} – ${dFim.getDate()} ${mesFim} ${dFim.getFullYear()}`;
}

void fmtDate;
