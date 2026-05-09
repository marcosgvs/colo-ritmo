import { useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap, Nivel } from '@/types';
import {
  cargaSemanal,
  diaSemanaBR,
  fimDoMes,
  fmtDate,
  fromISO,
  getHospital,
  HOJE,
  inicioDoMes,
  semanaDe,
} from '@/lib/data';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';

interface MesProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onSelectBloco: (b: Bloco) => void;
}

const MESES_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Mês · 4-6 semanas com heatmap de carga + cards-resumo lateral.
 * Foco: decisão macro · "essa semana tá pesada, mês 64h" · não é
 * editor, só visualização. Pra editar, abre Drawer.
 */
export function Mes({ blocos, hospitais, onSelectBloco }: MesProps) {
  const [refIso, setRefIso] = useState<string>(HOJE);

  const semanas = useMemo(() => {
    const inicio = inicioDoMes(refIso);
    const fim = fimDoMes(refIso);
    const out: string[][] = [];
    let cursor = semanaDe(inicio)[0]!;
    const fimDt = fromISO(fim).getTime();
    while (fromISO(cursor).getTime() <= fimDt) {
      const sem = semanaDe(cursor);
      out.push(sem);
      cursor = semanaDe(sem[6]!)[0]!; // próxima segunda
      // segurança: não loopa pra sempre
      if (out.length > 6) break;
      // próxima semana = adicionar 7 dias da segunda atual
      const proxSeg = new Date(`${cursor}T12:00:00`);
      proxSeg.setDate(proxSeg.getDate() + 7);
      cursor = proxSeg.toISOString().slice(0, 10);
    }
    return out;
  }, [refIso]);

  const mesData = fromISO(refIso);
  const mesNome = MESES_LONG[mesData.getMonth()];
  const ano = mesData.getFullYear();

  const blocosPorDia = useMemo(() => {
    const m = new Map<string, Bloco[]>();
    for (const b of blocos) {
      const arr = m.get(b.data) ?? [];
      arr.push(b);
      m.set(b.data, arr);
    }
    return m;
  }, [blocos]);

  const cargaDoMes = useMemo(() => {
    return blocos.reduce((sum, b) => {
      if (b.tipo !== 'plantao') return sum;
      const d = fromISO(b.data);
      if (d.getFullYear() !== mesData.getFullYear()) return sum;
      if (d.getMonth() !== mesData.getMonth()) return sum;
      return sum + b.duracao;
    }, 0);
  }, [blocos, mesData]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div>
          <Eyebrow>{`${mesNome} · ${ano}`}</Eyebrow>
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
            o mês todo de cima.
          </h1>
          <Hand color="var(--lavender-ink)" size={20} style={{ display: 'block', marginTop: 8 }}>
            {`${cargaDoMes}h previstas — média de ${semanas.length > 0 ? (cargaDoMes / semanas.length).toFixed(0) : 0}h/sem`}
          </Hand>
        </div>
        <NavMes refIso={refIso} setRefIso={setRefIso} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
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
              gridTemplateColumns: 'repeat(7, 1fr) 56px',
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
          </div>

          {semanas.map((semana, i) => {
            const cargaSem = cargaSemanal(
              semana.flatMap((d) => blocosPorDia.get(d) ?? []),
            );
            const niv: Nivel = cargaSem < 40 ? 'ok' : cargaSem < 60 ? 'warn' : 'err';
            return (
              <div
                key={`${semana[0]}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr) 56px',
                  borderBottom: i === semanas.length - 1 ? 'none' : '1px solid var(--line)',
                }}
              >
                {semana.map((iso) => {
                  const dataObj = fromISO(iso);
                  const noMes = dataObj.getMonth() === mesData.getMonth();
                  const isHoje = iso === HOJE;
                  const blocosDia = blocosPorDia.get(iso) ?? [];
                  const plantoesDia = blocosDia.filter(
                    (b): b is BlocoPlantao => b.tipo === 'plantao',
                  );
                  const cargaDia = plantoesDia.reduce((s, p) => s + p.duracao, 0);
                  const opacidadeBg =
                    cargaDia > 0 ? Math.min(0.4, 0.08 + cargaDia * 0.02) : 0;
                  return (
                    <div
                      key={iso}
                      style={{
                        minHeight: 96,
                        padding: 8,
                        borderRight: '1px solid var(--line)',
                        background: isHoje
                          ? 'var(--lavender-surface)'
                          : `rgba(199,114,100,${opacidadeBg})`,
                        opacity: noMes ? 1 : 0.45,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
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
                      {plantoesDia.slice(0, 2).map((p) => {
                        const hosp = getHospital(p.hospitalId);
                        if (!hosp) return null;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => onSelectBloco(p)}
                            style={{
                              textAlign: 'left',
                              background: `var(--${hosp.cor}-surface)`,
                              borderLeft: `3px solid var(--${hosp.cor})`,
                              borderRadius: 6,
                              padding: '4px 6px',
                              border: 'none',
                              cursor: 'pointer',
                              font: '600 10px/1.2 var(--font-body)',
                              color: `var(--${hosp.cor}-ink)`,
                            }}
                          >
                            {hosp.abrev} · {p.duracao}h
                          </button>
                        );
                      })}
                      {plantoesDia.length > 2 && (
                        <Mono style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                          +{plantoesDia.length - 2}
                        </Mono>
                      )}
                    </div>
                  );
                })}
                <div
                  style={{
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 500,
                    color:
                      niv === 'ok'
                        ? 'var(--sage-ink)'
                        : niv === 'warn'
                          ? '#B8884A'
                          : 'var(--coral-ink)',
                  }}
                >
                  {cargaSem}h
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ResumoMes blocos={blocos} hospitais={hospitais} mesAno={`${mesNome} ${ano}`} />
        </div>
      </div>
    </>
  );
}

interface NavMesProps {
  refIso: string;
  setRefIso: (iso: string) => void;
}

function NavMes({ refIso, setRefIso }: NavMesProps) {
  const ehAtual = refIso.slice(0, 7) === HOJE.slice(0, 7);

  function ajusta(deltaMeses: number) {
    const d = fromISO(refIso);
    d.setMonth(d.getMonth() + deltaMeses, 1);
    setRefIso(d.toISOString().slice(0, 10));
  }

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
      <button
        type="button"
        aria-label="mês anterior"
        onClick={() => ajusta(-1)}
        style={navBtnStyle}
      >
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
        este mês
      </button>
      <button
        type="button"
        aria-label="próximo mês"
        onClick={() => ajusta(1)}
        style={navBtnStyle}
      >
        ›
      </button>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  font: '600 14px/1 var(--font-body)',
  width: 32,
  height: 32,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};

interface ResumoMesProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  mesAno: string;
}

function ResumoMes({ blocos, hospitais, mesAno }: ResumoMesProps) {
  const plantoes = blocos.filter((b): b is BlocoPlantao => b.tipo === 'plantao');
  const plantoesFuturos = plantoes
    .filter((p) => p.data >= HOJE)
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio);
  const porHosp = new Map<string, { qt: number; horas: number }>();
  for (const p of plantoes) {
    const r = porHosp.get(p.hospitalId) ?? { qt: 0, horas: 0 };
    r.qt += 1;
    r.horas += p.duracao;
    porHosp.set(p.hospitalId, r);
  }
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: '18px 20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16 }}>
          por hospital
        </span>
        <Eyebrow>{mesAno}</Eyebrow>
      </div>
      {porHosp.size === 0 && (
        <Mono style={{ color: 'var(--ink-3)', display: 'block' }}>nenhum plantão no mês</Mono>
      )}
      {Array.from(porHosp.entries()).map(([id, r]) => {
        const hosp = hospitais[id];
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px dashed var(--line-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: `var(--${hosp?.cor ?? 'lavender'})`,
                }}
              />
              <span style={{ font: '500 14px/1.3 var(--font-body)' }}>
                {hosp?.abrev ?? id}
              </span>
            </div>
            <Mono style={{ color: 'var(--ink-2)' }}>
              {r.qt}× · {r.horas}h
            </Mono>
          </div>
        );
      })}
      {plantoes.length > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Mono>total</Mono>
          <Pill kind="lavender">{plantoes.length} plantões</Pill>
        </div>
      )}
      {plantoesFuturos[0] && (
        <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 14 }}>
          próximo: {fmtDate(plantoesFuturos[0].data)}
          {dayOfWeek(plantoesFuturos[0].data) === 6 ? ' · final de semana' : ''}
        </Hand>
      )}
    </div>
  );
}

function dayOfWeek(iso: string): number {
  return diaSemanaBR(iso);
}
