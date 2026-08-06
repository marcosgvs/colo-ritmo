import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type {
  EscalaEquipe as EscalaEquipeT,
  EscalaImportada,
  HospitaisMap,
  Janela,
  TurnoEquipe,
} from '@/types';
import { DOWS, diaSemanaBR, fmtRange, fromISO, HOJE, MESES } from '@/lib/data';
import {
  conflitosEquipe,
  escolherSlotPorPonteiro,
  idChipEscalado,
  idChipRoster,
  idSlot,
  JANELAS_DEFAULT,
  medicosDaImportada,
  resolverDrop,
  resumoPorMedico,
  semanasDoMes,
  turnosDeReferencia,
  type RetanguloSlot,
} from '@/lib/equipe';
import { Eyebrow, Hand, Mono, MonthPicker, Pill } from '@/components/atoms';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHead } from './_PageHead';
import {
  baixarPDFEquipeCompleto,
  baixarPDFEquipeMedico,
  fmtHorarioJanela,
  mesPorExtenso,
  rotuloDiaCurto,
  slugNome,
  type DadosPDFEquipe,
} from '@/lib/pdfEquipe';
import {
  baixarArquivoTexto,
  baixarXLSXEquipe,
  icsEquipe,
  textoEquipeGeral,
  textoEquipeMedico,
} from '@/lib/exportarEquipe';

interface EscalaEquipeProps {
  hospitais: HospitaisMap;
  escalasImportadas: EscalaImportada[];
  escalasEquipe: EscalaEquipeT[];
  /** Upsert por hospital+mês · o App persiste no user_state. */
  onSalvar: (e: EscalaEquipeT) => void;
}

/** Paleta de cores por médico · cicla os tokens do design system. */
const CORES_MEDICO = ['lavender', 'coral', 'blue', 'sage', 'sand', 'olive', 'aqua'] as const;

function corDoMedico(medico: string, medicos: string[]): string {
  const i = Math.max(0, medicos.indexOf(medico));
  return CORES_MEDICO[i % CORES_MEDICO.length]!;
}

/** Primeiro nome + inicial do segundo · usado nas mensagens de movimento. */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0]!;
  return `${partes[0]} ${partes[1]![0]}.`;
}

function mesLabel(mesISO: string): string {
  const d = fromISO(`${mesISO}-01`);
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function nomeArq(abrev: string, mesISO: string, ext: string, medico?: string): string {
  return `escala-${slugNome(abrev)}-${mesISO}${medico ? `-${slugNome(medico)}` : ''}.${ext}`;
}

/**
 * O alvo do drop é a ponta do cursor, resolvido por
 * `escolherSlotPorPonteiro` (regra e testes em lib/equipe) — o default do
 * dnd-kit usa a área do chip arrastado e caía no dia vizinho do mirado.
 */
const colisaoPorCursor: CollisionDetection = (args) => {
  const rects: RetanguloSlot[] = [];
  for (const [id, rect] of args.droppableRects) {
    if (!rect) continue;
    rects.push({
      id: String(id),
      top: rect.top,
      left: rect.left,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    });
  }
  const escolhido = escolherSlotPorPonteiro(args.pointerCoordinates, rects);
  if (!escolhido) return [];
  const container = args.droppableContainers.find((c) => String(c.id) === escolhido);
  return container ? [{ id: container.id }] : [];
};

/** União de janelas por rótulo (hospital + importada + rascunho), por hora. */
function janelasConhecidas(
  hospital: Janela[] | undefined,
  importada: Janela[] | undefined,
  rascunho: Janela[] | undefined,
): Janela[] {
  const m = new Map<string, Janela>();
  for (const j of [...(hospital ?? []), ...(importada ?? []), ...(rascunho ?? [])]) {
    if (!m.has(j.rotulo.toLowerCase())) m.set(j.rotulo.toLowerCase(), j);
  }
  const lista = [...m.values()].sort((a, b) => a.inicio - b.inicio);
  return lista.length > 0 ? lista : JANELAS_DEFAULT;
}

/** Altura das áreas com scroll próprio · a página em si não rola. O
 * desconto cobre header do app + padding + barra do setup + equipe. */
const ALTURA_PAINEL = 'clamp(320px, calc(100vh - 290px), 900px)';

type Etapa = 'setup' | 'montar' | 'revisar' | 'exportar';

/**
 * EscalaEquipe · página (temporária) onde a chefe monta a escala do TIME
 * inteiro de um hospital, em 4 etapas:
 *
 *   setup    → hospital, mês, puxar escala anterior, turnos do hospital
 *   montar   → calendário dia-por-linha · arrasta/clica os médicos
 *   revisar  → o mês inteiro numa tabela, pra conferir antes de mandar
 *   exportar → txt · pdf · agenda · excel · geral e por médico
 *
 * Feita pra desktop (mobile avisa).
 */
export function EscalaEquipe({
  hospitais,
  escalasImportadas,
  escalasEquipe,
  onSalvar,
}: EscalaEquipeProps) {
  const isMobile = useIsMobile();
  const hospitaisLista = Object.values(hospitais);

  // Default: onde ela já estava trabalhando · senão o hospital da escala
  // importada mais recente (proxy de "onde ela é chefe") · senão o 1º.
  const [hospitalId, setHospitalId] = useState<string>(() => {
    if (escalasEquipe[0]?.hospitalId && hospitais[escalasEquipe[0].hospitalId]) {
      return escalasEquipe[0].hospitalId;
    }
    const imp = [...escalasImportadas].sort(
      (a, b) => b.ano * 100 + b.mes - (a.ano * 100 + a.mes),
    )[0];
    if (imp && hospitais[imp.hospitalId]) return imp.hospitalId;
    return hospitaisLista[0]?.id ?? '';
  });
  const [mesISO, setMesISO] = useState<string>(() => {
    if (escalasEquipe[0]?.mesISO) return escalasEquipe[0].mesISO;
    const d = fromISO(HOJE);
    d.setMonth(d.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [etapa, setEtapa] = useState<Etapa>('setup');
  const [puxarAoAbrir, setPuxarAoAbrir] = useState(true);
  const [rosterAberto, setRosterAberto] = useState(false);
  const [medicoSel, setMedicoSel] = useState<string | null>(null);
  const [novoMedico, setNovoMedico] = useState('');
  const [exportando, setExportando] = useState<string | null>(null);
  /** Id do que está sendo arrastado agora · alimenta o DragOverlay. */
  const [arrastando, setArrastando] = useState<string | null>(null);
  /** Volta o calendário pro dia 1 ao trocar de mês (o nó DOM é reusado). */
  const scrollCalRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rascunho = escalasEquipe.find((e) => e.hospitalId === hospitalId && e.mesISO === mesISO);
  const importadaRecente = useMemo(
    () =>
      escalasImportadas
        .filter((e) => e.hospitalId === hospitalId)
        .sort((a, b) => b.ano * 100 + b.mes - (a.ano * 100 + a.mes))[0],
    [escalasImportadas, hospitalId],
  );

  const medicos = rascunho?.medicos ?? [];
  const turnos = rascunho?.turnos ?? [];
  const obs = rascunho?.obs ?? {};

  const conhecidas = janelasConhecidas(
    hospitais[hospitalId]?.janelas,
    importadaRecente?.janelas,
    rascunho?.janelas,
  );
  // Janelas ATIVAS (colunas do calendário) · sem rascunho salvo, tudo menos
  // "noitinha" — no HCB ela é ruído da escala antiga · religa no toggle.
  const janelas: Janela[] =
    rascunho?.janelas ?? conhecidas.filter((j) => j.rotulo.toLowerCase() !== 'noitinha');

  const semanas = useMemo(() => semanasDoMes(mesISO), [mesISO]);
  const resumos = useMemo(
    () => resumoPorMedico(medicos, turnos, janelas, mesISO),
    [medicos, turnos, janelas, mesISO],
  );
  const conflitos = useMemo(() => conflitosEquipe(turnos, janelas), [turnos, janelas]);

  const turnosPorSlot = useMemo(() => {
    const m = new Map<string, TurnoEquipe[]>();
    for (const t of turnos) {
      const k = `${t.data}|${t.janela}`;
      const arr = m.get(k) ?? [];
      arr.push(t);
      m.set(k, arr);
    }
    return m;
  }, [turnos]);

  // Cliques em sequência rápida chegam antes do re-render: ler do closure
  // perderia atribuições. O ref acumula otimisticamente entre renders e SÓ
  // ressincroniza quando o rascunho das props muda de verdade (save que
  // voltou, realtime, troca de mês) — re-render interno (histórico, seleção)
  // não pode descartar o acúmulo.
  const atualRef = useRef({ medicos, janelas, turnos, obs });
  const origemRef = useRef<{ rascunho: EscalaEquipeT | undefined; chave: string }>({
    rascunho,
    chave: `${hospitalId}|${mesISO}`,
  });
  if (
    origemRef.current.rascunho !== rascunho ||
    origemRef.current.chave !== `${hospitalId}|${mesISO}`
  ) {
    origemRef.current = { rascunho, chave: `${hospitalId}|${mesISO}` };
    atualRef.current = { medicos, janelas, turnos, obs };
  }

  // Histórico de movimentos (desfazer/refazer) · por hospital+mês, só da
  // sessão. Cada entrada guarda o estado ANTES do movimento + a descrição
  // — a descrição também sinaliza pro leigo o que acabou de acontecer.
  type Snapshot = typeof atualRef.current;
  interface Movimento {
    snap: Snapshot;
    desc: string;
  }
  const chaveEscala = `${hospitalId}|${mesISO}`;
  const [hist, setHist] = useState<{ chave: string; passado: Movimento[]; futuro: Movimento[] }>({
    chave: chaveEscala,
    passado: [],
    futuro: [],
  });
  const passado = hist.chave === chaveEscala ? hist.passado : [];
  const futuro = hist.chave === chaveEscala ? hist.futuro : [];
  const [ultimaAcao, setUltimaAcao] = useState<string | null>(null);

  function aplicar(snap: Snapshot): void {
    atualRef.current = snap;
    onSalvar({ hospitalId, mesISO, ...snap, atualizadaEm: new Date().toISOString() });
  }

  function salvar(prox: Partial<EscalaEquipeT>, desc: string): void {
    const antes = atualRef.current;
    const proximo: EscalaEquipeT = {
      hospitalId,
      mesISO,
      ...antes,
      ...prox,
      atualizadaEm: new Date().toISOString(),
    };
    atualRef.current = {
      medicos: proximo.medicos,
      janelas: proximo.janelas,
      turnos: proximo.turnos,
      obs: proximo.obs ?? {},
    };
    setHist((h) => ({
      chave: chaveEscala,
      passado: [...(h.chave === chaveEscala ? h.passado : []), { snap: antes, desc }].slice(-30),
      futuro: [],
    }));
    setUltimaAcao(desc);
    onSalvar(proximo);
  }

  function desfazer(): void {
    setHist((h) => {
      const p = h.chave === chaveEscala ? [...h.passado] : [];
      const mov = p.pop();
      if (!mov) return h;
      const agora = atualRef.current;
      aplicar(mov.snap);
      setUltimaAcao(`desfeito · ${mov.desc}`);
      return {
        chave: chaveEscala,
        passado: p,
        futuro: [...(h.chave === chaveEscala ? h.futuro : []), { snap: agora, desc: mov.desc }],
      };
    });
  }

  function refazer(): void {
    setHist((h) => {
      const f = h.chave === chaveEscala ? [...h.futuro] : [];
      const mov = f.pop();
      if (!mov) return h;
      const agora = atualRef.current;
      aplicar(mov.snap);
      setUltimaAcao(`refeito · ${mov.desc}`);
      return {
        chave: chaveEscala,
        passado: [...(h.chave === chaveEscala ? h.passado : []), { snap: agora, desc: mov.desc }],
        futuro: f,
      };
    });
  }

  // ctrl/cmd+Z desfaz · +shift refaz · ignora quando digitando num campo
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (e.shiftKey) refazer();
      else desfazer();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveEscala]);

  // Trocar de mês (ou entrar no calendário vindo de outra etapa) tem que
  // começar no dia 1 · o nó do scroll é reaproveitado pelo React.
  useEffect(() => {
    if (etapa === 'montar' && scrollCalRef.current) scrollCalRef.current.scrollTop = 0;
  }, [etapa, mesISO, hospitalId]);

  /** "seg 08" pra descrever movimentos. */
  function rotuloDia(iso: string): string {
    return `${DOWS[diaSemanaBR(iso)]} ${iso.slice(8)}`;
  }

  function puxarDaImportada(): void {
    if (!importadaRecente) return;
    const vindos = medicosDaImportada(importadaRecente);
    const roster = [...atualRef.current.medicos];
    for (const m of vindos) if (!roster.includes(m)) roster.push(m);
    // Pré-posiciona: cada um cai no mesmo dia-da-semana/posição do mês
    // que ocupava na escala de referência · o que ela já colocou fica.
    const atuais = atualRef.current.turnos;
    const sugeridos = turnosDeReferencia(importadaRecente, mesISO, atualRef.current.janelas, roster);
    const existentes = new Set(atuais.map((t) => `${t.data}|${t.janela}|${t.medico}`));
    const novos = sugeridos.filter((t) => !existentes.has(`${t.data}|${t.janela}|${t.medico}`));
    salvar(
      { medicos: roster, turnos: [...atuais, ...novos] },
      `puxou a escala de ${MESES[importadaRecente.mes - 1]}/${importadaRecente.ano}`,
    );
  }

  function abrirCalendario(): void {
    if (puxarAoAbrir && importadaRecente) puxarDaImportada();
    setEtapa('montar');
  }

  function alternarJanela(j: Janela): void {
    const atuais = atualRef.current.janelas;
    const ativa = atuais.some((x) => x.rotulo.toLowerCase() === j.rotulo.toLowerCase());
    const novas = ativa
      ? atuais.filter((x) => x.rotulo.toLowerCase() !== j.rotulo.toLowerCase())
      : [...atuais, j].sort((a, b) => a.inicio - b.inicio);
    if (novas.length === 0) return; // pelo menos uma coluna
    salvar({ janelas: novas }, `${ativa ? 'desligou' : 'ligou'} o turno ${j.rotulo}`);
  }

  function adicionarMedico(): void {
    const nome = novoMedico.trim();
    if (!nome || medicos.includes(nome)) return;
    salvar({ medicos: [...atualRef.current.medicos, nome] }, `adicionou ${nome}`);
    setNovoMedico('');
  }

  function removerMedico(nome: string): void {
    salvar(
      {
        medicos: atualRef.current.medicos.filter((m) => m !== nome),
        turnos: atualRef.current.turnos.filter((t) => t.medico !== nome),
      },
      `removeu ${nome}`,
    );
    if (medicoSel === nome) setMedicoSel(null);
  }

  function escalar(data: string, janela: string, medico: string): void {
    const atuais = atualRef.current.turnos;
    if (atuais.some((t) => t.data === data && t.janela === janela && t.medico === medico)) return;
    salvar(
      { turnos: [...atuais, { data, janela, medico }] },
      `escalou ${nomeCurto(medico)} · ${rotuloDia(data)} · ${janela}`,
    );
  }

  function desescalar(t: TurnoEquipe): void {
    salvar(
      {
        turnos: atualRef.current.turnos.filter(
          (x) => !(x.data === t.data && x.janela === t.janela && x.medico === t.medico),
        ),
      },
      `tirou ${nomeCurto(t.medico)} · ${rotuloDia(t.data)} · ${t.janela}`,
    );
  }

  /** Move um turno já escalado pra outro slot · uma ação só no histórico. */
  function mover(de: TurnoEquipe, data: string, janela: string): void {
    const atuais = atualRef.current.turnos;
    const jaTemNoDestino = atuais.some(
      (t) => t.data === data && t.janela === janela && t.medico === de.medico,
    );
    const semOrigem = atuais.filter(
      (t) => !(t.data === de.data && t.janela === de.janela && t.medico === de.medico),
    );
    salvar(
      { turnos: jaTemNoDestino ? semOrigem : [...semOrigem, { data, janela, medico: de.medico }] },
      `moveu ${nomeCurto(de.medico)} · ${rotuloDia(de.data)} ${de.janela} → ${rotuloDia(data)} ${janela}`,
    );
  }

  function anotarObs(data: string, texto: string): void {
    const proximas = { ...atualRef.current.obs };
    if (texto.trim()) proximas[data] = texto;
    else delete proximas[data];
    salvar({ obs: proximas }, `obs de ${rotuloDia(data)}`);
  }

  function onDragStart(ev: DragStartEvent): void {
    setArrastando(String(ev.active.id));
  }

  function onDragEnd(ev: DragEndEvent): void {
    setArrastando(null);
    const acao = resolverDrop(String(ev.active.id), ev.over?.id ? String(ev.over.id) : null);
    if (acao.tipo === 'escalar') escalar(acao.data, acao.janela, acao.medico);
    else if (acao.tipo === 'mover') mover(acao.de, acao.data, acao.janela);
  }

  function clicarSlot(data: string, janela: string): void {
    if (medicoSel) escalar(data, janela, medicoSel);
  }

  function dadosPDF(): DadosPDFEquipe {
    const h = hospitais[hospitalId];
    return {
      hospitalNome: h?.nome ?? hospitalId,
      hospitalAbrev: h?.abrev ?? hospitalId,
      mesISO,
      janelas,
      turnos,
      medicos,
      obs,
    };
  }

  async function exportar(chave: string, acao: () => Promise<void> | void): Promise<void> {
    setExportando(chave);
    try {
      await acao();
    } finally {
      setExportando(null);
    }
  }

  const abrev = hospitais[hospitalId]?.abrev ?? hospitalId;

  if (isMobile) {
    return (
      <PageHead
        eyebrow="escala da equipe"
        titulo="melhor no computador."
        hand="montar a escala do time inteiro pede tela grande · abre no desktop"
      />
    );
  }

  if (hospitaisLista.length === 0) {
    return (
      <PageHead
        eyebrow="escala da equipe"
        titulo="cadastra um hospital antes."
        hand="a escala da equipe nasce de um hospital seu"
      />
    );
  }

  // ---- etapa 1 · setup ---------------------------------------------------
  if (etapa === 'setup') {
    return (
      <>
        <PageHead
          eyebrow="escala da equipe · passo 1 de 4"
          titulo="qual mês vamos montar?"
          hand="escolhe aqui e a gente abre o calendário limpo do outro lado"
        />

        <div style={{ ...cartao, maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {hospitaisLista.length > 1 && (
            <label style={campo}>
              <Eyebrow>hospital</Eyebrow>
              <select
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                style={inputStyle}
              >
                {hospitaisLista.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.abrev} · {h.nome}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div style={campo}>
            <Eyebrow>mês</Eyebrow>
            <MonthPicker value={mesISO} onChange={setMesISO} />
          </div>

          {importadaRecente && (
            <label
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                cursor: 'pointer',
                padding: '12px 14px',
                borderRadius: 12,
                background: puxarAoAbrir ? 'var(--lavender-surface)' : 'var(--bg-alt)',
                border: `1px solid ${puxarAoAbrir ? 'var(--lavender)' : 'var(--line)'}`,
              }}
            >
              <input
                type="checkbox"
                checked={puxarAoAbrir}
                onChange={(e) => setPuxarAoAbrir(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--lavender-ink)' }}
              />
              <span>
                <span style={{ font: '600 13px/1.4 var(--font-body)', color: 'var(--ink)' }}>
                  puxar a escala de {MESES[importadaRecente.mes - 1]}/{importadaRecente.ano}
                </span>
                <Mono style={{ display: 'block', marginTop: 4, color: 'var(--ink-2)' }}>
                  traz a equipe e já posiciona cada um no mesmo dia da semana
                </Mono>
              </span>
            </label>
          )}

          <div style={campo}>
            <Eyebrow>turnos do hospital</Eyebrow>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              {conhecidas.map((j) => {
                const ativa = janelas.some((x) => x.rotulo.toLowerCase() === j.rotulo.toLowerCase());
                return (
                  <button
                    key={j.rotulo}
                    type="button"
                    onClick={() => alternarJanela(j)}
                    aria-pressed={ativa}
                    style={{
                      font: '600 12px/1 var(--font-body)',
                      padding: '9px 14px',
                      borderRadius: 999,
                      border: `1px solid ${ativa ? 'var(--ink)' : 'var(--line)'}`,
                      background: ativa ? 'var(--ink)' : 'var(--bg)',
                      color: ativa ? 'var(--bg)' : 'var(--ink-3)',
                      cursor: 'pointer',
                      textDecoration: ativa ? 'none' : 'line-through',
                    }}
                  >
                    {j.rotulo} · {fmtRange(j.inicio, j.duracao)}
                  </button>
                );
              })}
            </div>
            <Mono style={{ color: 'var(--ink-3)', marginTop: 8 }}>
              os desligados não aparecem no calendário
            </Mono>
          </div>

          <button type="button" onClick={abrirCalendario} style={{ ...botaoPrimario, marginTop: 4 }}>
            abrir o calendário ›
          </button>
        </div>

        {escalasEquipe.length > 0 && (
          <div style={{ marginTop: 22, maxWidth: 620 }}>
            <Eyebrow>ou continua uma que você já começou</Eyebrow>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {escalasEquipe.map((e) => (
                <button
                  key={`${e.hospitalId}-${e.mesISO}`}
                  type="button"
                  onClick={() => {
                    setHospitalId(e.hospitalId);
                    setMesISO(e.mesISO);
                    setPuxarAoAbrir(false);
                    setEtapa('montar');
                  }}
                  style={{ ...botaoSecundario, padding: '10px 14px' }}
                >
                  {hospitais[e.hospitalId]?.abrev ?? e.hospitalId} · {mesLabel(e.mesISO)} ·{' '}
                  {e.turnos.length} turnos
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  // ---- etapa 3 · revisar (o mês inteiro numa tabela) ---------------------
  if (etapa === 'revisar') {
    const comTurno = medicos.filter((m) => turnos.some((t) => t.medico === m));
    return (
      <>
        <PageHead
          eyebrow="escala da equipe · passo 3 de 4"
          titulo="o mês inteiro, de uma olhada."
          hand={`${abrev} · ${mesLabel(mesISO)} · confere e segue pro envio`}
        />
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <button type="button" onClick={() => setEtapa('montar')} style={botaoSecundario}>
            ‹ voltar pro calendário
          </button>
          <Eyebrow>
            {turnos.length} turnos · {comTurno.length} médicos escalados
          </Eyebrow>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setEtapa('exportar')} style={botaoPrimario}>
            exportar ›
          </button>
        </div>

        <TabelaRevisao
          mesISO={mesISO}
          janelas={janelas}
          turnosPorSlot={turnosPorSlot}
          obs={obs}
        />
      </>
    );
  }

  // ---- etapa 4 · exportar ------------------------------------------------
  if (etapa === 'exportar') {
    const comTurno = medicos.filter((m) => turnos.some((t) => t.medico === m));
    return (
      <>
        <PageHead
          eyebrow="escala da equipe · passo 4 de 4"
          titulo="agora manda."
          hand={`${abrev} · ${mesLabel(mesISO)} · o .ics entra no google calendar · o excel abre no sheets`}
        />
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <button type="button" onClick={() => setEtapa('revisar')} style={botaoSecundario}>
            ‹ voltar pra ver o mês
          </button>
        </div>

        <div style={{ ...cartao, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17 }}>
              escala completa
            </span>
            <Mono style={{ color: 'var(--ink-3)' }}>{mesPorExtenso(mesISO)}</Mono>
            <span style={{ flex: 1 }} />
            <BotaoExport
              rotulo="txt"
              chave="geral-txt"
              ocupado={exportando}
              onClick={() =>
                exportar('geral-txt', () =>
                  baixarArquivoTexto(nomeArq(abrev, mesISO, 'txt'), textoEquipeGeral(dadosPDF())),
                )
              }
            />
            <BotaoExport
              rotulo="pdf"
              chave="geral-pdf"
              ocupado={exportando}
              onClick={() => exportar('geral-pdf', () => baixarPDFEquipeCompleto(dadosPDF()))}
            />
            <BotaoExport
              rotulo="agenda (.ics)"
              chave="geral-ics"
              ocupado={exportando}
              onClick={() =>
                exportar('geral-ics', () =>
                  baixarArquivoTexto(nomeArq(abrev, mesISO, 'ics'), icsEquipe(dadosPDF())),
                )
              }
            />
            <BotaoExport
              rotulo="excel"
              chave="geral-xlsx"
              ocupado={exportando}
              onClick={() => exportar('geral-xlsx', () => baixarXLSXEquipe(dadosPDF()))}
            />
          </div>
        </div>

        <div style={cartao}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17 }}>
            um pra cada médico
          </span>
          {comTurno.length === 0 && (
            <Mono style={{ display: 'block', marginTop: 8, color: 'var(--ink-3)' }}>
              ninguém escalado ainda
            </Mono>
          )}
          <div
            style={{
              maxHeight: 'clamp(220px, calc(100vh - 430px), 560px)',
              overflowY: 'auto',
              marginTop: 6,
            }}
          >
            {comTurno.map((m) => {
              const r = resumos.find((x) => x.medico === m);
              const cor = corDoMedico(m, medicos);
              return (
                <div
                  key={m}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 0',
                    borderBottom: '1px dashed var(--line-2)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${cor})` }}
                  />
                  <span style={{ font: '600 13px/1.2 var(--font-body)' }}>{m}</span>
                  <Mono style={{ color: 'var(--ink-3)' }}>
                    {r?.plantoes ?? 0} plantões · {r?.total ?? 0}h
                  </Mono>
                  <span style={{ flex: 1 }} />
                  <BotaoExport
                    rotulo="txt"
                    chave={`txt-${m}`}
                    ocupado={exportando}
                    onClick={() =>
                      exportar(`txt-${m}`, () =>
                        baixarArquivoTexto(
                          nomeArq(abrev, mesISO, 'txt', m),
                          textoEquipeMedico(dadosPDF(), m),
                        ),
                      )
                    }
                  />
                  <BotaoExport
                    rotulo="pdf"
                    chave={`pdf-${m}`}
                    ocupado={exportando}
                    onClick={() => exportar(`pdf-${m}`, () => baixarPDFEquipeMedico(dadosPDF(), m))}
                  />
                  <BotaoExport
                    rotulo="agenda"
                    chave={`ics-${m}`}
                    ocupado={exportando}
                    onClick={() =>
                      exportar(`ics-${m}`, () =>
                        baixarArquivoTexto(nomeArq(abrev, mesISO, 'ics', m), icsEquipe(dadosPDF(), m)),
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ---- etapa 2 · montar --------------------------------------------------
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={colisaoPorCursor}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setArrastando(null)}
    >
      {/* barra do setup, compacta · clica pra voltar e ajustar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setEtapa('setup')}
          title="mudar hospital, mês ou turnos"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 14px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'var(--bg-alt)',
            cursor: 'pointer',
            font: '600 13px/1 var(--font-body)',
            color: 'var(--ink)',
          }}
        >
          {abrev} · {mesLabel(mesISO)}
          <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>
            {janelas.map((j) => j.rotulo).join(' · ')}
          </span>
          <span style={{ color: 'var(--ink-3)', font: '500 11px/1 var(--font-body)' }}>ajustar</span>
        </button>

        <span style={{ flex: 1 }} />

        <button
          type="button"
          onClick={desfazer}
          disabled={passado.length === 0}
          aria-label="desfazer"
          title={
            passado.length > 0
              ? `desfazer · ${passado[passado.length - 1]!.desc} (ctrl+z)`
              : 'nada pra desfazer'
          }
          style={{ ...botaoIcone, opacity: passado.length === 0 ? 0.35 : 1 }}
        >
          <IconeGirar />
        </button>
        <button
          type="button"
          onClick={refazer}
          disabled={futuro.length === 0}
          aria-label="refazer"
          title={
            futuro.length > 0
              ? `refazer · ${futuro[futuro.length - 1]!.desc} (ctrl+shift+z)`
              : 'nada pra refazer'
          }
          style={{ ...botaoIcone, opacity: futuro.length === 0 ? 0.35 : 1 }}
        >
          <IconeGirar espelhado />
        </button>

        <button
          type="button"
          onClick={() => setEtapa('revisar')}
          disabled={turnos.length === 0}
          style={{ ...botaoPrimario, opacity: turnos.length === 0 ? 0.5 : 1 }}
        >
          salvar e visualizar o mês ›
        </button>
      </div>

      {/* equipe · compacta, expande quando precisa */}
      <div
        style={{
          background: 'var(--bg-alt)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '8px 12px',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setRosterAberto((o) => !o)}
            aria-expanded={rosterAberto}
            aria-label={rosterAberto ? 'diminuir a equipe' : 'expandir a equipe'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '2px 0',
              font: '700 10px/1 var(--font-body)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                transition: 'transform 160ms ease',
                transform: rosterAberto ? 'rotate(90deg)' : 'none',
                fontSize: 11,
              }}
            >
              ▶
            </span>
            equipe · {medicos.length}
          </button>

          {/* seleção atual sempre visível, mesmo colapsado */}
          {medicoSel ? (
            <Hand color="var(--lavender-ink)" size={14}>
              escalando {nomeCurto(medicoSel)} · clica nos turnos
            </Hand>
          ) : (
            <Mono style={{ color: 'var(--ink-3)' }}>
              arrasta o nome pro turno · ou clica no nome e vai clicando
            </Mono>
          )}
          <span style={{ flex: 1 }} />
          {ultimaAcao && (
            <Mono style={{ color: 'var(--ink-3)', textAlign: 'right' }}>{ultimaAcao}</Mono>
          )}
          {/* fica aqui (e não junto dos chips) pra continuar alcançável
              quando a lista está colapsada */}
          <input
            value={novoMedico}
            onChange={(e) => setNovoMedico(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') adicionarMedico();
            }}
            placeholder="+ nome · enter"
            style={{ ...inputStyle, width: 150, padding: '6px 10px', flexShrink: 0 }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 7,
            alignItems: 'flex-start',
            alignContent: 'flex-start',
            flexWrap: 'wrap',
            marginTop: 8,
            maxHeight: rosterAberto ? 132 : 34,
            overflowY: rosterAberto ? 'auto' : 'hidden',
            transition: 'max-height 180ms ease',
          }}
        >
          {medicos.map((m) => (
            <ChipMedico
              key={m}
              nome={m}
              cor={corDoMedico(m, medicos)}
              selecionado={medicoSel === m}
              onSelecionar={() => setMedicoSel(medicoSel === m ? null : m)}
              onRemover={() => removerMedico(m)}
            />
          ))}
          {medicos.length === 0 && (
            <Mono style={{ color: 'var(--ink-3)' }}>
              digita os nomes ali do lado · ou volta e puxa a escala anterior
            </Mono>
          )}
        </div>
      </div>

      {/* calendário + status · cada um com scroll próprio */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 290px',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            height: ALTURA_PAINEL,
          }}
        >
          <div ref={scrollCalRef} style={{ overflowY: 'auto', overflowX: 'hidden' }}>
            {/* cabeçalho das colunas · gruda no topo DESTE scroll */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridDia(janelas.length),
                position: 'sticky',
                top: 0,
                zIndex: 6,
                background: 'var(--bg-alt)',
                borderBottom: '1px solid var(--line-2)',
              }}
            >
              <div style={cabecalhoColuna}>dia</div>
              {janelas.map((j) => (
                <div key={j.rotulo} style={{ ...cabecalhoColuna, ...divisoriaColuna }}>
                  {j.rotulo}
                  <span style={{ color: 'var(--line-2)', margin: '0 4px' }}>·</span>
                  {fmtRange(j.inicio, j.duracao)}
                </div>
              ))}
              <div style={{ ...cabecalhoColuna, ...divisoriaColuna }}>obs</div>
            </div>

            {diasDoMesLista(mesISO).map((iso, i) => (
              <DiaLinha
                key={iso}
                iso={iso}
                primeiraLinha={i === 0}
                janelas={janelas}
                turnosPorSlot={turnosPorSlot}
                medicos={medicos}
                conflitos={conflitos}
                temSelecao={!!medicoSel}
                obs={obs[iso] ?? ''}
                onObs={(txt) => anotarObs(iso, txt)}
                onClicarSlot={clicarSlot}
                onRemoverTurno={desescalar}
              />
            ))}
          </div>
        </div>

        <StatusEquipe
          resumos={resumos}
          medicos={medicos}
          semanas={semanas.length}
          conflitos={conflitos.size}
          mesISO={mesISO}
        />
      </div>

      {/* O chip que segue o cursor mora aqui (portal do dnd-kit): fora de
          qualquer stacking/overflow do cabeçalho e das linhas. */}
      <DragOverlay dropAnimation={null}>
        {arrastando && (
          <ChipFlutuante
            nome={nomeArrastado(arrastando)}
            cor={corDoMedico(nomeArrastado(arrastando), medicos)}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Nome do médico embutido no id arrastado (roster ou turno escalado). */
function nomeArrastado(id: string): string {
  if (id.startsWith('med|')) return id.slice('med|'.length);
  if (id.startsWith('turno|')) return id.split('|').slice(3).join('|');
  return id;
}

/**
 * arrow-rotate-left do Font Awesome Free 7 (CC BY 4.0 · fontawesome.com).
 * `espelhado` vira a seta pra virar o "refazer".
 */
function IconeGirar({ espelhado }: { espelhado?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 640 640"
      fill="currentColor"
      aria-hidden
      style={espelhado ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M320 128C263.2 128 212.1 152.7 176.9 192L224 192C241.7 192 256 206.3 256 224C256 241.7 241.7 256 224 256L96 256C78.3 256 64 241.7 64 224L64 96C64 78.3 78.3 64 96 64C113.7 64 128 78.3 128 96L128 150.7C174.9 97.6 243.5 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C233 576 156.1 532.6 109.9 466.3C99.8 451.8 103.3 431.9 117.8 421.7C132.3 411.5 152.2 415.1 162.4 429.6C197.2 479.4 254.8 511.9 320 511.9C426 511.9 512 425.9 512 319.9C512 213.9 426 128 320 128z" />
    </svg>
  );
}

function ChipFlutuante({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        font: '600 13px/1 var(--font-body)',
        padding: '9px 14px',
        borderRadius: 999,
        background: `var(--${cor}-surface)`,
        border: `1.5px solid var(--${cor})`,
        color: `var(--${cor}-ink)`,
        boxShadow: '0 8px 20px rgba(58,46,42,0.18)',
        cursor: 'grabbing',
        transform: 'rotate(-1.5deg)',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${cor})` }} />
      {nome}
    </span>
  );
}

/** Colunas de uma linha-dia: data | janelas | obs. */
function gridDia(nJanelas: number): string {
  return `88px repeat(${nJanelas}, minmax(0, 1fr)) 168px`;
}

function diasDoMesLista(mesISO: string): string[] {
  const fim = fromISO(`${mesISO}-01`);
  fim.setMonth(fim.getMonth() + 1, 0);
  const out: string[] = [];
  for (let d = 1; d <= fim.getDate(); d++) out.push(`${mesISO}-${String(d).padStart(2, '0')}`);
  return out;
}

function BotaoExport({
  rotulo,
  chave,
  ocupado,
  onClick,
}: {
  rotulo: string;
  chave: string;
  ocupado: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado !== null}
      style={{
        ...botaoSecundario,
        padding: '8px 14px',
        opacity: ocupado && ocupado !== chave ? 0.5 : 1,
      }}
    >
      {ocupado === chave ? 'gerando…' : rotulo}
    </button>
  );
}

/** Tabela dia × janela · exatamente o que sai nos exports · scroll próprio. */
function TabelaRevisao({
  mesISO,
  janelas,
  turnosPorSlot,
  obs,
}: {
  mesISO: string;
  janelas: Janela[];
  turnosPorSlot: Map<string, TurnoEquipe[]>;
  obs: Record<string, string>;
}) {
  const dias = diasDoMesLista(mesISO);
  const temObs = Object.keys(obs).some((d) => d.startsWith(mesISO) && obs[d]?.trim());
  // O React reaproveita o nó DOM da etapa anterior (mesma posição, mesmo
  // tipo), e com ele vem o scrollTop do calendário — a tabela abria no
  // meio do mês. Começa sempre no dia 1.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [mesISO]);
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        height: ALTURA_PAINEL,
        display: 'flex',
      }}
    >
      <div ref={scrollRef} style={{ overflowY: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', font: '500 12.5px/1.5 var(--font-body)' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, position: 'sticky', top: 0, background: 'var(--bg-alt)' }}>dia</th>
              {janelas.map((j) => (
                <th
                  key={j.rotulo}
                  style={{ ...thStyle, ...divisoriaColuna, position: 'sticky', top: 0, background: 'var(--bg-alt)' }}
                >
                  {j.rotulo} · {fmtHorarioJanela(j)}
                </th>
              ))}
              {temObs && (
                <th style={{ ...thStyle, ...divisoriaColuna, position: 'sticky', top: 0, background: 'var(--bg-alt)' }}>
                  obs
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {dias.map((iso) => {
              const fds = diaSemanaBR(iso) >= 5;
              return (
                <tr key={iso} style={{ background: fds ? 'var(--bg-alt)' : 'transparent' }}>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--ink-2)', fontWeight: 600 }}>
                    {rotuloDiaCurto(iso)}
                  </td>
                  {janelas.map((j) => (
                    <td key={j.rotulo} style={{ ...tdStyle, ...divisoriaColuna }}>
                      {(turnosPorSlot.get(`${iso}|${j.rotulo}`) ?? []).map((t) => t.medico).join(' · ')}
                    </td>
                  ))}
                  {temObs && (
                    <td style={{ ...tdStyle, ...divisoriaColuna, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                      {obs[iso] ?? ''}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChipMedico({
  nome,
  cor,
  selecionado,
  onSelecionar,
  onRemover,
}: {
  nome: string;
  cor: string;
  selecionado: boolean;
  onSelecionar: () => void;
  onRemover: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idChipRoster(nome) });
  return (
    <span
      ref={setNodeRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 999,
        border: `1.5px solid ${selecionado ? `var(--${cor}-ink)` : 'var(--line)'}`,
        background: selecionado ? `var(--${cor}-surface)` : 'var(--bg)',
        padding: '5px 8px 5px 10px',
        // o chip que segue o cursor é o DragOverlay · aqui só apagamos o
        // original pra ficar claro de onde ele saiu
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
    >
      <button
        type="button"
        onClick={onSelecionar}
        {...listeners}
        {...attributes}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: 'none',
          background: 'transparent',
          font: '600 12.5px/1 var(--font-body)',
          color: 'var(--ink)',
          cursor: 'grab',
          padding: 0,
        }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: `var(--${cor})` }} />
        {nome}
      </button>
      <button
        type="button"
        onClick={onRemover}
        aria-label={`remover ${nome}`}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          font: '600 12px/1 var(--font-body)',
          padding: 0,
        }}
      >
        ×
      </button>
    </span>
  );
}

function DiaLinha({
  iso,
  primeiraLinha,
  janelas,
  turnosPorSlot,
  medicos,
  conflitos,
  temSelecao,
  obs,
  onObs,
  onClicarSlot,
  onRemoverTurno,
}: {
  iso: string;
  primeiraLinha: boolean;
  janelas: Janela[];
  turnosPorSlot: Map<string, TurnoEquipe[]>;
  medicos: string[];
  conflitos: Set<string>;
  temSelecao: boolean;
  obs: string;
  onObs: (texto: string) => void;
  onClicarSlot: (data: string, janela: string) => void;
  onRemoverTurno: (t: TurnoEquipe) => void;
}) {
  const dow = diaSemanaBR(iso);
  const fds = dow >= 5;
  const isHoje = iso === HOJE;
  const inicioDeSemana = dow === 0 && !primeiraLinha;
  // obs digita local e salva no blur · salvar a cada tecla re-renderiza a
  // grade inteira no meio da digitação
  const [obsLocal, setObsLocal] = useState(obs);
  const [editandoObs, setEditandoObs] = useState(false);
  const obsExibida = editandoObs ? obsLocal : obs;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridDia(janelas.length),
        minHeight: 58,
        background: fds ? 'var(--bg-alt)' : 'transparent',
        // segunda-feira abre a semana com um traço mais firme · respiro visual
        borderTop: primeiraLinha
          ? 'none'
          : inicioDeSemana
            ? '2px solid var(--line-2)'
            : '1px solid var(--line)',
      }}
    >
      <div
        style={{
          padding: '10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          borderLeft: isHoje ? '3px solid var(--lavender)' : '3px solid transparent',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 15,
            letterSpacing: '-0.01em',
            color: isHoje ? 'var(--lavender-ink)' : fds ? 'var(--ink)' : 'var(--ink-2)',
          }}
        >
          {DOWS[dow]} {fromISO(iso).getDate()}
        </span>
        {isHoje && (
          <Hand color="var(--lavender-ink)" size={11}>
            hoje
          </Hand>
        )}
      </div>
      {janelas.map((j) => (
        <SlotJanela
          key={j.rotulo}
          iso={iso}
          janela={j}
          turnos={turnosPorSlot.get(`${iso}|${j.rotulo}`) ?? []}
          medicos={medicos}
          conflitos={conflitos}
          temSelecao={temSelecao}
          onClicar={() => onClicarSlot(iso, j.rotulo)}
          onRemoverTurno={onRemoverTurno}
        />
      ))}
      <div style={{ ...divisoriaColuna, display: 'flex', alignItems: 'flex-start' }}>
        <input
          value={obsExibida}
          onFocus={() => {
            setObsLocal(obs);
            setEditandoObs(true);
          }}
          onChange={(e) => setObsLocal(e.target.value)}
          onBlur={() => {
            setEditandoObs(false);
            if (obsLocal !== obs) onObs(obsLocal);
          }}
          placeholder="* obs"
          aria-label={`observação de ${iso}`}
          style={{
            margin: '8px 10px',
            padding: '5px 8px',
            border: '1px dashed transparent',
            borderRadius: 8,
            background: 'transparent',
            font: '400 12px/1.4 var(--font-body)',
            fontStyle: 'italic',
            color: 'var(--ink-2)',
            outline: 'none',
            width: 'calc(100% - 20px)',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'var(--line-2)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLInputElement).style.borderColor = 'transparent';
          }}
        />
      </div>
    </div>
  );
}

function SlotJanela({
  iso,
  janela,
  turnos,
  medicos,
  conflitos,
  temSelecao,
  onClicar,
  onRemoverTurno,
}: {
  iso: string;
  janela: Janela;
  turnos: TurnoEquipe[];
  medicos: string[];
  conflitos: Set<string>;
  temSelecao: boolean;
  onClicar: () => void;
  onRemoverTurno: (t: TurnoEquipe) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: idSlot(iso, janela.rotulo) });
  const vazio = turnos.length === 0;
  return (
    <div style={divisoriaColuna}>
      <div
        ref={setNodeRef}
        onClick={onClicar}
        role="button"
        aria-label={`turno ${janela.rotulo} de ${iso}`}
        title={`${janela.rotulo} · ${fmtRange(janela.inicio, janela.duracao)}`}
        style={{
          margin: 6,
          padding: 4,
          minHeight: 44,
          borderRadius: 10,
          border: `1.5px dashed ${
            isOver ? 'var(--lavender-ink)' : vazio ? 'var(--line-2)' : 'transparent'
          }`,
          background: isOver ? 'var(--lavender-surface)' : 'transparent',
          cursor: temSelecao ? 'copy' : 'default',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          justifyContent: vazio ? 'center' : 'flex-start',
        }}
      >
        {vazio && (
          <span
            aria-hidden
            style={{
              font: '600 11px/1 var(--font-body)',
              color: 'var(--line-2)',
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            {janela.rotulo}
          </span>
        )}
        {turnos.map((t) => (
          <ChipEscalado
            key={t.medico}
            turno={t}
            cor={corDoMedico(t.medico, medicos)}
            emConflito={conflitos.has(`${t.medico}|${t.data}|${t.janela}`)}
            onRemover={() => onRemoverTurno(t)}
          />
        ))}
      </div>
    </div>
  );
}

/** Médico já escalado num turno · arrasta pra mover, clica pra tirar. */
function ChipEscalado({
  turno,
  cor,
  emConflito,
  onRemover,
}: {
  turno: TurnoEquipe;
  cor: string;
  emConflito: boolean;
  onRemover: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idChipEscalado(turno),
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onRemover();
      }}
      title={`${turno.medico} · arrasta pra mover de turno · clica pra tirar`}
      style={{
        textAlign: 'left',
        font: '600 12.5px/1.3 var(--font-body)',
        padding: '6px 10px',
        borderRadius: 8,
        background: `var(--${cor}-surface)`,
        border: emConflito ? '1.5px solid var(--err-ink)' : 'none',
        borderLeft: `3px solid var(--${cor})`,
        color: `var(--${cor}-ink)`,
        cursor: 'grab',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        touchAction: 'none',
        opacity: isDragging ? 0.35 : 1,
        animation: 'colo-fab-in 220ms cubic-bezier(.2,.7,.2,1)',
      }}
    >
      {turno.medico}
    </button>
  );
}

function StatusEquipe({
  resumos,
  medicos,
  semanas,
  conflitos,
  mesISO,
}: {
  resumos: ReturnType<typeof resumoPorMedico>;
  medicos: string[];
  semanas: number;
  conflitos: number;
  mesISO: string;
}) {
  const totais = resumos.map((r) => r.total).filter((t) => t > 0);
  const media = totais.length > 0 ? totais.reduce((a, b) => a + b, 0) / totais.length : 0;
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm)',
        height: ALTURA_PAINEL,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15 }}>
          quem tá com quanto
        </span>
        <Eyebrow>{mesLabel(mesISO)}</Eyebrow>
      </div>

      <div style={{ overflowY: 'auto', padding: '0 16px 14px' }}>
        {conflitos > 0 && (
          <Pill kind="err" style={{ margin: '12px 0 4px' }}>
            {Math.max(1, Math.round(conflitos / 2))} choque
            {conflitos > 2 ? 's' : ''} de horário
          </Pill>
        )}
        {resumos.length === 0 && (
          <Mono style={{ color: 'var(--ink-3)', display: 'block', marginTop: 12 }}>
            adiciona a equipe ali em cima
          </Mono>
        )}
        {resumos.map((r) => {
          const cor = corDoMedico(r.medico, medicos);
          const desvio = media > 0 && r.total > 0 ? r.total - media : 0;
          return (
            <div key={r.medico} style={{ padding: '9px 0', borderBottom: '1px dashed var(--line-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden
                  style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${cor})`, flexShrink: 0 }}
                />
                <span
                  style={{
                    font: '600 12.5px/1.2 var(--font-body)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.medico}
                </span>
                <Mono style={{ marginLeft: 'auto', color: 'var(--ink)', flexShrink: 0 }}>{r.total}h</Mono>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                <Mono style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                  {r.porSemana.join(' · ')} /sem
                </Mono>
                <Mono style={{ color: 'var(--ink-3)', fontSize: 10, marginLeft: 'auto' }}>
                  fds {r.fds}h
                </Mono>
                {Math.abs(desvio) >= 12 && (
                  <Mono
                    style={{ fontSize: 10, color: desvio > 0 ? 'var(--coral-ink)' : 'var(--sage-ink)' }}
                  >
                    {desvio > 0 ? '+' : ''}
                    {Math.round(desvio)}h
                  </Mono>
                )}
              </div>
            </div>
          );
        })}
        {resumos.length > 0 && (
          <Mono style={{ display: 'block', marginTop: 10, color: 'var(--ink-3)', fontSize: 10 }}>
            {semanas} semanas · média {Math.round(media)}h por médico escalado
          </Mono>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 13px/1.3 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
};

const campo: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
};

const cartao: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: '20px 22px',
  boxShadow: 'var(--shadow-sm)',
};

const botaoPrimario: React.CSSProperties = {
  font: '600 13px/1 var(--font-body)',
  padding: '12px 22px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--ink)',
  color: 'var(--bg)',
  cursor: 'pointer',
};

const botaoSecundario: React.CSSProperties = {
  font: '600 12px/1 var(--font-body)',
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg-alt)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};

const botaoIcone: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

/** Linha vertical entre colunas de turno · sem isso as colunas somem. */
const divisoriaColuna: React.CSSProperties = {
  borderLeft: '1px solid var(--line)',
};

const cabecalhoColuna: React.CSSProperties = {
  padding: '10px 12px',
  font: '700 10px/1 var(--font-body)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  font: '700 10px/1 var(--font-body)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  borderBottom: '1px solid var(--line)',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 12px',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'top',
};
