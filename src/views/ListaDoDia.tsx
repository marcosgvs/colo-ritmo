import { useMemo, useState } from 'react';
import type { Bloco, HospitaisMap } from '@/types';
import {
  adicionaDia,
  diaSemanaBR,
  DOWS,
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
 * Lista da semana · layout 2 colunas (DATA | EVENTOS). Plantão noturno
 * que atravessa meia-noite aparece em DOIS dias, conectado visualmente:
 *   - no dia X: card com borda inferior reta + tag "termina amanhã 07h"
 *   - no dia X+1: card com borda superior reta + tag "começou ontem 19h"
 * mesma cor, mesma família, parecem um único bloco partido.
 */
export function ListaDoDia({ blocos, hospitais: _h, onSelectBloco }: ListaDaSemanaProps) {
  const [refIso, setRefIso] = useState<string>(HOJE);
  const semana = useMemo(() => semanaDe(refIso), [refIso]);
  const inicio = semana[0]!;
  const fim = semana[6]!;
  const label = formatRangeSemana(inicio, fim);

  const segmentosPorDia = useMemo(() => {
    const m = new Map<string, SegmentoVisivel[]>();
    for (const dia of semana) m.set(dia, segmentosDoDia(blocos, dia));
    return m;
  }, [blocos, semana]);

  const totalBlocos = Array.from(segmentosPorDia.values()).reduce(
    (s, a) => s + a.filter((seg) => !seg.continuaAntes).length,
    0,
  );

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
            const segs = segmentosPorDia.get(dia) ?? [];
            return (
              <DiaLinha
                key={dia}
                dia={dia}
                segs={segs}
                onSelectBloco={onSelectBloco}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

interface DiaLinhaProps {
  dia: string;
  segs: SegmentoVisivel[];
  onSelectBloco: (b: Bloco) => void;
}

function DiaLinha({ dia, segs, onSelectBloco }: DiaLinhaProps) {
  const dt = fromISO(dia);
  const isHoje = dia === HOJE;

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr',
        gap: 14,
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          paddingTop: 4,
          minWidth: 0,
        }}
      >
        <span
          style={{
            font: '500 28px/1 var(--font-display)',
            color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {String(dt.getDate()).padStart(2, '0')}
        </span>
        <span
          style={{
            font: '600 10px/1 var(--font-body)',
            color: isHoje ? 'var(--lavender-ink)' : 'var(--ink-3)',
            letterSpacing: '0.1em',
            marginTop: 6,
            textTransform: 'uppercase',
          }}
        >
          {DOWS[diaSemanaBR(dia)]}
        </span>
        {isHoje && (
          <span
            aria-hidden
            style={{
              marginTop: 8,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--lavender-ink)',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {segs.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--line-2)',
              borderRadius: 10,
              padding: '14px 16px',
              color: 'var(--ink-3)',
              font: '500 13px/1 var(--font-body)',
            }}
          >
            aberto
          </div>
        ) : (
          segs.map((seg, i) => (
            <ItemCard
              key={`${seg.bloco.id}-${seg.continuaAntes ? 'a' : 'b'}-${i}`}
              seg={seg}
              onClick={() => onSelectBloco(seg.bloco)}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface ItemCardProps {
  seg: SegmentoVisivel;
  onClick: () => void;
}

function ItemCard({ seg, onClick }: ItemCardProps) {
  const { bloco, continuaAntes, continuaDepois } = seg;
  const hosp =
    bloco.tipo === 'plantao' || bloco.tipo === 'cedido'
      ? getHospital(bloco.hospitalId)
      : undefined;
  const cor = hosp?.cor ?? null;
  const isPlantao = bloco.tipo === 'plantao';
  const cheio = isPlantao && cor !== null;

  // Bordas chanfradas onde o card "se conecta" com o vizinho
  const radiusTop = continuaAntes ? 0 : 10;
  const radiusBottom = continuaDepois ? 0 : 10;

  const titulo =
    bloco.tipo === 'plantao' && hosp
      ? hosp.nome
      : bloco.tipo === 'sono'
      ? 'sono protegido'
      : bloco.tipo === 'bloqueio'
      ? `bloqueio${bloco.motivo ? ` · ${bloco.motivo}` : ''}`
      : bloco.tipo === 'cedido' && hosp
      ? `cedido · ${bloco.cedidoPara}`
      : bloco.tipo === 'consulta'
      ? `consulta${bloco.local ? ` · ${bloco.local}` : ''}`
      : bloco.tipo === 'estudo' && bloco.titulo
      ? bloco.titulo
      : bloco.tipo === 'pessoal' && bloco.titulo
      ? bloco.titulo
      : bloco.tipo === 'outros' && bloco.titulo
      ? bloco.titulo
      : bloco.tipo;

  // Horário mostrado no card varia conforme parte do segmento
  // - Sem split: range total do plantão
  // - continuaDepois: "19:00 → 24:00" + tag "→ 07:00 amanhã"
  // - continuaAntes: "00:00 → 07:00" + tag "veio 19:00 ontem"
  const fimAbs = bloco.horaInicio + bloco.duracao;
  const horaFimDia = fimAbs % 24;

  let horario: string;
  let tagContinuacao: string | null = null;
  if (continuaDepois) {
    horario = `${fmtHora(bloco.horaInicio)} → 24:00`;
    tagContinuacao = `↓ termina ${fmtHora(horaFimDia)} amanhã`;
  } else if (continuaAntes) {
    horario = `00:00 → ${fmtHora(horaFimDia)}`;
    tagContinuacao = `↑ veio ${fmtHora(bloco.horaInicio)} ontem`;
  } else {
    horario = fmtRange(bloco.horaInicio, bloco.duracao);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: cheio
          ? `var(--${cor})`
          : cor
          ? `var(--${cor}-surface)`
          : 'var(--bg)',
        color: cheio ? 'var(--bg)' : 'var(--ink)',
        border: cheio ? 'none' : '1px solid var(--line)',
        borderLeft: cor && !cheio ? `3px solid var(--${cor})` : undefined,
        borderTopLeftRadius: radiusTop,
        borderTopRightRadius: radiusTop,
        borderBottomLeftRadius: radiusBottom,
        borderBottomRightRadius: radiusBottom,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            font: '500 14px/1.2 var(--font-display)',
            letterSpacing: '-0.005em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {titulo}
        </span>
        {tagContinuacao && (
          <span
            style={{
              font: '500 10px/1 var(--font-body)',
              color: cheio ? 'rgba(255,255,255,0.8)' : 'var(--ink-3)',
              letterSpacing: '0.02em',
            }}
          >
            {tagContinuacao}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <Mono
          style={{
            color: cheio ? 'rgba(255,255,255,0.95)' : 'var(--ink-2)',
            fontSize: 12,
            whiteSpace: 'nowrap',
          }}
        >
          {horario}
        </Mono>
        {bloco.tipo === 'plantao' && bloco.viaTroca && !continuaAntes && (
          <Pill kind={cheio ? 'neutral' : 'lavender'}>via troca</Pill>
        )}
        {bloco.tipo === 'plantao' && bloco.conflito && !continuaAntes && <IconConflito />}
      </div>
    </button>
  );
}

function fmtHora(h: number): string {
  const intH = Math.floor(h);
  const min = Math.round((h - intH) * 60);
  return `${String(intH).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

interface SegmentoVisivel {
  bloco: Bloco;
  startHora: number;
  endHora: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
}

/**
 * Segmentos visíveis num dia · plantão noturno do dia anterior aparece
 * aqui em [0, fim%24] com continuaAntes=true. Plantão que ultrapassa
 * meia-noite aparece em [inicio, 24] com continuaDepois=true.
 */
function segmentosDoDia(blocos: Bloco[], dia: string): SegmentoVisivel[] {
  const out: SegmentoVisivel[] = [];
  for (const b of blocos) {
    if (b.tipo === 'deslocamento') continue;
    const ini = b.horaInicio - 24 * diffDias(dia, b.data);
    const fim = ini + b.duracao;
    if (fim <= 0 || ini >= 24) continue;
    const startHora = Math.max(0, ini);
    const endHora = Math.min(24, fim);
    out.push({
      bloco: b,
      startHora,
      endHora,
      continuaAntes: ini < 0,
      continuaDepois: fim > 24,
    });
  }
  return out.sort((a, b) => {
    // Continuações ficam no topo (eram da noite anterior)
    if (a.continuaAntes && !b.continuaAntes) return -1;
    if (b.continuaAntes && !a.continuaAntes) return 1;
    return a.startHora - b.startHora;
  });
}

function diffDias(a: string, b: string): number {
  const da = fromISO(a).getTime();
  const db = fromISO(b).getTime();
  return Math.round((da - db) / (24 * 3600 * 1000));
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
void DOWS_LONG;
