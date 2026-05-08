import { useMemo, useState } from 'react';
import type { Bloco, HospitaisMap, Mode } from '@/types';
import {
  adicionaDia,
  cargaSemanal,
  fmtDate,
  fromISO,
  HOJE,
  inicioDaSemana,
  MESES,
  semanaDe,
} from '@/lib/data';
import { Eyebrow, Hand } from '@/components/atoms';
import { WeekGrid } from '@/components/week';
import { Rail } from '@/components/rail';

interface SemanaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  mode: Mode;
  loading: boolean;
  erro: string | null;
  onSelectBloco: (b: Bloco) => void;
}

export function Semana({ blocos, hospitais: _h, mode, loading, erro, onSelectBloco }: SemanaProps) {
  const [refIso, setRefIso] = useState<string>(HOJE);
  const semanaIso = useMemo(() => semanaDe(refIso), [refIso]);
  const inicio = semanaIso[0]!;
  const fim = semanaIso[6]!;
  const carga = cargaSemanal(
    blocos.filter((b) => semanaIso.includes(b.data)),
  );

  const label = formatRangeSemana(inicio, fim);

  return (
    <>
      {erro && (
        <div
          role="alert"
          style={{
            background: 'var(--coral-surface)',
            border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
            borderRadius: 'var(--r-md)',
            padding: '12px 16px',
            color: 'var(--coral-ink)',
            font: '500 13px/1.4 var(--font-body)',
            marginBottom: 18,
          }}
        >
          algo travou ao carregar sua agenda · {erro}
        </div>
      )}

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
            sua semana.
          </h1>
          <Hand color="var(--lavender-ink)" size={20} style={{ display: 'block', marginTop: 8 }}>
            {loading ? 'carregando seus plantões…' : `${carga}h previstas`}
          </Hand>
        </div>
        <NavSemana refIso={refIso} setRefIso={setRefIso} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        <WeekGrid
          blocos={blocos}
          density={24}
          semanaIso={semanaIso}
          hojeIso={HOJE}
          onSelectBloco={onSelectBloco}
        />
        <Rail blocos={blocos} mode={mode} />
      </div>
    </>
  );
}

interface NavSemanaProps {
  refIso: string;
  setRefIso: (iso: string) => void;
}

function NavSemana({ refIso, setRefIso }: NavSemanaProps) {
  const seg = inicioDaSemana(refIso);
  const semanaAtual = inicioDaSemana(HOJE);
  const ehAtual = seg === semanaAtual;

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
      <NavBtn
        aria="semana anterior"
        onClick={() => setRefIso(adicionaDia(seg, -7))}
      >
        ‹
      </NavBtn>
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
      <NavBtn
        aria="semana próxima"
        onClick={() => setRefIso(adicionaDia(seg, 7))}
      >
        ›
      </NavBtn>
    </div>
  );
}

function NavBtn({ children, onClick, aria }: { children: string; onClick: () => void; aria: string }) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      style={{
        font: '600 14px/1 var(--font-body)',
        width: 32,
        height: 32,
        borderRadius: 999,
        border: 'none',
        background: 'transparent',
        color: 'var(--ink-2)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function formatRangeSemana(inicio: string, fim: string): string {
  const dIni = fromISO(inicio);
  const dFim = fromISO(fim);
  const mesIni = MESES[dIni.getMonth()];
  const mesFim = MESES[dFim.getMonth()];
  if (mesIni === mesFim) {
    return `${dIni.getDate()}–${dFim.getDate()} ${mesIni} ${dIni.getFullYear()}`;
  }
  return `${dIni.getDate()} ${mesIni} – ${dFim.getDate()} ${mesFim} ${dFim.getFullYear()}`;
}

// Mantém referência usada implicitamente pra evitar tree-shake removing
void fmtDate;
