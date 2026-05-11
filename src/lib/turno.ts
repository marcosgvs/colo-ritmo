/**
 * Helpers de rótulo de turno. Cada hospital cadastra `janelas[]` com
 * `rotulo`, `inicio` e `duracao`. Dado um plantão (horaInicio, duracao) e
 * o hospital, devolve o rótulo da janela que casa — ex: "noitinha",
 * "manhã", "tarde 1". Se não casar nenhuma janela exata, devolve null
 * (chamador decide fallback pra horário cru).
 */

import type { Hospital } from '@/types';

/** Tolera arredondamento de fração de hora (5min). */
const EPSILON = 0.09;

/**
 * Retorna o rotulo da janela do hospital que casa exatamente com
 * (horaInicio, duracao). Null se não tiver janelas cadastradas ou se
 * nenhuma janela casar.
 */
export function rotuloTurno(
  horaInicio: number,
  duracao: number,
  hospital: Hospital | undefined,
): string | null {
  if (!hospital?.janelas || hospital.janelas.length === 0) return null;
  for (const j of hospital.janelas) {
    if (
      Math.abs(j.inicio - horaInicio) < EPSILON &&
      Math.abs(j.duracao - duracao) < EPSILON
    ) {
      return j.rotulo;
    }
  }
  return null;
}
