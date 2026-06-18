import { SOBRENOMES, type Lado } from '../data';

interface Props {
  ordem: string[];
  onToggle: (nome: string) => void;
}

const LADOS: Lado[] = [1, 2];
const ROTULO: Record<Lado, string> = { 1: 'Lado 1', 2: 'Lado 2' };

function classesChip(lado: Lado, ativo: boolean): string {
  if (lado === 1) {
    return ativo
      ? 'border-lado1-line bg-lado1-bg text-lado1-ink'
      : 'border-line bg-white text-ink hover:border-lado1-line';
  }
  return ativo
    ? 'border-lado2-line bg-lado2-bg text-lado2-ink'
    : 'border-line bg-white text-ink hover:border-lado2-line';
}

export function Sobrenomes({ ordem, onToggle }: Props) {
  return (
    <section aria-labelledby="sobrenomes-titulo" className="space-y-4">
      <h2 id="sobrenomes-titulo" className="text-sm font-medium text-muted">
        Sobrenomes
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {LADOS.map((lado) => (
          <div key={lado} className="space-y-2">
            <p className="text-xs text-muted">{ROTULO[lado]}</p>
            <div className="flex flex-wrap gap-2">
              {SOBRENOMES.filter((s) => s.lado === lado).map((s) => {
                const ativo = ordem.includes(s.nome);
                return (
                  <button
                    key={s.nome}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => onToggle(s.nome)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${classesChip(lado, ativo)}`}
                  >
                    {s.nome}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
