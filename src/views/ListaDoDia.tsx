import { useEffect, useMemo, useRef, useState } from 'react';
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

const ALTURA_HORA = 56;
const HORARIO_INICIAL_SCROLL = 6;

/**
 * Agenda mobile · timeline vertical 0-24h do dia selecionado. Chips no
 * topo pra navegar entre dias da semana. Plantão que cruza meia-noite
 * vira um card que vai do início até o fim do dia (canto inferior reto)
 * e aparece no dia seguinte de 0h até o horário de fim (canto superior
 * reto) · mesma cor, parecem partidos em dois.
 */
export function ListaDoDia({ blocos, hospitais: _h, onSelectBloco }: ListaDaSemanaProps) {
  const [diaSelecionado, setDiaSelecionado] = useState<string>(HOJE);
  const semana = useMemo(() => semanaDe(diaSelecionado), [diaSelecionado]);
  const segs = useMemo(() => segmentosDoDia(blocos, diaSelecionado), [blocos, diaSelecionado]);

  const dt = fromISO(diaSelecionado);
  const dowLong = DOWS_LONG[diaSemanaBR(diaSelecionado)];
  const isHoje = diaSelecionado === HOJE;

  const refTimeline = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll inicial pras 6h (evita começar em 0 sempre vazio)
    if (refTimeline.current) {
      refTimeline.current.scrollTop = HORARIO_INICIAL_SCROLL * ALTURA_HORA - 40;
    }
  }, [diaSelecionado]);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow>agenda · {DOWS[diaSemanaBR(diaSelecionado)]}</Eyebrow>
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
          {dt.getDate()} {MESES[dt.getMonth()]} · {dowLong}
        </h1>
        {isHoje && (
          <Hand color="var(--lavender-ink)" size={18} style={{ display: 'block', marginTop: 6 }}>
            hoje
          </Hand>
        )}
      </div>

      <ChipsSemana
        semana={semana}
        selecionado={diaSelecionado}
        onSelecionar={setDiaSelecionado}
        blocos={blocos}
      />

      <NavDia diaSelecionado={diaSelecionado} setDiaSelecionado={setDiaSelecionado} />

      {segs.length === 0 ? (
        <EmptyState
          titulo="dia aberto."
          recado="nada agendado · aproveita pra respirar."
        />
      ) : (
        <div
          ref={refTimeline}
          style={{
            position: 'relative',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            overflow: 'auto',
            maxHeight: 'calc(100vh - 320px)',
            minHeight: 400,
          }}
        >
          <Timeline segs={segs} isHoje={isHoje} onSelectBloco={onSelectBloco} />
        </div>
      )}
    </>
  );
}

interface ChipsSemanaProps {
  semana: readonly string[];
  selecionado: string;
  onSelecionar: (dia: string) => void;
  blocos: Bloco[];
}

function ChipsSemana({ semana, selecionado, onSelecionar, blocos }: ChipsSemanaProps) {
  // Mapa rápido: dia -> tem plantão (incluindo continuações)
  const ocupacao = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const dia of semana) {
      const segs = segmentosDoDia(blocos, dia);
      m.set(
        dia,
        segs.some((s) => s.bloco.tipo === 'plantao' || s.bloco.tipo === 'cedido'),
      );
    }
    return m;
  }, [blocos, semana]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 6,
        marginBottom: 18,
      }}
    >
      {semana.map((dia) => {
        const dt = fromISO(dia);
        const sel = dia === selecionado;
        const ehHoje = dia === HOJE;
        const ocupado = ocupacao.get(dia) === true;
        return (
          <button
            key={dia}
            type="button"
            onClick={() => onSelecionar(dia)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 4px',
              borderRadius: 10,
              background: sel
                ? 'var(--ink)'
                : ehHoje
                ? 'var(--lavender-surface)'
                : 'var(--bg)',
              border: sel
                ? 'none'
                : ehHoje
                ? '1px solid var(--lavender)'
                : '1px solid var(--line)',
              cursor: 'pointer',
              color: sel ? 'var(--bg)' : ehHoje ? 'var(--lavender-ink)' : 'var(--ink-2)',
            }}
          >
            <span
              style={{
                font: '600 9px/1 var(--font-body)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: sel ? 0.7 : 0.85,
              }}
            >
              {DOWS[diaSemanaBR(dia)]}
            </span>
            <span
              style={{
                font: '500 17px/1 var(--font-display)',
                letterSpacing: '-0.01em',
              }}
            >
              {dt.getDate()}
            </span>
            <span
              aria-hidden
              style={{
                width: 4,
                height: 4,
                borderRadius: 999,
                background: ocupado
                  ? sel
                    ? 'var(--bg)'
                    : 'var(--lavender-ink)'
                  : 'transparent',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

function NavDia({
  diaSelecionado,
  setDiaSelecionado,
}: {
  diaSelecionado: string;
  setDiaSelecionado: (d: string) => void;
}) {
  const ehHoje = diaSelecionado === HOJE;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <button
        type="button"
        onClick={() => setDiaSelecionado(adicionaDia(diaSelecionado, -1))}
        aria-label="dia anterior"
        style={navBtn}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => setDiaSelecionado(HOJE)}
        disabled={ehHoje}
        style={{
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: ehHoje ? 'var(--bg)' : 'var(--bg-alt)',
          color: ehHoje ? 'var(--ink-3)' : 'var(--ink-2)',
          cursor: ehHoje ? 'default' : 'pointer',
          textTransform: 'lowercase',
        }}
      >
        hoje
      </button>
      <button
        type="button"
        onClick={() => setDiaSelecionado(adicionaDia(diaSelecionado, 1))}
        aria-label="próximo dia"
        style={navBtn}
      >
        ›
      </button>
    </div>
  );
}

interface TimelineProps {
  segs: SegmentoVisivel[];
  isHoje: boolean;
  onSelectBloco: (b: Bloco) => void;
}

function Timeline({ segs, isHoje, onSelectBloco }: TimelineProps) {
  const horaAgora = useHoraAgora(isHoje);

  return (
    <div
      style={{
        position: 'relative',
        height: 24 * ALTURA_HORA,
        display: 'grid',
        gridTemplateColumns: '54px 1fr',
      }}
    >
      {/* Coluna de horas */}
      <div style={{ position: 'relative' }}>
        {Array.from({ length: 24 }).map((_, h) => (
          <div
            key={h}
            style={{
              position: 'absolute',
              top: h * ALTURA_HORA,
              left: 0,
              right: 0,
              height: ALTURA_HORA,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
              paddingTop: 4,
              paddingRight: 8,
            }}
          >
            <Mono
              style={{
                color: 'var(--ink-3)',
                fontSize: 11,
              }}
            >
              {String(h).padStart(2, '0')}:00
            </Mono>
          </div>
        ))}
      </div>

      {/* Coluna de eventos */}
      <div style={{ position: 'relative', borderLeft: '1px solid var(--line)' }}>
        {/* Linhas horizontais por hora */}
        {Array.from({ length: 24 }).map((_, h) => (
          <span
            key={h}
            aria-hidden
            style={{
              position: 'absolute',
              top: h * ALTURA_HORA,
              left: 0,
              right: 0,
              height: 1,
              background: 'var(--line-2)',
              opacity: 0.5,
            }}
          />
        ))}

        {/* Linha "agora" se for hoje */}
        {horaAgora != null && (
          <>
            <span
              style={{
                position: 'absolute',
                top: horaAgora * ALTURA_HORA,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--lavender-ink)',
                zIndex: 2,
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: horaAgora * ALTURA_HORA - 5,
                left: -6,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: 'var(--lavender-ink)',
                zIndex: 3,
              }}
            />
          </>
        )}

        {/* Cards de eventos */}
        {segs.map((seg, i) => (
          <CardEvento
            key={`${seg.bloco.id}-${seg.continuaAntes ? 'a' : 'b'}-${i}`}
            seg={seg}
            onClick={() => onSelectBloco(seg.bloco)}
          />
        ))}
      </div>
    </div>
  );
}

function useHoraAgora(ativo: boolean): number | null {
  const [horaAgora, setHoraAgora] = useState<number | null>(null);
  useEffect(() => {
    if (!ativo) {
      setHoraAgora(null);
      return;
    }
    function calc() {
      const d = new Date();
      setHoraAgora(d.getHours() + d.getMinutes() / 60);
    }
    calc();
    const interval = setInterval(calc, 60_000);
    return () => clearInterval(interval);
  }, [ativo]);
  return horaAgora;
}

function CardEvento({
  seg,
  onClick,
}: {
  seg: SegmentoVisivel;
  onClick: () => void;
}) {
  const { bloco, startHora, endHora, continuaAntes, continuaDepois } = seg;
  const hosp =
    bloco.tipo === 'plantao' || bloco.tipo === 'cedido'
      ? getHospital(bloco.hospitalId)
      : undefined;
  const cor = hosp?.cor ?? null;
  const isPlantao = bloco.tipo === 'plantao';
  const cheio = isPlantao && cor !== null;

  const top = startHora * ALTURA_HORA;
  const height = Math.max(28, (endHora - startHora) * ALTURA_HORA - 2);
  const radiusTop = continuaAntes ? 0 : 8;
  const radiusBottom = continuaDepois ? 0 : 8;
  const compacto = height < 60;

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

  const horario = fmtRange(bloco.horaInicio, bloco.duracao);
  const ehCedido = bloco.tipo === 'cedido';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute',
        top,
        left: 6,
        right: 6,
        height,
        background: cheio
          ? `var(--${cor})`
          : cor
          ? `var(--${cor}-surface)`
          : 'var(--bg-alt)',
        color: cheio ? 'var(--bg)' : 'var(--ink)',
        border: cheio ? 'none' : `1px solid var(--line)`,
        borderLeft: cor && !cheio ? `3px solid var(--${cor})` : undefined,
        borderTopLeftRadius: radiusTop,
        borderTopRightRadius: radiusTop,
        borderBottomLeftRadius: radiusBottom,
        borderBottomRightRadius: radiusBottom,
        padding: compacto ? '6px 10px' : '8px 12px',
        textAlign: 'left',
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: compacto ? 2 : 4,
        zIndex: 1,
        ...(ehCedido && {
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.4) 4px 7px)',
          opacity: 0.85,
        }),
      }}
    >
      <span
        style={{
          font: `500 ${compacto ? 12 : 14}px/1.15 var(--font-display)`,
          letterSpacing: '-0.005em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {titulo}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Mono
          style={{
            color: cheio ? 'rgba(255,255,255,0.9)' : 'var(--ink-3)',
            fontSize: 10,
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

interface SegmentoVisivel {
  bloco: Bloco;
  /** 0-24 · onde o segmento começa no dia. */
  startHora: number;
  /** 0-24 · onde termina no dia. */
  endHora: number;
  continuaAntes: boolean;
  continuaDepois: boolean;
}

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
  return out.sort((a, b) => a.startHora - b.startHora);
}

function diffDias(a: string, b: string): number {
  const da = fromISO(a).getTime();
  const db = fromISO(b).getTime();
  return Math.round((da - db) / (24 * 3600 * 1000));
}

const navBtn: React.CSSProperties = {
  font: '600 16px/1 var(--font-body)',
  width: 36,
  height: 36,
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg-alt)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};

void fmtDate;
void inicioDaSemana;
