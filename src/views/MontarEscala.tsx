import { useEffect, useMemo, useState } from 'react';
import type { Bloco, BlocoBloqueio, BlocoPlantao, HospitaisMap, Preferencias } from '@/types';
import { analisarMesAnterior, fmtDate, fmtRange } from '@/lib/data';
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

  // UX
  const [setupColapsado, setSetupColapsado] = useState(false);

  // Editor de proposta · clone mutável da sugestão da lente atual
  const [sugestaoEditavel, setSugestaoEditavel] = useState<BlocoPlantao[] | null>(null);
  const [adicionarEm, setAdicionarEm] = useState<string | null>(null);
  const [previewAberto, setPreviewAberto] = useState(false);

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
    setSugestaoEditavel(null);
    setSetupColapsado(false);
  }, [mesAlvo, hospitaisIncluidos, metaInput]);

  // Quando lente muda, reseta a edição (base mudou)
  useEffect(() => {
    if (comparativo) {
      setSugestaoEditavel(comparativo[lente].blocos.map((b) => ({ ...b })));
    }
  }, [comparativo, lente]);

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
    setSetupColapsado(true);
  }

  function removerPlantao(b: Bloco) {
    if (!sugestaoEditavel) return;
    setSugestaoEditavel(sugestaoEditavel.filter((p) => p.id !== b.id));
  }

  function adicionarPlantao(novo: BlocoPlantao) {
    if (!sugestaoEditavel) return;
    setSugestaoEditavel([...sugestaoEditavel, novo]);
    setAdicionarEm(null);
  }

  function resetarEdicao() {
    if (!comparativo) return;
    setSugestaoEditavel(comparativo[lente].blocos.map((b) => ({ ...b })));
  }

  const sugestaoOriginal = comparativo ? comparativo[lente].blocos : [];
  const houveEdicao =
    sugestaoEditavel !== null &&
    (sugestaoEditavel.length !== sugestaoOriginal.length ||
      sugestaoEditavel.some((b, i) => b.id !== sugestaoOriginal[i]?.id));

  const blocosFinaisProposta = sugestaoEditavel ?? [];

  const podeGerar = hospitaisIncluidos.size > 0;

  return (
    <>
      <PageHead
        eyebrow="planejar mês"
        titulo="montar a escala do mês."
        hand="defina o setup, gere 3 cenários e leve pro chefe da equipe."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!semHospitais && setupColapsado ? (
          <SetupChip
            mesAlvo={mesAlvo}
            hospitaisIncluidos={hospitaisIncluidos}
            metaInput={metaInput}
            bloqueios={bloqueiosDoMes}
            onEditar={() => setSetupColapsado(false)}
          />
        ) : !semHospitais ? (
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
        ) : (
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

            {sugestao && (
              <Card
                titulo="prévia do mês"
                eyebrow={`${blocosFinaisProposta.length} plantões · clica pra editar`}
              >
                <CalendarioMes
                  refIso={`${mesAlvo}-15`}
                  blocos={blocos}
                  hospitais={hospitais}
                  marcadores={blocosFinaisProposta}
                  onSelectMarcador={removerPlantao}
                  onSelectDia={(iso) => setAdicionarEm(iso)}
                />
                <Hand
                  color="var(--ink-3)"
                  size={14}
                  style={{ display: 'block', marginTop: 10 }}
                >
                  clica num plantão sugerido pra remover · num dia livre pra adicionar
                </Hand>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginTop: 16,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPreviewAberto(true)}
                    disabled={blocosFinaisProposta.length === 0}
                    style={{
                      font: '600 13px/1 var(--font-body)',
                      padding: '12px 22px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'var(--ink)',
                      color: 'var(--bg)',
                      cursor: blocosFinaisProposta.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: blocosFinaisProposta.length === 0 ? 0.5 : 1,
                    }}
                  >
                    revisar e exportar
                  </button>
                  {houveEdicao && (
                    <button
                      type="button"
                      onClick={resetarEdicao}
                      style={{
                        font: '600 12px/1 var(--font-body)',
                        padding: '10px 16px',
                        borderRadius: 999,
                        border: '1px dashed var(--line-2)',
                        background: 'transparent',
                        color: 'var(--ink-3)',
                        cursor: 'pointer',
                      }}
                    >
                      voltar à sugestão original
                    </button>
                  )}
                  {houveEdicao && (
                    <Pill kind="warn" dot={false}>
                      editado
                    </Pill>
                  )}
                </div>

                {sugestao.resumo.motivosPulados.length > 0 && (
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 14,
                      borderTop: '1px dashed var(--line-2)',
                    }}
                  >
                    <Eyebrow>dias que o solver pulou (top 8)</Eyebrow>
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
          </>
        )}
      </div>

      {adicionarEm && (
        <AdicionarPlantaoModal
          dataISO={adicionarEm}
          hospitais={hospitaisAtivos}
          jaTemNoDia={blocosFinaisProposta.some((b) => b.data === adicionarEm)}
          onConfirmar={adicionarPlantao}
          onCancelar={() => setAdicionarEm(null)}
        />
      )}

      {previewAberto && (
        <PreviewModal
          plantoes={blocosFinaisProposta}
          hospitais={hospitaisAtivos}
          mesISO={mesAlvo}
          nomeMedico={preferencias.nome}
          blocos={blocos}
          onConfirmar={() => {
            setPreviewAberto(false);
            setExportandoAberto(true);
          }}
          onCancelar={() => setPreviewAberto(false)}
        />
      )}

      {exportandoAberto && (
        <ExportarMontar
          plantoesSugeridos={blocosFinaisProposta}
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

interface SetupChipProps {
  mesAlvo: string;
  hospitaisIncluidos: Set<string>;
  metaInput: string;
  bloqueios: BlocoBloqueio[];
  onEditar: () => void;
}

function fmtMesAlvo(iso: string): string {
  const [ano, mes] = iso.split('-').map(Number);
  if (!ano || !mes) return iso;
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${meses[mes - 1]} ${ano}`;
}

function SetupChip({ mesAlvo, hospitaisIncluidos, metaInput, bloqueios, onEditar }: SetupChipProps) {
  const meta = Number(metaInput.replace(/\D/g, '')) || 0;
  const partes = [
    fmtMesAlvo(mesAlvo),
    `${hospitaisIncluidos.size} ${hospitaisIncluidos.size === 1 ? 'hospital' : 'hospitais'}`,
    `meta R$ ${meta.toLocaleString('pt-BR')}`,
    bloqueios.length > 0
      ? `${bloqueios.length} ${bloqueios.length === 1 ? 'bloqueio' : 'bloqueios'}`
      : 'sem bloqueios',
  ];
  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Eyebrow>setup</Eyebrow>
        <span style={{ font: '500 14px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
          {partes.join('  ·  ')}
        </span>
      </div>
      <button
        type="button"
        onClick={onEditar}
        style={{
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}
      >
        editar
      </button>
    </div>
  );
}

interface AdicionarPlantaoModalProps {
  dataISO: string;
  hospitais: HospitaisMap;
  jaTemNoDia: boolean;
  onConfirmar: (b: BlocoPlantao) => void;
  onCancelar: () => void;
}

function AdicionarPlantaoModal({
  dataISO,
  hospitais,
  jaTemNoDia,
  onConfirmar,
  onCancelar,
}: AdicionarPlantaoModalProps) {
  const lista = Object.values(hospitais);
  const [hospitalId, setHospitalId] = useState(lista[0]?.id ?? '');
  const [horaInicio, setHoraInicio] = useState(7);
  const [duracao, setDuracao] = useState(12);
  const [setor, setSetor] = useState('');

  const hosp = hospitais[hospitalId];
  const setores = hosp?.setores ?? [];
  const valido = hospitalId && duracao > 0;

  function confirmar() {
    if (!valido) return;
    const novo: BlocoPlantao = {
      id: `man-${Date.now()}`,
      tipo: 'plantao',
      hospitalId,
      data: dataISO,
      horaInicio,
      duracao,
      setor: setor || setores[0] || '',
    };
    onConfirmar(novo);
  }

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.18)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 20px',
        animation: 'colo-fade-in 180ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          padding: '24px 28px',
          width: '100%',
          maxWidth: 420,
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <Eyebrow>adicionar à proposta</Eyebrow>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 22,
            margin: '6px 0 4px',
          }}
        >
          plantão em {fmtDate(dataISO)}
        </h2>
        {jaTemNoDia && (
          <Pill kind="warn" style={{ marginTop: 6 }}>
            já tem plantão proposto neste dia
          </Pill>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <Field label="hospital">
            <select
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
              style={inputStyle}
            >
              {lista.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.abrev} · {h.nome}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="início">
              <input
                type="number"
                step="0.5"
                min={0}
                max={23.5}
                value={horaInicio}
                onChange={(e) => setHoraInicio(Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
            <Field label="duração (h)">
              <input
                type="number"
                step="0.5"
                min={0.5}
                max={24}
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="setor">
            <input
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder={setores[0] ?? 'enfermaria'}
              list="setores-modal"
              style={inputStyle}
            />
            <datalist id="setores-modal">
              {setores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Mono style={{ color: 'var(--ink-3)', display: 'block' }}>
            {fmtRange(horaInicio, duracao)} · {duracao}h
          </Mono>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            type="button"
            onClick={confirmar}
            disabled={!valido}
            style={{
              font: '600 13px/1 var(--font-body)',
              padding: '12px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--sage-ink)',
              color: 'var(--bg)',
              cursor: valido ? 'pointer' : 'not-allowed',
              opacity: valido ? 1 : 0.5,
            }}
          >
            adicionar
          </button>
          <button
            type="button"
            onClick={onCancelar}
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
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

interface PreviewModalProps {
  plantoes: BlocoPlantao[];
  hospitais: HospitaisMap;
  mesISO: string;
  nomeMedico: string;
  blocos: Bloco[];
  onConfirmar: () => void;
  onCancelar: () => void;
}

function PreviewModal({
  plantoes,
  hospitais,
  mesISO,
  nomeMedico,
  blocos,
  onConfirmar,
  onCancelar,
}: PreviewModalProps) {
  // Agrupa por hospital pra mostrar a divisão final
  const porHospital = new Map<string, BlocoPlantao[]>();
  for (const p of plantoes) {
    const arr = porHospital.get(p.hospitalId) ?? [];
    arr.push(p);
    porHospital.set(p.hospitalId, arr);
  }
  void blocos;
  void nomeMedico;

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.22)',
        zIndex: 65,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 20px',
        animation: 'colo-fade-in 180ms ease',
        overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          padding: '28px 32px',
          width: '100%',
          maxWidth: 880,
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <Eyebrow>preview · revisar antes de exportar</Eyebrow>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: '-0.015em',
            margin: '6px 0 4px',
          }}
        >
          a proposta tá assim
        </h2>
        <Mono style={{ color: 'var(--ink-3)', display: 'block', marginBottom: 18 }}>
          {fmtMesAlvo(mesISO)} · {plantoes.length} {plantoes.length === 1 ? 'plantão' : 'plantões'} ·{' '}
          {porHospital.size} {porHospital.size === 1 ? 'hospital' : 'hospitais'}
        </Mono>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...porHospital.entries()].map(([hospId, lista]) => {
            const h = hospitais[hospId];
            if (!h) return null;
            const ordenados = [...lista].sort(
              (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
            );
            return (
              <div
                key={hospId}
                style={{
                  background: `var(--${h.cor}-surface)`,
                  borderLeft: `4px solid var(--${h.cor})`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <Eyebrow color={`var(--${h.cor}-ink)`}>{h.abrev}</Eyebrow>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 500,
                        fontSize: 16,
                        margin: '2px 0 0',
                      }}
                    >
                      {h.nome}
                    </p>
                  </div>
                  <Pill kind="ok" dot={false}>
                    {ordenados.length} {ordenados.length === 1 ? 'plantão' : 'plantões'}
                  </Pill>
                </div>
                <ul
                  style={{
                    margin: 0,
                    padding: '0 0 0 14px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '4px 16px',
                    font: '500 12px/1.4 var(--font-body)',
                    color: 'var(--ink-2)',
                  }}
                >
                  {ordenados.map((p) => (
                    <li key={String(p.id)}>
                      {fmtDate(p.data).replace(/^\w+ /, '')} · {fmtRange(p.horaInicio, p.duracao)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onConfirmar}
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
            confirmar e exportar
          </button>
          <button
            type="button"
            onClick={onCancelar}
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
            voltar e ajustar
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 14px/1.4 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
  width: '100%',
};
