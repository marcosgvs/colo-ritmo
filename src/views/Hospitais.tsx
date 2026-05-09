import { useMemo, useRef, useState } from 'react';
import type {
  CorFamilia,
  EnderecoHospital,
  Hospital,
  HospitaisMap,
  Janela,
  TipoHospital,
} from '@/types';
import { buscarCep, geocodificar } from '@/lib/geo';
import {
  buscarSugestoesHospitais,
  type SugestaoHospital,
} from '@/lib/hospitaisBrasilia';
import { Eyebrow, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

const JANELAS_DEFAULT: Janela[] = [
  { rotulo: 'manhã', inicio: 7, duracao: 6 },
  { rotulo: 'tarde', inicio: 13, duracao: 6 },
  { rotulo: 'noitinha', inicio: 19, duracao: 5 },
  { rotulo: 'noite', inicio: 19, duracao: 12 },
];

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
      valorPlantao: 0,
      valorFixo: 0,
      adicionalNoite: 200,
      regras: {
        maxPorSemana: 2,
        minFimDeSemana: 0,
        intervaloMinHoras: 11,
        duracaoPlantao: 12,
        janelas: [],
        maxPorMes: 8,
      },
      janelas: JANELAS_DEFAULT,
      observacoes: '',
    },
  );

  const [enderecoAberto, setEnderecoAberto] = useState(false);
  const ehPublico = draft.tipo === 'publico';

  function setJanelas(novas: Janela[]) {
    setDraft((d) => ({ ...d, janelas: novas }));
  }

  // Autocomplete por nome contra a lista curada de Brasília + entorno
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const fechaSugestoesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sugestoes = useMemo(
    () => (sugestoesAbertas ? buscarSugestoesHospitais(draft.nome) : []),
    [draft.nome, sugestoesAbertas],
  );

  function setCampo<K extends keyof Hospital>(k: K, v: Hospital[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function setRegra<K extends keyof Hospital['regras']>(k: K, v: Hospital['regras'][K]) {
    setDraft((d) => ({ ...d, regras: { ...d.regras, [k]: v } }));
  }

  function selecionarSugestao(s: SugestaoHospital) {
    setDraft((d) => ({
      ...d,
      nome: s.nome,
      // Se ela já digitou uma abreviação custom, respeita; senão usa a sugerida
      abrev: d.abrev.trim() ? d.abrev : s.abrev,
      tipo: s.tipo,
      endereco: {
        cep: s.endereco.cep ?? '',
        logradouro: s.endereco.logradouro,
        bairro: s.endereco.bairro,
        cidade: s.endereco.cidade,
        uf: s.endereco.uf,
        lat: s.endereco.lat,
        lng: s.endereco.lng,
      },
    }));
    setSugestoesAbertas(false);
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
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valido) return;
          // Tenta auto-localizar pelo nome se ainda sem coordenadas.
          const semGeo =
            !draft.endereco || draft.endereco.lat === undefined || draft.endereco.lng === undefined;
          if (semGeo && draft.nome.trim()) {
            const r = await geocodificar(draft.nome.trim());
            if (r) {
              const e2 = draft.endereco ?? {
                cep: '', logradouro: '', bairro: '', cidade: '', uf: '',
              };
              onSalvar({ ...draft, endereco: { ...e2, lat: r.lat, lng: r.lng } });
              return;
            }
          }
          onSalvar(draft);
        }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 720 }}
      >
        <Field label="nome">
          <div style={{ position: 'relative' }}>
            <input
              value={draft.nome}
              onChange={(e) => {
                setCampo('nome', e.target.value);
                setSugestoesAbertas(true);
              }}
              onFocus={() => setSugestoesAbertas(true)}
              onBlur={() => {
                // Delay pequeno pra permitir click numa sugestão antes de fechar
                fechaSugestoesTimer.current = setTimeout(
                  () => setSugestoesAbertas(false),
                  150,
                );
              }}
              placeholder="começa a digitar · sugiro hospitais de Brasília"
              autoComplete="off"
              style={{ ...input, width: '100%' }}
            />
            {sugestoesAbertas && sugestoes.length > 0 && (
              <ul
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  listStyle: 'none',
                  margin: 0,
                  padding: 6,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-md)',
                  boxShadow: 'var(--shadow-lg)',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {sugestoes.map((s) => (
                  <li key={`${s.abrev}-${s.endereco.cidade}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        // mousedown antes do blur — evita perder o click
                        e.preventDefault();
                        if (fechaSugestoesTimer.current) {
                          clearTimeout(fechaSugestoesTimer.current);
                        }
                        selecionarSugestao(s);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--r-sm)',
                        cursor: 'pointer',
                        color: 'var(--ink)',
                        font: '500 13px/1.3 var(--font-body)',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'var(--bg-alt)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{s.nome}</div>
                      <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                        {s.endereco.bairro} · {s.endereco.cidade} · {s.endereco.uf}
                      </Mono>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
        {ehPublico ? (
          <Field label="valor fixo mensal (R$)">
            <input
              type="number"
              value={draft.valorFixo ?? 0}
              onChange={(e) => setCampo('valorFixo', Number(e.target.value))}
              placeholder="contrato CLT · independente das horas"
              style={input}
            />
          </Field>
        ) : (
          <Field label="valor por hora (R$)">
            <input
              type="number"
              value={draft.valorHora ?? 0}
              onChange={(e) => setCampo('valorHora', Number(e.target.value))}
              placeholder="ex: 150"
              style={input}
            />
          </Field>
        )}
        <Field label="adicional noturno (R$)">
          <input
            type="number"
            value={draft.adicionalNoite}
            onChange={(e) => setCampo('adicionalNoite', Number(e.target.value))}
            style={input}
          />
        </Field>
        <Field label={ehPublico ? 'máx plantões por semana' : 'máx por semana'}>
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
        <Field label={ehPublico ? 'fins-de-semana obrigatórios / mês' : 'finais de semana mínimos'}>
          <input
            type="number"
            value={draft.regras.minFimDeSemana}
            onChange={(e) => setRegra('minFimDeSemana', Number(e.target.value))}
            style={input}
          />
        </Field>

        <div style={{ gridColumn: '1 / -1' }}>
          <BlocoJanelas
            janelas={draft.janelas ?? JANELAS_DEFAULT}
            onChange={setJanelas}
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="observações (opcional)">
            <textarea
              value={draft.observacoes ?? ''}
              onChange={(e) => setCampo('observacoes', e.target.value)}
              placeholder="ex: feriado conta dobrado · mês de jul tem semana de férias · plantão de sábado paga +30%"
              rows={3}
              style={{
                ...input,
                width: '100%',
                resize: 'vertical',
                fontFamily: 'var(--font-body)',
              }}
            />
          </Field>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          {enderecoAberto ? (
            <BlocoEndereco
              endereco={draft.endereco}
              onChange={(end) => setDraft((d) => ({ ...d, endereco: end }))}
              nomeHospital={draft.nome}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEnderecoAberto(true)}
              style={{
                font: '500 13px/1 var(--font-body)',
                padding: '10px 14px',
                borderRadius: 'var(--r-md)',
                border: '1px dashed var(--line-2)',
                background: 'transparent',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {draft.endereco?.logradouro
                ? `endereço · ${draft.endereco.bairro || draft.endereco.cidade || 'preenchido'} (clica pra editar)`
                : '+ adicionar endereço (opcional · ajuda no cálculo de deslocamento)'}
            </button>
          )}
        </div>

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

function BlocoJanelas({
  janelas,
  onChange,
}: {
  janelas: Janela[];
  onChange: (j: Janela[]) => void;
}) {
  function setItem(i: number, patch: Partial<Janela>) {
    onChange(janelas.map((j, idx) => (idx === i ? { ...j, ...patch } : j)));
  }
  function remover(i: number) {
    onChange(janelas.filter((_, idx) => idx !== i));
  }
  function adicionar() {
    onChange([...janelas, { rotulo: 'novo', inicio: 7, duracao: 6 }]);
  }
  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <Eyebrow>turnos</Eyebrow>
        <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
          edite ou adicione conforme a escala do hospital
        </Mono>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {janelas.map((j, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 90px 36px',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <input
              value={j.rotulo}
              onChange={(e) => setItem(i, { rotulo: e.target.value })}
              placeholder="rótulo"
              style={input}
            />
            <input
              type="number"
              step="0.5"
              min={0}
              max={23.5}
              value={j.inicio}
              onChange={(e) => setItem(i, { inicio: Number(e.target.value) })}
              placeholder="início"
              style={input}
            />
            <input
              type="number"
              step="0.5"
              min={0.5}
              max={24}
              value={j.duracao}
              onChange={(e) => setItem(i, { duracao: Number(e.target.value) })}
              placeholder="duração (h)"
              style={input}
            />
            <button
              type="button"
              onClick={() => remover(i)}
              aria-label="remover turno"
              title="remover turno"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                border: '1px solid var(--line)',
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
        ))}
      </div>
      <button
        type="button"
        onClick={adicionar}
        style={{
          marginTop: 10,
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px dashed var(--line-2)',
          background: 'transparent',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}
      >
        + adicionar turno
      </button>
    </div>
  );
}

interface BlocoEnderecoProps {
  endereco: EnderecoHospital | undefined;
  onChange: (e: EnderecoHospital | undefined) => void;
  nomeHospital: string;
}

function BlocoEndereco({ endereco, onChange, nomeHospital }: BlocoEnderecoProps) {
  const [estado, setEstado] = useState<'parado' | 'buscando-cep' | 'erro'>('parado');
  const [erro, setErro] = useState<string | null>(null);
  void nomeHospital;

  const e: EnderecoHospital = endereco ?? {
    cep: '', logradouro: '', bairro: '', cidade: '', uf: '',
  };

  function setCampo<K extends keyof EnderecoHospital>(k: K, v: EnderecoHospital[K]) {
    onChange({ ...e, [k]: v });
  }

  async function lookupCep() {
    if (!e.cep || e.cep.replace(/\D/g, '').length !== 8) return;
    setEstado('buscando-cep');
    setErro(null);
    try {
      const r = await buscarCep(e.cep);
      if (!r) {
        setEstado('erro');
        setErro('cep não encontrado');
        return;
      }
      onChange({
        ...e,
        cep: r.cepFormatado,
        logradouro: r.logradouro,
        bairro: r.bairro,
        cidade: r.cidade,
        uf: r.uf,
      });
      setEstado('parado');
    } catch (err) {
      setEstado('erro');
      setErro((err as Error).message);
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        borderRadius: 'var(--r-md)',
        padding: '16px 18px',
        marginTop: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Eyebrow>endereço (opcional)</Eyebrow>
        <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
          ajuda no cálculo de deslocamento
        </Mono>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginTop: 10 }}>
        <Field label="cep">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={e.cep}
              onChange={(ev) => setCampo('cep', ev.target.value)}
              onBlur={lookupCep}
              placeholder="70335-000"
              style={{ ...input, flex: 1 }}
            />
            <button
              type="button"
              onClick={lookupCep}
              disabled={estado === 'buscando-cep'}
              style={{
                font: '600 12px/1 var(--font-body)',
                padding: '0 14px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--ink-2)',
                cursor: 'pointer',
              }}
            >
              {estado === 'buscando-cep' ? '…' : 'buscar'}
            </button>
          </div>
        </Field>
        <Field label="logradouro">
          <input
            value={e.logradouro}
            onChange={(ev) => setCampo('logradouro', ev.target.value)}
            placeholder="SMHN Quadra 1, Conjunto A"
            style={input}
          />
        </Field>
        <Field label="bairro">
          <input
            value={e.bairro}
            onChange={(ev) => setCampo('bairro', ev.target.value)}
            style={input}
          />
        </Field>
        <Field label="cidade · uf">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={e.cidade}
              onChange={(ev) => setCampo('cidade', ev.target.value)}
              style={{ ...input, flex: 2 }}
            />
            <input
              value={e.uf}
              onChange={(ev) => setCampo('uf', ev.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              style={{ ...input, flex: 1, textAlign: 'center' }}
            />
          </div>
        </Field>
      </div>

      {erro && (
        <Mono style={{ color: 'var(--coral-ink)', display: 'block', marginTop: 10 }}>
          {erro}
        </Mono>
      )}
    </div>
  );
}
