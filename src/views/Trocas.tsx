import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface TrocasProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onCriarPedido: (b: BlocoPlantao, motivo: string, candidatos: string[]) => void;
}

/**
 * Trocas · ainda em construção. O wizard antigo era mock (colegas fake +
 * console.info) e fingia sucesso em produção · removido até o fluxo real
 * existir. As props seguem aceitas pra manter a rota do App compilando.
 */
export function Trocas(_props: TrocasProps) {
  return (
    <>
      <PageHead
        eyebrow="trocas"
        titulo="ainda em construção."
        hand="sem fingir que funciona · quando existir de verdade, aparece aqui."
      />
      <EmptyState
        titulo="trocas entre colegas ainda está em construção."
        recado="por enquanto, combine a troca direto com a pessoa e edite o plantão aqui na agenda."
      />
    </>
  );
}
