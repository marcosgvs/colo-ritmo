import { useMemo } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import {
  adicionaDia,
  DOWS,
  diaSemanaBR,
  espelhoDescanso,
  faixasRecuperacaoNaSemana,
  faixaAbsoluta,
  fmtRange,
  fromISO,
  getHospital,
  MESES,
} from '@/lib/data';
import { Eyebrow, Mono, Pill } from '@/components/atoms';

const MS_HORA = 3_600_000;

interface JanelaPreviewProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  novoBloco: BlocoPlantao;
  /** Dias antes/depois do novo plantão · default 1. */
  raioDias?: number;
}

/**
 * Faixa horizontal de 72h pra ver o contexto antes/depois de aceitar um
 * plantão. Mostra plantões existentes + o proposto + as recuperações
 * que ele invade. É o "espelho" que mata a percepção de "vazio = livre"
 * — quando ela vê dia inteiro de plantão depois de noturno, ela enxerga
 * que aquilo não é descanso.
 */
export function JanelaPreview({ blocos, hospitais: _h, novoBloco, raioDias = 1 }: JanelaPreviewProps) {
  const espelho = useMemo(
    () => espelhoDescanso(blocos, novoBloco, raioDias),
    [blocos, novoBloco, raioDias],
  );

  const dias = useMemo(() => {
    const out: string[] = [];
    let cursor = espelho.janelaIni;
    while (cursor <= espelho.janelaFim) {
      out.push(cursor);
      cursor = adicionaDia(cursor, 1);
    }
    return out;
  }, [espelho.janelaIni, espelho.janelaFim]);

  const totalHoras = dias.length * 24;
  const iniAbs = new Date(`${espelho.janelaIni}T00:00:00`).getTime() / MS_HORA;

  const plantoesExistentes = useMemo(
    () =>
      blocos.filter((b): b is BlocoPlantao => {
        if (b.tipo !== 'plantao') return false;
        const f = faixaAbsoluta(b);
        return f.fim > iniAbs && f.ini < iniAbs + totalHoras;
      }),
    [blocos, iniAbs, totalHoras],
  );

  const recuperacoesDepois = useMemo(
    () => faixasRecuperacaoNaSemana([...blocos, novoBloco], dias),
    [blocos, novoBloco, dias],
  );

  function offsetPct(b: { data: string; horaInicio: number; duracao: number }) {
    const t = new Date(`${b.data}T00:00:00`).getTime() / MS_HORA;
    const left = t + b.horaInicio - iniAbs;
    const width = b.duracao;
    return {
      left: `${(Math.max(0, left) / totalHoras) * 100}%`,
      width: `${(Math.min(width, totalHoras - left) / totalHoras) * 100}%`,
    };
  }

  function offsetPctFaixa(iniHora: number, dur: number, dia: string) {
    const t = new Date(`${dia}T00:00:00`).getTime() / MS_HORA;
    const left = t + iniHora - iniAbs;
    return {
      left: `${(Math.max(0, left) / totalHoras) * 100}%`,
      width: `${(dur / totalHoras) * 100}%`,
    };
  }

  const horasAntes = Math.floor(espelho.antes.maiorDescansoContinuo);
  const horasDepois = Math.floor(espelho.depois.maiorDescansoContinuo);
  const piorouNoturna =
    espelho.depois.recuperacoesInvadidas.length >
    espelho.antes.recuperacoesInvadidas.length;
  const ganhouDiaSeguido = espelho.depois.diasSeguidos > espelho.antes.diasSeguidos;

  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <Eyebrow>preview · {dias.length} dias</Eyebrow>
        <Mono style={{ color: 'var(--ink-3)' }}>
          {fmtRange(novoBloco.horaInicio, novoBloco.duracao)} · {novoBloco.duracao}h
        </Mono>
      </div>

      <div
        style={{
          position: 'relative',
          height: 64,
          background: 'var(--bg)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* separadores de dia */}
        {dias.slice(1).map((d, i) => (
          <div
            key={d}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(((i + 1) * 24) / totalHoras) * 100}%`,
              width: 1,
              background: 'var(--line)',
            }}
          />
        ))}

        {/* faixa madrugada (0-6h) por dia */}
        {dias.map((d, i) => (
          <div
            key={`dawn-${d}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(((i * 24) + 0) / totalHoras) * 100}%`,
              width: `${(6 / totalHoras) * 100}%`,
              background: 'rgba(45,42,50,0.04)',
            }}
          />
        ))}

        {/* recuperações invadidas (cinza listrado) */}
        {recuperacoesDepois.map((f, i) => {
          const { left, width } = offsetPctFaixa(f.iniHora, f.duracao, f.data);
          return (
            <div
              key={`rec-${i}`}
              title="recuperação pós-plantão noturno · invadida"
              style={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                left,
                width,
                backgroundImage:
                  'repeating-linear-gradient(135deg, rgba(58,46,42,0.16) 0 4px, transparent 4px 9px)',
                backgroundColor: 'rgba(58,46,42,0.05)',
                borderRadius: 4,
              }}
            />
          );
        })}

        {/* plantões existentes */}
        {plantoesExistentes.map((p) => {
          const hosp = getHospital(p.hospitalId);
          const cor = hosp ? `var(--${hosp.cor})` : 'var(--ink-2)';
          const corInk = hosp ? `var(--${hosp.cor}-ink)` : 'var(--ink)';
          const { left, width } = offsetPct(p);
          const widthPct = parseFloat(width);
          // só mostra label se houver largura mínima (~3%)
          const mostraLabel = widthPct >= 3;
          return (
            <div
              key={`p-${p.id}`}
              title={`${hosp?.abrev ?? '?'} · ${fmtRange(p.horaInicio, p.duracao)}`}
              style={{
                position: 'absolute',
                top: 10,
                height: 44,
                left,
                width,
                background: cor,
                borderRadius: 4,
                opacity: 0.92,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: '700 10px/1 var(--font-body)',
                color: corInk,
                letterSpacing: '0.02em',
                overflow: 'hidden',
                padding: '0 2px',
                textTransform: 'uppercase',
              }}
            >
              {mostraLabel && hosp?.abrev}
            </div>
          );
        })}

        {/* plantão proposto · listrado */}
        {(() => {
          const hosp = getHospital(novoBloco.hospitalId);
          const cor = hosp ? `var(--${hosp.cor})` : 'var(--lavender)';
          const corInk = hosp ? `var(--${hosp.cor}-ink)` : 'var(--lavender-ink)';
          const { left, width } = offsetPct(novoBloco);
          const widthPct = parseFloat(width);
          const mostraLabel = widthPct >= 5;
          return (
            <div
              title={`proposto · ${fmtRange(novoBloco.horaInicio, novoBloco.duracao)}`}
              style={{
                position: 'absolute',
                top: 10,
                height: 44,
                left,
                width,
                backgroundColor: cor,
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 4px, transparent 4px 8px)',
                border: `1.5px dashed ${corInk}`,
                borderRadius: 4,
                opacity: 0.98,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: '700 10px/1 var(--font-body)',
                color: corInk,
                letterSpacing: '0.02em',
                overflow: 'hidden',
                padding: '0 2px',
                textTransform: 'uppercase',
              }}
            >
              {mostraLabel && (hosp?.abrev ?? 'NOVO')}
            </div>
          );
        })()}
      </div>

      {/* labels dos dias */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${dias.length}, 1fr)`,
          marginTop: 6,
          gap: 0,
        }}
      >
        {dias.map((d) => {
          const dt = fromISO(d);
          const dow = DOWS[diaSemanaBR(d)];
          const ehNovo = d === novoBloco.data;
          return (
            <div
              key={d}
              style={{
                font: '500 11px/1 var(--font-body)',
                color: ehNovo ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: ehNovo ? 700 : 500,
                textAlign: 'center',
                letterSpacing: '0.02em',
                textTransform: 'lowercase',
              }}
            >
              {dow} {dt.getDate()} {MESES[dt.getMonth()]}
            </div>
          );
        })}
      </div>

      {/* legenda */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 10,
          font: '500 10px/1.2 var(--font-body)',
          color: 'var(--ink-3)',
        }}
      >
        <LegendaItem>
          <span style={{ width: 14, height: 10, borderRadius: 2, background: 'var(--ink-3)', opacity: 0.7 }} />
          existente
        </LegendaItem>
        <LegendaItem>
          <span
            style={{
              width: 14,
              height: 10,
              borderRadius: 2,
              backgroundColor: 'var(--lavender)',
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 3px, transparent 3px 6px)',
              border: '1px dashed var(--lavender-ink)',
            }}
          />
          novo
        </LegendaItem>
        <LegendaItem>
          <span
            style={{
              width: 14,
              height: 10,
              borderRadius: 2,
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(58,46,42,0.16) 0 3px, transparent 3px 6px)',
              backgroundColor: 'rgba(58,46,42,0.05)',
            }}
          />
          recuperação invadida
        </LegendaItem>
      </div>

      {/* resumo antes/depois */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px dashed var(--line-2)',
          flexWrap: 'wrap',
        }}
      >
        <Mono style={{ color: 'var(--ink-3)' }}>antes</Mono>
        <span style={{ font: '600 16px/1 var(--font-display)', color: 'var(--ink-2)' }}>
          {horasAntes}h livres
        </span>
        <span style={{ color: 'var(--ink-3)' }}>→</span>
        <Mono style={{ color: 'var(--ink-3)' }}>depois</Mono>
        <span
          style={{
            font: '600 16px/1 var(--font-display)',
            color: espelho.piora ? 'var(--coral-ink)' : 'var(--sage-ink)',
          }}
        >
          {horasDepois}h livres
        </span>
        {piorouNoturna && (
          <Pill kind="err" dot={false}>
            invade recuperação
          </Pill>
        )}
        {ganhouDiaSeguido && espelho.depois.alerta3DiasSeguidos && (
          <Pill kind="err" dot={false}>
            {espelho.depois.diasSeguidos} dias seguidos
          </Pill>
        )}
        {espelho.depois.alertaDescansoCurto && !piorouNoturna && (
          <Pill kind="err" dot={false}>
            descanso curto
          </Pill>
        )}
      </div>
    </div>
  );
}

function LegendaItem({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {children}
    </span>
  );
}
