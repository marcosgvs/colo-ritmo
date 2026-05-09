import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';

/**
 * Conflitos detectáveis automaticamente. Cada conflito tem um par (a, b)
 * — quando faz sentido — e um tipo. A UI usa o tipo pra escolher copy:
 *   sobreposicao    — dois plantões no mesmo intervalo
 *   sem_descanso    — < intervalo mínimo do hospital entre plantões
 *   max_semana      — passou do limite definido pelo hospital
 */

export type TipoConflito = 'sobreposicao' | 'sem_descanso' | 'max_semana';

export interface Conflito {
  tipo: TipoConflito;
  a: BlocoPlantao;
  b?: BlocoPlantao;
  /** Métrica relevante: horas, gap, etc. */
  detalhe: string;
}

const MS_HORA = 60 * 60 * 1000;

function abs(b: BlocoPlantao): { ini: number; fim: number } {
  const t = new Date(`${b.data}T00:00:00`).getTime() / MS_HORA;
  return { ini: t + b.horaInicio, fim: t + b.horaInicio + b.duracao };
}

function isoWeek(iso: string): string {
  // chave de semana: ano-iso + numero da semana ISO. Pra simplificar
  // usamos ano + número da semana (segunda como início). Não é ISO 8601
  // strict mas é estável o suficiente para detecção de carga semanal.
  const d = new Date(`${iso}T12:00:00`);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function detectarConflitos(
  blocos: Bloco[],
  hospitais: HospitaisMap,
): Conflito[] {
  const plantoes = blocos.filter(
    (b): b is BlocoPlantao => b.tipo === 'plantao',
  );

  const conflitos: Conflito[] = [];

  // 1. Sobreposição entre plantões (par-a-par).
  // 2. Sem descanso (< intervalo mínimo do hospital · default 11h).
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
        continue;
      }
      // Calcular gap entre o fim do mais cedo e início do mais tarde
      const [primeiro, segundo] = ra.ini <= rb.ini ? [ra, rb] : [rb, ra];
      const gap = segundo.ini - primeiro.fim;
      if (gap < 0) continue;
      // Jornada estendida no mesmo hospital (ex: manhã 7-13 + tarde 13-19) é
      // uma única plantão "vendida" em duas células do PDF do chefe — não é
      // falta de descanso. Tolera até 30min de gap (handover, pausa curta).
      if (a.hospitalId === b.hospitalId && gap < 0.5) continue;
      const hospA = hospitais[a.hospitalId];
      const hospB = hospitais[b.hospitalId];
      const minDescanso = Math.min(
        hospA?.regras.intervaloMinHoras ?? 11,
        hospB?.regras.intervaloMinHoras ?? 11,
      );
      if (gap < minDescanso) {
        const [pa, pb] = ra.ini <= rb.ini ? [a, b] : [b, a];
        conflitos.push({
          tipo: 'sem_descanso',
          a: pa,
          b: pb,
          detalhe: `${gap.toFixed(1)}h de descanso · mín. ${minDescanso}h`,
        });
      }
    }
  }

  // 3. Limite por hospital (max por semana).
  const porSemanaHosp = new Map<string, Map<string, BlocoPlantao[]>>();
  for (const p of plantoes) {
    const k = isoWeek(p.data);
    if (!porSemanaHosp.has(k)) porSemanaHosp.set(k, new Map());
    const sub = porSemanaHosp.get(k)!;
    const arr = sub.get(p.hospitalId) ?? [];
    arr.push(p);
    sub.set(p.hospitalId, arr);
  }
  for (const [, sub] of porSemanaHosp) {
    for (const [hospId, lista] of sub) {
      const hosp = hospitais[hospId];
      if (!hosp) continue;
      if (lista.length > hosp.regras.maxPorSemana && lista[0]) {
        conflitos.push({
          tipo: 'max_semana',
          a: lista[0],
          detalhe: `${lista.length} plantões em ${hosp.abrev} · máx. ${hosp.regras.maxPorSemana}/sem`,
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
    if (c.b) idsEmConflito.add(c.b.id);
  }
  return blocos.map((b) => {
    if (b.tipo !== 'plantao') return b;
    const deveTer = idsEmConflito.has(b.id);
    if (b.conflito === deveTer) return b; // sem mudança · evita re-render
    return { ...b, conflito: deveTer };
  });
}
