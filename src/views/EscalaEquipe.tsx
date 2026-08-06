import { useMemo, useRef, useState } from 'react';
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
} from '@/lib/equipe';
import { Eyebrow, Hand, Mono, MonthPicker, Pill } from '@/components/atoms';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHead } from './_PageHead';
import {
  baixarPDFEquipeCompleto,
  baixarPDFEquipeMedico,
  type DadosPDFEquipe,
} from '@/lib/pdfEquipe';

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

/**
 * EscalaEquipe · página (temporária) onde a chefe monta a escala do TIME
 * inteiro de um hospital: arrasta (ou seleciona e clica) médicos pros
 * turnos do mês, acompanha horas por semana/fds/total de cada um ao vivo,
 * e exporta PDF completo + um por médico. Feita pra desktop.
 */
export function EscalaEquipe({
  hospitais,
  escalasImportadas,
  escalasEquipe,
  onSalvar,
}: EscalaEquipeProps) {
  const isMobile = useIsMobile();
  const hospitaisLista = Object.values(hospitais);
  const [hospitalId, setHospitalId] = useState<string>(hospitaisLista[0]?.id ?? '');
  const [mesISO, setMesISO] = useState<string>(() => {
    // default: mês que vem · escala se monta antes do mês começar
    const d = fromISO(HOJE);
    d.setMonth(d.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
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
  const janelas: Janela[] =
    rascunho?.janelas ??
    (hospitais[hospitalId]?.janelas?.length
      ? hospitais[hospitalId]!.janelas!
      : importadaRecente?.janelas?.length
        ? importadaRecente.janelas
        : JANELAS_DEFAULT);

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

  // Cliques em sequência rápida chegam antes do re-render: ler `turnos`
  // direto do closure perderia atribuições (o 2º save nasceria do estado
  // velho). O ref acumula otimisticamente entre renders.
  const atualRef = useRef({ medicos, janelas, turnos });
  atualRef.current = { medicos, janelas, turnos };

  function salvar(prox: Partial<EscalaEquipeT>): void {
    const proximo: EscalaEquipeT = {
      hospitalId,
      mesISO,
      ...atualRef.current,
      ...prox,
      atualizadaEm: new Date().toISOString(),
    };
    atualRef.current = {
      medicos: proximo.medicos,
      janelas: proximo.janelas,
      turnos: proximo.turnos,
    };
    onSalvar(proximo);
  }

  function puxarDaImportada(): void {
    if (!importadaRecente) return;
    const vindos = medicosDaImportada(importadaRecente);
    const mescla = [...medicos];
    for (const m of vindos) if (!mescla.includes(m)) mescla.push(m);
    salvar({
      medicos: mescla,
      janelas: rascunho?.janelas ?? importadaRecente.janelas ?? janelas,
    });
  }

  function adicionarMedico(): void {
    const nome = novoMedico.trim();
    if (!nome || medicos.includes(nome)) return;
    salvar({ medicos: [...medicos, nome] });
    setNovoMedico('');
  }

  function removerMedico(nome: string): void {
    salvar({
      medicos: medicos.filter((m) => m !== nome),
      turnos: turnos.filter((t) => t.medico !== nome),
    });
    if (medicoSel === nome) setMedicoSel(null);
  }

  function escalar(data: string, janela: string, medico: string): void {
    const atuais = atualRef.current.turnos;
    const jaTem = atuais.some(
      (t) => t.data === data && t.janela === janela && t.medico === medico,
    );
    if (jaTem) return;
    salvar({ turnos: [...atuais, { data, janela, medico }] });
  }

  function desescalar(t: TurnoEquipe): void {
    salvar({
      turnos: atualRef.current.turnos.filter(
        (x) => !(x.data === t.data && x.janela === t.janela && x.medico === t.medico),
      ),
    });
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

  async function exportarCompleto(): Promise<void> {
    setExportando('completo');
    try {
      await baixarPDFEquipeCompleto(dadosPDF());
    } finally {
      setExportando(null);
    }
  }

  async function exportarPorMedico(): Promise<void> {
    setExportando('medicos');
    try {
      const comTurno = medicos.filter((m) => turnos.some((t) => t.medico === m));
      for (const m of comTurno) {
        await baixarPDFEquipeMedico(dadosPDF(), m);
        // o browser engasga com downloads simultâneos · respiro entre eles
        await new Promise((r) => setTimeout(r, 450));
      }
    } finally {
      setExportando(null);
    }
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
    };
  }

  if (isMobile) {
    return (
      <>
        <PageHead
          eyebrow="escala da equipe"
          titulo="melhor no computador."
          hand="montar a escala do time inteiro pede tela grande · abre no desktop"
        />
      </>
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

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <PageHead
        eyebrow="escala da equipe"
        titulo="o mês do time inteiro."
        hand="arrasta o nome pro turno · ou clica no nome e vai clicando nos turnos"
      />

      {/* setup: hospital + mês + puxar equipe */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <select
          value={hospitalId}
          onChange={(e) => setHospitalId(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 180 }}
        >
          {hospitaisLista.map((h) => (
            <option key={h.id} value={h.id}>
              {h.abrev} · {h.nome}
            </option>
          ))}
        </select>
        <MonthPicker value={mesISO} onChange={setMesISO} />
        {importadaRecente && (
          <button type="button" onClick={puxarDaImportada} style={botaoSecundario}>
            puxar equipe da escala de {MESES[importadaRecente.mes - 1]}/{importadaRecente.ano}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => void exportarCompleto()}
          disabled={turnos.length === 0 || exportando !== null}
          style={{ ...botaoPrimario, opacity: turnos.length === 0 || exportando ? 0.5 : 1 }}
        >
          {exportando === 'completo' ? 'gerando…' : 'pdf completo'}
        </button>
        <button
          type="button"
          onClick={() => void exportarPorMedico()}
          disabled={turnos.length === 0 || exportando !== null}
          style={{ ...botaoSecundario, opacity: turnos.length === 0 || exportando ? 0.5 : 1 }}
        >
          {exportando === 'medicos' ? 'gerando…' : 'pdf por médico'}
        </button>
      </div>

      {/* roster de médicos */}
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
          marginBottom: 16,
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
          style={{ ...inputStyle, width: 200 }}
        />
        {medicos.length === 0 && !importadaRecente && (
          <Mono style={{ color: 'var(--ink-3)' }}>
            digita os nomes · ou importa uma escala antiga em sincronizar
          </Mono>
        )}
      </div>

      {medicoSel && (
        <Hand color="var(--lavender-ink)" size={15} style={{ display: 'block', marginBottom: 12 }}>
          escalando {nomeCurto(medicoSel)} · clica nos turnos (clica no nome de novo pra soltar)
        </Hand>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'flex-start' }}>
        {/* calendário */}
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-alt)', borderBottom: '1px solid var(--line)' }}>
            {DOWS.map((d) => (
              <div
                key={d}
                style={{
                  padding: '10px 8px',
                  font: '700 10px/1 var(--font-body)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                  textAlign: 'center',
                }}
              >
                {d}
              </div>
            ))}
          </div>
          {semanas.map((semana, i) => (
            <div
              key={`${semana[0]}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: i === semanas.length - 1 ? 'none' : '1px solid var(--line)',
              }}
            >
              {semana.map((iso) => (
                <DiaEquipe
                  key={iso}
                  iso={iso}
                  mesISO={mesISO}
                  janelas={janelas}
                  turnosPorSlot={turnosPorSlot}
                  medicos={medicos}
                  conflitos={conflitos}
                  temSelecao={!!medicoSel}
                  onClicarSlot={clicarSlot}
                  onRemoverTurno={desescalar}
                />
              ))}
            </div>
          ))}
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

function DiaEquipe({
  iso,
  mesISO,
  janelas,
  turnosPorSlot,
  medicos,
  conflitos,
  temSelecao,
  onClicarSlot,
  onRemoverTurno,
}: {
  iso: string;
  mesISO: string;
  janelas: Janela[];
  turnosPorSlot: Map<string, TurnoEquipe[]>;
  medicos: string[];
  conflitos: Set<string>;
  temSelecao: boolean;
  onClicarSlot: (data: string, janela: string) => void;
  onRemoverTurno: (t: TurnoEquipe) => void;
}) {
  const noMes = iso.startsWith(mesISO);
  const fds = diaSemanaBR(iso) >= 5;
  const isHoje = iso === HOJE;
  return (
    <div
      style={{
        minHeight: 96,
        borderRight: '1px solid var(--line)',
        background: fds ? 'var(--bg-alt)' : 'transparent',
        opacity: noMes ? 1 : 0.35,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 13,
          padding: '6px 8px 2px',
          color: isHoje ? 'var(--lavender-ink)' : 'var(--ink-2)',
        }}
      >
        {fromISO(iso).getDate()}
      </span>
      {noMes &&
        janelas.map((j) => (
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
  return (
    <div
      ref={setNodeRef}
      onClick={onClicar}
      role="button"
      aria-label={`turno ${janela.rotulo} de ${iso}`}
      title={`${janela.rotulo} · ${fmtRange(janela.inicio, janela.duracao)}`}
      style={{
        flex: 1,
        margin: '2px 4px',
        padding: '3px 4px',
        borderRadius: 8,
        border: `1.5px dashed ${isOver ? 'var(--lavender-ink)' : 'var(--line-2)'}`,
        background: isOver ? 'var(--lavender-surface)' : 'transparent',
        cursor: temSelecao ? 'copy' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minHeight: 30,
      }}
    >
      <span
        style={{
          font: '700 8px/1 var(--font-body)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {janela.rotulo}
      </span>
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
              font: '600 10px/1.2 var(--font-body)',
              padding: '3px 6px',
              borderRadius: 6,
              background: `var(--${cor}-surface)`,
              border: emConflito ? '1.5px solid var(--err-ink)' : 'none',
              borderLeft: `3px solid var(--${cor})`,
              color: `var(--${cor}-ink)`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {nomeCurto(t.medico)}
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
