import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  JANELAS_DEFAULT,
  medicosDaImportada,
  resumoPorMedico,
  semanasDoMes,
  turnosDeReferencia,
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

/** Primeiro nome + inicial do segundo quando há ambiguidade de espaço. */
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

/**
 * EscalaEquipe · página (temporária) onde a chefe monta a escala do TIME
 * inteiro de um hospital: arrasta (ou seleciona e clica) médicos pros
 * turnos do mês, acompanha horas por semana/fds/total ao vivo, anota as
 * observações do dia (os "asteriscos"), revisa a tabela completa e
 * exporta txt/pdf/agenda/excel — geral e por médico. Feita pra desktop.
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
  const [etapa, setEtapa] = useState<'montar' | 'revisar'>('montar');
  const [medicoSel, setMedicoSel] = useState<string | null>(null);
  const [novoMedico, setNovoMedico] = useState('');
  const [exportando, setExportando] = useState<string | null>(null);

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
  // Janelas ATIVAS (colunas da grade) · sem rascunho salvo, tudo menos
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
    onSalvar({
      hospitalId,
      mesISO,
      ...snap,
      atualizadaEm: new Date().toISOString(),
    });
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

  /** "seg 08" pra descrever movimentos. */
  function rotuloDia(iso: string): string {
    return `${DOWS[diaSemanaBR(iso)]} ${iso.slice(8)}`;
  }

  function puxarDaImportada(): void {
    if (!importadaRecente) return;
    const vindos = medicosDaImportada(importadaRecente);
    const roster = [...medicos];
    for (const m of vindos) if (!roster.includes(m)) roster.push(m);
    // Pré-posiciona: cada um cai no mesmo dia-da-semana/posição do mês
    // que ocupava na escala de referência · o que ela já colocou fica.
    const sugeridos = turnosDeReferencia(importadaRecente, mesISO, janelas, roster);
    const existentes = new Set(turnos.map((t) => `${t.data}|${t.janela}|${t.medico}`));
    const novos = sugeridos.filter((t) => !existentes.has(`${t.data}|${t.janela}|${t.medico}`));
    salvar(
      { medicos: roster, turnos: [...turnos, ...novos] },
      `puxou a escala de ${MESES[importadaRecente.mes - 1]}/${importadaRecente.ano}`,
    );
  }

  function alternarJanela(j: Janela): void {
    const ativa = janelas.some((x) => x.rotulo.toLowerCase() === j.rotulo.toLowerCase());
    const novas = ativa
      ? janelas.filter((x) => x.rotulo.toLowerCase() !== j.rotulo.toLowerCase())
      : [...janelas, j].sort((a, b) => a.inicio - b.inicio);
    if (novas.length === 0) return; // pelo menos uma coluna
    salvar({ janelas: novas }, `${ativa ? 'desligou' : 'ligou'} o turno ${j.rotulo}`);
  }

  function adicionarMedico(): void {
    const nome = novoMedico.trim();
    if (!nome || medicos.includes(nome)) return;
    salvar({ medicos: [...medicos, nome] }, `adicionou ${nome}`);
    setNovoMedico('');
  }

  function removerMedico(nome: string): void {
    salvar(
      {
        medicos: medicos.filter((m) => m !== nome),
        turnos: turnos.filter((t) => t.medico !== nome),
      },
      `removeu ${nome}`,
    );
    if (medicoSel === nome) setMedicoSel(null);
  }

  function escalar(data: string, janela: string, medico: string): void {
    const atuais = atualRef.current.turnos;
    const jaTem = atuais.some(
      (t) => t.data === data && t.janela === janela && t.medico === medico,
    );
    if (jaTem) return;
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

  function anotarObs(data: string, texto: string): void {
    const proximas = { ...atualRef.current.obs };
    if (texto.trim()) proximas[data] = texto;
    else delete proximas[data];
    salvar({ obs: proximas }, `obs de ${rotuloDia(data)}`);
  }

  function onDragEnd(ev: DragEndEvent): void {
    const medico = String(ev.active.id).replace(/^med\|/, '');
    const over = ev.over?.id ? String(ev.over.id) : null;
    if (!over || !over.startsWith('slot|')) return;
    const [, data, janela] = over.split('|');
    if (data && janela) escalar(data, janela, medico);
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

  // ---- etapa revisar/exportar -------------------------------------------
  if (etapa === 'revisar') {
    const comTurno = medicos.filter((m) => turnos.some((t) => t.medico === m));
    return (
      <>
        <PageHead
          eyebrow="escala da equipe"
          titulo="confere e manda."
          hand={`${abrev} · ${mesLabel(mesISO)} · a tabela abaixo é exatamente o que sai nos exports`}
        />
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
          <button type="button" onClick={() => setEtapa('montar')} style={botaoSecundario}>
            ‹ voltar pra editar
          </button>
          <span style={{ flex: 1 }} />
          <Eyebrow>{turnos.length} turnos · {comTurno.length} médicos escalados</Eyebrow>
        </div>

        <TabelaRevisao mesISO={mesISO} janelas={janelas} turnosPorSlot={turnosPorSlot} obs={obs} />

        {/* escala completa */}
        <div style={cardExport}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16 }}>
              escala completa
            </span>
            <Mono style={{ color: 'var(--ink-3)' }}>{mesPorExtenso(mesISO)}</Mono>
            <span style={{ flex: 1 }} />
            <BotaoExport
              rotulo="txt"
              ocupado={exportando}
              chave="geral-txt"
              onClick={() =>
                exportar('geral-txt', () =>
                  baixarArquivoTexto(nomeArq(abrev, mesISO, 'txt'), textoEquipeGeral(dadosPDF())),
                )
              }
            />
            <BotaoExport
              rotulo="pdf"
              ocupado={exportando}
              chave="geral-pdf"
              onClick={() => exportar('geral-pdf', () => baixarPDFEquipeCompleto(dadosPDF()))}
            />
            <BotaoExport
              rotulo="agenda (.ics)"
              ocupado={exportando}
              chave="geral-ics"
              onClick={() =>
                exportar('geral-ics', () =>
                  baixarArquivoTexto(nomeArq(abrev, mesISO, 'ics'), icsEquipe(dadosPDF())),
                )
              }
            />
            <BotaoExport
              rotulo="excel"
              ocupado={exportando}
              chave="geral-xlsx"
              onClick={() => exportar('geral-xlsx', () => baixarXLSXEquipe(dadosPDF()))}
            />
          </div>
          <Mono style={{ display: 'block', marginTop: 8, color: 'var(--ink-3)' }}>
            o .ics importa direto no google calendar · o excel abre no sheets
          </Mono>
        </div>

        {/* por médico */}
        <div style={cardExport}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16 }}>
            um pra cada médico
          </span>
          {comTurno.length === 0 && (
            <Mono style={{ display: 'block', marginTop: 8, color: 'var(--ink-3)' }}>
              ninguém escalado ainda
            </Mono>
          )}
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
                  padding: '10px 0',
                  borderBottom: '1px dashed var(--line-2)',
                }}
              >
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${cor})` }} />
                <span style={{ font: '600 13px/1.2 var(--font-body)' }}>{m}</span>
                <Mono style={{ color: 'var(--ink-3)' }}>
                  {r?.plantoes ?? 0} plantões · {r?.total ?? 0}h
                </Mono>
                <span style={{ flex: 1 }} />
                <BotaoExport
                  rotulo="txt"
                  ocupado={exportando}
                  chave={`txt-${m}`}
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
                  ocupado={exportando}
                  chave={`pdf-${m}`}
                  onClick={() => exportar(`pdf-${m}`, () => baixarPDFEquipeMedico(dadosPDF(), m))}
                />
                <BotaoExport
                  rotulo="agenda"
                  ocupado={exportando}
                  chave={`ics-${m}`}
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
      </>
    );
  }

  // ---- etapa montar ------------------------------------------------------
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <PageHead
        eyebrow="escala da equipe"
        titulo="o mês do time inteiro."
        hand="arrasta o nome pro turno · ou clica no nome e vai clicando nos turnos"
      />

      {/* setup: hospital + mês + puxar + revisar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {hospitaisLista.length > 1 && (
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 160 }}
          >
            {hospitaisLista.map((h) => (
              <option key={h.id} value={h.id}>
                {h.abrev} · {h.nome}
              </option>
            ))}
          </select>
        )}
        <MonthPicker value={mesISO} onChange={setMesISO} />
        {importadaRecente && (
          <button type="button" onClick={puxarDaImportada} style={botaoSecundario}>
            puxar a escala de {MESES[importadaRecente.mes - 1]}/{importadaRecente.ano} (nomes + posições)
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setEtapa('revisar')}
          disabled={turnos.length === 0}
          style={{ ...botaoPrimario, opacity: turnos.length === 0 ? 0.5 : 1 }}
        >
          salvar e exportar ›
        </button>
      </div>

      {/* escalas já salvas */}
      {escalasEquipe.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <Eyebrow>salvas</Eyebrow>
          {escalasEquipe.map((e) => {
            const ativa = e.hospitalId === hospitalId && e.mesISO === mesISO;
            return (
              <button
                key={`${e.hospitalId}-${e.mesISO}`}
                type="button"
                onClick={() => {
                  setHospitalId(e.hospitalId);
                  setMesISO(e.mesISO);
                }}
                style={{
                  ...botaoSecundario,
                  padding: '8px 12px',
                  background: ativa ? 'var(--lavender-surface)' : 'var(--bg-alt)',
                  border: `1px solid ${ativa ? 'var(--lavender)' : 'var(--line)'}`,
                  color: ativa ? 'var(--lavender-ink)' : 'var(--ink-2)',
                }}
              >
                {hospitais[e.hospitalId]?.abrev ?? e.hospitalId} · {mesLabel(e.mesISO)} · {e.turnos.length} turnos
              </button>
            );
          })}
        </div>
      )}

      {/* janelas ativas */}
      {conhecidas.length > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <Eyebrow>turnos do hospital</Eyebrow>
          {conhecidas.map((j) => {
            const ativa = janelas.some((x) => x.rotulo.toLowerCase() === j.rotulo.toLowerCase());
            return (
              <button
                key={j.rotulo}
                type="button"
                onClick={() => alternarJanela(j)}
                aria-pressed={ativa}
                title={fmtRange(j.inicio, j.duracao)}
                style={{
                  font: '600 12px/1 var(--font-body)',
                  padding: '8px 14px',
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
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'flex-start' }}>
        <div>
          {/* Bloco grudado no topo enquanto o mês rola: o roster (pra trocar
              de médico sem voltar) + o cabeçalho das colunas. */}
          <div style={{ position: 'sticky', top: 0, zIndex: 15, background: 'var(--bg)', paddingBottom: 2 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '12px 14px',
                background: 'var(--bg-alt)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                marginBottom: 8,
              }}
            >
              <Eyebrow style={{ marginRight: 4 }}>equipe</Eyebrow>
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
              <input
                value={novoMedico}
                onChange={(e) => setNovoMedico(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') adicionarMedico();
                }}
                placeholder="+ nome do médico · enter"
                style={{ ...inputStyle, width: 190 }}
              />
              {medicos.length === 0 && !importadaRecente && (
                <Mono style={{ color: 'var(--ink-3)' }}>
                  digita os nomes · ou importa uma escala antiga em sincronizar
                </Mono>
              )}
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
                style={{ ...botaoDesfazer, opacity: passado.length === 0 ? 0.35 : 1 }}
              >
                ↶
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
                style={{ ...botaoDesfazer, opacity: futuro.length === 0 ? 0.35 : 1 }}
              >
                ↷
              </button>
              {(medicoSel || ultimaAcao) && (
                <span style={{ width: '100%', display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  {medicoSel && (
                    <Hand color="var(--lavender-ink)" size={14}>
                      escalando {nomeCurto(medicoSel)} · clica nos turnos (clica no nome de novo pra soltar)
                    </Hand>
                  )}
                  {ultimaAcao && (
                    <Mono style={{ color: 'var(--ink-3)', marginLeft: medicoSel ? 'auto' : 0 }}>
                      {ultimaAcao}
                    </Mono>
                  )}
                </span>
              )}
            </div>

            {/* cabeçalho das colunas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridDia(janelas.length),
                background: 'var(--bg-alt)',
                border: '1px solid var(--line)',
                borderRadius: '12px 12px 0 0',
                borderBottom: 'none',
              }}
            >
              <div style={cabecalhoColuna}>dia</div>
              {janelas.map((j) => (
                <div key={j.rotulo} style={cabecalhoColuna}>
                  {j.rotulo} · {fmtRange(j.inicio, j.duracao)}
                </div>
              ))}
              <div style={cabecalhoColuna}>obs</div>
            </div>
          </div>

          {/* um dia por linha · largura inteira, respiro, scroll natural */}
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: '0 0 16px 16px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
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

        {/* status lateral */}
        <StatusEquipe
          resumos={resumos}
          medicos={medicos}
          semanas={semanas.length}
          conflitos={conflitos.size}
          mesISO={mesISO}
        />
      </div>
    </DndContext>
  );
}

/** Colunas de uma linha-dia: data | janelas | obs. */
function gridDia(nJanelas: number): string {
  return `96px repeat(${nJanelas}, minmax(0, 1fr)) 180px`;
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

/** Tabela dia × janela · exatamente o que sai nos exports. */
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
  const dias: string[] = [];
  const fim = fromISO(`${mesISO}-01`);
  fim.setMonth(fim.getMonth() + 1, 0);
  for (let d = 1; d <= fim.getDate(); d++) {
    dias.push(`${mesISO}-${String(d).padStart(2, '0')}`);
  }
  const temObs = Object.keys(obs).some((d) => d.startsWith(mesISO) && obs[d]?.trim());
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 18,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', font: '500 12px/1.4 var(--font-body)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-alt)' }}>
            <th style={thStyle}>dia</th>
            {janelas.map((j) => (
              <th key={j.rotulo} style={thStyle}>
                {j.rotulo} · {fmtHorarioJanela(j)}
              </th>
            ))}
            {temObs && <th style={thStyle}>obs</th>}
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
                  <td key={j.rotulo} style={tdStyle}>
                    {(turnosPorSlot.get(`${iso}|${j.rotulo}`) ?? []).map((t) => t.medico).join(' · ')}
                  </td>
                ))}
                {temObs && (
                  <td style={{ ...tdStyle, color: 'var(--ink-3)', fontStyle: 'italic' }}>{obs[iso] ?? ''}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `med|${nome}`,
  });
  return (
    <span
      ref={setNodeRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        border: `1.5px solid ${selecionado ? `var(--${cor}-ink)` : 'var(--line)'}`,
        background: selecionado ? `var(--${cor}-surface)` : 'var(--bg)',
        padding: '7px 10px 7px 12px',
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.75 : 1,
        zIndex: isDragging ? 30 : undefined,
        position: 'relative',
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
          gap: 7,
          border: 'none',
          background: 'transparent',
          font: '600 13px/1 var(--font-body)',
          color: 'var(--ink)',
          cursor: 'grab',
          padding: 0,
        }}
      >
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${cor})` }} />
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
          padding: '2px 2px',
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
        minHeight: 64,
        background: fds ? 'var(--bg-alt)' : 'transparent',
        // segunda-feira abre a semana com um traço mais firme · respiro visual
        borderTop: primeiraLinha ? 'none' : inicioDeSemana ? '2px solid var(--line-2)' : '1px solid var(--line)',
        borderLeft: isHoje ? '3px solid var(--lavender)' : '3px solid transparent',
      }}
    >
      <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 16,
            letterSpacing: '-0.01em',
            color: isHoje ? 'var(--lavender-ink)' : fds ? 'var(--ink)' : 'var(--ink-2)',
          }}
        >
          {DOWS[dow]} {fromISO(iso).getDate()}
        </span>
        {isHoje && (
          <Hand color="var(--lavender-ink)" size={12}>
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
          padding: '6px 10px',
          border: '1px dashed transparent',
          borderRadius: 8,
          background: 'transparent',
          font: `400 12px/1.4 var(--font-body)`,
          fontStyle: 'italic',
          color: 'var(--ink-2)',
          outline: 'none',
          alignSelf: 'flex-start',
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
  const { setNodeRef, isOver } = useDroppable({ id: `slot|${iso}|${janela.rotulo}` });
  const vazio = turnos.length === 0;
  return (
    <div
      ref={setNodeRef}
      onClick={onClicar}
      role="button"
      aria-label={`turno ${janela.rotulo} de ${iso}`}
      title={`${janela.rotulo} · ${fmtRange(janela.inicio, janela.duracao)}`}
      style={{
        margin: '8px 6px',
        padding: '6px 6px',
        borderRadius: 10,
        border: `1.5px dashed ${
          isOver ? 'var(--lavender-ink)' : vazio ? 'var(--line-2)' : 'transparent'
        }`,
        background: isOver ? 'var(--lavender-surface)' : 'transparent',
        cursor: temSelecao ? 'copy' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        minHeight: 46,
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
      {turnos.map((t) => {
        const cor = corDoMedico(t.medico, medicos);
        const emConflito = conflitos.has(`${t.medico}|${t.data}|${t.janela}`);
        return (
          <button
            key={t.medico}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoverTurno(t);
            }}
            title={`${t.medico} · clica pra tirar`}
            style={{
              textAlign: 'left',
              font: '600 13px/1.3 var(--font-body)',
              padding: '7px 12px',
              borderRadius: 8,
              background: `var(--${cor}-surface)`,
              border: emConflito ? '1.5px solid var(--err-ink)' : 'none',
              borderLeft: `3px solid var(--${cor})`,
              color: `var(--${cor}-ink)`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              // pisca ao entrar · sinaliza a mudança pra quem clicou
              animation: 'colo-fab-in 220ms cubic-bezier(.2,.7,.2,1)',
            }}
          >
            {t.medico}
          </button>
        );
      })}
    </div>
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
        borderRadius: 16,
        padding: '16px 18px',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16 }}>
          quem tá com quanto
        </span>
        <Eyebrow>{mesLabel(mesISO)}</Eyebrow>
      </div>
      {conflitos > 0 && (
        <Pill kind="err" style={{ marginBottom: 10 }}>
          {conflitos / 2 >= 1 ? Math.round(conflitos / 2) : 1} choque{conflitos > 2 ? 's' : ''} de horário
        </Pill>
      )}
      {resumos.length === 0 && (
        <Mono style={{ color: 'var(--ink-3)', display: 'block' }}>adiciona a equipe ali em cima</Mono>
      )}
      {resumos.map((r) => {
        const cor = corDoMedico(r.medico, medicos);
        const desvio = media > 0 && r.total > 0 ? r.total - media : 0;
        return (
          <div key={r.medico} style={{ padding: '10px 0', borderBottom: '1px dashed var(--line-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${cor})`, flexShrink: 0 }} />
              <span style={{ font: '600 13px/1.2 var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.medico}
              </span>
              <Mono style={{ marginLeft: 'auto', color: 'var(--ink)', flexShrink: 0 }}>
                {r.total}h
              </Mono>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 5, alignItems: 'center' }}>
              <Mono style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                {r.porSemana.map((h) => `${h}`).join(' · ')} /sem
              </Mono>
              <Mono style={{ color: 'var(--ink-3)', fontSize: 10, marginLeft: 'auto' }}>
                fds {r.fds}h
              </Mono>
              {Math.abs(desvio) >= 12 && (
                <Mono
                  style={{
                    fontSize: 10,
                    color: desvio > 0 ? 'var(--coral-ink)' : 'var(--sage-ink)',
                  }}
                >
                  {desvio > 0 ? '+' : ''}
                  {Math.round(desvio)}h vs média
                </Mono>
              )}
            </div>
          </div>
        );
      })}
      {resumos.length > 0 && (
        <Mono style={{ display: 'block', marginTop: 10, color: 'var(--ink-3)', fontSize: 10 }}>
          {semanas} semanas no mês · média {Math.round(media)}h por médico escalado
        </Mono>
      )}
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

const botaoPrimario: React.CSSProperties = {
  font: '600 13px/1 var(--font-body)',
  padding: '11px 20px',
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

const botaoDesfazer: React.CSSProperties = {
  font: '600 15px/1 var(--font-body)',
  width: 36,
  height: 36,
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};

const cabecalhoColuna: React.CSSProperties = {
  padding: '11px 12px',
  font: '700 10px/1 var(--font-body)',
  letterSpacing: '0.06em',
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

const cardExport: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  borderRadius: 16,
  padding: '16px 18px',
  boxShadow: 'var(--shadow-sm)',
  marginBottom: 14,
};
