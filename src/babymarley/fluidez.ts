import { PESOS } from './data';

/**
 * Organiza os sobrenomes para um fluxo sonoro curto → longo → médio → curto.
 *
 * - Ordena por peso crescente.
 * - Mantém o mais curto na frente e coloca o restante em ordem decrescente.
 *   Ex.: pesos [1,2,3,5] → ordem [1,5,3,2].
 * - Com 0 ou 1 sobrenome, devolve a ordem como está.
 */
export function organizarPorFluidez(sobrenomes: string[]): string[] {
  if (sobrenomes.length <= 1) return [...sobrenomes];

  const crescente = [...sobrenomes].sort((a, b) => PESOS[a] - PESOS[b]);
  const [maisCurto, ...resto] = crescente;
  resto.sort((a, b) => PESOS[b] - PESOS[a]);

  return [maisCurto, ...resto];
}
