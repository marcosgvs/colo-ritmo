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
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
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
      {b.tipo === 'plantao' && b.conflito && <Pill kind="err">conflito</Pill>}
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
