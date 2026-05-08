import { useEffect, useMemo, useState } from 'react';
import type { Bloco, BlocoBloqueio, HospitaisMap, Preferencias } from '@/types';
import { analisarMesAnterior, fmtDate } from '@/lib/data';
import {
  compararLentes,
  type ComparativoLentes,
  type Lente,
  type SugestaoSolver,
} from '@/lib/solver';
import { Eyebrow, Hand, Mono, MonthPicker, Pill } from '@/components/atoms';
import { CalendarioMes } from '@/components/calendario';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';
import { ExportarMontar } from './ExportarMontar';

interface MontarEscalaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  mesISO: string;
  onAdicionarBloco?: (b: Bloco) => void;
  onRemoverBloco?: (id: number | string) => void;
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
 * Montar Escala v3 · setup wizard antes de gerar.
 *
 * Passos:
 *   1. setup · mês alvo + hospitais a incluir + meta financeira + bloqueios
 *   2. gerar 3 cenários · solver roda com 3 lentes
 *   3. comparar · escolhe a lente, vê o calendário
 *   4. exportar pra cada chefe (mensagem · PDF visual · CSV)
 *
 * Sem "aplicar essa proposta" — é sugestão pro chefe, não escala oficial.
 * Quando o chefe responder com a oficial, ela sincroniza pelo calendar feed.
 */
export function MontarEscala({
  blocos,
  hospitais,
  preferencias,
  mesISO,
  onAdicionarBloco,
  onRemoverBloco,
}: MontarEscalaProps) {
  const semHospitais = Object.keys(hospitais).length === 0;

  // Setup state
  const [mesAlvo, setMesAlvo] = useState(mesISO);
  const [hospitaisIncluidos, setHospitaisIncluidos] = useState<Set<string>>(
    () => new Set(Object.keys(hospitais)),
  );
  const [metaInput, setMetaInput] = useState<string>(
    String(preferencias.metaMensal ?? 0),
  );

  // Resultado da geração
  const [comparativo, setComparativo] = useState<ComparativoLentes | null>(null);
  const [lente, setLente] = useState<Lente>('equilibrar');
  const [exportandoAberto, setExportandoAberto] = useState(false);

  const diagnostico = useMemo(
    () => analisarMesAnterior(blocos, hospitais, mesAlvo, preferencias),
    [blocos, hospitais, mesAlvo, preferencias],
  );

  useEffect(() => {
    setLente(diagnostico.lenteSugerida);
  }, [diagnostico.lenteSugerida]);

  // Quando setup muda, joga fora resultado anterior pra forçar re-gerar
  useEffect(() => {
    setComparativo(null);
  }, [mesAlvo, hospitaisIncluidos, metaInput]);

  const hospitaisAtivos = useMemo(() => {
    const out: HospitaisMap = {};
    for (const id of hospitaisIncluidos) {
      const h = hospitais[id];
      if (h) out[id] = h;
    }
    return out;
  }, [hospitais, hospitaisIncluidos]);

  const preferenciasParaSolver = useMemo<Preferencias>(() => {
    const meta = Number(metaInput.replace(/\D/g, '')) || 0;
    return { ...preferencias, metaMensal: meta };
  }, [preferencias, metaInput]);

  const bloqueiosDoMes = useMemo(
    () =>
      blocos.filter(
        (b): b is BlocoBloqueio => b.tipo === 'bloqueio' && b.data.startsWith(mesAlvo),
      ),
    [blocos, mesAlvo],
  );

  const sugestao: SugestaoSolver | null = comparativo ? comparativo[lente] : null;

  function toggleHospital(id: string) {
    setHospitaisIncluidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function gerar() {
    const c = compararLentes({
      blocos,
      hospitais: hospitaisAtivos,
      preferencias: preferenciasParaSolver,
      mes: mesAlvo,
    });
    setComparativo(c);
    setLente(diagnostico.lenteSugerida);
  }

  const podeGerar = hospitaisIncluidos.size > 0;

  return (
    <>
      <PageHead
        eyebrow="planejar mês"
        titulo="montar a escala do mês."
        hand="defina o setup, gere 3 cenários e leve pro chefe da equipe."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!semHospitais && (
          <SetupCard
            mesAlvo={mesAlvo}
            onMesAlvo={setMesAlvo}
            hospitais={hospitais}
            hospitaisIncluidos={hospitaisIncluidos}
            onToggleHospital={toggleHospital}
            metaInput={metaInput}
            onMetaInput={setMetaInput}
            metaPreferencia={preferencias.metaMensal}
            bloqueios={bloqueiosDoMes}
            onAdicionarBloco={onAdicionarBloco}
            onRemoverBloco={onRemoverBloco}
            onGerar={gerar}
            podeGerar={podeGerar}
            jaTemResultado={!!comparativo}
          />
        )}

        {semHospitais && (
          <EmptyState
            eyebrow="solver"
            titulo="cadastra um hospital primeiro."
            recado="o solver precisa saber regras e valores antes de sugerir."
          />
        )}

        {comparativo && (
          <>
            <DiagnosticoCard diagnostico={diagnostico} />

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

            {sugestao && sugestao.blocos.length > 0 && (
              <Card titulo="prévia do mês" eyebrow={`lente · ${ROTULO_LENTE[lente]}`}>
                <CalendarioMes
                  refIso={`${mesAlvo}-15`}
                  blocos={blocos}
                  hospitais={hospitais}
                  marcadores={sugestao.blocos}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setExportandoAberto(true)}
                    style={{
                      font: '600 13px/1 var(--font-body)',
                      padding: '12px 22px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'var(--ink)',
                      color: 'var(--bg)',
                      cursor: 'pointer',
                    }}
                  >
                    exportar pra cada chefe
                  </button>
                </div>
                {sugestao.resumo.motivosPulados.length > 0 && (
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 14,
                      borderTop: '1px dashed var(--line-2)',
                    }}
                  >
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

            {sugestao && sugestao.blocos.length === 0 && (
              <EmptyState
                titulo="nenhuma sugestão pra essa lente."
                recado="hospitais cheios, dias evitados batem ou regras estão apertadas demais."
              />
            )}
          </>
        )}
      </div>

      {exportandoAberto && sugestao && (
        <ExportarMontar
          plantoesSugeridos={sugestao.blocos}
          hospitais={hospitaisAtivos}
          blocosTodos={blocos}
          mesISO={mesAlvo}
          nomeMedico={preferencias.nome}
          onFechar={() => setExportandoAberto(false)}
        />
      )}
    </>
  );
}

interface SetupCardProps {
  mesAlvo: string;
  onMesAlvo: (m: string) => void;
  hospitais: HospitaisMap;
  hospitaisIncluidos: Set<string>;
  onToggleHospital: (id: string) => void;
  metaInput: string;
  onMetaInput: (v: string) => void;
  metaPreferencia: number;
  bloqueios: BlocoBloqueio[];
  onAdicionarBloco?: (b: Bloco) => void;
  onRemoverBloco?: (id: number | string) => void;
  onGerar: () => void;
  podeGerar: boolean;
  jaTemResultado: boolean;
}

function SetupCard({
  mesAlvo,
  onMesAlvo,
  hospitais,
  hospitaisIncluidos,
  onToggleHospital,
  metaInput,
  onMetaInput,
  metaPreferencia,
  bloqueios,
  onAdicionarBloco,
  onRemoverBloco,
  onGerar,
  podeGerar,
  jaTemResultado,
}: SetupCardProps) {
  const [bloqueioOpen, setBloqueioOpen] = useState(false);
  const [bloqData, setBloqData] = useState(`${mesAlvo}-15`);
  const [bloqMotivo, setBloqMotivo] = useState('');

  function adicionarBloqueio() {
    if (!onAdicionarBloco || !bloqData) return;
    const novo: BlocoBloqueio = {
      id: `bloq-${Date.now()}`,
      tipo: 'bloqueio',
      data: bloqData,
      horaInicio: 0,
      duracao: 24,
      motivo: bloqMotivo || undefined,
    };
    onAdicionarBloco(novo);
    setBloqMotivo('');
    setBloqueioOpen(false);
  }

  return (
    <Card titulo="setup do mês" eyebrow="defina antes de gerar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="mês alvo">
          <MonthPicker value={mesAlvo} onChange={onMesAlvo} janela={12} />
        </Field>

        <Field label="hospitais a incluir">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.values(hospitais).map((h) => {
              const on = hospitaisIncluidos.has(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onToggleHospital(h.id)}
                  style={{
                    font: '600 13px/1 var(--font-body)',
                    padding: '10px 16px',
                    borderRadius: 999,
                    border: on ? `2px solid var(--${h.cor}-ink)` : '1px solid var(--line)',
                    background: on ? `var(--${h.cor}-surface)` : 'var(--bg)',
                    color: on ? `var(--${h.cor}-ink)` : 'var(--ink-3)',
                    cursor: 'pointer',
                  }}
                >
                  {on ? '✓ ' : ''}
                  {h.abrev}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="meta financeira deste mês">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: '500 14px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>R$</span>
            <input
              type="text"
              inputMode="numeric"
              value={metaInput}
              onChange={(e) => onMetaInput(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="22000"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                font: '500 14px/1.4 var(--font-body)',
                color: 'var(--ink)',
                outline: 'none',
                width: 160,
              }}
            />
            <Mono style={{ color: 'var(--ink-3)' }}>
              só pra esse mês · padrão R$ {metaPreferencia.toLocaleString('pt-BR')}
            </Mono>
          </div>
        </Field>

        <Field label="bloqueios deste mês">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {bloqueios.length === 0 && !bloqueioOpen && (
              <Mono style={{ color: 'var(--ink-3)' }}>nenhum bloqueio cadastrado</Mono>
            )}
            {bloqueios.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-alt)',
                  borderRadius: 'var(--r-md)',
                }}
              >
                <span style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>
                  {fmtDate(b.data)} {b.motivo ? `· ${b.motivo}` : ''}
                </span>
                {onRemoverBloco && (
                  <button
                    type="button"
                    onClick={() => onRemoverBloco(b.id)}
                    aria-label="remover"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-3)',
                      font: '500 18px/1 var(--font-body)',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {bloqueioOpen ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr auto auto',
                  gap: 8,
                  alignItems: 'center',
                  marginTop: 4,
                }}
              >
                <input
                  type="date"
                  value={bloqData}
                  onChange={(e) => setBloqData(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    font: '500 13px/1.4 var(--font-body)',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
                <input
                  type="text"
                  value={bloqMotivo}
                  onChange={(e) => setBloqMotivo(e.target.value)}
                  placeholder="aniversário · viagem · descanso"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    font: '500 13px/1.4 var(--font-body)',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={adicionarBloqueio}
                  style={{
                    font: '600 12px/1 var(--font-body)',
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'var(--sage-ink)',
                    color: 'var(--bg)',
                    cursor: 'pointer',
                  }}
                >
                  salvar
                </button>
                <button
                  type="button"
                  onClick={() => setBloqueioOpen(false)}
                  style={{
                    font: '600 12px/1 var(--font-body)',
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--ink-3)',
                    cursor: 'pointer',
                  }}
                >
                  cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setBloqueioOpen(true)}
                style={{
                  alignSelf: 'flex-start',
                  font: '600 12px/1 var(--font-body)',
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: '1px dashed var(--line-2)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                + adicionar bloqueio
              </button>
            )}
          </div>
        </Field>

        <button
          type="button"
          onClick={onGerar}
          disabled={!podeGerar}
          style={{
            font: '600 14px/1 var(--font-body)',
            padding: '14px 28px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--lavender-ink)',
            color: 'var(--bg)',
            cursor: podeGerar ? 'pointer' : 'not-allowed',
            opacity: podeGerar ? 1 : 0.5,
            alignSelf: 'flex-start',
            marginTop: 4,
          }}
        >
          {jaTemResultado ? 'gerar de novo' : 'gerar 3 cenários'}
        </button>
      </div>
    </Card>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}
