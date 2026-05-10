import { useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import type { AddTipo } from '@/components/shell';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
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

const TITULO_CRIAR: Record<AddTipo, string> = {
  plantao: 'novo plantão',
  sono: 'janela de sono',
  bloqueio: 'dia bloqueado',
  consulta: 'consulta',
  estudo: 'estudo / curso',
  pessoal: 'compromisso pessoal',
  outros: 'outro evento',
};

const TITULO_EDITAR: Record<AddTipo, string> = {
  plantao: 'editar plantão',
  sono: 'editar janela de sono',
  bloqueio: 'editar bloqueio',
  consulta: 'editar consulta',
  estudo: 'editar estudo',
  pessoal: 'editar compromisso',
  outros: 'editar evento',
};

const ROTULO_TIPO: Record<Exclude<AddTipo, 'plantao'>, string> = {
  sono: 'sono',
  bloqueio: 'bloqueio',
  consulta: 'consulta',
  estudo: 'estudo',
  pessoal: 'pessoal',
  outros: 'outros',
};

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
  sono: 'janela protegida',
  bloqueio: 'sem agenda',
  consulta: 'consultório ou ambulatório',
  estudo: 'curso, congresso, aula',
  pessoal: 'fora da medicina',
  outros: 'qualquer outro evento',
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
  // Em modo editar não-plantão, tipo é mutável (select). Plantão sempre fixo.
  const [tipoAtual, setTipoAtual] = useState<AddTipo>(tipo);
  const [data, setData] = useState(blocoExistente?.data ?? hojeISO);
  const [horaInicio, setHoraInicio] = useState(
    blocoExistente?.horaInicio ?? (tipo === 'plantao' ? 7 : tipo === 'sono' ? 22 : 19),
  );
  const [duracao, setDuracao] = useState(
    blocoExistente?.duracao ?? (tipo === 'sono' ? 8 : tipo === 'bloqueio' ? 24 : 12),
  );
  const [hospitalId, setHospitalId] = useState(
    blocoExistente?.tipo === 'plantao' ? blocoExistente.hospitalId : hospitaisLista[0]?.id ?? '',
  );
  const [nome, setNome] = useState(blocoExistente ? nomeDoBloco(blocoExistente) : '');

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
  const mostraNome = tipoAtual !== 'plantao' && tipoAtual !== 'sono';
  const placeholderNome =
    tipoAtual === 'bloqueio'
      ? 'aniversário · viagem · descanso'
      : tipoAtual === 'consulta'
      ? 'consultório centro'
      : tipoAtual === 'estudo'
      ? 'curso de UTI neonatal'
      : 'reunião · jantar · etc';
  const mostraSelectTipo = modoEditar && tipoAtual !== 'plantao';

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
          <Eyebrow>{modoEditar ? `editar · ${tipoAtual}` : tipoAtual}</Eyebrow>
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
          {(modoEditar ? TITULO_EDITAR : TITULO_CRIAR)[tipoAtual]}
        </h2>
        <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginBottom: 18 }}>
          {HAND_HINT[tipoAtual]}
        </Hand>

        {mostraNome && (
          <Field label="nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={placeholderNome}
              style={input}
            />
          </Field>
        )}

        {mostraSelectTipo && (
          <Field label="tipo">
            <select
              value={tipoAtual}
              onChange={(e) => setTipoAtual(e.target.value as AddTipo)}
              style={input}
            >
              {(Object.keys(ROTULO_TIPO) as Array<keyof typeof ROTULO_TIPO>).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
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
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              style={input}
            />
          </Field>
          <Field label={tipoAtual === 'bloqueio' ? 'duração (h)' : 'horário'}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                step="0.5"
                min={0}
                max={24}
                value={horaInicio}
                onChange={(e) => setHoraInicio(Number(e.target.value))}
                style={{ ...input, flex: 1 }}
                placeholder="h início"
              />
              <input
                type="number"
                step="0.5"
                min={0.5}
                max={24}
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value))}
                style={{ ...input, flex: 1 }}
                placeholder="duração"
              />
            </div>
          </Field>
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
