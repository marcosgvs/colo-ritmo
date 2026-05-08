import { useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap, Preferencias } from '@/types';
import { calcRemuneracaoMes } from '@/lib/data';
import { sugerirPlantoes, type SugestaoSolver } from '@/lib/solver';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { CalendarioMes } from '@/components/calendario';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface MontarEscalaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  mesISO: string;
  onAdicionarSugestoes?: (b: BlocoPlantao[]) => void;
}

/**
 * Montar Escala · agora com solver heurístico simples. Click em
 * "sugerir mês" computa plantões respeitando regras + preferências, e
 * mostra lista pra Mariana revisar antes de aplicar.
 */
export function MontarEscala({
  blocos,
  hospitais,
  preferencias,
  mesISO,
  onAdicionarSugestoes,
}: MontarEscalaProps) {
  const [sugestao, setSugestao] = useState<SugestaoSolver | null>(null);
  const resumo = calcRemuneracaoMes(blocos, hospitais, mesISO);
  const pctMeta = preferencias.metaMensal
    ? Math.min(100, Math.round((resumo.total.liquido / preferencias.metaMensal) * 100))
    : null;

  const semHospitais = Object.keys(hospitais).length === 0;

  const rodar = useMemo(
    () => () => {
      const r = sugerirPlantoes({ blocos, hospitais, preferencias, mes: mesISO });
      setSugestao(r);
    },
    [blocos, hospitais, preferencias, mesISO],
  );

  const aceitarTodas = () => {
    if (!sugestao || !onAdicionarSugestoes) return;
    onAdicionarSugestoes(sugestao.blocos);
    setSugestao(null);
  };

  return (
    <>
      <PageHead
        eyebrow="planejar mês"
        titulo="montar a escala do mês."
        hand="solver heurístico · respeita regras dos hospitais e suas preferências."
        direita={
          !semHospitais && (
            <button
              type="button"
              onClick={rodar}
              style={{
                font: '600 13px/1 var(--font-body)',
                padding: '12px 22px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--lavender-ink)',
                color: 'var(--bg)',
                cursor: 'pointer',
              }}
            >
              {sugestao ? 'rodar de novo' : 'sugerir mês'}
            </button>
          )
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
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card titulo="por hospital" eyebrow="cards do mês">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {Object.values(hospitais).map((h) => {
                const r = resumo.porHospital[h.id];
                const qt = r?.plantoes ?? 0;
                const sugAqui = sugestao?.blocos.filter((b) => b.hospitalId === h.id).length ?? 0;
                return (
                  <div
                    key={h.id}
                    style={{
                      background: `var(--${h.cor}-surface)`,
                      borderLeft: `4px solid var(--${h.cor})`,
                      borderRadius: 14,
                      padding: '16px 18px',
                    }}
                  >
                    <Eyebrow color={`var(--${h.cor}-ink)`}>{h.abrev}</Eyebrow>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 500,
                        fontSize: 20,
                        letterSpacing: '-0.005em',
                        margin: '6px 0 0',
                      }}
                    >
                      {qt}
                      {sugAqui > 0 && (
                        <span style={{ color: 'var(--lavender-ink)', fontSize: 16 }}>
                          {' '}+{sugAqui}
                        </span>
                      )}
                      <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 16 }}>
                        /{h.regras.maxPorMes}
                      </span>
                    </p>
                    <Mono style={{ display: 'block', color: 'var(--ink-3)' }}>
                      máx · R$ {(h.valorPlantao ?? 0).toLocaleString('pt-BR')}/plantão
                    </Mono>
                    {qt + sugAqui > h.regras.maxPorMes && (
                      <Pill kind="err" style={{ marginTop: 10 }}>
                        passou do máx
                      </Pill>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {sugestao && (
            <Card
              titulo={
                sugestao.blocos.length === 1
                  ? '1 plantão sugerido'
                  : `${sugestao.blocos.length} plantões sugeridos`
              }
              eyebrow="revisar antes de aplicar"
            >
              {sugestao.blocos.length === 0 ? (
                <EmptyState
                  titulo="o solver não encontrou espaço."
                  recado="todos os hospitais estão cheios ou os dias preferidos batem com o que já está marcado."
                />
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <CalendarioMes
                      refIso={`${mesISO}-15`}
                      blocos={blocos}
                      hospitais={hospitais}
                      marcadores={sugestao.blocos}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={aceitarTodas}
                      disabled={!onAdicionarSugestoes}
                      style={{
                        font: '600 13px/1 var(--font-body)',
                        padding: '12px 22px',
                        borderRadius: 999,
                        border: 'none',
                        background: 'var(--sage-ink)',
                        color: 'var(--bg)',
                        cursor: 'pointer',
                        opacity: onAdicionarSugestoes ? 1 : 0.5,
                      }}
                    >
                      aplicar {sugestao.blocos.length === 1 ? '1 sugestão' : `as ${sugestao.blocos.length} sugestões`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSugestao(null)}
                      style={{
                        font: '600 13px/1 var(--font-body)',
                        padding: '12px 22px',
                        borderRadius: 999,
                        border: '1px solid var(--line)',
                        background: 'transparent',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                      }}
                    >
                      descartar sugestões
                    </button>
                  </div>
                </>
              )}

              {sugestao.resumo.motivosPulados.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--line-2)' }}>
                  <Eyebrow>dias pulados (top 8)</Eyebrow>
                  <ul style={{ margin: '8px 0 0', padding: '0 0 0 18px', font: '400 12px/1.5 var(--font-mono)', color: 'var(--ink-3)' }}>
                    {sugestao.resumo.motivosPulados.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Card titulo="suas preferências" eyebrow="o solver usou isso">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Linha rotulo="dias preferidos">{preferencias.diasPreferidos.join(', ')}</Linha>
              <Linha rotulo="dias a evitar">{preferencias.diasEvitar.join(', ')}</Linha>
              <Linha rotulo="hospitais favoritos">
                {preferencias.hospitaisPreferidos.join(', ')}
              </Linha>
              <Linha rotulo="máx/semana">{preferencias.maxPlantoesPorSemana} plantões</Linha>
              <Linha rotulo="janela">{preferencias.janelaPreferida}</Linha>
              <Linha rotulo="evitar 24h corrido">
                {preferencias.evitar24hCorrido ? 'sim' : 'não'}
              </Linha>
            </div>
            <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 14 }}>
              ajusta em "usuário" se algo aqui não te serve.
            </Hand>
          </Card>

          {semHospitais && (
            <EmptyState
              eyebrow="solver"
              titulo="cadastra um hospital primeiro."
              recado="o solver precisa saber regras e valores antes de sugerir."
            />
          )}
        </section>

        <aside
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Eyebrow>meta do mês</Eyebrow>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 28,
              letterSpacing: '-0.015em',
              margin: '6px 0 4px',
            }}
          >
            R$ {(preferencias.metaMensal ?? 0).toLocaleString('pt-BR')}
          </p>
          {pctMeta !== null && (
            <Pill kind={pctMeta >= 100 ? 'ok' : pctMeta >= 70 ? 'warn' : 'err'}>
              {pctMeta}% atingido
            </Pill>
          )}
          <div style={{ marginTop: 16 }}>
            <Eyebrow>caminho hoje</Eyebrow>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: '-0.005em',
                margin: '4px 0 0',
                color: 'var(--sage-ink)',
              }}
            >
              R$ {resumo.total.liquido.toLocaleString('pt-BR')}
            </p>
            <Mono style={{ color: 'var(--ink-3)' }}>líquido estimado</Mono>
          </div>
          {sugestao && sugestao.blocos.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--line-2)' }}>
              <Eyebrow>com sugestões aplicadas</Eyebrow>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 22,
                  letterSpacing: '-0.005em',
                  margin: '4px 0 0',
                  color: 'var(--lavender-ink)',
                }}
              >
                R$ {sugestao.resumo.receitaEstimada.toLocaleString('pt-BR')}
              </p>
              {sugestao.resumo.metaPct !== null && (
                <Mono style={{ color: 'var(--ink-3)' }}>
                  {sugestao.resumo.metaPct}% da meta
                </Mono>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Card({
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
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18 }}>
          {titulo}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px dashed var(--line-2)' }}>
      <Eyebrow style={{ width: 160, flexShrink: 0 }}>{rotulo}</Eyebrow>
      <span style={{ font: '500 14px/1.4 var(--font-body)', color: 'var(--ink)' }}>{children}</span>
    </div>
  );
}
