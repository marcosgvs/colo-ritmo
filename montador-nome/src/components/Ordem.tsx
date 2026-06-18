import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { OrdemItem } from './OrdemItem';

interface Props {
  ordem: string[];
  onReordenar: (ordem: string[]) => void;
  onRemover: (nome: string) => void;
}

export function Ordem({ ordem, onReordenar, onRemover }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const de = ordem.indexOf(String(active.id));
    const para = ordem.indexOf(String(over.id));
    if (de === -1 || para === -1) return;
    onReordenar(arrayMove(ordem, de, para));
  }

  if (ordem.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {ordem.map((nome, i) => (
            <OrdemItem key={nome} nome={nome} indice={i + 1} onRemover={onRemover} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
