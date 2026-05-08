import { useState } from 'react';
import type { CorFamilia, Hospital, HospitaisMap, TipoHospital } from '@/types';
import { Eyebrow, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface HospitaisProps {
  hospitais: HospitaisMap;
  onSalvar: (id: string, h: Hospital) => void;
  onRemover: (id: string) => void;
}

const CORES: CorFamilia[] = ['sand', 'blue', 'coral', 'aqua', 'sage', 'olive', 'lavender', 'pink'];

export function Hospitais({ hospitais, onSalvar, onRemover }: HospitaisProps) {
  const [editando, setEditando] = useState<Hospital | null>(null);
  const [criando, setCriando] = useState(false);

  if (editando || criando) {
    return (
      <HospitalForm
        inicial={editando}
        coresUsadas={Object.values(hospitais).map((h) => h.cor)}
        onSalvar={(h) => {
          onSalvar(h.id, h);
          setEditando(null);
          setCriando(false);
        }}
        onCancelar={() => {
          setEditando(null);
          setCriando(false);
        }}
        onRemover={editando ? () => {
          onRemover(editando.id);
          setEditando(null);
        } : undefined}
      />
    );
  }

  const lista = Object.values(hospitais);

  return (
    <>
      <PageHead
        eyebrow="seus hospitais"
        titulo={lista.length === 0 ? 'nenhum cadastrado.' : `${lista.length} hospitais.`}
        hand="cor + regras + valor são por hospital · cada um na sua família."
        direita={
          <button
            type="button"
            onClick={() => setCriando(true)}
            style={{
              font: '600 13px/1 var(--font-body)',
              padding: '12px 20px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
              cursor: 'pointer',
            }}
          >
            cadastrar hospital
          </button>
        }
      />

      {lista.length === 0 ? (
        <EmptyState
          titulo="comece pelo principal."
          recado="o hospital onde você passa mais plantões · depois adiciona os outros."
          acao={{ label: 'cadastrar primeiro', onClick: () => setCriando(true) }}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {lista.map((h) => (
            <button
              type="button"
              key={h.id}
              onClick={() => setEditando(h)}
              style={{
                background: `var(--${h.cor}-surface)`,
                borderLeft: `4px solid var(--${h.cor})`,
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: '18px 20px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Eyebrow color={`var(--${h.cor}-ink)`}>{h.abrev}</Eyebrow>
                <Pill kind={h.tipo === 'publico' ? 'info' : 'neutral'}>{h.tipo}</Pill>
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 22,
                  letterSpacing: '-0.005em',
                  margin: 0,
                  color: 'var(--ink)',
                }}
              >
                {h.nome}
              </p>
              <Mono style={{ color: 'var(--ink-3)' }}>
                R$ {(h.valorPlantao ?? 0).toLocaleString('pt-BR')} · até {h.regras.maxPorSemana}/sem
              </Mono>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

interface FormProps {
  inicial: Hospital | null;
  coresUsadas: CorFamilia[];
  onSalvar: (h: Hospital) => void;
  onCancelar: () => void;
  onRemover?: () => void;
}

function HospitalForm({ inicial, coresUsadas, onSalvar, onCancelar, onRemover }: FormProps) {
  const [draft, setDraft] = useState<Hospital>(
    inicial ?? {
      id: `H-${Date.now()}`.slice(0, 12),
      nome: '',
      abrev: '',
      cor: CORES.find((c) => !coresUsadas.includes(c)) ?? 'lavender',
      tipo: 'publico',
      valorPlantao: 1800,
      adicionalNoite: 200,
      setores: [],
      regras: {
        maxPorSemana: 2,
        minFimDeSemana: 0,
        intervaloMinHoras: 11,
        duracaoPlantao: 12,
        janelas: ['07:00–19:00', '19:00–07:00'],
        maxPorMes: 8,
      },
    },
  );

  function setCampo<K extends keyof Hospital>(k: K, v: Hospital[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function setRegra<K extends keyof Hospital['regras']>(k: K, v: Hospital['regras'][K]) {
    setDraft((d) => ({ ...d, regras: { ...d.regras, [k]: v } }));
  }

  const valido = draft.nome.trim().length > 0 && draft.abrev.trim().length > 0;

  return (
    <>
      <button
        type="button"
        onClick={onCancelar}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-2)',
          font: '500 13px/1 var(--font-body)',
          marginBottom: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: 0,
        }}
      >
        ← voltar pra lista
      </button>

      <PageHead
        eyebrow={inicial ? 'editando' : 'novo hospital'}
        titulo={inicial ? draft.nome || 'sem nome' : 'cadastrar hospital'}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) onSalvar(draft);
        }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 720 }}
      >
        <Field label="nome">
          <input
            value={draft.nome}
            onChange={(e) => setCampo('nome', e.target.value)}
            placeholder="Hospital Santa Lúcia"
            style={input}
          />
        </Field>
        <Field label="abreviação">
          <input
            value={draft.abrev}
            onChange={(e) => setCampo('abrev', e.target.value.toUpperCase())}
            placeholder="HSL"
            style={input}
          />
        </Field>
        <Field label="tipo">
          <select
            value={draft.tipo}
            onChange={(e) => setCampo('tipo', e.target.value as TipoHospital)}
            style={input}
          >
            <option value="publico">público</option>
            <option value="privado">privado</option>
          </select>
        </Field>
        <Field label="cor da família">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CORES.map((c) => {
              const ativo = c === draft.cor;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCampo('cor', c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    border: ativo ? `2px solid var(--ink)` : `2px solid transparent`,
                    background: `var(--${c})`,
                    cursor: 'pointer',
                  }}
                  aria-label={c}
                />
              );
            })}
          </div>
        </Field>
        <Field label="valor / plantão (R$)">
          <input
            type="number"
            value={draft.valorPlantao}
            onChange={(e) => setCampo('valorPlantao', Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label="adicional noturno (R$)">
          <input
            type="number"
            value={draft.adicionalNoite}
            onChange={(e) => setCampo('adicionalNoite', Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label="máx por semana">
          <input
            type="number"
            value={draft.regras.maxPorSemana}
            onChange={(e) => setRegra('maxPorSemana', Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label="máx por mês">
          <input
            type="number"
            value={draft.regras.maxPorMes}
            onChange={(e) => setRegra('maxPorMes', Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label="descanso mínimo (h)">
          <input
            type="number"
            value={draft.regras.intervaloMinHoras}
            onChange={(e) => setRegra('intervaloMinHoras', Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label="finais de semana mínimos">
          <input
            type="number"
            value={draft.regras.minFimDeSemana}
            onChange={(e) => setRegra('minFimDeSemana', Number(e.target.value))}
            style={input}
          />
        </Field>

        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="submit"
            disabled={!valido}
            style={{
              font: '600 13px/1 var(--font-body)',
              padding: '12px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
              cursor: 'pointer',
              opacity: valido ? 1 : 0.5,
            }}
          >
            {inicial ? 'salvar' : 'criar hospital'}
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
          <span style={{ flex: 1 }} />
          {onRemover && (
            <button
              type="button"
              onClick={() => {
                if (confirm('remover este hospital? plantões antigos vão perder a cor e a regra.')) {
                  onRemover();
                }
              }}
              style={{
                font: '600 13px/1 var(--font-body)',
                padding: '12px 22px',
                borderRadius: 999,
                border: '1px solid var(--coral)',
                background: 'transparent',
                color: 'var(--coral-ink)',
                cursor: 'pointer',
              }}
            >
              remover hospital
            </button>
          )}
        </div>
      </form>
    </>
  );
}

const input: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 14px/1.3 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}
