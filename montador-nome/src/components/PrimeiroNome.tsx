import { CATEGORIAS } from '../data';

interface Props {
  valor: string;
  nomeSelecionadoId: string | null;
  onSelecionar: (nome: string) => void;
  onDigitar: (texto: string) => void;
}

export function PrimeiroNome({ valor, nomeSelecionadoId, onSelecionar, onDigitar }: Props) {
  return (
    <section aria-labelledby="primeiro-nome-titulo" className="space-y-4">
      <h2 id="primeiro-nome-titulo" className="text-sm font-medium text-muted">
        Primeiro nome
      </h2>

      <div className="space-y-4">
        {CATEGORIAS.map((cat) => (
          <div key={cat.titulo} className="space-y-2">
            <p className="text-xs text-muted">{cat.titulo}</p>
            <div className="flex flex-wrap gap-2">
              {cat.nomes.map((n) => {
                const ativo = nomeSelecionadoId === n.nome;
                return (
                  <button
                    key={n.nome}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => onSelecionar(n.nome)}
                    className={[
                      'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30',
                      ativo
                        ? 'border-ink bg-ink text-paper'
                        : 'border-line bg-white text-ink hover:border-ink/40',
                    ].join(' ')}
                  >
                    {n.nome}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">Ou digite um nome</span>
        <input
          type="text"
          value={valor}
          onChange={(e) => onDigitar(e.target.value)}
          placeholder="ou digite um nome"
          autoComplete="off"
          className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-ink/50"
        />
      </label>
    </section>
  );
}
