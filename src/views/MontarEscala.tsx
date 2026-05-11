import { useMemo, useState } from 'react';
import type {
  Bloco,
  BlocoPlantao,
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
import { Eyebrow, LoadingFrases, MonthPicker, Mono } from '@/components/atoms';
import { rotuloTurno } from '@/lib/turno';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHead } from './_PageHead';

const FRASES_MONTAR = [
  'lendo as regras de cada hospital',
  'olhando seu histórico',
  'checando o padrão do chefe',
  'respeitando seus bloqueios',
  'espaçando descanso entre plantões',
  'calculando se bate na meta',
  'ajustando a proposta final',
] as const;

type Lente = 'descansar' | 'equilibrar' | 'acelerar';
type Etapa = 'setup' | 'bloqueios' | 'gerando' | 'preview' | 'exportar';
type TipoAtividade = 'bloqueio' | 'sono' | 'consulta' | 'estudo' | 'pessoal' | 'outros';

const ETAPAS: Array<{ id: Etapa; label: string }> = [
  { id: 'setup', label: 'configurar' },
  { id: 'bloqueios', label: 'bloqueios' },
  { id: 'gerando', label: 'gerar' },
  { id: 'preview', label: 'editar' },
  { id: 'exportar', label: 'exportar' },
];

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
  valorEstimado: number;
  avisos: string[];
  respostaCrua?: string;
}

interface MontarEscalaProps {
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  blocos: Bloco[];
  escalasImportadas: EscalaImportada[];
  onCriarBloco: (b: Bloco) => void;
}

const LENTES: Array<{ id: Lente; titulo: string; recado: string }> = [
  { id: 'descansar', titulo: 'descansar', recado: 'menos plantões · espaçamento maior · prioriza descanso' },
  { id: 'equilibrar', titulo: 'equilibrar', recado: 'saudável dentro das regras · sem pressão extra' },
  { id: 'acelerar', titulo: 'acelerar', recado: 'mais perto do teto contratual · precisa de motivo' },
];

export function MontarEscala({
  hospitais,
  preferencias,
  blocos,
  escalasImportadas,
  onCriarBloco,
}: MontarEscalaProps) {
  const proximoMes = useMemo(() => {
    const hoje = new Date();
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [etapa, setEtapa] = useState<Etapa>('setup');
  const [mes, setMes] = useState<string>(proximoMes);
  const [hospitaisSel, setHospitaisSel] = useState<Set<string>>(
    () => new Set(Object.keys(hospitais)),
  );
  const [lente, setLente] = useState<Lente>('equilibrar');
  const [acelerarPercentual, setAcelerarPercentual] = useState<string>('');
  const [acelerarValor, setAcelerarValor] = useState<string>('');
  const [chefes, setChefes] = useState<Record<string, string>>({});

  const [resultado, setResultado] = useState<PropostaResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lista = Object.values(hospitais);
  const hospitaisHabilitados = lista.filter((h) => hospitaisSel.has(h.id));

  const mesNomeExtenso = useMemo(() => {
    const [a, m] = mes.split('-');
    const idx = parseInt(m ?? '1', 10) - 1;
    return `${MESES[idx] ?? ''} ${a}`;
  }, [mes]);

  const metaEfetiva = useMemo<number | null>(() => {
    if (lente !== 'acelerar') return null;
    const o = acelerarValor.trim() ? parseInt(acelerarValor, 10) : NaN;
    return isFinite(o) && o > 0 ? o : null;
  }, [lente, acelerarValor]);

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
    if (lente === 'acelerar' && !acelerarPercentual.trim() && !acelerarValor.trim()) {
      setErro('acelerar precisa de motivo · preencha % ou R$');
      return;
    }
    setEtapa('gerando');
    setErro(null);
    try {
      const [anoStr, mesStr] = mes.split('-');
      const ano = parseInt(anoStr ?? '0', 10);
      const mesNum = parseInt(mesStr ?? '0', 10);
      const acelPct =
        lente === 'acelerar' && acelerarPercentual.trim()
          ? parseInt(acelerarPercentual, 10)
          : undefined;
      const acelVal =
        lente === 'acelerar' && acelerarValor.trim()
          ? parseInt(acelerarValor, 10)
          : undefined;

      const resp = await fetch('/api/montar-escala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano,
          mes: mesNum,
          lente,
          acelerarPercentual: acelPct,
          acelerarValor: acelVal,
          hospitais: hospitaisHabilitados,
          preferencias,
          escalasImportadas: escalasImportadas.filter((e) => hospitaisSel.has(e.hospitalId)),
          blocos,
        }),
      });

      if (!resp.ok) {
        setErro(`servidor não respondeu bem · ${resp.status}`);
        setEtapa('setup');
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
      setEtapa('preview');
    } catch (err) {
      setErro((err as Error).message);
      setEtapa('setup');
    }
  }

  function regerar() {
    setResultado(null);
    setEtapa('setup');
  }

  function removerPlantao(id: string) {
    setResultado((r) => (r ? { ...r, plantoes: r.plantoes.filter((p) => p.id !== id) } : r));
  }

  function adicionarPlantao(data: string, hospitalId: string, janela: Janela) {
    setResultado((r) => {
      if (!r) return r;
      const id = `sug-${Date.now()}-${r.plantoes.length}`;
      return {
        ...r,
        plantoes: [...r.plantoes, { id, hospitalId, data, horaInicio: janela.inicio, duracao: janela.duracao }],
      };
    });
  }

  return (
    <>
      <PageHead
        eyebrow="montar"
        titulo={
          etapa === 'preview'
            ? `${mesNomeExtenso} · ${resultado?.plantoes.length ?? 0} plantões`
            : etapa === 'exportar'
              ? `exportar · ${mesNomeExtenso}`
              : 'proposta de escala.'
        }
        hand={
          etapa === 'preview'
            ? 'edita à vontade · clica num dia pra adicionar/remover'
            : etapa === 'exportar'
              ? 'um chefe por vez · escolha o formato'
              : 'configura, escolho o jeito de pensar, e proponho um mês todo'
        }
      />

      <StepBar etapa={etapa} />

      {etapa === 'setup' && (
        <SetupCard
          mes={mes}
          setMes={setMes}
          hospitais={lista}
          hospitaisSel={hospitaisSel}
          toggleHospital={toggleHospital}
          lente={lente}
          setLente={setLente}
          acelerarPercentual={acelerarPercentual}
          setAcelerarPercentual={setAcelerarPercentual}
          acelerarValor={acelerarValor}
          setAcelerarValor={setAcelerarValor}
          erro={erro}
          onAvancar={() => {
            if (hospitaisSel.size === 0) {
              setErro('escolha pelo menos um hospital');
              return;
            }
            if (lente === 'acelerar' && !acelerarPercentual.trim() && !acelerarValor.trim()) {
              setErro('acelerar precisa de motivo · preencha % ou R$');
              return;
            }
            setErro(null);
            setEtapa('bloqueios');
          }}
        />
      )}

      {etapa === 'bloqueios' && (
        <BloqueiosCard
          mes={mes}
          blocos={blocos}
          hospitais={hospitais}
          onCriarBloco={onCriarBloco}
          onVoltar={() => setEtapa('setup')}
          onAvancar={() => void gerar()}
        />
      )}

      {etapa === 'gerando' && (
        <div
          style={{
            padding: '40px 32px',
            background: 'var(--lavender-surface)',
            border: '1px dashed var(--lavender-ink)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            maxWidth: 720,
          }}
        >
          <LoadingFrases frases={FRASES_MONTAR} fontSize={16} />
          <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            isso pode levar até uns 30 segundos
          </Mono>
        </div>
      )}

      {etapa === 'preview' && resultado && (
        <PreviewBlock
          mes={mes}
          metaEfetiva={metaEfetiva}
          resultado={resultado}
          hospitais={hospitais}
          blocos={blocos}
          onRemoverPlantao={removerPlantao}
          onAdicionarPlantao={adicionarPlantao}
          onVoltar={() => setEtapa('bloqueios')}
          onAvancar={() => setEtapa('exportar')}
          onRegerar={regerar}
        />
      )}

      {etapa === 'exportar' && resultado && (
        <ExportarPanel
          mes={mes}
          plantoes={resultado.plantoes}
          hospitais={hospitais}
          hospitaisSel={hospitaisSel}
          preferencias={preferencias}
          chefes={chefes}
          setChefes={setChefes}
          onVoltar={() => setEtapa('preview')}
        />
      )}
    </>
  );
}

// --- StepBar ----------------------------------------------------------------

function StepBar({ etapa }: { etapa: Etapa }) {
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        marginBottom: 22,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {ETAPAS.map((e, i) => {
        const ativo = i === idx;
        const passou = i < idx;
        return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: ativo ? 'var(--lavender-ink)' : passou ? 'var(--sage-ink)' : 'var(--line-2)',
                color: ativo || passou ? 'var(--bg)' : 'var(--ink-3)',
                font: '600 11px/22px var(--font-body)',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                font: ativo ? '600 12px/1 var(--font-body)' : '500 12px/1 var(--font-body)',
                color: ativo ? 'var(--ink)' : passou ? 'var(--sage-ink)' : 'var(--ink-3)',
              }}
            >
              {e.label}
            </span>
            {i < ETAPAS.length - 1 && (
              <span
                style={{
                  width: 18,
                  height: 1,
                  background: 'var(--line-2)',
                  margin: '0 4px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Etapa 1 · Setup --------------------------------------------------------

interface SetupCardProps {
  mes: string;
  setMes: (m: string) => void;
  hospitais: ReturnType<typeof Object.values<HospitaisMap[string]>>;
  hospitaisSel: Set<string>;
  toggleHospital: (id: string) => void;
  lente: Lente;
  setLente: (l: Lente) => void;
  acelerarPercentual: string;
  setAcelerarPercentual: (s: string) => void;
  acelerarValor: string;
  setAcelerarValor: (s: string) => void;
  erro: string | null;
  onAvancar: () => void;
}

function SetupCard({
  mes,
  setMes,
  hospitais,
  hospitaisSel,
  toggleHospital,
  lente,
  setLente,
  acelerarPercentual,
  setAcelerarPercentual,
  acelerarValor,
  setAcelerarValor,
  erro,
  onAvancar,
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
      <Linha rotulo="mês">
        <MonthPicker value={mes} onChange={setMes} janela={12} />
      </Linha>

      <Linha rotulo="hospitais">
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
      </Linha>

      <Linha rotulo="jeito de pensar">
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
      </Linha>

      {lente === 'acelerar' && (
        <Linha rotulo="motivo">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '14px 16px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--lavender-ink)',
              background: 'var(--lavender-surface)',
            }}
          >
            <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
              preencha pelo menos um · pode preencher os dois e a gente honra o mais demandante
            </Mono>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px/1.3 var(--font-body)' }}>
              <span>+</span>
              <input
                inputMode="numeric"
                value={acelerarPercentual}
                onChange={(e) => setAcelerarPercentual(e.target.value.replace(/\D/g, ''))}
                placeholder="15"
                style={{ ...inputBase, width: 70, textAlign: 'right' }}
              />
              <span>% de plantões a mais que seu normal histórico</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px/1.3 var(--font-body)' }}>
              <span>chegar até R$</span>
              <input
                inputMode="numeric"
                value={acelerarValor}
                onChange={(e) => setAcelerarValor(e.target.value.replace(/\D/g, ''))}
                placeholder="25000"
                style={{ ...inputBase, width: 110, textAlign: 'right' }}
              />
              <span>estimado no mês</span>
            </label>
          </div>
        </Linha>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <button
          type="button"
          onClick={onAvancar}
          disabled={hospitaisSel.size === 0}
          style={{
            font: '600 14px/1 var(--font-body)',
            padding: '13px 22px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--lavender-ink)',
            color: 'var(--bg)',
            cursor: hospitaisSel.size === 0 ? 'not-allowed' : 'pointer',
            opacity: hospitaisSel.size === 0 ? 0.5 : 1,
          }}
        >
          avançar
        </button>
        {erro && (
          <span style={{ font: '500 13px/1.4 var(--font-body)', color: 'var(--coral-ink)' }}>
            {erro}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Etapa 2 · Bloqueios ----------------------------------------------------

interface BloqueiosCardProps {
  mes: string;
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onCriarBloco: (b: Bloco) => void;
  onVoltar: () => void;
  onAvancar: () => void;
}

function BloqueiosCard({ mes, blocos, hospitais, onCriarBloco, onVoltar, onAvancar }: BloqueiosCardProps) {
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  const dias = useMemo(() => listarDiasDoMes(mes), [mes]);
  const bloqueiosMes = useMemo(
    () => blocos.filter((b) => b.tipo !== 'plantao' && b.tipo !== 'cedido' && b.data.startsWith(mes)),
    [blocos, mes],
  );
  const plantoesMes = useMemo(
    () => blocos.filter((b): b is BlocoPlantao => b.tipo === 'plantao' && b.data.startsWith(mes)),
    [blocos, mes],
  );

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: '24px 26px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 4px' }}>
        Quer bloquear algum dia ou parte do dia? Clique no calendário pra adicionar uma atividade
        (consulta, sono, bloqueio, etc) que não pode ser plantão.
      </p>
      <Mono style={{ color: 'var(--ink-3)', fontSize: 11, marginBottom: 16, display: 'block' }}>
        atividades criadas aqui vão pra sua agenda real e o Montar respeita
      </Mono>

      <CalendarioBloqueios
        dias={dias}
        mes={mes}
        bloqueios={bloqueiosMes}
        plantoes={plantoesMes}
        hospitais={hospitais}
        onClickDia={setDiaAberto}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={onVoltar}
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
          voltar
        </button>
        <button
          type="button"
          onClick={onAvancar}
          style={{
            font: '600 14px/1 var(--font-body)',
            padding: '11px 22px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--lavender-ink)',
            color: 'var(--bg)',
            cursor: 'pointer',
          }}
        >
          gerar proposta
        </button>
      </div>

      {diaAberto && (
        <BloqueioFormModal
          iso={diaAberto}
          onSalvar={(b) => onCriarBloco(b)}
          onFechar={() => setDiaAberto(null)}
        />
      )}
    </div>
  );
}

interface CalendarioBloqueiosProps {
  dias: string[];
  mes: string;
  bloqueios: Bloco[];
  plantoes: BlocoPlantao[];
  hospitais: HospitaisMap;
  onClickDia: (iso: string) => void;
}

function CalendarioBloqueios({ dias, mes, bloqueios, plantoes, hospitais, onClickDia }: CalendarioBloqueiosProps) {
  const porDia = useMemo(() => {
    const m = new Map<string, { plantoes: BlocoPlantao[]; bloqueios: Bloco[] }>();
    for (const p of plantoes) {
      const e = m.get(p.data) ?? { plantoes: [], bloqueios: [] };
      e.plantoes.push(p);
      m.set(p.data, e);
    }
    for (const b of bloqueios) {
      const e = m.get(b.data) ?? { plantoes: [], bloqueios: [] };
      e.bloqueios.push(b);
      m.set(b.data, e);
    }
    return m;
  }, [plantoes, bloqueios]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {DOWS.map((d) => (
          <Mono key={d} style={{ color: 'var(--ink-3)', textAlign: 'center', fontSize: 11 }}>
            {d}
          </Mono>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {dias.map((iso) => {
          const dataMes = iso.startsWith(mes);
          const e = porDia.get(iso) ?? { plantoes: [], bloqueios: [] };
          return (
            <button
              key={iso}
              type="button"
              onClick={() => dataMes && onClickDia(iso)}
              disabled={!dataMes}
              style={{
                textAlign: 'left',
                padding: 8,
                minHeight: 76,
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line-2)',
                background: dataMes ? 'var(--bg)' : 'var(--bg-alt)',
                opacity: dataMes ? 1 : 0.4,
                cursor: dataMes ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span style={{ font: '600 12px/1 var(--font-body)', color: 'var(--ink-2)' }}>
                {fromISO(iso).getDate()}
              </span>
              {e.plantoes.map((p) => {
                const h = hospitais[p.hospitalId];
                const cor = h?.cor ?? 'sand';
                return (
                  <Mono
                    key={String(p.id)}
                    style={{
                      fontSize: 10,
                      padding: '2px 4px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: `var(--${cor}-surface)`,
                      color: `var(--${cor}-ink)`,
                    }}
                  >
                    {h?.abrev} · {rotuloTurno(p.horaInicio, p.duracao, h) ?? fmtHora(p.horaInicio)}
                  </Mono>
                );
              })}
              {e.bloqueios.map((b) => {
                const motivo = (b as { motivo?: string; titulo?: string }).motivo
                  ?? (b as { titulo?: string }).titulo
                  ?? b.tipo;
                return (
                  <Mono
                    key={String(b.id)}
                    style={{
                      fontSize: 10,
                      padding: '2px 4px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: 'var(--bg-alt)',
                      color: 'var(--ink-3)',
                      borderLeft: '2px solid var(--ink-3)',
                    }}
                  >
                    {motivo.length > 14 ? `${motivo.slice(0, 14)}…` : motivo}
                  </Mono>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Modal · criar atividade pra bloquear o dia ----------------------------

const TIPOS_ATIVIDADE: Array<{ id: TipoAtividade; label: string }> = [
  { id: 'bloqueio', label: 'bloqueio' },
  { id: 'sono', label: 'sono protegido' },
  { id: 'consulta', label: 'consulta' },
  { id: 'estudo', label: 'estudo' },
  { id: 'pessoal', label: 'pessoal' },
  { id: 'outros', label: 'outros' },
];

function BloqueioFormModal({
  iso,
  onSalvar,
  onFechar,
}: {
  iso: string;
  onSalvar: (b: Bloco) => void;
  onFechar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoAtividade>('bloqueio');
  const [motivo, setMotivo] = useState('');
  const [horaInicio, setHoraInicio] = useState(8);
  const [duracao, setDuracao] = useState(2);

  function salvar() {
    const id = `act-${Date.now()}`;
    const base = { id, data: iso, horaInicio, duracao };
    let bloco: Bloco;
    if (tipo === 'sono') bloco = { ...base, tipo: 'sono' };
    else if (tipo === 'bloqueio') bloco = { ...base, tipo: 'bloqueio', motivo: motivo || 'bloqueado' };
    else if (tipo === 'consulta') bloco = { ...base, tipo: 'consulta', detalhe: motivo || 'consulta' };
    else if (tipo === 'estudo') bloco = { ...base, tipo: 'estudo', subtipo: motivo || undefined };
    else if (tipo === 'pessoal') bloco = { ...base, tipo: 'pessoal', titulo: motivo || 'pessoal' };
    else bloco = { ...base, tipo: 'outros', titulo: motivo || 'compromisso' };
    onSalvar(bloco);
    onFechar();
  }

  return (
    <Modal onFechar={onFechar}>
      <Eyebrow>{capitalize(diaSemanaBRLong(iso))}</Eyebrow>
      <h3 style={{ font: '500 22px/1.2 var(--font-display)', margin: '4px 0 0', color: 'var(--ink)' }}>
        {fmtDate(iso)}
      </h3>

      <Field label="tipo">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAtividade)} style={inputBase}>
          {TIPOS_ATIVIDADE.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={tipo === 'sono' ? 'observação (opcional)' : 'motivo / título'}>
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="ex: aniversário do filho · consulta clínica · curso"
          style={inputBase}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="início">
          <input
            type="number"
            min={0}
            max={23.5}
            step={0.5}
            value={horaInicio}
            onChange={(e) => setHoraInicio(parseFloat(e.target.value) || 0)}
            style={inputBase}
          />
        </Field>
        <Field label="duração (h)">
          <input
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            value={duracao}
            onChange={(e) => setDuracao(parseFloat(e.target.value) || 0.5)}
            style={inputBase}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
        <button type="button" onClick={onFechar} style={btnSecundario}>
          cancelar
        </button>
        <button type="button" onClick={salvar} style={btnPrimario}>
          salvar
        </button>
      </div>
    </Modal>
  );
}

// --- Etapa 4 · Preview --------------------------------------------------------

interface PreviewBlockProps {
  mes: string;
  metaEfetiva: number | null;
  resultado: PropostaResultado;
  hospitais: HospitaisMap;
  blocos: Bloco[];
  onRemoverPlantao: (id: string) => void;
  onAdicionarPlantao: (data: string, hospitalId: string, janela: Janela) => void;
  onVoltar: () => void;
  onAvancar: () => void;
  onRegerar: () => void;
}

function PreviewBlock({
  mes,
  metaEfetiva,
  resultado,
  hospitais,
  blocos,
  onRemoverPlantao,
  onAdicionarPlantao,
  onVoltar,
  onAvancar,
  onRegerar,
}: PreviewBlockProps) {
  const isMobile = useIsMobile();
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const totalDuracao = resultado.plantoes.reduce((s, p) => s + p.duracao, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {resultado.justificativa && (
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--lavender-surface)',
            border: '1px solid var(--lavender-ink)',
            borderRadius: 'var(--r-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Eyebrow color="var(--lavender-ink)">por que assim · raciocínio</Eyebrow>
          <p style={{ font: '400 14px/1.6 var(--font-body)', color: 'var(--ink)', margin: 0 }}>
            {resultado.justificativa}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: isMobile ? 18 : 24, alignItems: 'flex-start' }}>
      <CalendarioProposta
        mes={mes}
        plantoes={resultado.plantoes}
        hospitais={hospitais}
        blocos={blocos}
        diaAberto={diaAberto}
        setDiaAberto={setDiaAberto}
        onRemoverPlantao={onRemoverPlantao}
        onAdicionarPlantao={onAdicionarPlantao}
      />

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card titulo="totais" eyebrow="estimativa">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Total rotulo="plantões" valor={String(resultado.plantoes.length)} />
            <Total rotulo="horas" valor={`${totalDuracao}h`} />
            <Total rotulo="valor estimado" valor={`R$ ${resultado.valorEstimado.toLocaleString('pt-BR')}`} />
            {metaEfetiva !== null && (
              <Total rotulo="meta" valor={`R$ ${metaEfetiva.toLocaleString('pt-BR')}`} />
            )}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onAvancar} style={btnPrimario}>
            avançar pra exportar
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onVoltar} style={{ ...btnSecundario, flex: 1 }}>
              voltar
            </button>
            <button type="button" onClick={onRegerar} style={{ ...btnSecundario, flex: 1 }}>
              regerar
            </button>
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}

// --- Etapa 5 · Exportar -----------------------------------------------------

interface ExportarPanelProps {
  mes: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  hospitaisSel: Set<string>;
  preferencias: Preferencias;
  chefes: Record<string, string>;
  setChefes: (c: Record<string, string>) => void;
  onVoltar: () => void;
}

function ExportarPanel({
  mes,
  plantoes,
  hospitais,
  hospitaisSel,
  preferencias,
  chefes,
  setChefes,
  onVoltar,
}: ExportarPanelProps) {
  const porHospital = useMemo(() => {
    const m = new Map<string, PlantaoSugerido[]>();
    for (const p of plantoes) {
      const arr = m.get(p.hospitalId) ?? [];
      arr.push(p);
      m.set(p.hospitalId, arr);
    }
    return m;
  }, [plantoes]);

  const [anoStr, mesStr] = mes.split('-');
  const ano = parseInt(anoStr ?? '0', 10);
  const mesNum = parseInt(mesStr ?? '0', 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
      {Array.from(hospitaisSel).map((hid) => {
        const hospital = hospitais[hid];
        if (!hospital) return null;
        const plantoesH = porHospital.get(hid) ?? [];
        return (
          <ExportarHospitalCard
            key={hid}
            hospital={hospital}
            plantoes={plantoesH}
            ano={ano}
            mes={mesNum}
            preferencias={preferencias}
            chefe={chefes[hid] ?? ''}
            setChefe={(v) => setChefes({ ...chefes, [hid]: v })}
          />
        );
      })}

      <button type="button" onClick={onVoltar} style={{ ...btnSecundario, alignSelf: 'flex-start' }}>
        voltar pra editar
      </button>
    </div>
  );
}

interface ExportarHospitalCardProps {
  hospital: HospitaisMap[string];
  plantoes: PlantaoSugerido[];
  ano: number;
  mes: number;
  preferencias: Preferencias;
  chefe: string;
  setChefe: (v: string) => void;
}

function ExportarHospitalCard({ hospital, plantoes, ano, mes, preferencias, chefe, setChefe }: ExportarHospitalCardProps) {
  const [statusTexto, setStatusTexto] = useState<'idle' | 'copiado'>('idle');
  const [exportando, setExportando] = useState<'pdf' | 'xlsx' | null>(null);

  const blocosPlantao: BlocoPlantao[] = plantoes.map((p) => ({
    id: p.id,
    tipo: 'plantao',
    hospitalId: p.hospitalId,
    data: p.data,
    horaInicio: p.horaInicio,
    duracao: p.duracao,
  }));

  async function copiarTexto() {
    const mod = await import('@/lib/exportarMontar');
    const texto = mod.montarMensagem({
      hospital,
      plantoes: blocosPlantao,
      ano,
      mes,
      preferencias,
      chefe: chefe.trim() || undefined,
    });
    await navigator.clipboard.writeText(texto);
    setStatusTexto('copiado');
    setTimeout(() => setStatusTexto('idle'), 2000);
  }

  async function baixarPdf() {
    setExportando('pdf');
    try {
      const mod = await import('@/lib/exportarMontar');
      await mod.baixarPDFMontar({
        hospital,
        plantoes: blocosPlantao,
        ano,
        mes,
        preferencias,
        chefe: chefe.trim() || undefined,
      });
    } finally {
      setExportando(null);
    }
  }

  async function baixarExcel() {
    setExportando('xlsx');
    try {
      const mod = await import('@/lib/exportarMontar');
      await mod.baixarExcelMontar({
        hospital,
        plantoes: blocosPlantao,
        ano,
        mes,
        preferencias,
        chefe: chefe.trim() || undefined,
      });
    } finally {
      setExportando(null);
    }
  }

  if (plantoes.length === 0) {
    return (
      <Card titulo={`${hospital.abrev ?? '?'} · ${hospital.nome}`} eyebrow="sem plantões">
        <Mono style={{ color: 'var(--ink-3)' }}>nenhum plantão proposto pra esse hospital · pule</Mono>
      </Card>
    );
  }

  return (
    <Card
      titulo={`${hospital.abrev ?? '?'} · ${hospital.nome}`}
      eyebrow={`${plantoes.length} plantões`}
    >
      <Field label="nome do chefe (opcional)">
        <input
          type="text"
          value={chefe}
          onChange={(e) => setChefe(e.target.value)}
          placeholder="ex: Paulo · Dra. Carla · etc"
          style={inputBase}
        />
      </Field>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <button type="button" onClick={copiarTexto} style={btnExport(statusTexto === 'copiado')}>
          {statusTexto === 'copiado' ? 'texto copiado!' : 'copiar texto'}
        </button>
        <button type="button" onClick={baixarPdf} disabled={exportando !== null} style={btnExport(false)}>
          {exportando === 'pdf' ? 'gerando…' : 'baixar pdf'}
        </button>
        <button type="button" onClick={baixarExcel} disabled={exportando !== null} style={btnExport(false)}>
          {exportando === 'xlsx' ? 'gerando…' : 'baixar excel'}
        </button>
      </div>
    </Card>
  );
}

// --- Calendário do preview --------------------------------------------------

interface CalendarioPropostaProps {
  mes: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  blocos: Bloco[];
  diaAberto: string | null;
  setDiaAberto: (d: string | null) => void;
  onRemoverPlantao: (id: string) => void;
  onAdicionarPlantao: (data: string, hospitalId: string, janela: Janela) => void;
}

function CalendarioProposta({
  mes,
  plantoes,
  hospitais,
  blocos,
  diaAberto,
  setDiaAberto,
  onRemoverPlantao,
  onAdicionarPlantao,
}: CalendarioPropostaProps) {
  const dias = useMemo(() => listarDiasDoMes(mes), [mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, PlantaoSugerido[]>();
    for (const p of plantoes) {
      const arr = m.get(p.data) ?? [];
      arr.push(p);
      m.set(p.data, arr);
    }
    return m;
  }, [plantoes]);

  const bloqueiosPorDia = useMemo(() => {
    const m = new Map<string, Bloco[]>();
    for (const b of blocos) {
      if (b.tipo === 'plantao' || b.tipo === 'cedido') continue;
      if (!b.data.startsWith(mes)) continue;
      const arr = m.get(b.data) ?? [];
      arr.push(b);
      m.set(b.data, arr);
    }
    return m;
  }, [blocos, mes]);

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
              <span style={{ font: '600 12px/1 var(--font-body)', color: dataMes ? 'var(--ink-2)' : 'var(--ink-3)' }}>
                {fromISO(iso).getDate()}
              </span>
              {(bloqueiosPorDia.get(iso) ?? []).map((b) => {
                const motivo = (b as { motivo?: string; titulo?: string; detalhe?: string }).motivo
                  ?? (b as { titulo?: string }).titulo
                  ?? (b as { detalhe?: string }).detalhe
                  ?? b.tipo;
                return (
                  <div
                    key={String(b.id)}
                    style={{
                      padding: '3px 6px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: 'var(--bg-alt)',
                      borderLeft: '2px solid var(--ink-3)',
                      font: '500 10px/1.2 var(--font-mono)',
                      color: 'var(--ink-3)',
                    }}
                    title={`${b.tipo} · ${fmtHora(b.horaInicio)}-${fmtHora((b.horaInicio + b.duracao) % 24)}`}
                  >
                    {motivo.length > 12 ? `${motivo.slice(0, 12)}…` : motivo}
                  </div>
                );
              })}
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
                    {h?.abrev ?? '?'} · {rotuloTurno(p.horaInicio, p.duracao, h) ?? fmtHora(p.horaInicio)}
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

// --- Detalhe do dia (preview · adicionar/remover plantão) -------------------

function DetalheDia({
  iso,
  plantoes,
  hospitais,
  onFechar,
  onRemover,
  onAdicionar,
}: {
  iso: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  onFechar: () => void;
  onRemover: (id: string) => void;
  onAdicionar: (hospitalId: string, janela: Janela) => void;
}) {
  const isMobile = useIsMobile();
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
    <Modal onFechar={onFechar}>
      <Eyebrow>{capitalize(diaSemanaBRLong(iso))}</Eyebrow>
      <h3 style={{ font: '500 22px/1.2 var(--font-display)', margin: '4px 0 0', color: 'var(--ink)' }}>
        {fmtDate(iso)}
      </h3>

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
                    {h?.abrev ?? '?'} · {rotuloTurno(p.horaInicio, p.duracao, h) ?? `${fmtHora(p.horaInicio)} → ${fmtHora((p.horaInicio + p.duracao) % 24)}`}
                  </span>
                  <Mono style={{ color: 'var(--ink-2)', fontSize: 11 }}>
                    {p.duracao}h
                  </Mono>
                  {p.razao && (
                    <Mono style={{ color: 'var(--ink-3)', fontSize: 11, marginTop: 2 }}>{p.razao}</Mono>
                  )}
                </div>
                <button type="button" onClick={() => onRemover(p.id)} style={btnXStyle(isMobile)}>
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
          <select value={hospitalEsc} onChange={(e) => setHospitalEsc(e.target.value)} style={inputBase}>
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

      <button type="button" onClick={onFechar} style={{ ...btnSecundario, alignSelf: 'flex-end' }}>
        fechar
      </button>
    </Modal>
  );
}

// --- Helpers visuais --------------------------------------------------------

function listarDiasDoMes(mes: string): string[] {
  const ini = inicioDaSemana(inicioDoMes(`${mes}-01`));
  const fim = fimDoMes(`${mes}-01`);
  const out: string[] = [];
  let cursor = ini;
  while (cursor <= fim || diaSemanaBR(cursor) !== 0) {
    out.push(cursor);
    cursor = adicionaDia(cursor, 1);
    if (out.length > 42) break;
  }
  return out;
}

function fmtHora(h: number): string {
  const inteiro = Math.floor(h);
  const min = Math.round((h - inteiro) * 60);
  return `${String(inteiro).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function diaSemanaBRLong(iso: string): string {
  const d = fromISO(iso);
  return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()]!;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Modal({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
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
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>
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
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'baseline' }}>
      <Eyebrow>{rotulo}</Eyebrow>
      {children}
    </div>
  );
}

function Total({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <Mono style={{ color: 'var(--ink-3)', fontSize: 12 }}>{rotulo}</Mono>
      <span style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>{valor}</span>
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

const inputBase: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 13px/1.3 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
};

const btnPrimario: React.CSSProperties = {
  font: '600 14px/1 var(--font-body)',
  padding: '12px 20px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--lavender-ink)',
  color: 'var(--bg)',
  cursor: 'pointer',
};

const btnSecundario: React.CSSProperties = {
  font: '500 13px/1 var(--font-body)',
  padding: '11px 18px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};

function btnExport(success: boolean): React.CSSProperties {
  return {
    font: '600 13px/1 var(--font-body)',
    padding: '11px 18px',
    borderRadius: 999,
    border: 'none',
    background: success ? 'var(--sage-ink)' : 'var(--ink)',
    color: 'var(--bg)',
    cursor: 'pointer',
  };
}

function btnXStyle(isMobile: boolean): React.CSSProperties {
  const size = isMobile ? 44 : 28;
  return {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 999,
    border: '1px solid var(--coral-ink)',
    background: 'transparent',
    color: 'var(--coral-ink)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

