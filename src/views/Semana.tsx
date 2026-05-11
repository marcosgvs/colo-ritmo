import { useMemo, useState } from 'react';
import type { Bloco, HospitaisMap, Mode } from '@/types';
import {
  adicionaDia,
  analisarDescanso,
  cargaSemanal,
  fromISO,
  HOJE,
  inicioDaSemana,
  MESES,
  semanaDe,
} from '@/lib/data';
import { Eyebrow, Hand, Mono } from '@/components/atoms';
import { WeekGrid } from '@/components/week';
import { Rail } from '@/components/rail';
import { useIsMobile } from '@/hooks/useIsMobile';

interface SemanaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  mode: Mode;
  loading: boolean;
  erro: string | null;
  onSelectBloco: (b: Bloco) => void;
}

export function Semana({ blocos, hospitais: _h, mode, loading, erro, onSelectBloco }: SemanaProps) {
  const isMobile = useIsMobile();
  const [refIso, setRefIso] = useState<string>(HOJE);
  const semanaIso = useMemo(() => semanaDe(refIso), [refIso]);
  const inicio = semanaIso[0]!;
  const fim = semanaIso[6]!;
  const blocosDaSemana = blocos.filter((b) => semanaIso.includes(b.data));
  const carga = cargaSemanal(blocosDaSemana);
  const analise = useMemo(
    () => analisarDescanso(blocos, inicio, fim),
    [blocos, inicio, fim],
  );
  const respiracao = Math.floor(analise.maiorDescansoContinuo);
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
          sua semana.
        </h1>
        {loading ? (
          <Hand color="var(--lavender-ink)" size={20} style={{ display: 'block', marginTop: 8 }}>
            carregando seus plantões…
          </Hand>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
            <Hand
              color={analise.alertaDescansoCurto ? 'var(--coral-ink)' : 'var(--sage-ink)'}
              size={22}
            >
              {respiracao}h de descanso contínuo
            </Hand>
            <Mono style={{ color: 'var(--ink-3)' }}>
              {carga}h de plantão
              {analise.diasSeguidos >= 3 && ` · ${analise.diasSeguidos} dias seguidos`}
              {analise.recuperacoesInvadidas.length > 0 &&
                ` · ${analise.recuperacoesInvadidas.length} recuperação invadida`}
            </Mono>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 1px 320px',
          gap: isMobile ? 18 : 24,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 4px',
            }}
          >
            <span
              style={{
                font: '700 11px/1 var(--font-body)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
              }}
            >
              {label}
            </span>
            <NavSemana refIso={refIso} setRefIso={setRefIso} />
          </div>
          <WeekGrid
            blocos={blocos}
            density={24}
            semanaIso={semanaIso}
            hojeIso={HOJE}
            onSelectBloco={onSelectBloco}
          />
        </div>

        <div
          style={{
            alignSelf: 'stretch',
            background: 'var(--line)',
            width: 1,
          }}
        />

        <Rail blocos={blocos} mode={mode} analise={analise} blocosDaJanela={blocosDaSemana} />
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
      <NavBtn aria="semana anterior" onClick={() => setRefIso(adicionaDia(seg, -7))}>
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
      <NavBtn aria="semana próxima" onClick={() => setRefIso(adicionaDia(seg, 7))}>
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
