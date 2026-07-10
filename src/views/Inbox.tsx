import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

/**
 * Inbox · ainda em construção. As pendências antigas eram mock com botões
 * mortos · removidas até o fluxo de trocas real existir.
 */
export function Inbox() {
  return (
    <>
      <PageHead
        eyebrow="admin"
        titulo="inbox."
        hand="pedidos de troca e cessão vão chegar aqui quando o fluxo existir."
      />
      <EmptyState
        eyebrow="status"
        titulo="nada por aqui ainda."
        recado="essa área ainda está em construção · nenhuma pendência real passa por aqui por enquanto."
      />
    </>
  );
}
