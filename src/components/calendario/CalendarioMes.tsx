import { useMemo } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import {
  diaSemanaBR,
  fimDoMes,
  fromISO,
  getHospital,
  HOJE,
  inicioDoMes,
  semanaDe,
} from '@/lib/data';
import { Eyebrow, Hand, Mono } from '@/components/atoms';

interface CalendarioMesProps {
  /** ISO de qualquer dia dentro do mês a renderizar (YYYY-MM-DD). */
  refIso: string;
  blocos: Bloco[];
  hospitais: HospitaisMap;
  /** Marcadores extras visuais (ex: blocos sugeridos). */
  marcadores?: Bloco[];
  onSelectBloco?: (b: Bloco) => void;
  /** Default false; se true, a coluna "soma" some. */
  semSoma?: boolean;
}

/**
 * CalendarioMes · grid 7 colunas + (opcional) coluna soma.
 *
 * Bloquinhos coloridos por hospital. `blocos` são os já confirmados;
 * `marcadores` aparecem com pattern listrado (sugestões do solver).
 */
export function CalendarioMes({
  refIso,
  blocos,
  hospitais: _h,
  marcadores = [],
  onSelectBloco,
  semSoma = false,
}: CalendarioMesProps) {
  const semanas = useMemo(() => calcularSemanas(refIso), [refIso]);
  const mesData = fromISO(refIso);

  const blocosPorDia = useMemo(() => {
    const m = new Map<string, Bloco[]>();
    for (const b of blocos) {
      const arr = m.get(b.data) ?? [];
      arr.push(b);
      m.set(b.data, arr);
    }
    return m;
  }, [blocos]);

  const marcadoresPorDia = useMemo(() => {
    const m = new Map<string, Bloco[]>();
    for (const b of marcadores) {
      const arr = m.get(b.data) ?? [];
      arr.push(b);
      m.set(b.data, arr);
    }
    return m;
  }, [marcadores]);

  const cols = semSoma ? 'repeat(7, 1fr)' : 'repeat(7, 1fr) 56px';

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols,
          background: 'var(--bg-alt)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((dow) => (
          <div
            key={dow}
            style={{
              padding: '12px 10px',
              font: '700 10px/1 var(--font-body)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            {dow}
          </div>
        ))}
        {!semSoma && (
          <div
            style={{
              padding: '12px 10px',
              font: '700 10px/1 var(--font-body)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              textAlign: 'right',
            }}
          >
            soma
          </div>
        )}
      </div>

      {semanas.map((semana, i) => {
        let cargaSem = 0;
        for (const dia of semana) {
          for (const b of blocosPorDia.get(dia) ?? []) {
            if (b.tipo === 'plantao') cargaSem += b.duracao;
          }
          for (const b of marcadoresPorDia.get(dia) ?? []) {
            if (b.tipo === 'plantao') cargaSem += b.duracao;
          }
        }
        return (
          <div
            key={`${semana[0]}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: cols,
              borderBottom: i === semanas.length - 1 ? 'none' : '1px solid var(--line)',
            }}
          >
            {semana.map((iso) => {
              const dataObj = fromISO(iso);
              const noMes = dataObj.getMonth() === mesData.getMonth();
              const isHoje = iso === HOJE;
              const items = (blocosPorDia.get(iso) ?? []).filter(
                (b): b is BlocoPlantao => b.tipo === 'plantao',
              );
              const sugItems = (marcadoresPorDia.get(iso) ?? []).filter(
                (b): b is BlocoPlantao => b.tipo === 'plantao',
              );
              const bloqueio = (blocosPorDia.get(iso) ?? []).find(
                (b) => b.tipo === 'bloqueio',
              );
              return (
                <div
                  key={iso}
                  style={{
                    minHeight: 96,
                    padding: 8,
                    borderRight: '1px solid var(--line)',
                    background: isHoje
                      ? 'var(--lavender-surface)'
                      : bloqueio
                      ? 'transparent'
                      : 'transparent',
                    backgroundImage: bloqueio
                      ? 'repeating-linear-gradient(135deg, rgba(58,46,42,0.06) 0 6px, transparent 6px 14px)'
                      : undefined,
                    opacity: noMes ? 1 : 0.45,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 500,
                        fontSize: 16,
                        letterSpacing: '-0.01em',
                        color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
                      }}
                    >
                      {dataObj.getDate()}
                    </span>
                    {isHoje && (
                      <Hand color="var(--lavender-ink)" size={12}>
                        hoje
                      </Hand>
                    )}
                  </div>
                  {bloqueio && bloqueio.tipo === 'bloqueio' && (
                    <div
                      style={{
                        font: '500 10px/1.2 var(--font-body)',
                        color: 'var(--ink-3)',
                        fontStyle: 'italic',
                      }}
                    >
                      bloq{bloqueio.motivo ? ` · ${bloqueio.motivo}` : ''}
                    </div>
                  )}
                  {items.slice(0, 2).map((p) => {
                    const hosp = getHospital(p.hospitalId);
                    if (!hosp) return null;
                    return (
                      <Bloquinho
                        key={`c-${p.id}`}
                        cor={hosp.cor}
                        abrev={hosp.abrev}
                        duracao={p.duracao}
                        onClick={onSelectBloco ? () => onSelectBloco(p) : undefined}
                      />
                    );
                  })}
                  {sugItems.slice(0, 2).map((p) => {
                    const hosp = getHospital(p.hospitalId);
                    if (!hosp) return null;
                    return (
                      <Bloquinho
                        key={`s-${p.id}`}
                        cor={hosp.cor}
                        abrev={hosp.abrev}
                        duracao={p.duracao}
                        sugerido
                      />
                    );
                  })}
                  {(items.length + sugItems.length) > 2 && (
                    <Mono style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                      +{items.length + sugItems.length - 2}
                    </Mono>
                  )}
                </div>
              );
            })}
            {!semSoma && (
              <div
                style={{
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: cargaSem >= 60 ? 'var(--coral-ink)' : cargaSem >= 40 ? '#B8884A' : 'var(--sage-ink)',
                }}
              >
                {cargaSem}h
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface BloquinhoProps {
  cor: string;
  abrev: string;
  duracao: number;
  sugerido?: boolean;
  onClick?: () => void;
}

function Bloquinho({ cor, abrev, duracao, sugerido, onClick }: BloquinhoProps) {
  const surface = `var(--${cor}-surface)`;
  const ink = `var(--${cor}-ink)`;
  const background = sugerido
    ? `repeating-linear-gradient(135deg, ${surface}, ${surface} 4px, color-mix(in oklab, ${ink} 14%, transparent) 4px, color-mix(in oklab, ${ink} 14%, transparent) 8px)`
    : surface;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        textAlign: 'left',
        background,
        borderLeft: `3px solid var(--${cor})`,
        borderRadius: 6,
        padding: '4px 6px',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        font: '600 10px/1.2 var(--font-body)',
        color: ink,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span>{abrev}</span>
      <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {duracao}h</span>
    </button>
  );
}

function calcularSemanas(refIso: string): string[][] {
  const inicio = inicioDoMes(refIso);
  const fim = fimDoMes(refIso);
  const out: string[][] = [];
  let cursor = semanaDe(inicio)[0]!;
  const fimDt = fromISO(fim).getTime();
  let safety = 6;
  while (fromISO(cursor).getTime() <= fimDt && safety-- > 0) {
    const sem = semanaDe(cursor);
    out.push(sem);
    const proxSeg = new Date(`${cursor}T12:00:00`);
    proxSeg.setDate(proxSeg.getDate() + 7);
    cursor = proxSeg.toISOString().slice(0, 10);
  }
  return out;
}

void diaSemanaBR;
void Eyebrow;
