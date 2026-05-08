import { useEffect, useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap, Preferencias } from '@/types';
import { analisarMesAnterior, calcRemuneracaoMes } from '@/lib/data';
import {
  compararLentes,
  type ComparativoLentes,
  type Lente,
  type SugestaoSolver,
} from '@/lib/solver';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { CalendarioMes } from '@/components/calendario';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';
import { ExportarMontar } from './ExportarMontar';

interface MontarEscalaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  mesISO: string;
  onAdicionarSugestoes?: (b: BlocoPlantao[]) => void;
}

const ROTULO_LENTE: Record<Lente, string> = {
  descansar: 'descansar',
  equilibrar: 'equilibrar',
  ganhar: 'ganhar mais',
};

const RECADO_LENTE: Record<Lente, string> = {
  descansar: 'menos plantões · descanso protegido',
  equilibrar: 'meio-termo · meta + descanso',
  ganhar: 'mais plantões · receita acima da meta',
};

/**
 * Montar Escala v2 · roda o solver com 3 lentes (descansar / equilibrar
 * / ganhar) e mostra um diagnóstico do mês anterior pra ajudar a
 * escolher. Ela compara, escolhe uma lente, e leva pro chefe.
 */
export function MontarEscala({
  blocos,
  hospitais,
  preferencias,
  mesISO,
  onAdicionarSugestoes,
}: MontarEscalaProps) {
  const semHospitais = Object.keys(hospitais).length === 0;
  const resumo = calcRemuneracaoMes(blocos, hospitais, mesISO);
  const pctMetaAtual = preferencias.metaMensal
    ? Math.min(100, Math.round((resumo.total.liquido / preferencias.metaMensal) * 100))
    : null;

  const diagnostico = useMemo(
    () => analisarMesAnterior(blocos, hospitais, mesISO, preferencias),
    [blocos, hospitais, mesISO, preferencias],
  );

  const [comparativo, setComparativo] = useState<ComparativoLentes | null>(null);
  const [lente, setLente] = useState<Lente>(diagnostico.lenteSugerida);
  const [exportandoAberto, setExportandoAberto] = useState(false);

  useEffect(() => {
    setLente(diagnostico.lenteSugerida);
  }, [diagnostico.lenteSugerida]);

  const sugestao: SugestaoSolver | null = comparativo ? comparativo[lente] : null;

  const rodar = () => {
    const c = compararLentes({ blocos, hospitais, preferencias, mes: mesISO });
    setComparativo(c);
    setLente(diagnostico.lenteSugerida);
  };

  const aceitar = () => {
    if (!sugestao || !onAdicionarSugestoes) return;
    onAdicionarSugestoes(sugestao.blocos);
    setComparativo(null);
  };

  return (
    <>
      <PageHead
        eyebrow="planejar mês"
        titulo="montar a escala do mês."
        hand="3 cenários · escolhe um e leva pro chefe."
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
              {comparativo ? 'rodar de novo' : 'sugerir mês'}
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
          {!semHospitais && <DiagnosticoCard diagnostico={diagnostico} />}

          {comparativo && (
            <Card
              titulo="3 cenários"
              eyebrow={`lente sugerida · ${ROTULO_LENTE[diagnostico.lenteSugerida]}`}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                }}
              >
                {(['descansar', 'equilibrar', 'ganhar'] as const).map((L) => (
                  <LenteCard
                    key={L}
                    lente={L}
                    sugestao={comparativo[L]}
                    selecionada={lente === L}
                    sugerida={diagnostico.lenteSugerida === L}
                    onSelect={() => setLente(L)}
                  />
                ))}
              </div>
            </Card>
          )}

          <Card titulo="por hospital" eyebrow="cards do mês">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 12,
              }}
            >
              {Object.values(hospitais).map((h) => {
                const r = resumo.porHospital[h.id];
                const qt = r?.plantoes ?? 0;
                const sugAqui = sugestao?.blocos.filter((b) => b.hospitalId === h.id).length ?? 0;
                const maxMes = h.regras?.maxPorMes ?? null;
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
                      {maxMes !== null && (
                        <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 16 }}>
                          /{maxMes}
                        </span>
                      )}
                    </p>
                    <Mono style={{ display: 'block', color: 'var(--ink-3)' }}>
                      máx · R$ {(h.valorPlantao ?? 0).toLocaleString('pt-BR')}/plantão
                    </Mono>
                    {maxMes !== null && qt + sugAqui > maxMes && (
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
              eyebrow={`lente · ${ROTULO_LENTE[lente]}`}
            >
              {sugestao.blocos.length === 0 ? (
                <EmptyState
                  titulo="nenhuma sugestão pra essa lente."
                  recado="hospitais cheios, dias evitados batem ou regras estão apertadas demais."
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
                      onClick={aceitar}
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
                      aplicar essa proposta
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportandoAberto(true)}
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
                      exportar pra cada chefe
                    </button>
                    <button
                      type="button"
                      onClick={() => setComparativo(null)}
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
                      descartar
                    </button>
                  </div>
                </>
              )}

              {sugestao.resumo.motivosPulados.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--line-2)' }}>
                  <Eyebrow>dias pulados (top 8)</Eyebrow>
                  <ul
                    style={{
                      margin: '8px 0 0',
                      padding: '0 0 0 18px',
                      font: '400 12px/1.5 var(--font-mono)',
                      color: 'var(--ink-3)',
                    }}
                  >
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
              <LinhaPref rotulo="dias preferidos">{preferencias.diasPreferidos.join(', ')}</LinhaPref>
              <LinhaPref rotulo="dias a evitar">{preferencias.diasEvitar.join(', ')}</LinhaPref>
              <LinhaPref rotulo="hospitais favoritos">
                {preferencias.hospitaisPreferidos.join(', ')}
              </LinhaPref>
              <LinhaPref rotulo="máx/semana">{preferencias.maxPlantoesPorSemana} plantões</LinhaPref>
              <LinhaPref rotulo="janela">{preferencias.janelaPreferida}</LinhaPref>
              <LinhaPref rotulo="evitar 24h corrido">
                {preferencias.evitar24hCorrido ? 'sim' : 'não'}
              </LinhaPref>
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
          <Eyebrow>respiração esperada</Eyebrow>
          {sugestao && sugestao.blocos.length > 0 ? (
            <>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 28,
                  letterSpacing: '-0.015em',
                  margin: '6px 0 4px',
                  color:
                    sugestao.resumo.recuperacoesInvadidas > 0 ||
                    sugestao.resumo.diasSeguidosMax >= 3
                      ? 'var(--coral-ink)'
                      : 'var(--sage-ink)',
                }}
              >
                {Math.floor(sugestao.resumo.maiorDescansoContinuo)}h
              </p>
              <Mono style={{ color: 'var(--ink-3)' }}>
                {sugestao.resumo.diasSeguidosMax} dias seguidos máx
                {sugestao.resumo.recuperacoesInvadidas > 0 &&
                  ` · ${sugestao.resumo.recuperacoesInvadidas} invasão`}
              </Mono>
            </>
          ) : (
            <Mono style={{ color: 'var(--ink-3)', display: 'block', marginTop: 6 }}>
              roda o mês pra ver
            </Mono>
          )}

          <div style={{ marginTop: 18 }}>
            <Eyebrow>plantões</Eyebrow>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: '-0.005em',
                margin: '4px 0 0',
                color: 'var(--ink-2)',
              }}
            >
              {sugestao
                ? `${resumo.total.bruto > 0 ? Object.values(resumo.porHospital).reduce((s, r) => s + r.plantoes, 0) : 0} + ${sugestao.blocos.length}`
                : Object.values(resumo.porHospital).reduce((s, r) => s + r.plantoes, 0)}
            </p>
            <Mono style={{ color: 'var(--ink-3)' }}>
              já marcados {sugestao ? '+ sugestões' : ''}
            </Mono>
          </div>

          <div style={{ marginTop: 18 }}>
            <Eyebrow>valor estimado</Eyebrow>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: '-0.005em',
                margin: '4px 0 0',
                color: sugestao ? 'var(--lavender-ink)' : 'var(--ink-2)',
              }}
            >
              R$ {((sugestao?.resumo.receitaEstimada ?? resumo.total.liquido)).toLocaleString('pt-BR')}
            </p>
            {sugestao?.resumo.metaPct !== null && sugestao?.resumo.metaPct !== undefined && (
              <Mono style={{ color: 'var(--ink-3)' }}>
                {sugestao.resumo.metaPct}% da meta
              </Mono>
            )}
            {!sugestao && pctMetaAtual !== null && (
              <Mono style={{ color: 'var(--ink-3)' }}>{pctMetaAtual}% da meta hoje</Mono>
            )}
          </div>
        </aside>
      </div>

      {exportandoAberto && sugestao && (
        <ExportarMontar
          plantoesSugeridos={sugestao.blocos}
          hospitais={hospitais}
          mesISO={mesISO}
          nomeMedico={preferencias.nome}
          onFechar={() => setExportandoAberto(false)}
        />
      )}
    </>
  );
}

interface DiagnosticoCardProps {
  diagnostico: ReturnType<typeof analisarMesAnterior>;
}

function DiagnosticoCard({ diagnostico }: DiagnosticoCardProps) {
  const cor =
    diagnostico.classificacao === 'pesado'
      ? 'var(--coral-ink)'
      : diagnostico.classificacao === 'caro'
      ? '#B8884A'
      : 'var(--sage-ink)';
  const surface =
    diagnostico.classificacao === 'pesado'
      ? 'var(--coral-surface)'
      : diagnostico.classificacao === 'caro'
      ? 'rgba(184,136,74,0.10)'
      : 'var(--sage-surface)';
  return (
    <div
      style={{
        background: surface,
        borderRadius: 16,
        padding: '18px 22px',
      }}
    >
      <Eyebrow color={cor} style={{ opacity: 0.85 }}>
        mês passado · diagnóstico
      </Eyebrow>
      <Hand color={cor} size={22} style={{ display: 'block', marginTop: 6 }}>
        {diagnostico.recado}
      </Hand>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          font: '400 12px/1.4 var(--font-mono)',
          color: 'var(--ink-3)',
        }}
      >
        <span>{diagnostico.plantoes} plantões</span>
        <span>R$ {diagnostico.receita.toLocaleString('pt-BR')}</span>
        {diagnostico.pctMeta !== null && <span>{diagnostico.pctMeta}% da meta</span>}
        <span>{Math.floor(diagnostico.hLivresMedia)}h livres / sem (média)</span>
        {diagnostico.diasSeguidosMax > 0 && (
          <span>{diagnostico.diasSeguidosMax} dias seguidos máx</span>
        )}
      </div>
    </div>
  );
}

interface LenteCardProps {
  lente: Lente;
  sugestao: SugestaoSolver;
  selecionada: boolean;
  sugerida: boolean;
  onSelect: () => void;
}

function LenteCard({ lente, sugestao, selecionada, sugerida, onSelect }: LenteCardProps) {
  const horas = Math.floor(sugestao.resumo.maiorDescansoContinuo);
  const cor =
    lente === 'descansar'
      ? 'var(--sage-ink)'
      : lente === 'ganhar'
      ? '#B8884A'
      : 'var(--lavender-ink)';
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        background: selecionada ? `color-mix(in oklab, ${cor} 8%, var(--bg))` : 'var(--bg)',
        border: selecionada ? `2px solid ${cor}` : '1px solid var(--line)',
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Eyebrow color={cor}>{ROTULO_LENTE[lente]}</Eyebrow>
        {sugerida && (
          <Pill kind="ok" dot={false}>
            sugerida
          </Pill>
        )}
      </div>
      <Mono style={{ display: 'block', color: 'var(--ink-3)', fontSize: 11 }}>
        {RECADO_LENTE[lente]}
      </Mono>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 22,
          letterSpacing: '-0.01em',
          margin: '6px 0 0',
          color: 'var(--ink)',
        }}
      >
        {sugestao.blocos.length} plantões
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          marginTop: 8,
          font: '500 12px/1.3 var(--font-body)',
          color: 'var(--ink-2)',
        }}
      >
        <LinhaMetric rotulo="descanso" valor={`${horas}h`} />
        <LinhaMetric
          rotulo="dias seguidos"
          valor={String(sugestao.resumo.diasSeguidosMax)}
          alerta={sugestao.resumo.diasSeguidosMax >= 3}
        />
        <LinhaMetric
          rotulo="receita"
          valor={`R$ ${sugestao.resumo.receitaEstimada.toLocaleString('pt-BR')}`}
        />
        {sugestao.resumo.metaPct !== null && (
          <LinhaMetric rotulo="meta" valor={`${sugestao.resumo.metaPct}%`} />
        )}
        {sugestao.resumo.recuperacoesInvadidas > 0 && (
          <LinhaMetric
            rotulo="invasões"
            valor={String(sugestao.resumo.recuperacoesInvadidas)}
            alerta
          />
        )}
      </div>
    </button>
  );
}

function LinhaMetric({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--ink-3)' }}>{rotulo}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: alerta ? 'var(--coral-ink)' : 'var(--ink-2)',
          fontWeight: alerta ? 700 : 500,
        }}
      >
        {valor}
      </span>
    </div>
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

function LinhaPref({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px dashed var(--line-2)',
      }}
    >
      <Eyebrow style={{ width: 160, flexShrink: 0 }}>{rotulo}</Eyebrow>
      <span style={{ font: '500 14px/1.4 var(--font-body)', color: 'var(--ink)' }}>{children}</span>
    </div>
  );
}
