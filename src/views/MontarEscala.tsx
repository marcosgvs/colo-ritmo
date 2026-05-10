import { useMemo, useState } from 'react';
import type {
  Bloco,
  EscalaImportada,
  HospitaisMap,
  Janela,
  Preferencias,
} from '@/types';
import {
  DOWS,
  MESES,
  adicionaDia,
  diaSemanaBR,
  fimDoMes,
  fmtDate,
  fromISO,
  inicioDaSemana,
  inicioDoMes,
} from '@/lib/data';
import { Eyebrow, Hand, MonthPicker, Mono, Pill } from '@/components/atoms';
import { PageHead } from './_PageHead';

type Lente = 'descansar' | 'equilibrar' | 'ganhar';
type Estado = 'parado' | 'gerando' | 'pronto' | 'erro';

interface PlantaoSugerido {
  id: string;
  hospitalId: string;
  data: string;
  horaInicio: number;
  duracao: number;
  razao?: string;
}

interface PropostaResultado {
  plantoes: PlantaoSugerido[];
  justificativa: string;
  totalEstimadoLiquido: number;
  avisos: string[];
  respostaCrua?: string;
}

interface MontarEscalaProps {
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  blocos: Bloco[];
  escalasImportadas: EscalaImportada[];
}

const LENTES: Array<{ id: Lente; titulo: string; recado: string }> = [
  {
    id: 'descansar',
    titulo: 'descansar',
    recado: 'menos plantões · espaçamento maior · prioriza descanso',
  },
  {
    id: 'equilibrar',
    titulo: 'equilibrar',
    recado: 'meta + descanso · mistura turnos · padrão sustentável',
  },
  {
    id: 'ganhar',
    titulo: 'ganhar',
    recado: 'maximiza receita · prefere noturno se paga mais',
  },
];

export function MontarEscala({
  hospitais,
  preferencias,
  blocos,
  escalasImportadas,
}: MontarEscalaProps) {
  const proximoMes = useMemo(() => {
    const hoje = new Date();
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [mes, setMes] = useState<string>(proximoMes);
  const [hospitaisSel, setHospitaisSel] = useState<Set<string>>(
    () => new Set(Object.keys(hospitais)),
  );
  const [lente, setLente] = useState<Lente>('equilibrar');
  const [metaOverride, setMetaOverride] = useState<string>('');

  const [estado, setEstado] = useState<Estado>('parado');
  const [resultado, setResultado] = useState<PropostaResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lista = Object.values(hospitais);
  const hospitaisHabilitados = lista.filter((h) => hospitaisSel.has(h.id));

  function toggleHospital(id: string) {
    setHospitaisSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function gerar() {
    if (hospitaisSel.size === 0) {
      setErro('escolha pelo menos um hospital');
      return;
    }
    setEstado('gerando');
    setErro(null);
    try {
      const [anoStr, mesStr] = mes.split('-');
      const ano = parseInt(anoStr ?? '0', 10);
      const mesNum = parseInt(mesStr ?? '0', 10);
      const meta = metaOverride.trim() ? parseInt(metaOverride, 10) : undefined;

      const resp = await fetch('/api/montar-escala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano,
          mes: mesNum,
          lente,
          metaOverride: meta,
          hospitais: hospitaisHabilitados,
          preferencias,
          escalasImportadas: escalasImportadas.filter((e) => hospitaisSel.has(e.hospitalId)),
          blocos,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        setErro(`servidor não respondeu bem · ${resp.status}`);
        setEstado('erro');
        console.error('montar-escala:', txt);
        return;
      }

      const json = (await resp.json()) as PropostaResultado;
      const baseId = Date.now();
      setResultado({
        ...json,
        plantoes: (json.plantoes ?? []).map((p, i) => ({
          ...p,
          id: p.id || `sug-${baseId}-${i}`,
        })),
      });
      setEstado('pronto');
    } catch (err) {
      setErro((err as Error).message);
      setEstado('erro');
    }
  }

  function regerar() {
    setResultado(null);
    setEstado('parado');
  }

  function removerPlantao(id: string) {
    setResultado((r) => {
      if (!r) return r;
      return { ...r, plantoes: r.plantoes.filter((p) => p.id !== id) };
    });
  }

  function adicionarPlantao(data: string, hospitalId: string, janela: Janela) {
    setResultado((r) => {
      if (!r) return r;
      const id = `sug-${Date.now()}-${r.plantoes.length}`;
      return {
        ...r,
        plantoes: [
          ...r.plantoes,
          { id, hospitalId, data, horaInicio: janela.inicio, duracao: janela.duracao },
        ],
      };
    });
  }

  return (
    <>
      <PageHead
        eyebrow="montar"
        titulo={
          estado === 'pronto'
            ? `proposta pronta · ${resultado?.plantoes.length ?? 0} plantões`
            : 'proposta de escala.'
        }
        hand={
          estado === 'pronto'
            ? 'edita à vontade · clica num dia pra adicionar/remover'
            : 'configura, escolho o jeito de pensar, e proponho um mês todo'
        }
      />

      {estado === 'parado' || estado === 'gerando' || estado === 'erro' ? (
        <SetupCard
          mes={mes}
          setMes={setMes}
          hospitais={lista}
          hospitaisSel={hospitaisSel}
          toggleHospital={toggleHospital}
          lente={lente}
          setLente={setLente}
          metaOverride={metaOverride}
          setMetaOverride={setMetaOverride}
          metaPadrao={preferencias.metaMensal}
          onGerar={gerar}
          gerando={estado === 'gerando'}
          erro={erro}
        />
      ) : null}

      {estado === 'pronto' && resultado && (
        <PreviewBlock
          mes={mes}
          resultado={resultado}
          hospitais={hospitais}
          preferencias={preferencias}
          onRemoverPlantao={removerPlantao}
          onAdicionarPlantao={adicionarPlantao}
          onRegerar={regerar}
        />
      )}
    </>
  );
}

// --- Setup -----------------------------------------------------------------

interface SetupCardProps {
  mes: string;
  setMes: (m: string) => void;
  hospitais: ReturnType<typeof Object.values<HospitaisMap[string]>>;
  hospitaisSel: Set<string>;
  toggleHospital: (id: string) => void;
  lente: Lente;
  setLente: (l: Lente) => void;
  metaOverride: string;
  setMetaOverride: (s: string) => void;
  metaPadrao: number;
  onGerar: () => void;
  gerando: boolean;
  erro: string | null;
}

function SetupCard({
  mes,
  setMes,
  hospitais,
  hospitaisSel,
  toggleHospital,
  lente,
  setLente,
  metaOverride,
  setMetaOverride,
  metaPadrao,
  onGerar,
  gerando,
  erro,
}: SetupCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: '24px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        boxShadow: 'var(--shadow-sm)',
        maxWidth: 720,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'center' }}>
        <Eyebrow>mês</Eyebrow>
        <MonthPicker value={mes} onChange={setMes} janela={12} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'baseline' }}>
        <Eyebrow>hospitais</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {hospitais.map((h) => {
            const ativo = hospitaisSel.has(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => toggleHospital(h.id)}
                style={{
                  font: '500 13px/1 var(--font-body)',
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: ativo ? '1px solid var(--ink)' : '1px solid var(--line)',
                  background: ativo ? 'var(--ink)' : 'transparent',
                  color: ativo ? 'var(--bg)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {h.abrev}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'baseline' }}>
        <Eyebrow>jeito de pensar</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LENTES.map((l) => {
            const ativo = lente === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLente(l.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: 'var(--r-md)',
                  border: ativo ? '1px solid var(--lavender-ink)' : '1px solid var(--line)',
                  background: ativo ? 'var(--lavender-surface)' : 'var(--bg-alt)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <span style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>
                  {l.titulo}
                </span>
                <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>{l.recado}</Mono>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'baseline' }}>
        <Eyebrow>meta líquida</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            inputMode="numeric"
            value={metaOverride}
            onChange={(e) => setMetaOverride(e.target.value.replace(/\D/g, ''))}
            placeholder={`padrão · R$ ${metaPadrao.toLocaleString('pt-BR')}`}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              font: '500 13px/1.3 var(--font-body)',
              color: 'var(--ink)',
              outline: 'none',
              width: 220,
            }}
          />
          <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            só pra essa rodada · não muda seu padrão
          </Mono>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <button
          type="button"
          onClick={onGerar}
          disabled={gerando || hospitaisSel.size === 0}
          style={{
            font: '600 14px/1 var(--font-body)',
            padding: '13px 22px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--lavender-ink)',
            color: 'var(--bg)',
            cursor: gerando || hospitaisSel.size === 0 ? 'not-allowed' : 'pointer',
            opacity: gerando || hospitaisSel.size === 0 ? 0.5 : 1,
          }}
        >
          {gerando ? 'tô pensando…' : 'gerar proposta'}
        </button>
        {erro && (
          <span style={{ font: '500 13px/1.4 var(--font-body)', color: 'var(--coral-ink)' }}>
            {erro}
          </span>
        )}
      </div>

      <Hand color="var(--ink-3)" size={14}>
        depois de gerada, você edita à vontade · click em qualquer dia abre o detalhe
      </Hand>
    </div>
  );
}

// --- Preview ----------------------------------------------------------------

interface PreviewBlockProps {
  mes: string;
  resultado: PropostaResultado;
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  onRemoverPlantao: (id: string) => void;
  onAdicionarPlantao: (data: string, hospitalId: string, janela: Janela) => void;
  onRegerar: () => void;
}

function PreviewBlock({
  mes,
  resultado,
  hospitais,
  preferencias,
  onRemoverPlantao,
  onAdicionarPlantao,
  onRegerar,
}: PreviewBlockProps) {
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [modalExportarHospital, setModalExportarHospital] = useState<string | null>(null);

  const totalDuracao = resultado.plantoes.reduce((s, p) => s + p.duracao, 0);
  const porHospital = useMemo(() => {
    const m = new Map<string, PlantaoSugerido[]>();
    for (const p of resultado.plantoes) {
      const arr = m.get(p.hospitalId) ?? [];
      arr.push(p);
      m.set(p.hospitalId, arr);
    }
    return m;
  }, [resultado.plantoes]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'flex-start' }}>
      <CalendarioProposta
        mes={mes}
        plantoes={resultado.plantoes}
        hospitais={hospitais}
        diaAberto={diaAberto}
        setDiaAberto={setDiaAberto}
        onRemoverPlantao={onRemoverPlantao}
        onAdicionarPlantao={onAdicionarPlantao}
      />

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card titulo="por que assim" eyebrow="raciocínio">
          <p style={{ font: '400 13px/1.55 var(--font-body)', color: 'var(--ink-2)', margin: 0 }}>
            {resultado.justificativa}
          </p>
        </Card>

        <Card titulo="totais" eyebrow="estimativa">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Linha rotulo="plantões" valor={String(resultado.plantoes.length)} />
            <Linha rotulo="horas" valor={`${totalDuracao}h`} />
            <Linha
              rotulo="líquido aprox."
              valor={`R$ ${resultado.totalEstimadoLiquido.toLocaleString('pt-BR')}`}
            />
            <Linha
              rotulo="meta"
              valor={`R$ ${preferencias.metaMensal.toLocaleString('pt-BR')}`}
            />
          </div>
        </Card>

        {resultado.avisos.length > 0 && (
          <Card titulo={`${resultado.avisos.length} aviso(s)`} eyebrow="cuidado">
            <ul style={{ margin: 0, padding: '0 0 0 16px', font: '400 13px/1.45 var(--font-body)', color: 'var(--ink-2)' }}>
              {resultado.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            {resultado.respostaCrua && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', font: '500 12px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>
                  ver o que recebi
                </summary>
                <pre
                  style={{
                    marginTop: 6,
                    padding: 10,
                    background: 'var(--bg-alt)',
                    border: '1px solid var(--line-2)',
                    borderRadius: 'var(--r-sm)',
                    font: '400 11px/1.5 var(--font-mono)',
                    color: 'var(--ink-2)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {resultado.respostaCrua}
                </pre>
              </details>
            )}
          </Card>
        )}

        <Card titulo="exportar" eyebrow="um chefe por vez">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from(porHospital.keys()).map((id) => {
              const h = hospitais[id];
              if (!h) return null;
              const qtd = porHospital.get(id)?.length ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setModalExportarHospital(id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    font: '500 13px/1.3 var(--font-body)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{h.abrev} · {h.nome}</span>
                  <Pill kind="info">{qtd}</Pill>
                </button>
              );
            })}
          </div>
        </Card>

        <button
          type="button"
          onClick={onRegerar}
          style={{
            font: '500 13px/1 var(--font-body)',
            padding: '11px 18px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          regerar com outra lente
        </button>
      </aside>

      {modalExportarHospital && (
        <ExportarModal
          hospitalId={modalExportarHospital}
          hospitais={hospitais}
          plantoes={porHospital.get(modalExportarHospital) ?? []}
          preferencias={preferencias}
          mes={mes}
          onFechar={() => setModalExportarHospital(null)}
        />
      )}
    </div>
  );
}

// --- Calendário -------------------------------------------------------------

interface CalendarioPropostaProps {
  mes: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  diaAberto: string | null;
  setDiaAberto: (d: string | null) => void;
  onRemoverPlantao: (id: string) => void;
  onAdicionarPlantao: (data: string, hospitalId: string, janela: Janela) => void;
}

function CalendarioProposta({
  mes,
  plantoes,
  hospitais,
  diaAberto,
  setDiaAberto,
  onRemoverPlantao,
  onAdicionarPlantao,
}: CalendarioPropostaProps) {
  const dias = useMemo(() => {
    const ini = inicioDaSemana(inicioDoMes(`${mes}-01`));
    const fim = fimDoMes(`${mes}-01`);
    const out: string[] = [];
    let cursor = ini;
    while (cursor <= fim || diaSemanaBR(cursor) !== 0) {
      out.push(cursor);
      cursor = adicionaDia(cursor, 1);
      if (out.length > 42) break; // safety
    }
    return out;
  }, [mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, PlantaoSugerido[]>();
    for (const p of plantoes) {
      const arr = m.get(p.data) ?? [];
      arr.push(p);
      m.set(p.data, arr);
    }
    return m;
  }, [plantoes]);

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: '20px 22px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {DOWS.map((d) => (
          <Mono key={d} style={{ color: 'var(--ink-3)', textAlign: 'center', fontSize: 11 }}>
            {d}
          </Mono>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {dias.map((iso) => {
          const dataMes = iso.startsWith(mes);
          const lista = porDia.get(iso) ?? [];
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDiaAberto(iso)}
              style={{
                textAlign: 'left',
                padding: 8,
                minHeight: 88,
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line-2)',
                background: dataMes ? 'var(--bg)' : 'var(--bg-alt)',
                opacity: dataMes ? 1 : 0.4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  font: '600 12px/1 var(--font-body)',
                  color: dataMes ? 'var(--ink-2)' : 'var(--ink-3)',
                }}
              >
                {fromISO(iso).getDate()}
              </span>
              {lista.map((p) => {
                const h = hospitais[p.hospitalId];
                const cor = h?.cor ?? 'sand';
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '3px 6px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: `var(--${cor}-surface)`,
                      borderLeft: `2px solid var(--${cor}-ink)`,
                      font: '500 11px/1.2 var(--font-mono)',
                      color: `var(--${cor}-ink)`,
                    }}
                  >
                    {h?.abrev ?? '?'} · {fmtHora(p.horaInicio)}
                  </div>
                );
              })}
            </button>
          );
        })}
      </div>

      {diaAberto && (
        <DetalheDia
          iso={diaAberto}
          plantoes={porDia.get(diaAberto) ?? []}
          hospitais={hospitais}
          onFechar={() => setDiaAberto(null)}
          onRemover={onRemoverPlantao}
          onAdicionar={(hospitalId, janela) => onAdicionarPlantao(diaAberto, hospitalId, janela)}
        />
      )}
    </div>
  );
}

function fmtHora(h: number): string {
  const inteiro = Math.floor(h);
  const min = Math.round((h - inteiro) * 60);
  return `${String(inteiro).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// --- Detalhe do dia (modal) -------------------------------------------------

interface DetalheDiaProps {
  iso: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  onFechar: () => void;
  onRemover: (id: string) => void;
  onAdicionar: (hospitalId: string, janela: Janela) => void;
}

function DetalheDia({ iso, plantoes, hospitais, onFechar, onRemover, onAdicionar }: DetalheDiaProps) {
  const [adicionando, setAdicionando] = useState(false);
  const lista = Object.values(hospitais);
  const [hospitalEsc, setHospitalEsc] = useState<string>(lista[0]?.id ?? '');
  const hospital = hospitais[hospitalEsc];
  const janelas: Janela[] = hospital?.janelas ?? [
    { rotulo: 'manhã', inicio: 7, duracao: 6 },
    { rotulo: 'tarde', inicio: 13, duracao: 6 },
    { rotulo: 'noite', inicio: 19, duracao: 12 },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-lg)',
          padding: '22px 26px',
          width: 'min(440px, calc(100% - 32px))',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <Eyebrow>{capitalize(diaSemanaBRLong(iso))}</Eyebrow>
          <h3 style={{ font: '500 22px/1.2 var(--font-display)', margin: '4px 0 0', color: 'var(--ink)' }}>
            {fmtDate(iso)}
          </h3>
        </div>

        {plantoes.length === 0 ? (
          <Mono style={{ color: 'var(--ink-3)' }}>nenhum plantão · adicionar?</Mono>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plantoes.map((p) => {
              const h = hospitais[p.hospitalId];
              const cor = h?.cor ?? 'sand';
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: `var(--${cor}-surface)`,
                    borderLeft: `3px solid var(--${cor}-ink)`,
                    borderRadius: 'var(--r-sm)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '500 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>
                      {h?.abrev ?? '?'}
                    </span>
                    <Mono style={{ color: 'var(--ink-2)', fontSize: 11 }}>
                      {fmtHora(p.horaInicio)} → {fmtHora((p.horaInicio + p.duracao) % 24)} · {p.duracao}h
                    </Mono>
                    {p.razao && (
                      <Mono style={{ color: 'var(--ink-3)', fontSize: 11, marginTop: 2 }}>
                        {p.razao}
                      </Mono>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemover(p.id)}
                    aria-label="remover"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      border: '1px solid var(--coral-ink)',
                      background: 'transparent',
                      color: 'var(--coral-ink)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!adicionando ? (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--r-md)',
              border: '1px dashed var(--line)',
              background: 'transparent',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              font: '500 13px/1 var(--font-body)',
            }}
          >
            + adicionar plantão
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '12px 14px',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-alt)',
            }}
          >
            <Eyebrow>novo plantão</Eyebrow>
            <select
              value={hospitalEsc}
              onChange={(e) => setHospitalEsc(e.target.value)}
              style={inputBase}
            >
              {lista.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.abrev} · {h.nome}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {janelas.map((j) => (
                <button
                  key={j.rotulo}
                  type="button"
                  onClick={() => {
                    onAdicionar(hospitalEsc, j);
                    setAdicionando(false);
                  }}
                  style={{
                    font: '500 12px/1 var(--font-body)',
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                >
                  {j.rotulo} · {fmtHora(j.inicio)} ({j.duracao}h)
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onFechar}
          style={{
            font: '500 13px/1 var(--font-body)',
            padding: '10px 16px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          fechar
        </button>
      </div>
    </div>
  );
}

// --- Modal exportar (mensagem por hospital) ---------------------------------

interface ExportarModalProps {
  hospitalId: string;
  hospitais: HospitaisMap;
  plantoes: PlantaoSugerido[];
  preferencias: Preferencias;
  mes: string;
  onFechar: () => void;
}

function ExportarModal({ hospitalId, hospitais, plantoes, preferencias, mes, onFechar }: ExportarModalProps) {
  const hospital = hospitais[hospitalId];
  const [copiado, setCopiado] = useState(false);

  const texto = useMemo(() => {
    const ordenados = [...plantoes].sort(
      (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
    );
    const [, mesStr] = mes.split('-');
    const mesNome = MESES[parseInt(mesStr ?? '1', 10) - 1];
    const cabecalho = `Olá,\n\nSegue minha proposta de plantões para ${mesNome}/${mes.split('-')[0]} no ${hospital?.nome ?? hospitalId}:\n\n`;
    const linhas = ordenados.map((p) => {
      const d = fromISO(p.data);
      const dow = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()]!;
      const dia = d.getDate();
      const fim = (p.horaInicio + p.duracao) % 24;
      return `- ${dow} ${dia}/${mesStr} · ${fmtHora(p.horaInicio)} às ${fmtHora(fim)} (${p.duracao}h)`;
    });
    const total = ordenados.length;
    const horas = ordenados.reduce((s, p) => s + p.duracao, 0);
    const rodape = `\n\nTotal: ${total} plantões, ${horas} horas.\n\nFico no aguardo da escala oficial.\n\nObrigada,\n${preferencias.nome}`;
    return cabecalho + linhas.join('\n') + rodape;
  }, [plantoes, hospital, hospitalId, mes, preferencias.nome]);

  function copiar() {
    void navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-lg)',
          padding: '24px 28px',
          width: 'min(560px, calc(100% - 32px))',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <Eyebrow>mensagem para o chefe</Eyebrow>
          <h3 style={{ font: '500 22px/1.2 var(--font-display)', margin: '4px 0 0', color: 'var(--ink)' }}>
            {hospital?.abrev ?? hospitalId} · {hospital?.nome ?? ''}
          </h3>
        </div>
        <textarea
          value={texto}
          readOnly
          rows={14}
          style={{
            ...inputBase,
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.5,
            resize: 'vertical',
            minHeight: 280,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onFechar}
            style={{
              font: '500 13px/1 var(--font-body)',
              padding: '11px 18px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}
          >
            fechar
          </button>
          <button
            type="button"
            onClick={copiar}
            style={{
              font: '600 13px/1 var(--font-body)',
              padding: '11px 18px',
              borderRadius: 999,
              border: 'none',
              background: copiado ? 'var(--sage-ink)' : 'var(--ink)',
              color: 'var(--bg)',
              cursor: 'pointer',
            }}
          >
            {copiado ? 'copiado!' : 'copiar texto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Helpers UI --------------------------------------------------------------

function Card({ titulo, eyebrow, children }: { titulo: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>
          {titulo}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <Mono style={{ color: 'var(--ink-3)', fontSize: 12 }}>{rotulo}</Mono>
      <span style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>{valor}</span>
    </div>
  );
}

function diaSemanaBRLong(iso: string): string {
  const d = fromISO(iso);
  return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()]!;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const inputBase: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 13px/1.3 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
};

