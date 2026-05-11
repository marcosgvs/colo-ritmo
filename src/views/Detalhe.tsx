import type { Bloco, HospitaisMap } from '@/types';
import {
  fmtDate,
  fmtRange,
  getHospital,
  ehNoturno,
} from '@/lib/data';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHead } from './_PageHead';

interface DetalheProps {
  bloco: Bloco;
  hospitais: HospitaisMap;
  voltar: () => void;
  onTrocar?: () => void;
  onCeder?: () => void;
}

/**
 * Detalhe · página inteira do plantão. Mais profunda que o drawer.
 * Mostra timeline (chegada/saída), co-plantonista (mock até v2 ter
 * relação com `time`), checklist do plantão, ações no rodapé sticky.
 */
export function Detalhe({ bloco, hospitais: _h, voltar, onTrocar, onCeder }: DetalheProps) {
  const isMobile = useIsMobile();
  const hosp =
    bloco.tipo === 'plantao' || bloco.tipo === 'cedido' ? getHospital(bloco.hospitalId) : undefined;
  const noturno = bloco.tipo === 'plantao' ? ehNoturno(bloco) : false;

  const titulo =
    bloco.tipo === 'plantao' && hosp
      ? hosp.abrev
      : bloco.tipo === 'cedido' && hosp
        ? `cedido · ${bloco.cedidoPara}`
        : bloco.tipo;

  return (
    <>
      <button
        type="button"
        onClick={voltar}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-2)',
          font: '500 13px/1 var(--font-body)',
          marginBottom: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        voltar pra agenda
      </button>

      <PageHead
        eyebrow={fmtDate(bloco.data)}
        titulo={titulo}
        hand={
          bloco.tipo === 'plantao' && bloco.viaTroca
            ? `chegou via troca · ${bloco.trocaInfo ?? 'sem detalhes'}`
            : undefined
        }
        direita={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {noturno && <Pill kind="info">noturno</Pill>}
            {bloco.tipo === 'plantao' && bloco.conflito && <Pill kind="err">conflito</Pill>}
            {bloco.tipo === 'plantao' && bloco.viaTroca && <Pill kind="lavender">via troca</Pill>}
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px',
          gap: isMobile ? 18 : 32,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card title="quando" eyebrow="janela do plantão">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <Eyebrow>chegada</Eyebrow>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 28,
                    letterSpacing: '-0.01em',
                    margin: '4px 0 0',
                  }}
                >
                  {fmtRange(bloco.horaInicio, bloco.duracao).split(' → ')[0]}
                </p>
              </div>
              <div>
                <Eyebrow>saída</Eyebrow>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 28,
                    letterSpacing: '-0.01em',
                    margin: '4px 0 0',
                  }}
                >
                  {fmtRange(bloco.horaInicio, bloco.duracao).split(' → ')[1]}
                </p>
              </div>
              <div>
                <Eyebrow>duração</Eyebrow>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 28,
                    letterSpacing: '-0.01em',
                    margin: '4px 0 0',
                  }}
                >
                  {bloco.duracao}h
                </p>
              </div>
            </div>
            {noturno && (
              <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 10 }}>
                a noite vai cobrir madrugada · proteja sono pra antes ou depois
              </Hand>
            )}
          </Card>

          {hosp && (
            <Card title="onde" eyebrow="hospital">
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 22,
                  letterSpacing: '-0.005em',
                  margin: 0,
                }}
              >
                {hosp.nome}
              </p>
              <Mono style={{ display: 'block', marginTop: 6, color: 'var(--ink-3)' }}>
                {hosp.tipo === 'publico' ? 'público' : 'privado'}
              </Mono>
            </Card>
          )}

          <Card title="checklist" eyebrow="antes de sair de casa">
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {[
                'crachá e estetoscópio',
                'lanche pra atravessar a virada',
                'protetor pra o sono depois',
                bloco.tipo === 'plantao' && noturno ? 'avisa o Marcos antes de sair' : null,
              ]
                .filter((x): x is string => Boolean(x))
                .map((item) => (
                  <li
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      font: '400 14px/1.5 var(--font-body)',
                      color: 'var(--ink-2)',
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: '1.5px solid var(--line-2)',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                    {item}
                  </li>
                ))}
            </ul>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bloco.tipo === 'plantao' && (
            <Card title="ações" eyebrow="se o dia mudar">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {onTrocar && (
                  <button
                    type="button"
                    onClick={onTrocar}
                    style={{
                      font: '600 13px/1 var(--font-body)',
                      padding: '12px 16px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'var(--ink)',
                      color: 'var(--bg)',
                      cursor: 'pointer',
                    }}
                  >
                    pedir troca
                  </button>
                )}
                {onCeder && (
                  <button
                    type="button"
                    onClick={onCeder}
                    style={{
                      font: '600 13px/1 var(--font-body)',
                      padding: '12px 16px',
                      borderRadius: 999,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    ceder pra colega
                  </button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Card({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '20px 22px',
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
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 18,
            letterSpacing: '-0.005em',
          }}
        >
          {title}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}
