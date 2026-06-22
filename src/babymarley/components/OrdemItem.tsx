import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LADO_DE } from '../data';
import { CORES_LADO } from '../tema';

interface Props {
  nome: string;
  indice: number;
  onRemover: (nome: string) => void;
}

const iconeBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'currentColor',
  opacity: 0.55,
  cursor: 'pointer',
  borderRadius: 'var(--r-sm)',
  transition: 'opacity 140ms ease',
};

export function OrdemItem({ nome, indice, onRemover }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nome,
  });

  const c = CORES_LADO[LADO_DE[nome]];

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    border: `1px solid ${c.borda}`,
    background: c.surface,
    color: c.ink,
    boxShadow: isDragging ? 'var(--shadow-md)' : 'none',
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        aria-label={`reordenar ${nome}. pressione espaço e use as setas para cima e para baixo.`}
        style={{ ...iconeBtn, cursor: 'grab', touchAction: 'none' }}
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

      <span
        style={{
          width: 18,
          textAlign: 'center',
          font: '600 14px/1 var(--font-mono)',
          opacity: 0.7,
        }}
      >
        {indice}
      </span>

      <span style={{ flex: 1, font: '500 17px/1.2 var(--font-body)' }}>{nome}</span>

      <button
        type="button"
        onClick={() => onRemover(nome)}
        aria-label={`remover ${nome}`}
        style={iconeBtn}
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
