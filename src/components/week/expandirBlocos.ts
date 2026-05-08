import { adicionaDia } from '@/lib/data';
import type { Bloco } from '@/types';

/**
 * Expande blocos noturnos em dois segmentos virtuais para a grade Semana.
 *
 *   bloco original:        19h, dura 12h (vai até 7h do dia seguinte)
 *   após expandir:
 *     · dia A · 19→24 · _seg='inicio' (continua amanhã)
 *     · dia B ·  0→ 7 · _seg='fim'    (vem de ontem)
 *
 * Blocos que cabem no dia recebem _seg='unico'.
 */
export function expandirBlocos(blocos: Bloco[]): Bloco[] {
  const out: Bloco[] = [];
  for (const b of blocos) {
    const fim = b.horaInicio + b.duracao;
    if (fim <= 24) {
      out.push({ ...b, _seg: 'unico' });
      continue;
    }
    out.push({
      ...b,
      duracao: 24 - b.horaInicio,
      _seg: 'inicio',
    });
    out.push({
      ...b,
      data: adicionaDia(b.data, 1),
      horaInicio: 0,
      duracao: fim - 24,
      _seg: 'fim',
    });
  }
  return out;
}

export function blocosDoDia(blocos: Bloco[], data: string): Bloco[] {
  return blocos
    .filter((b) => b.data === data)
    .sort((a, b) => a.horaInicio - b.horaInicio);
}
