import { useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import { fmtDate, fmtRange, getHospital, HOJE, semanaDe } from '@/lib/data';
import { Eyebrow, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface ListaDoDiaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onSelectBloco: (b: Bloco) => void;
}

/**
 * Lista do dia · foco em "o que tem hoje?" e "o que vem essa semana?".
 * Cada bloco vira um card linha · clica abre o drawer.
 */
export function ListaDoDia({ blocos, hospitais: _h, onSelectBloco }: ListaDoDiaProps) {
  const [refIso] = useState<string>(HOJE);
  const semana = useMemo(() => semanaDe(refIso), [refIso]);

  const blocosHoje = blocos
    .filter((b) => b.data === refIso)
    .sort((a, b) => a.horaInicio - b.horaInicio);

  const blocosSemana = blocos
    .filter((b) => semana.includes(b.data) && b.data !== refIso)
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio);

  const cedidosNaSemana = blocosSemana.filter((b) => b.tipo === 'cedido');
  const trocas = blocosSemana.filter(
    (b): b is BlocoPlantao => b.tipo === 'plantao' && Boolean(b.viaTroca),
  );

  return (
    <>
      <PageHead
        eyebrow={`hoje · ${fmtDate(refIso)}`}
        titulo={blocosHoje.length === 0 ? 'sem nada hoje.' : 'olha pro dia.'}
        hand={
          blocosHoje.length === 0
            ? 'janela tranquila — vale aproveitar pra dormir adiantado'
            : (() => {
                const n = blocosHoje.filter((b) => b.tipo === 'plantao').length;
                return `${n === 1 ? '1 plantão' : `${n} plantões`} · respira fundo`;
              })()
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Bloco titulo="hoje" eyebrow={fmtDate(refIso)}>
            {blocosHoje.length === 0 ? (
              <EmptyState
                titulo="o dia está aberto."
                recado="aproveita pra fazer um café na hora certa, sem correria."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {blocosHoje.map((b) => (
                  <ItemLinha key={`${b.id}-hoje`} b={b} onClick={() => onSelectBloco(b)} />
                ))}
              </div>
            )}
          </Bloco>

          <Bloco titulo="resto da semana" eyebrow={`${blocosSemana.length} blocos`}>
            {blocosSemana.length === 0 ? (
              <EmptyState
                titulo="semana enxuta."
                recado="nada agendado depois de hoje. vale planejar — ou descansar."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {blocosSemana.map((b) => (
                  <ItemLinha key={`${b.id}-${b.data}`} b={b} onClick={() => onSelectBloco(b)} mostraData />
                ))}
              </div>
            )}
          </Bloco>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SideCard titulo="recados" eyebrow="movimentações da semana">
            {cedidosNaSemana.length === 0 && trocas.length === 0 ? (
              <Mono style={{ color: 'var(--ink-3)', display: 'block' }}>tudo certo · sem movimento</Mono>
            ) : (
              <>
                {cedidosNaSemana.map((b) => (
                  <Recado
                    key={b.id}
                    cor="sand"
                    titulo={`cedido${b.tipo === 'cedido' ? ` pra ${b.cedidoPara}` : ''}`}
                    detalhe={`${fmtDate(b.data)} · ${fmtRange(b.horaInicio, b.duracao)}`}
                  />
                ))}
                {trocas.map((b) => (
                  <Recado
                    key={`t-${b.id}`}
                    cor="lavender"
                    titulo="troca recebida"
                    detalhe={`${fmtDate(b.data)} · ${b.trocaInfo ?? 'sem detalhes'}`}
                  />
                ))}
              </>
            )}
          </SideCard>
        </aside>
      </div>
    </>
  );
}

function Bloco({
  titulo,
  eyebrow,
  children,
}: {
  titulo: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: '-0.005em',
            margin: 0,
          }}
        >
          {titulo}
        </h2>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}

function ItemLinha({
  b,
  onClick,
  mostraData = false,
}: {
  b: Bloco;
  onClick: () => void;
  mostraData?: boolean;
}) {
  const hosp =
    b.tipo === 'plantao' || b.tipo === 'cedido' ? getHospital(b.hospitalId) : undefined;
  const cor = hosp?.cor ?? null;
  const titulo =
    b.tipo === 'plantao' && hosp
      ? `${hosp.abrev} · ${b.setor}`
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
        borderLeft: cor ? `4px solid var(--${cor})` : '4px solid var(--line-2)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        font: '500 14px/1.3 var(--font-body)',
        color: 'var(--ink)',
        width: '100%',
      }}
    >
      <div style={{ flex: 1 }}>
        <Eyebrow color={cor ? `var(--${cor}-ink)` : 'var(--ink-3)'}>
          {mostraData ? fmtDate(b.data) : titulo}
        </Eyebrow>
        <p
          style={{
            margin: '6px 0 0',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 18,
            letterSpacing: '-0.005em',
          }}
        >
          {mostraData ? titulo : fmtRange(b.horaInicio, b.duracao)}
        </p>
        {mostraData && (
          <Mono style={{ display: 'block', marginTop: 4, color: 'var(--ink-3)' }}>
            {fmtRange(b.horaInicio, b.duracao)} · {b.duracao}h
          </Mono>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        {b.tipo === 'plantao' && b.viaTroca && <Pill kind="lavender">via troca</Pill>}
        {b.tipo === 'plantao' && b.conflito && <Pill kind="err">conflito</Pill>}
      </div>
    </button>
  );
}

function SideCard({
  titulo,
  eyebrow,
  children,
}: {
  titulo: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
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
          marginBottom: 14,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16 }}>
          {titulo}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}

function Recado({ cor, titulo, detalhe }: { cor: string; titulo: string; detalhe: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px dashed var(--line-2)',
      }}
    >
      <span
        style={{
          marginTop: 6,
          width: 6,
          height: 6,
          borderRadius: 999,
          background: `var(--${cor})`,
          flexShrink: 0,
        }}
      />
      <div>
        <p style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)', margin: 0 }}>
          {titulo}
        </p>
        <Mono style={{ color: 'var(--ink-3)' }}>{detalhe}</Mono>
      </div>
    </div>
  );
}
