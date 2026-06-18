import { useReducer, useState } from 'react';
import { LADO_DE, apelidoDe } from './data';
import { organizarPorFluidez } from './fluidez';
import { PrimeiroNome } from './components/PrimeiroNome';
import { Sobrenomes } from './components/Sobrenomes';
import { Ordem } from './components/Ordem';
import { NomeMontado } from './components/NomeMontado';
import { Contadores } from './components/Contadores';
import { Dicas } from './components/Dicas';

interface State {
  primeiroNome: string;
  /** Nome do chip atualmente realçado; null quando o nome foi digitado. */
  nomeSelecionadoId: string | null;
  /** Sobrenomes escolhidos, na ordem montada. */
  ordem: string[];
}

const INICIAL: State = { primeiroNome: '', nomeSelecionadoId: null, ordem: [] };

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
      // Clicar de novo no nome já selecionado limpa a escolha.
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

export default function App() {
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
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header className="mb-8 text-center">
        <h1 className="text-lg font-medium text-ink">Montador de nome</h1>
        <p className="mt-1 text-sm text-muted">
          Combine um primeiro nome com os sobrenomes das duas famílias.
        </p>
      </header>

      <div className="space-y-8">
        <NomeMontado
          nomeCompleto={nomeCompleto}
          apelido={apelido}
          copiado={copiado}
          onCopiar={copiar}
        />

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

        {total > 0 && (
          <section aria-labelledby="ordem-titulo" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="ordem-titulo" className="text-sm font-medium text-muted">
                Ordem
              </h2>
              <button
                type="button"
                onClick={() => dispatch({ type: 'fluidez' })}
                disabled={total < 2}
                className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink transition-colors hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Organizar por fluidez
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

        <footer className="border-t border-line pt-6">
          <button
            type="button"
            onClick={limpar}
            className="rounded text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            Limpar tudo
          </button>
        </footer>
      </div>
    </div>
  );
}
