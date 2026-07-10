import { useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import type { AddTipo } from '@/components/shell';
import { DatePicker, Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { JanelaPreview } from '@/components/preview';
import { detectarConflitos, fmtDate, fmtRange, toISO } from '@/lib/data';

interface AdicionarBlocoProps {
  tipo: AddTipo;
  hospitais: HospitaisMap;
  blocosAtuais: Bloco[];
  /** ISO sugerido (default = hoje no calendário sample). */
  dataInicial?: string;
  /** Se presente, abre em modo "editar" — preserva id, oferece botão remover. */
  blocoExistente?: Bloco;
  onSalvar: (b: Bloco) => void;
  onRemover?: () => void;
  onCancelar: () => void;
}

/**
 * Tudo que não é plantão entra pelo MESMO form ("outro compromisso"):
 * descrição livre + chip opcional de identificação. O chip mapeia pro
 * tipo já existente no modelo (sono/bloqueio/consulta/…), então blocos
 * antigos continuam válidos e a cor/semântica de cada um se mantém —
 * folga segue bloqueando o Montar, sono segue pintado de sage, etc.
 */
interface ChipTipo {
  tipo: Exclude<AddTipo, 'plantao'>;
  rotulo: string;
  cor: string;
  /** Defaults de janela ao escolher o chip em modo criar. */
  inicio: number;
  duracao: number;
  placeholder: string;
}

const CHIPS_TIPO: ChipTipo[] = [
  { tipo: 'outros',   rotulo: 'outro',    cor: 'ink-3',     inicio: 19, duracao: 3,  placeholder: 'reunião · jantar · etc' },
  { tipo: 'consulta', rotulo: 'consulta', cor: 'coral-ink', inicio: 9,  duracao: 4,  placeholder: 'consultório centro' },
  { tipo: 'estudo',   rotulo: 'estudo',   cor: 'blue-ink',  inicio: 9,  duracao: 8,  placeholder: 'curso de UTI neonatal' },
  { tipo: 'pessoal',  rotulo: 'pessoal',  cor: 'sand-ink',  inicio: 19, duracao: 3,  placeholder: 'aniversário · família' },
  { tipo: 'bloqueio', rotulo: 'folga',    cor: 'olive-ink', inicio: 0,  duracao: 24, placeholder: 'viagem · descanso' },
  { tipo: 'sono',     rotulo: 'sono',     cor: 'sage-ink',  inicio: 22, duracao: 8,  placeholder: '' },
];

function chipDe(tipo: AddTipo): ChipTipo {
  return CHIPS_TIPO.find((c) => c.tipo === tipo) ?? CHIPS_TIPO[0]!;
}

/** Hora-fim a partir de início + duração · cruza meia-noite (mod 24). */
function horaFimDe(inicio: number, duracao: number): number {
  return (inicio + duracao) % 24;
}

/** Clampa input numérico de hora · NaN (campo vazio) vira o mínimo. */
function clampHora(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/** Duração inferida de início + fim · se fim ≤ início, considera overnight. */
function duracaoDeInicioFim(inicio: number, fim: number): number {
  if (fim === inicio) return 24;
  return (fim - inicio + 24) % 24;
}

/** Lê o "nome" descritivo de um bloco · varia por tipo (motivo/local/titulo). */
function nomeDoBloco(b: Bloco): string {
  if (b.tipo === 'bloqueio') return b.motivo ?? '';
  if (b.tipo === 'consulta') return b.local ?? '';
  if (b.tipo === 'estudo' || b.tipo === 'pessoal' || b.tipo === 'outros')
    return b.titulo ?? '';
  return '';
}

const HAND_HINT: Record<AddTipo, string> = {
  plantao: 'um turno',
  sono: 'janela protegida de descanso',
  bloqueio: 'sem agenda nesse período',
  consulta: 'consultório ou ambulatório',
  estudo: 'curso, congresso, aula',
  pessoal: 'fora da medicina',
  outros: 'qualquer coisa que ocupa tempo',
};

/** Tipos que o AdicionarBloco/Editor cobre. Outros (cedido/trocado/deslocamento)
 * são resultados de ações específicas e não passam por aqui. */
const TIPOS_EDITAVEIS: AddTipo[] = [
  'plantao',
  'sono',
  'bloqueio',
  'consulta',
  'estudo',
  'pessoal',
  'outros',
];

export function ehTipoEditavel(t: Bloco['tipo']): t is AddTipo {
  return (TIPOS_EDITAVEIS as string[]).includes(t);
}

/**
 * Modal full-overlay que substitui o stub `console.info('FAB:', tipo)`
 * por um form real. Cria um bloco do tipo escolhido e devolve via
 * `onSalvar`. O caller (App) faz merge no user_state.
 *
 * Avisa em tempo real se a janela escolhida geraria conflito (sobrepor
 * outro plantão, descanso curto). Não bloqueia · só informa.
 */
export function AdicionarBloco({
  tipo,
  hospitais,
  blocosAtuais,
  dataInicial,
  blocoExistente,
  onSalvar,
  onRemover,
  onCancelar,
}: AdicionarBlocoProps) {
  const modoEditar = !!blocoExistente;
  const hojeISO = dataInicial ?? toISO(new Date());

  const hospitaisLista = Object.values(hospitais);
  // Em não-plantão, tipo é mutável (chips de identificação). Plantão fixo.
  const [tipoAtual, setTipoAtual] = useState<AddTipo>(tipo);
  const [data, setData] = useState(blocoExistente?.data ?? hojeISO);
  const [horaInicio, setHoraInicio] = useState(
    blocoExistente?.horaInicio ?? (tipo === 'plantao' ? 7 : chipDe(tipo).inicio),
  );
  const [duracao, setDuracao] = useState(
    blocoExistente?.duracao ?? (tipo === 'plantao' ? 12 : chipDe(tipo).duracao),
  );
  const [hospitalId, setHospitalId] = useState(
    blocoExistente?.tipo === 'plantao' ? blocoExistente.hospitalId : hospitaisLista[0]?.id ?? '',
  );
  const [nome, setNome] = useState(blocoExistente ? nomeDoBloco(blocoExistente) : '');

  // Chip clicado em modo criar aplica os defaults de janela do chip
  // (folga = dia inteiro, sono = 22→6…) · em editar preserva as horas.
  function escolherChip(c: ChipTipo): void {
    setTipoAtual(c.tipo);
    if (!modoEditar) {
      setHoraInicio(c.inicio);
      setDuracao(c.duracao);
    }
  }

  const novoBloco: Bloco = useMemo(() => {
    const id = blocoExistente?.id ?? `manual-${Date.now()}`;
    if (tipoAtual === 'plantao') {
      return { id, tipo: 'plantao', hospitalId, data, horaInicio, duracao };
    }
    if (tipoAtual === 'sono') return { id, tipo: 'sono', data, horaInicio, duracao };
    if (tipoAtual === 'bloqueio') return { id, tipo: 'bloqueio', data, horaInicio, duracao, motivo: nome };
    if (tipoAtual === 'consulta') return { id, tipo: 'consulta', data, horaInicio, duracao, local: nome };
    if (tipoAtual === 'estudo') return { id, tipo: 'estudo', data, horaInicio, duracao, titulo: nome };
    if (tipoAtual === 'pessoal') return { id, tipo: 'pessoal', data, horaInicio, duracao, titulo: nome };
    return { id, tipo: 'outros', data, horaInicio, duracao, titulo: nome };
  }, [tipoAtual, hospitalId, data, horaInicio, duracao, nome, blocoExistente]);

  const conflitos = useMemo(() => {
    if (tipoAtual !== 'plantao') return [];
    // Em modo editar, remove o bloco original do array antes de detectar —
    // senão o detector compara o novoBloco contra ele mesmo e gera SOBREPOSICAO falsa.
    const semOriginal = blocoExistente
      ? blocosAtuais.filter((b) => b.id !== blocoExistente.id)
      : blocosAtuais;
    return detectarConflitos([...semOriginal, novoBloco], hospitais).filter((c) =>
      c.a.id === novoBloco.id || c.b?.id === novoBloco.id,
    );
  }, [tipoAtual, novoBloco, blocosAtuais, hospitais, blocoExistente]);

  const podeSalvar = (tipoAtual !== 'plantao' || hospitalId) && duracao > 0;
  const ehPlantao = tipoAtual === 'plantao';
  // Sono não tem campo de texto no modelo · o chip já diz tudo.
  const mostraNome = !ehPlantao && tipoAtual !== 'sono';
  const titulo = ehPlantao
    ? modoEditar
      ? 'editar plantão'
      : 'novo plantão'
    : modoEditar
      ? 'editar compromisso'
      : 'outro compromisso';

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.18)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 20px',
        // conteúdo maior que a tela (preview + aviso de conflito em mobile)
        // rola dentro do overlay · senão os botões ficam inalcançáveis
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        animation: 'colo-fade-in 180ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          padding: '28px 32px',
          width: '100%',
          maxWidth: 520,
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Eyebrow>
            {ehPlantao ? 'plantão' : chipDe(tipoAtual).rotulo}
            {modoEditar ? ' · editar' : ''}
          </Eyebrow>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="fechar"
            style={{
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: 8,
              cursor: 'pointer',
              color: 'var(--ink-2)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 28,
            letterSpacing: '-0.015em',
            margin: '8px 0 6px',
          }}
        >
          {titulo}
        </h2>
        <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginBottom: 18 }}>
          {HAND_HINT[tipoAtual]}
        </Hand>

        {mostraNome && (
          <Field label="o que é">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={chipDe(tipoAtual).placeholder}
              style={input}
            />
          </Field>
        )}

        {!ehPlantao && (
          <Field label="identificar como">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CHIPS_TIPO.map((c) => {
                const ativo = c.tipo === tipoAtual;
                return (
                  <button
                    key={c.tipo}
                    type="button"
                    onClick={() => escolherChip(c)}
                    aria-pressed={ativo}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      font: '600 13px/1 var(--font-body)',
                      padding: '10px 14px',
                      minHeight: 40,
                      borderRadius: 999,
                      border: `1px solid ${ativo ? 'var(--ink)' : 'var(--line)'}`,
                      background: ativo ? 'var(--ink)' : 'var(--bg)',
                      color: ativo ? 'var(--bg)' : 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: `var(--${c.cor})`,
                      }}
                    />
                    {c.rotulo}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {tipoAtual === 'plantao' && (
          <Field label="hospital">
            <select
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
              style={input}
            >
              {hospitaisLista.length === 0 && <option value="">cadastra um hospital antes</option>}
              {hospitaisLista.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.abrev} · {h.nome}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="data">
            <DatePicker value={data} onChange={setData} />
          </Field>
          {tipoAtual === 'plantao' ? (
            <Field label="horário · h + duração">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={23.5}
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(clampHora(Number(e.target.value), 0, 23.5))}
                  style={{ ...input, flex: 1 }}
                  placeholder="h início"
                />
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={24}
                  value={duracao}
                  onChange={(e) => setDuracao(clampHora(Number(e.target.value), 0.5, 24))}
                  style={{ ...input, flex: 1 }}
                  placeholder="duração"
                />
              </div>
            </Field>
          ) : (
            <Field label="horário · início → fim">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={23.5}
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(clampHora(Number(e.target.value), 0, 23.5))}
                  style={{ ...input, flex: 1 }}
                  placeholder="início"
                />
                <span style={{ color: 'var(--ink-3)', font: '500 14px/1 var(--font-body)' }}>→</span>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={23.5}
                  value={horaFimDe(horaInicio, duracao)}
                  onChange={(e) => {
                    const fim = clampHora(Number(e.target.value), 0, 23.5);
                    setDuracao(duracaoDeInicioFim(horaInicio, fim));
                  }}
                  style={{ ...input, flex: 1 }}
                  placeholder="fim"
                />
              </div>
            </Field>
          )}
        </div>

        <Mono style={{ display: 'block', marginTop: 14, color: 'var(--ink-3)' }}>
          {fmtDate(data)} · {fmtRange(horaInicio, duracao)} · {duracao}h
        </Mono>

        {tipoAtual === 'plantao' && hospitalId && (
          <div style={{ marginTop: 14 }}>
            <JanelaPreview
              blocos={
                blocoExistente
                  ? blocosAtuais.filter((b) => b.id !== blocoExistente.id)
                  : blocosAtuais
              }
              hospitais={hospitais}
              novoBloco={novoBloco as BlocoPlantao}
            />
          </div>
        )}

        {conflitos.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              background: 'var(--coral-surface)',
              borderLeft: '3px solid var(--coral-ink)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <Eyebrow color="var(--coral-ink)">vai gerar conflito</Eyebrow>
            <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
              {conflitos.map((c, i) => (
                <li key={i}>
                  <Pill kind="err" dot={false} style={{ marginRight: 6 }}>
                    {c.tipo.replace('_', ' ')}
                  </Pill>
                  {c.detalhe}
                </li>
              ))}
            </ul>
            <Mono style={{ display: 'block', marginTop: 8, color: 'var(--coral-ink)' }}>
              dá pra salvar mesmo assim · resolve depois.
            </Mono>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 22,
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onSalvar(novoBloco)}
              disabled={!podeSalvar}
              style={{
                font: '600 13px/1 var(--font-body)',
                padding: '12px 22px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--ink)',
                color: 'var(--bg)',
                cursor: podeSalvar ? 'pointer' : 'not-allowed',
                opacity: podeSalvar ? 1 : 0.5,
              }}
            >
              {modoEditar ? 'salvar alterações' : 'adicionar'}
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
          {modoEditar && onRemover && (
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
              remover da agenda
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 14px/1.4 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--font-body)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}
