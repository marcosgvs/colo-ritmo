import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LADO_DE } from '../data';

interface Props {
  nome: string;
  indice: number;
  onRemover: (nome: string) => void;
}

export function OrdemItem({ nome, indice, onRemover }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nome,
  });

  const cor =
    LADO_DE[nome] === 1
      ? 'border-lado1-line bg-lado1-bg text-lado1-ink'
      : 'border-lado2-line bg-lado2-bg text-lado2-ink';

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${cor} ${
        isDragging ? 'relative z-10 opacity-80' : ''
      }`}
    >
      <button
        type="button"
        aria-label={`Reordenar ${nome}. Pressione espaço e use as setas para cima e para baixo.`}
        className="-m-1 cursor-grab touch-none rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <circle cx="6" cy="4" r="1.2" />
          <circle cx="10" cy="4" r="1.2" />
          <circle cx="6" cy="8" r="1.2" />
          <circle cx="10" cy="8" r="1.2" />
          <circle cx="6" cy="12" r="1.2" />
          <circle cx="10" cy="12" r="1.2" />
        </svg>
      </button>

      <span className="w-4 text-center text-sm font-medium tabular-nums opacity-60">{indice}</span>
      <span className="flex-1 text-base">{nome}</span>

      <button
        type="button"
        onClick={() => onRemover(nome)}
        aria-label={`Remover ${nome}`}
        className="rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </li>
  );
}
