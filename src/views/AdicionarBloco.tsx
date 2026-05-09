import { useEffect, useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import type { AddTipo } from '@/components/shell';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { JanelaPreview } from '@/components/preview';
import { detectarConflitos, fmtDate, fmtRange } from '@/lib/data';

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
  const hojeISO = dataInicial ?? new Date().toISOString().slice(0, 10);

  const hospitaisLista = Object.values(hospitais);
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
  const [setor, setSetor] = useState(
    blocoExistente?.tipo === 'plantao' ? blocoExistente.setor : '',
  );
  const [titulo, setTitulo] = useState(
    blocoExistente?.tipo === 'estudo' ||
      blocoExistente?.tipo === 'pessoal' ||
      blocoExistente?.tipo === 'outros'
      ? blocoExistente.titulo ?? ''
      : '',
  );
  const [motivo, setMotivo] = useState(
    blocoExistente?.tipo === 'bloqueio' ? blocoExistente.motivo ?? '' : '',
  );
  const [local, setLocal] = useState(
    blocoExistente?.tipo === 'consulta' ? blocoExistente.local ?? '' : '',
  );

  // Atalho · setor segue o primeiro do hospital escolhido se ainda vazio
  useEffect(() => {
    if (tipo !== 'plantao') return;
    const hosp = hospitais[hospitalId];
    if (hosp && !setor && hosp.setores[0]) setSetor(hosp.setores[0]);
  }, [hospitalId, tipo, hospitais, setor]);

  const novoBloco: Bloco = useMemo(() => {
    const id = blocoExistente?.id ?? `manual-${Date.now()}`;
    if (tipo === 'plantao') {
      return {
        id,
        tipo: 'plantao',
        hospitalId,
        data,
        horaInicio,
        duracao,
        setor: setor || hospitais[hospitalId]?.setores[0] || '',
      };
    }
    if (tipo === 'sono') return { id, tipo: 'sono', data, horaInicio, duracao };
    if (tipo === 'bloqueio') return { id, tipo: 'bloqueio', data, horaInicio, duracao, motivo };
    if (tipo === 'consulta') return { id, tipo: 'consulta', data, horaInicio, duracao, local };
    if (tipo === 'estudo') return { id, tipo: 'estudo', data, horaInicio, duracao, titulo };
    if (tipo === 'pessoal') return { id, tipo: 'pessoal', data, horaInicio, duracao, titulo };
    return { id, tipo: 'outros', data, horaInicio, duracao, titulo };
  }, [tipo, hospitalId, data, horaInicio, duracao, setor, motivo, local, titulo, hospitais, blocoExistente]);

  const conflitos = useMemo(() => {
    if (tipo !== 'plantao') return [];
    return detectarConflitos([...blocosAtuais, novoBloco], hospitais).filter((c) =>
      c.a.id === novoBloco.id || c.b?.id === novoBloco.id,
    );
  }, [tipo, novoBloco, blocosAtuais, hospitais]);

  const podeSalvar =
    (tipo !== 'plantao' || (hospitalId && setor.length > 0)) && duracao > 0;

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
          <Eyebrow>{modoEditar ? `editar · ${tipo}` : tipo}</Eyebrow>
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
          {(modoEditar ? TITULO_EDITAR : TITULO_CRIAR)[tipo]}
        </h2>
        <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginBottom: 18 }}>
          {HAND_HINT[tipo]}
        </Hand>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="data">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              style={input}
            />
          </Field>
          <Field label={tipo === 'bloqueio' ? 'duração (h)' : 'horário'}>
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

        {tipo === 'plantao' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
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
            <Field label="setor">
              <input
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                placeholder="UTI Pediátrica"
                style={input}
                list="setores-sugeridos"
              />
              <datalist id="setores-sugeridos">
                {(hospitais[hospitalId]?.setores ?? []).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>
        )}

        {tipo === 'bloqueio' && (
          <Field label="motivo (opcional)">
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="aniversário · viagem · descanso"
              style={input}
            />
          </Field>
        )}

        {tipo === 'consulta' && (
          <Field label="local">
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="consultório centro"
              style={input}
            />
          </Field>
        )}

        {(tipo === 'estudo' || tipo === 'pessoal' || tipo === 'outros') && (
          <Field label="título">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === 'estudo' ? 'curso de UTI neonatal' : 'reunião · jantar · etc'}
              style={input}
            />
          </Field>
        )}

        <Mono style={{ display: 'block', marginTop: 14, color: 'var(--ink-3)' }}>
          {fmtDate(data)} · {fmtRange(horaInicio, duracao)} · {duracao}h
        </Mono>

        {tipo === 'plantao' && hospitalId && (
          <div style={{ marginTop: 14 }}>
            <JanelaPreview
              blocos={blocosAtuais}
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
