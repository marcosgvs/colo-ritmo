import { useReducer, useState, type CSSProperties } from 'react';
import { LADO_DE, apelidoDe } from './data';
import { organizarPorFluidez } from './fluidez';
import { NomeMontado } from './components/NomeMontado';
import { Ordem } from './components/Ordem';
import { Dicas } from './components/Dicas';
import { PrimeiroNome } from './components/PrimeiroNome';
import { Sobrenomes } from './components/Sobrenomes';
import { Contadores } from './components/Contadores';
import { Eyebrow } from '@/components/atoms/Eyebrow';
import { ColoMark } from '@/components/atoms/ColoMark';

interface State {
  primeiroNome: string;
  /** Nome do chip realçado; null quando o nome foi digitado. */
  nomeSelecionadoId: string | null;
  /** Sobrenomes escolhidos, na ordem montada. */
  ordem: string[];
}

const INICIAL: State = { primeiroNome: '', nomeSelecionadoId: null, ordem: [] };

type Action =
  | { type: 'selecionarNome'; nome: string }
  | { type: 'digitarNome'; texto: string }
  | { type: 'toggleSobrenome'; nome: string }
  | { type: 'removerSobrenome'; nome: string }
  | { type: 'reordenar'; ordem: string[] }
  | { type: 'fluidez' }
  | { type: 'limpar' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'selecionarNome':
      return state.nomeSelecionadoId === action.nome
        ? { ...state, primeiroNome: '', nomeSelecionadoId: null }
        : { ...state, primeiroNome: action.nome, nomeSelecionadoId: action.nome };
    case 'digitarNome':
      return { ...state, primeiroNome: action.texto, nomeSelecionadoId: null };
    case 'toggleSobrenome':
      return {
        ...state,
        ordem: state.ordem.includes(action.nome)
          ? state.ordem.filter((n) => n !== action.nome)
          : [...state.ordem, action.nome],
      };
    case 'removerSobrenome':
      return { ...state, ordem: state.ordem.filter((n) => n !== action.nome) };
    case 'reordenar':
      return { ...state, ordem: action.ordem };
    case 'fluidez':
      return { ...state, ordem: organizarPorFluidez(state.ordem) };
    case 'limpar':
      return INICIAL;
  }
}

/** Fallback de cópia para quando a Clipboard API não está disponível. */
function copiarFallback(texto: string): boolean {
  const area = document.createElement('textarea');
  area.value = texto;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

const botaoGhost: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 999,
  border: '1px solid var(--line-2)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  font: '600 14px/1 var(--font-body)',
  cursor: 'pointer',
  transition: 'border-color 140ms ease, opacity 140ms ease',
};

export function App() {
  const [state, dispatch] = useReducer(reducer, INICIAL);
  const [copiado, setCopiado] = useState(false);

  const nomeCompleto = [state.primeiroNome.trim(), ...state.ordem].filter(Boolean).join(' ');
  const apelido = apelidoDe(state.primeiroNome);
  const total = state.ordem.length;
  const lado1 = state.ordem.filter((n) => LADO_DE[n] === 1).length;
  const lado2 = state.ordem.filter((n) => LADO_DE[n] === 2).length;

  async function copiar() {
    if (!nomeCompleto) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(nomeCompleto);
      ok = true;
    } catch {
      ok = copiarFallback(nomeCompleto);
    }
    if (!ok) return;
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1600);
  }

  function limpar() {
    dispatch({ type: 'limpar' });
    setCopiado(false);
  }

  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: 'clamp(28px, 6vw, 56px) clamp(20px, 5vw, 32px) 64px',
        animation: 'colo-page-in 240ms ease both',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: 28 }}>
        <span style={{ font: '700 24px/1 var(--font-handwritten)', color: 'var(--lavender-ink)' }}>
          baby marley
        </span>
        <h1
          style={{
            marginTop: 8,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(26px, 6vw, 36px)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}
        >
          um nome pra ela
        </h1>
        <p style={{ marginTop: 10, font: '400 16px/1.5 var(--font-body)', color: 'var(--ink-2)' }}>
          combine um primeiro nome com os sobrenomes das duas famílias e arraste pra achar o que soa
          melhor.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 32 }}>
        <NomeMontado
          nomeCompleto={nomeCompleto}
          apelido={apelido}
          copiado={copiado}
          onCopiar={copiar}
        />

        {total > 0 && (
          <section aria-labelledby="ordem-titulo" style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Eyebrow style={{ display: 'block' }}>
                <span id="ordem-titulo">ordem</span>
              </Eyebrow>
              <button
                type="button"
                onClick={() => dispatch({ type: 'fluidez' })}
                disabled={total < 2}
                style={{
                  ...botaoGhost,
                  cursor: total < 2 ? 'not-allowed' : 'pointer',
                  opacity: total < 2 ? 0.45 : 1,
                }}
              >
                organizar por fluidez
              </button>
            </div>

            <Ordem
              ordem={state.ordem}
              onReordenar={(ordem) => dispatch({ type: 'reordenar', ordem })}
              onRemover={(nome) => dispatch({ type: 'removerSobrenome', nome })}
            />

            <Contadores total={total} lado1={lado1} lado2={lado2} />
          </section>
        )}

        <Dicas
          temPrimeiroNome={state.primeiroNome.trim().length > 0}
          totalSobrenomes={total}
          lado1={lado1}
          lado2={lado2}
        />

        <PrimeiroNome
          valor={state.primeiroNome}
          nomeSelecionadoId={state.nomeSelecionadoId}
          onSelecionar={(nome) => dispatch({ type: 'selecionarNome', nome })}
          onDigitar={(texto) => dispatch({ type: 'digitarNome', texto })}
        />

        <Sobrenomes
          ordem={state.ordem}
          onToggle={(nome) => dispatch({ type: 'toggleSobrenome', nome })}
        />

        <footer
          style={{
            marginTop: 8,
            paddingTop: 24,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <button
            type="button"
            onClick={limpar}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              font: '500 14px/1 var(--font-body)',
              color: 'var(--ink-3)',
              cursor: 'pointer',
            }}
          >
            limpar tudo
          </button>
          <span style={{ opacity: 0.55 }} title="feito com o design system da colo">
            <ColoMark size={16} />
          </span>
        </footer>
      </div>
    </main>
  );
}
