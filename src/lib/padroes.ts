/**
 * Cálculo de padrões observados — alimenta o solver com bônus pra
 * candidatos que batem com a rotina natural da médica.
 *
 * Regra do "padrão":
 *   "(hospital × dia da semana × horário+duração) aparece em pelo menos
 *    50% dos meses observados naquele hospital"
 *
 * Ex: Mariana faz noitinha (19h, 5h) no HSLz em 4 das 4 segundas de maio
 * + 4 das 4 segundas de junho. Padrão forte: HSLz × seg × 19h × 5h = 100%.
 */

import type { Bloco, BlocoPlantao, PadraoMedica } from '@/types';
import { fromISO } from './dates.js';

const LIMIAR_PADRAO = 0.5;

interface ChavePadrao {
  hospitalId: string;
  diaDeSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  inicio: number;
  duracao: number;
}

function chave(p: ChavePadrao): string {
  return `${p.hospitalId}|${p.diaDeSemana}|${p.inicio}|${p.duracao}`;
}

/**
 * Calcula padrões a partir de TODOS os plantões da médica em qualquer hospital.
 * Agrupa por (hospital × DOW × hora × dur), conta meses únicos, mantém só
 * os que cobrem >= LIMIAR_PADRAO dos meses observados.
 */
export function calcularPadroes(blocos: Bloco[]): PadraoMedica[] {
  const plantoes = blocos.filter((b): b is BlocoPlantao => b.tipo === 'plantao');
  if (plantoes.length === 0) return [];

  // Por hospital, conta total de meses únicos observados.
  const mesesPorHospital = new Map<string, Set<string>>();
  for (const p of plantoes) {
    const mes = p.data.slice(0, 7); // YYYY-MM
    const set = mesesPorHospital.get(p.hospitalId) ?? new Set<string>();
    set.add(mes);
    mesesPorHospital.set(p.hospitalId, set);
  }

  // Por chave, conta em quais meses (únicos) ela apareceu.
  const ocorrencias = new Map<string, { dados: ChavePadrao; meses: Set<string> }>();
  for (const p of plantoes) {
    const dow = fromISO(p.data).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const dados: ChavePadrao = {
      hospitalId: p.hospitalId,
      diaDeSemana: dow,
      inicio: p.horaInicio,
      duracao: p.duracao,
    };
    const k = chave(dados);
    const mes = p.data.slice(0, 7);
    const atual = ocorrencias.get(k);
    if (atual) {
      atual.meses.add(mes);
    } else {
      ocorrencias.set(k, { dados, meses: new Set([mes]) });
    }
  }

  const padroes: PadraoMedica[] = [];
  for (const { dados, meses } of ocorrencias.values()) {
    const totalMeses = mesesPorHospital.get(dados.hospitalId)?.size ?? 0;
    if (totalMeses === 0) continue;
    const proporcao = meses.size / totalMeses;
    if (proporcao < LIMIAR_PADRAO) continue;
    padroes.push({
      hospitalId: dados.hospitalId,
      diaDeSemana: dados.diaDeSemana,
      inicio: dados.inicio,
      duracao: dados.duracao,
      observadoEm: meses.size,
      totalMeses,
    });
  }

  // Ordena por força (mais observado primeiro).
  return padroes.sort((a, b) => b.observadoEm / b.totalMeses - a.observadoEm / a.totalMeses);
}

/**
 * Bônus de score (0-1) pra um candidato a plantão sugerido pelo solver,
 * baseado em quanto ele bate com algum padrão conhecido. Usado como
 * multiplicador positivo no ranking de candidatos.
 *
 * - Match exato (hospital + DOW + inicio + dur) = bônus = proporção do padrão (até 1.0)
 * - Match parcial (hospital + DOW só) = metade
 * - Sem match = 0
 */
export function bonusPadrao(
  candidato: { hospitalId: string; data: string; horaInicio: number; duracao: number },
  padroes: PadraoMedica[],
): number {
  if (padroes.length === 0) return 0;
  const dow = fromISO(candidato.data).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  let melhor = 0;
  for (const p of padroes) {
    if (p.hospitalId !== candidato.hospitalId) continue;
    if (p.diaDeSemana !== dow) continue;
    const proporcao = p.observadoEm / Math.max(1, p.totalMeses);
    if (p.inicio === candidato.horaInicio && p.duracao === candidato.duracao) {
      melhor = Math.max(melhor, proporcao);
    } else {
      melhor = Math.max(melhor, proporcao * 0.5);
    }
  }
  return melhor;
}
