import { useEffect, useMemo, useState } from 'react';
import type {
  Bloco,
  BlocoBloqueio,
  BlocoPlantao,
  HospitaisMap,
  Preferencias,
  PropostaSalva,
} from '@/types';
import { analisarMesAnterior, fmtDate, fmtMesAnoExtenso, fmtRange } from '@/lib/data';
import {
  compararLentes,
  type ComparativoLentes,
  type Lente,
  type SugestaoSolver,
} from '@/lib/solver';
import { novoIdProposta, removerProposta as removerPropostaLista } from '@/lib/propostas';
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
  propostas: PropostaSalva[];
  onAtualizarPropostas: (lista: PropostaSalva[]) => void;
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
  propostas,
  onAtualizarPropostas,
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
  const [historicoAberto, setHistoricoAberto] = useState(false);

  // Editor de proposta · clone mutável da sugestão da lente atual
  const [sugestaoEditavel, setSugestaoEditavel] = useState<BlocoPlantao[] | null>(null);
  const [editorPlantao, setEditorPlantao] = useState<
    | { modo: 'adicionar'; dataISO: string }
    | { modo: 'editar'; bloco: BlocoPlantao }
    | null
  >(null);
  const [previewAberto, setPreviewAberto] = useState(false);

  // Detalhe do dia (modal expandido quando clica numa célula da prévia)
  const [diaAtivo, setDiaAtivo] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  // Id da proposta ativa · setado quando reabre do drawer ou ao primeiro export
  const [propostaAtivaId, setPropostaAtivaId] = useState<string | null>(null);
  // Modo "reaberta": mostra prévia editável sem precisar do solver rodar
  const [propostaReaberta, setPropostaReaberta] = useState<PropostaSalva | null>(null);

  const diagnostico = useMemo(
    () => analisarMesAnterior(blocos, hospitais, mesAlvo, preferencias),
    [blocos, hospitais, mesAlvo, preferencias],
  );

  useEffect(() => {
    if (propostaReaberta) return; // proposta reaberta dita a própria lente
    setLente(diagnostico.lenteSugerida);
  }, [diagnostico.lenteSugerida, propostaReaberta]);

  // Quando lente muda, reseta a edição (base mudou) — só se há comparativo
  // e não estamos em proposta reaberta (que tem blocos congelados).
  useEffect(() => {
    if (comparativo && !propostaReaberta) {
      setSugestaoEditavel(comparativo[lente].blocos.map((b) => ({ ...b })));
    }
  }, [comparativo, lente, propostaReaberta]);

  /**
   * Limpa estado quando setup muda. Chamado explicitamente nos handlers
   * (toggle hospital, mês, meta) em vez de via useEffect, pra não conflitar
   * com transições controladas tipo regerar-a-partir-de-proposta-reaberta.
   */
  function invalidarSetupAtual() {
    if (propostaReaberta) return;
    setComparativo(null);
    setSugestaoEditavel(null);
    setSetupColapsado(false);
  }

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
    invalidarSetupAtual();
  }

  function trocarMesAlvo(m: string) {
    setMesAlvo(m);
    invalidarSetupAtual();
  }

  function trocarMeta(v: string) {
    setMetaInput(v);
    invalidarSetupAtual();
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
    // Gerar do zero = nova proposta · descarta id reaberto
    setPropostaAtivaId(null);
    setPropostaReaberta(null);
  }

  function abrirEditorMarcador(b: Bloco) {
    if (b.tipo !== 'plantao') return;
    setEditorPlantao({ modo: 'editar', bloco: b });
  }

  function abrirDiaAtivo(iso: string) {
    setDiaAtivo(iso);
  }

  function flash(msg: string) {
    setFlashMsg(msg);
    window.setTimeout(() => setFlashMsg(null), 2400);
  }

  function bloquearDia(iso: string) {
    if (!onAdicionarBloco) return;
    const novo: BlocoBloqueio = {
      id: `bloq-${Date.now()}`,
      tipo: 'bloqueio',
      data: iso,
      horaInicio: 0,
      duracao: 24,
    };
    onAdicionarBloco(novo);
    flash(`${fmtDate(iso)} bloqueado · vai pra agenda`);
    setDiaAtivo(null);
  }

  function desbloquearDia(iso: string) {
    if (!onRemoverBloco) return;
    const bloq = blocos.find(
      (b): b is BlocoBloqueio => b.tipo === 'bloqueio' && b.data === iso,
    );
    if (!bloq) return;
    onRemoverBloco(bloq.id);
    flash(`${fmtDate(iso)} desbloqueado`);
    setDiaAtivo(null);
  }

  function adicionarPlantaoNoDia(iso: string) {
    setEditorPlantao({ modo: 'adicionar', dataISO: iso });
    setDiaAtivo(null);
  }

  function editarPlantaoDoDia(b: BlocoPlantao) {
    setEditorPlantao({ modo: 'editar', bloco: b });
    setDiaAtivo(null);
  }

  function removerPlantaoDoDia(id: string | number) {
    if (!sugestaoEditavel) return;
    setSugestaoEditavel(sugestaoEditavel.filter((p) => p.id !== id));
    flash('plantão removido da proposta');
  }

  function salvarPlantaoEditor(novo: BlocoPlantao) {
    if (!sugestaoEditavel) {
      setSugestaoEditavel([novo]);
    } else {
      const existente = sugestaoEditavel.find((p) => p.id === novo.id);
      if (existente) {
        setSugestaoEditavel(sugestaoEditavel.map((p) => (p.id === novo.id ? novo : p)));
      } else {
        setSugestaoEditavel([...sugestaoEditavel, novo]);
      }
    }
    setEditorPlantao(null);
  }

  function removerPlantaoEditor(id: string | number) {
    if (!sugestaoEditavel) return;
    setSugestaoEditavel(sugestaoEditavel.filter((p) => p.id !== id));
    setEditorPlantao(null);
  }

  function resetarEdicao() {
    if (!comparativo) return;
    setSugestaoEditavel(comparativo[lente].blocos.map((b) => ({ ...b })));
  }

  function reabrirProposta(p: PropostaSalva) {
    setMesAlvo(p.mesISO);
    setHospitaisIncluidos(new Set(p.hospitaisIncluidos));
    setMetaInput(String(p.metaUsada));
    setLente(p.lente);
    setComparativo(null); // sem 3 lentes · só a salva
    setSugestaoEditavel(p.blocos.map((b) => ({ ...b })));
    setSetupColapsado(true);
    setPropostaAtivaId(p.id);
    setPropostaReaberta(p);
    setHistoricoAberto(false);
  }

  function removerPropostaDoHistorico(id: string) {
    onAtualizarPropostas(removerPropostaLista(propostas, id));
    if (propostaAtivaId === id) {
      setPropostaAtivaId(null);
      setPropostaReaberta(null);
    }
  }

  const sugestaoOriginal = propostaReaberta
    ? propostaReaberta.blocos
    : comparativo
    ? comparativo[lente].blocos
    : [];
  const houveEdicao =
    sugestaoEditavel !== null &&
    (sugestaoEditavel.length !== sugestaoOriginal.length ||
      sugestaoEditavel.some((b, i) => {
        const orig = sugestaoOriginal[i];
        if (!orig) return true;
        return (
          b.id !== orig.id ||
          b.data !== orig.data ||
          b.horaInicio !== orig.horaInicio ||
          b.duracao !== orig.duracao ||
          b.hospitalId !== orig.hospitalId
        );
      }));

  const blocosFinaisProposta = sugestaoEditavel ?? [];

  const podeGerar = hospitaisIncluidos.size > 0;
  const temPropostaPraMostrar = comparativo !== null || propostaReaberta !== null;

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
            onEditar={() => setSetupColapsado(false)}
          />
        ) : !semHospitais ? (
          <SetupCard
            mesAlvo={mesAlvo}
            onMesAlvo={trocarMesAlvo}
            hospitais={hospitais}
            hospitaisIncluidos={hospitaisIncluidos}
            onToggleHospital={toggleHospital}
            metaInput={metaInput}
            onMetaInput={trocarMeta}
            metaPreferencia={preferencias.metaMensal}
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

        {temPropostaPraMostrar && (
          <>
            {comparativo && !propostaReaberta && (
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
              </>
            )}

            {propostaReaberta && (
              <PropostaReabertaCard
                proposta={propostaReaberta}
                onRegerar={() => {
                  setPropostaReaberta(null);
                  setPropostaAtivaId(null);
                  gerar();
                }}
                onDescartar={() => {
                  setPropostaReaberta(null);
                  setPropostaAtivaId(null);
                  setSugestaoEditavel(null);
                  setSetupColapsado(false);
                }}
              />
            )}

            {(sugestao || propostaReaberta) && (
              <Card
                titulo="prévia do mês"
                eyebrow={`${blocosFinaisProposta.length} plantões · sugestão pro chefe`}
              >
                <CalendarioMes
                  refIso={`${mesAlvo}-15`}
                  blocos={blocos}
                  hospitais={hospitais}
                  marcadores={blocosFinaisProposta}
                  onSelectMarcador={abrirEditorMarcador}
                  cellHotspot
                  onSelectDia={abrirDiaAtivo}
                />
                <Hand
                  color="var(--lavender-ink)"
                  size={14}
                  style={{ display: 'block', marginTop: 10 }}
                >
                  click num dia pra ver e ajustar tudo que tem nele
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

                {sugestao && sugestao.resumo.motivosPulados.length > 0 && (
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

        {!semHospitais && propostas.length > 0 && (
          <HistoricoTrigger
            quantidade={propostas.length}
            onAbrir={() => setHistoricoAberto(true)}
          />
        )}
      </div>

      {editorPlantao && (
        <EditorPlantaoProposta
          modo={editorPlantao.modo}
          dataISO={editorPlantao.modo === 'adicionar' ? editorPlantao.dataISO : undefined}
          blocoExistente={editorPlantao.modo === 'editar' ? editorPlantao.bloco : undefined}
          hospitais={hospitaisAtivos}
          jaTemOutroNoDia={blocosFinaisProposta.some((b) => {
            const dataAlvo =
              editorPlantao.modo === 'adicionar'
                ? editorPlantao.dataISO
                : editorPlantao.bloco.data;
            const idAlvo = editorPlantao.modo === 'editar' ? editorPlantao.bloco.id : null;
            return b.data === dataAlvo && b.id !== idAlvo;
          })}
          onConfirmar={salvarPlantaoEditor}
          onRemover={
            editorPlantao.modo === 'editar'
              ? () => removerPlantaoEditor(editorPlantao.bloco.id)
              : undefined
          }
          onCancelar={() => setEditorPlantao(null)}
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
          onPrimeiraExportacao={() => {
            // Cria/atualiza a proposta · garante que tem id ativo
            if (propostaAtivaId) return propostaAtivaId;
            const id = novoIdProposta();
            setPropostaAtivaId(id);
            return id;
          }}
          propostaAtivaId={propostaAtivaId}
          dadosProposta={{
            mesISO: mesAlvo,
            hospitaisIncluidos: [...hospitaisIncluidos],
            metaUsada: Number(metaInput.replace(/\D/g, '')) || 0,
            bloqueioIds: bloqueiosDoMes.map((b) => b.id),
            lente,
            blocos: blocosFinaisProposta,
          }}
          propostas={propostas}
          onAtualizarPropostas={onAtualizarPropostas}
          onFechar={() => setExportandoAberto(false)}
        />
      )}

      {historicoAberto && (
        <HistoricoDrawer
          propostas={propostas}
          hospitais={hospitais}
          onAbrir={reabrirProposta}
          onRemover={removerPropostaDoHistorico}
          onFechar={() => setHistoricoAberto(false)}
        />
      )}

      {diaAtivo && (
        <DiaProposta
          iso={diaAtivo}
          plantoesNoDia={blocosFinaisProposta.filter((p) => p.data === diaAtivo)}
          bloqueio={
            blocos.find(
              (b): b is BlocoBloqueio => b.tipo === 'bloqueio' && b.data === diaAtivo,
            ) ?? null
          }
          hospitais={hospitaisAtivos}
          onAdicionar={() => adicionarPlantaoNoDia(diaAtivo)}
          onEditar={editarPlantaoDoDia}
          onRemover={removerPlantaoDoDia}
          onBloquear={() => bloquearDia(diaAtivo)}
          onDesbloquear={() => desbloquearDia(diaAtivo)}
          onFechar={() => setDiaAtivo(null)}
        />
      )}

      {flashMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--ink)',
            color: 'var(--bg)',
            padding: '10px 18px',
            borderRadius: 999,
            font: '500 13px/1.4 var(--font-body)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 80,
            animation: 'colo-fade-in 180ms ease',
          }}
        >
          {flashMsg}
        </div>
      )}
    </>
  );
}

interface DiaPropostaProps {
  iso: string;
  plantoesNoDia: BlocoPlantao[];
  bloqueio: BlocoBloqueio | null;
  hospitais: HospitaisMap;
  onAdicionar: () => void;
  onEditar: (b: BlocoPlantao) => void;
  onRemover: (id: string | number) => void;
  onBloquear: () => void;
  onDesbloquear: () => void;
  onFechar: () => void;
}

/**
 * Modal "detalhe do dia" no builder de proposta. Expande o conteúdo do dia:
 * cards individuais por plantão (cor do hospital · ações editar/remover),
 * empty state se vazio, ação primária pra adicionar, e bloquear/desbloquear
 * no rodapé separado por divisória.
 */
function DiaProposta({
  iso,
  plantoesNoDia,
  bloqueio,
  hospitais,
  onAdicionar,
  onEditar,
  onRemover,
  onBloquear,
  onDesbloquear,
  onFechar,
}: DiaPropostaProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const ordenados = [...plantoesNoDia].sort((a, b) => a.horaInicio - b.horaInicio);
  const [ano, mes, dia] = iso.split('-').map(Number);
  const dt = new Date(ano!, mes! - 1, dia!);
  const diaSemana = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dataLonga = dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.28)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 20px',
        animation: 'colo-fade-in 160ms ease',
        overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          width: '100%',
          maxWidth: 560,
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-day-expand 220ms cubic-bezier(.2,.7,.2,1)',
          overflow: 'hidden',
          border: '1px solid var(--lavender-ink)',
        }}
      >
        <div
          style={{
            background: 'var(--lavender-surface)',
            padding: '16px 24px 14px',
            borderBottom: '1px dashed var(--lavender-ink)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <Eyebrow color="var(--lavender-ink)">{diaSemana}</Eyebrow>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 26,
                letterSpacing: '-0.015em',
                margin: '4px 0 2px',
                color: 'var(--ink)',
              }}
            >
              {dataLonga}
            </h2>
            <Mono style={{ color: 'var(--lavender-ink)', display: 'block', fontSize: 11 }}>
              {bloqueio
                ? 'dia bloqueado · não vai pro chefe'
                : ordenados.length === 0
                ? 'nenhum plantão proposto'
                : `${ordenados.length} ${ordenados.length === 1 ? 'plantão proposto' : 'plantões propostos'}`}
            </Mono>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="fechar"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--lavender-ink)',
              borderRadius: 999,
              padding: 6,
              cursor: 'pointer',
              color: 'var(--lavender-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px 4px' }}>
          {bloqueio ? (
            <div
              style={{
                background: 'var(--bg-alt)',
                border: '1px dashed var(--line-2)',
                borderRadius: 14,
                padding: '20px 20px',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <Hand color="var(--ink-3)" size={16} style={{ display: 'block' }}>
                este dia tá bloqueado
              </Hand>
              <Mono style={{ color: 'var(--ink-3)', display: 'block', marginTop: 6, fontSize: 11 }}>
                bloqueios não viram sugestão pro chefe
              </Mono>
            </div>
          ) : ordenados.length === 0 ? (
            <div
              style={{
                background: 'var(--bg-alt)',
                border: '1px dashed var(--line-2)',
                borderRadius: 14,
                padding: '24px 20px',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <Hand color="var(--ink-3)" size={16} style={{ display: 'block' }}>
                nada proposto pra este dia ainda
              </Hand>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginBottom: 16,
              }}
            >
              {ordenados.map((p) => (
                <PlantaoLinha
                  key={String(p.id)}
                  plantao={p}
                  hospitais={hospitais}
                  onEditar={() => onEditar(p)}
                  onRemover={() => onRemover(p.id)}
                />
              ))}
            </div>
          )}

          {!bloqueio && (
            <button
              type="button"
              onClick={onAdicionar}
              style={{
                width: '100%',
                font: '600 13px/1 var(--font-body)',
                padding: '14px 18px',
                borderRadius: 12,
                border: '1px dashed var(--lavender-ink)',
                background: 'transparent',
                color: 'var(--lavender-ink)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {ordenados.length > 0 ? 'adicionar outro plantão' : 'adicionar plantão à proposta'}
            </button>
          )}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--line)',
            padding: '14px 24px 18px',
            background: 'var(--bg-alt)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            {bloqueio ? 'desbloquear devolve à agenda livre' : 'bloquear vai pra sua agenda real'}
          </Mono>
          {bloqueio ? (
            <button
              type="button"
              onClick={onDesbloquear}
              style={{
                font: '600 12px/1 var(--font-body)',
                padding: '10px 18px',
                borderRadius: 999,
                border: '1px solid var(--ink-2)',
                background: 'transparent',
                color: 'var(--ink-2)',
                cursor: 'pointer',
              }}
            >
              desbloquear o dia
            </button>
          ) : (
            <button
              type="button"
              onClick={onBloquear}
              style={{
                font: '600 12px/1 var(--font-body)',
                padding: '10px 18px',
                borderRadius: 999,
                border: '1px solid var(--coral-ink)',
                background: 'transparent',
                color: 'var(--coral-ink)',
                cursor: 'pointer',
              }}
            >
              bloquear o dia
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlantaoLinha({
  plantao,
  hospitais,
  onEditar,
  onRemover,
}: {
  plantao: BlocoPlantao;
  hospitais: HospitaisMap;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const h = hospitais[plantao.hospitalId];
  const cor = h?.cor ?? 'sand';
  return (
    <div
      style={{
        background: `var(--${cor}-surface)`,
        borderLeft: `4px solid var(--${cor})`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <Eyebrow color={`var(--${cor}-ink)`}>{h?.abrev ?? plantao.hospitalId}</Eyebrow>
          <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            {fmtRange(plantao.horaInicio, plantao.duracao)} · {plantao.duracao}h
          </Mono>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 16,
            margin: '4px 0 0',
            color: 'var(--ink)',
          }}
        >
          {h?.nome ?? plantao.hospitalId}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={onEditar}
          aria-label="editar"
          title="editar"
          style={iconBtnStyle}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onRemover}
          aria-label="remover"
          title="remover"
          style={{ ...iconBtnStyle, color: 'var(--coral-ink)', borderColor: 'var(--coral-ink)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function HistoricoTrigger({
  quantidade,
  onAbrir,
}: {
  quantidade: number;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      style={{
        background: 'var(--bg-alt)',
        border: '1px dashed var(--line-2)',
        borderRadius: 14,
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <div>
        <Eyebrow>histórico</Eyebrow>
        <p
          style={{
            font: '500 14px/1.4 var(--font-body)',
            color: 'var(--ink-2)',
            margin: '4px 0 0',
          }}
        >
          minhas propostas · {quantidade} {quantidade === 1 ? 'salva' : 'salvas'}
        </p>
      </div>
      <span
        style={{
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
        }}
      >
        ver →
      </span>
    </button>
  );
}

interface PropostaReabertaCardProps {
  proposta: PropostaSalva;
  onRegerar: () => void;
  onDescartar: () => void;
}

function PropostaReabertaCard({ proposta, onRegerar, onDescartar }: PropostaReabertaCardProps) {
  const exportada = proposta.exportadaEm
    ? new Date(proposta.exportadaEm).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : null;
  return (
    <div
      style={{
        background: 'var(--lavender-surface)',
        border: '1px solid var(--lavender-ink)',
        borderRadius: 16,
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <Eyebrow color="var(--lavender-ink)">proposta reaberta · {ROTULO_LENTE[proposta.lente]}</Eyebrow>
        <p
          style={{
            font: '500 14px/1.4 var(--font-body)',
            color: 'var(--ink)',
            margin: '4px 0 0',
          }}
        >
          {fmtMesAnoExtenso(proposta.mesISO)} · {proposta.blocos.length} plantões
          {exportada ? ` · enviada em ${exportada}` : ''}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRegerar}
          style={{
            font: '600 12px/1 var(--font-body)',
            padding: '10px 16px',
            borderRadius: 999,
            border: '1px solid var(--lavender-ink)',
            background: 'transparent',
            color: 'var(--lavender-ink)',
            cursor: 'pointer',
          }}
        >
          regerar 3 cenários
        </button>
        <button
          type="button"
          onClick={onDescartar}
          style={{
            font: '600 12px/1 var(--font-body)',
            padding: '10px 16px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          fechar
        </button>
      </div>
    </div>
  );
}

interface HistoricoDrawerProps {
  propostas: PropostaSalva[];
  hospitais: HospitaisMap;
  onAbrir: (p: PropostaSalva) => void;
  onRemover: (id: string) => void;
  onFechar: () => void;
}

function HistoricoDrawer({
  propostas,
  hospitais,
  onAbrir,
  onRemover,
  onFechar,
}: HistoricoDrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.22)',
        zIndex: 65,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'colo-fade-in 180ms ease',
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          width: '100%',
          maxWidth: 480,
          height: '100%',
          padding: '28px 32px',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-drawer-in 220ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 4,
          }}
        >
          <Eyebrow>histórico</Eyebrow>
          <button
            type="button"
            onClick={onFechar}
            aria-label="fechar"
            style={{
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: 6,
              cursor: 'pointer',
              color: 'var(--ink-2)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 24,
            letterSpacing: '-0.015em',
            margin: '4px 0 4px',
          }}
        >
          minhas propostas
        </h2>
        <Mono style={{ color: 'var(--ink-3)', display: 'block', marginBottom: 18 }}>
          últimas {propostas.length} {propostas.length === 1 ? 'salva' : 'salvas'} · clica pra reabrir
        </Mono>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {propostas.map((p) => (
            <CardProposta
              key={p.id}
              proposta={p}
              hospitais={hospitais}
              onAbrir={() => onAbrir(p)}
              onRemover={() => onRemover(p.id)}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}

function CardProposta({
  proposta,
  hospitais,
  onAbrir,
  onRemover,
}: {
  proposta: PropostaSalva;
  hospitais: HospitaisMap;
  onAbrir: () => void;
  onRemover: () => void;
}) {
  const corLente =
    proposta.lente === 'descansar'
      ? 'var(--sage-ink)'
      : proposta.lente === 'ganhar'
      ? '#B8884A'
      : 'var(--lavender-ink)';
  const exportada = proposta.exportadaEm
    ? new Date(proposta.exportadaEm).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : null;
  const chefes = proposta.exportadaParaChefes ?? {};
  const chefesEntries = Object.entries(chefes).filter(([, n]) => n.trim());

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: corLente,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 18,
              color: 'var(--ink)',
            }}
          >
            {fmtMesAnoExtenso(proposta.mesISO)}
          </span>
        </div>
        <Eyebrow color={corLente}>{ROTULO_LENTE[proposta.lente]}</Eyebrow>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {proposta.hospitaisIncluidos.map((id) => {
          const h = hospitais[id];
          if (!h) return (
            <span
              key={id}
              style={{
                font: '500 11px/1 var(--font-mono)',
                padding: '4px 8px',
                borderRadius: 999,
                background: 'var(--bg-alt)',
                color: 'var(--ink-3)',
              }}
            >
              {id}
            </span>
          );
          return (
            <span
              key={id}
              style={{
                font: '500 11px/1 var(--font-mono)',
                padding: '4px 8px',
                borderRadius: 999,
                background: `var(--${h.cor}-surface)`,
                color: `var(--${h.cor}-ink)`,
              }}
            >
              {h.abrev}
            </span>
          );
        })}
      </div>

      <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
        {proposta.blocos.length} plantões · {exportada ? `enviada em ${exportada}` : 'rascunho'}
      </Mono>

      {chefesEntries.length > 0 && (
        <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
          enviada pra {chefesEntries.map(([id, nome]) => `${nome} (${hospitais[id]?.abrev ?? id})`).join(' · ')}
        </Mono>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onAbrir}
          style={{
            font: '600 12px/1 var(--font-body)',
            padding: '8px 14px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--ink)',
            color: 'var(--bg)',
            cursor: 'pointer',
          }}
        >
          reabrir
        </button>
        <button
          type="button"
          onClick={onRemover}
          style={{
            font: '600 12px/1 var(--font-body)',
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-3)',
            cursor: 'pointer',
          }}
        >
          remover
        </button>
      </div>
    </div>
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
  onGerar,
  podeGerar,
  jaTemResultado,
}: SetupCardProps) {
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

        <Hand color="var(--ink-3)" size={13} style={{ display: 'block' }}>
          bloqueios você cria depois, clicando direto no dia da prévia
        </Hand>

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
  onEditar: () => void;
}

function fmtMesAlvo(iso: string): string {
  const [ano, mes] = iso.split('-').map(Number);
  if (!ano || !mes) return iso;
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${meses[mes - 1]} ${ano}`;
}

function SetupChip({ mesAlvo, hospitaisIncluidos, metaInput, onEditar }: SetupChipProps) {
  const meta = Number(metaInput.replace(/\D/g, '')) || 0;
  const partes = [
    fmtMesAlvo(mesAlvo),
    `${hospitaisIncluidos.size} ${hospitaisIncluidos.size === 1 ? 'hospital' : 'hospitais'}`,
    `meta R$ ${meta.toLocaleString('pt-BR')}`,
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

interface EditorPlantaoPropostaProps {
  /** Modo: 'adicionar' precisa de dataISO; 'editar' precisa de blocoExistente. */
  modo: 'adicionar' | 'editar';
  dataISO?: string;
  blocoExistente?: BlocoPlantao;
  hospitais: HospitaisMap;
  jaTemOutroNoDia: boolean;
  onConfirmar: (b: BlocoPlantao) => void;
  onRemover?: () => void;
  onCancelar: () => void;
}

/**
 * Editor unificado de plantão dentro do builder de proposta. Identidade
 * visual lavanda + etiqueta "proposta" pra deixar claro que NÃO entra na
 * agenda real — é só sugestão pro chefe.
 */
function EditorPlantaoProposta({
  modo,
  dataISO,
  blocoExistente,
  hospitais,
  jaTemOutroNoDia,
  onConfirmar,
  onRemover,
  onCancelar,
}: EditorPlantaoPropostaProps) {
  const lista = Object.values(hospitais);
  const [hospitalId, setHospitalId] = useState(
    blocoExistente?.hospitalId ?? lista[0]?.id ?? '',
  );
  const [data, setData] = useState(blocoExistente?.data ?? dataISO ?? '');
  const [horaInicio, setHoraInicio] = useState(blocoExistente?.horaInicio ?? 7);
  const [duracao, setDuracao] = useState(blocoExistente?.duracao ?? 12);

  const valido = hospitalId && duracao > 0 && data;

  function confirmar() {
    if (!valido) return;
    const id = blocoExistente?.id ?? `prop-${Date.now()}`;
    const novo: BlocoPlantao = {
      id,
      tipo: 'plantao',
      hospitalId,
      data,
      horaInicio,
      duracao,
    };
    onConfirmar(novo);
  }

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.22)',
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
          padding: 0,
          width: '100%',
          maxWidth: 460,
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
          overflow: 'hidden',
          border: '2px solid var(--lavender-ink)',
        }}
      >
        <div
          style={{
            background: 'var(--lavender-surface)',
            padding: '14px 22px 12px',
            borderBottom: '1px dashed var(--lavender-ink)',
          }}
        >
          <Eyebrow color="var(--lavender-ink)">
            {modo === 'adicionar' ? 'adicionar à proposta' : 'editar plantão da proposta'}
          </Eyebrow>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 22,
              margin: '4px 0 2px',
              color: 'var(--ink)',
            }}
          >
            {modo === 'adicionar' ? 'novo plantão sugerido' : 'ajustar plantão sugerido'}
          </h2>
          <Mono style={{ color: 'var(--lavender-ink)', display: 'block', fontSize: 11 }}>
            isto é só uma sugestão pro chefe · não entra na sua agenda
          </Mono>
        </div>

        <div style={{ padding: '18px 22px 22px' }}>
          {jaTemOutroNoDia && (
            <Pill kind="warn" style={{ marginBottom: 10 }}>
              já tem outro plantão proposto neste dia
            </Pill>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <Field label="dia">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                style={inputStyle}
              />
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
            <Mono style={{ color: 'var(--ink-3)', display: 'block' }}>
              {data ? fmtDate(data) + ' · ' : ''}
              {fmtRange(horaInicio, duracao)} · {duracao}h
            </Mono>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 20,
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={confirmar}
                disabled={!valido}
                style={{
                  font: '600 13px/1 var(--font-body)',
                  padding: '12px 22px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--lavender-ink)',
                  color: 'var(--bg)',
                  cursor: valido ? 'pointer' : 'not-allowed',
                  opacity: valido ? 1 : 0.5,
                }}
              >
                {modo === 'adicionar' ? 'adicionar à proposta' : 'salvar alterações'}
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
            {modo === 'editar' && onRemover && (
              <button
                type="button"
                onClick={onRemover}
                style={{
                  font: '600 12px/1 var(--font-body)',
                  padding: '10px 16px',
                  borderRadius: 999,
                  border: '1px solid var(--coral-ink)',
                  background: 'transparent',
                  color: 'var(--coral-ink)',
                  cursor: 'pointer',
                }}
              >
                remover da proposta
              </button>
            )}
          </div>
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
