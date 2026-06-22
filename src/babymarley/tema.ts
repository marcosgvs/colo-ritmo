import type { Lado } from './data';

export interface CoresLado {
  surface: string;
  ink: string;
  borda: string;
}

/**
 * Os dois lados da família usam as famílias de cor da colo:
 *   lado 1 → aqua (verde-azulado), lado 2 → lavender (roxo).
 * As bordas saem de um color-mix entre a cor dusty e a --line, pra ficarem
 * suaves como o resto do app.
 */
export const CORES_LADO: Record<Lado, CoresLado> = {
  1: {
    surface: 'var(--aqua-surface)',
    ink: '#3D7884',
    borda: 'color-mix(in oklab, var(--aqua) 55%, var(--line))',
  },
  2: {
    surface: 'var(--lavender-surface)',
    ink: 'var(--lavender-ink)',
    borda: 'color-mix(in oklab, var(--lavender) 50%, var(--line))',
  },
};

export const ROTULO_LADO: Record<Lado, string> = { 1: 'lado 1', 2: 'lado 2' };
