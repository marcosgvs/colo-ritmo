import type { Bloco, BlocoPlantao, HospitaisMap } from '../types/index.js';

/**
 * Conflito de agenda · só sobreposição.
 *
 * Outras "regras" (descanso entre plantões, máx por semana, máx por mês)
 * existem como dados no cadastro do hospital mas NÃO disparam conflito.
 * Elas viram insumo do Montar AI futuro. O alerta de carga semanal pesada
 * vive no Rail (RespiracaoCard).
 */

export type TipoConflito = 'sobreposicao';

export interface Conflito {
  tipo: TipoConflito;
  a: BlocoPlantao;
  b: BlocoPlantao;
  detalhe: string;
}

const MS_HORA = 60 * 60 * 1000;

function abs(b: BlocoPlantao): { ini: number; fim: number } {
  const t = new Date(`${b.data}T00:00:00`).getTime() / MS_HORA;
  return { ini: t + b.horaInicio, fim: t + b.horaInicio + b.duracao };
}

export function detectarConflitos(
  blocos: Bloco[],
  _hospitais: HospitaisMap,
): Conflito[] {
  const plantoes = blocos.filter(
    (b): b is BlocoPlantao => b.tipo === 'plantao',
  );

  const conflitos: Conflito[] = [];

  // Sobreposição entre plantões (par-a-par).
  for (let i = 0; i < plantoes.length; i++) {
    for (let j = i + 1; j < plantoes.length; j++) {
      const a = plantoes[i]!;
      const b = plantoes[j]!;
      const ra = abs(a);
      const rb = abs(b);
      const overlap = ra.ini < rb.fim && rb.ini < ra.fim;
      if (overlap) {
        conflitos.push({
          tipo: 'sobreposicao',
          a,
          b,
          detalhe: `${a.duracao}h + ${b.duracao}h sobrepostos`,
        });
      }
    }
  }

  return conflitos;
}

/** Carga total de plantão (não conta sono / bloqueio). */
export function cargaSemanal(blocos: Bloco[]): number {
  return blocos.reduce((s, b) => (b.tipo === 'plantao' ? s + b.duracao : s), 0);
}

/**
 * Retorna nova lista de blocos com `conflito: true` marcado nos plantões
 * que aparecem em qualquer conflito detectado. Idempotente: limpa flags
 * antes de aplicar. Não muta a entrada.
 *
 * Usado pelo App.tsx pra enriquecer `state.blocos` antes de passar pras
 * views — sem isso, o detector acha conflito mas o calendário não pinta
 * vermelho nenhum bloquinho.
 */
export function marcarConflitos(
  blocos: Bloco[],
  hospitais: HospitaisMap,
): Bloco[] {
  const conflitos = detectarConflitos(blocos, hospitais);
  const idsEmConflito = new Set<string | number>();
  for (const c of conflitos) {
    idsEmConflito.add(c.a.id);
    idsEmConflito.add(c.b.id);
  }
  return blocos.map((b) => {
    if (b.tipo !== 'plantao') return b;
    const deveTer = idsEmConflito.has(b.id);
    if (b.conflito === deveTer) return b; // sem mudança · evita re-render
    return { ...b, conflito: deveTer };
  });
}
