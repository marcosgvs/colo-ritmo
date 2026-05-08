import type { Bloco, BlocoPlantao, HospitaisMap, Preferencias } from '@/types';
import { adicionaDia, diaSemanaBR, fimDoMes, fromISO, inicioDoMes, semanaDe } from './dates.js';
import { detectarConflitos } from './conflitos.js';
import { calcRemuneracaoBloco } from './remuneracao.js';

/**
 * Solver simples · sugere plantões pro mês respeitando preferências e
 * regras de hospital. Heurística de 1 passada (não otimização global):
 *
 *   1. mapeia limites mensais já usados (plantões existentes contam)
 *   2. itera cada dia do mês
 *   3. pula dias evitados, dias com bloco existente, dias com plantão
 *      próximo (intervalo mínimo de descanso)
 *   4. escolhe hospital preferido com vaga
 *   5. usa janela preferida (dia/noite/ambos)
 *   6. para quando atingir meta de remuneração ou esgotar dias
 *
 * Retorna apenas plantões SUGERIDOS · ids prefixados com `sug-` pra
 * caller diferenciar. Não modifica estado.
 */

const DOWS_BR = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export interface SugerirOpts {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  /** Mês ISO `YYYY-MM`. */
  mes: string;
}

export interface SugestaoSolver {
  blocos: BlocoPlantao[];
  resumo: {
    sugeridos: number;
    receitaEstimada: number;
    metaPct: number | null;
    motivosPulados: string[];
  };
}

interface Limites {
  porHospitalMes: Map<string, number>;
  porHospitalSemana: Map<string, Map<string, number>>;
  diasOcupados: Set<string>;
}

function semanaKey(iso: string): string {
  return semanaDe(iso)[0]!;
}

function calcularLimites(blocos: Bloco[], mesISO: string): Limites {
  const porHospitalMes = new Map<string, number>();
  const porHospitalSemana = new Map<string, Map<string, number>>();
  const diasOcupados = new Set<string>();

  for (const b of blocos) {
    diasOcupados.add(b.data);
    if (b.tipo !== 'plantao') continue;
    const dataMes = b.data.slice(0, 7);
    if (dataMes !== mesISO) continue;
    porHospitalMes.set(b.hospitalId, (porHospitalMes.get(b.hospitalId) ?? 0) + 1);
    const sem = semanaKey(b.data);
    if (!porHospitalSemana.has(sem)) porHospitalSemana.set(sem, new Map());
    const sub = porHospitalSemana.get(sem)!;
    sub.set(b.hospitalId, (sub.get(b.hospitalId) ?? 0) + 1);
  }

  return { porHospitalMes, porHospitalSemana, diasOcupados };
}

function escolherHospital(
  diaISO: string,
  hospitais: HospitaisMap,
  prefs: Preferencias,
  limites: Limites,
): string | null {
  const ordem = [
    ...prefs.hospitaisPreferidos.filter((id) => hospitais[id]),
    ...Object.keys(hospitais).filter((id) => !prefs.hospitaisPreferidos.includes(id)),
  ];

  for (const id of ordem) {
    const hosp = hospitais[id];
    if (!hosp) continue;
    const usadoMes = limites.porHospitalMes.get(id) ?? 0;
    if (usadoMes >= hosp.regras.maxPorMes) continue;
    const usadoSemana =
      limites.porHospitalSemana.get(semanaKey(diaISO))?.get(id) ?? 0;
    if (usadoSemana >= hosp.regras.maxPorSemana) continue;
    return id;
  }
  return null;
}

function janelaParaPlantao(prefs: Preferencias): { horaInicio: number; duracao: number } {
  if (prefs.janelaPreferida === 'noite') return { horaInicio: 19, duracao: 12 };
  if (prefs.janelaPreferida === 'ambos') {
    return { horaInicio: 7, duracao: 12 };
  }
  return { horaInicio: 7, duracao: 12 };
}

export function sugerirPlantoes(opts: SugerirOpts): SugestaoSolver {
  const { blocos, hospitais, preferencias, mes } = opts;
  const ini = inicioDoMes(`${mes}-01`);
  const fim = fimDoMes(`${mes}-01`);
  const fimT = fromISO(fim).getTime();

  const limites = calcularLimites(blocos, mes);
  const sugeridos: BlocoPlantao[] = [];
  const motivos: string[] = [];

  // remuneração-alvo (líquida)
  const meta = preferencias.metaMensal;
  let receitaAcum = 0;
  for (const b of blocos) {
    if (b.tipo !== 'plantao') continue;
    if (b.data.slice(0, 7) !== mes) continue;
    const hosp = hospitais[b.hospitalId];
    if (!hosp) continue;
    receitaAcum += calcRemuneracaoBloco(b, hosp).liquido;
  }

  let cursor = ini;
  let segurancaMax = 60;

  while (cursor <= fim && segurancaMax-- > 0) {
    if (fromISO(cursor).getTime() > fimT) break;

    if (limites.diasOcupados.has(cursor)) {
      cursor = adicionaDia(cursor, 1);
      continue;
    }

    const dow = DOWS_BR[diaSemanaBR(cursor)]!;
    if (preferencias.diasEvitar.includes(dow)) {
      motivos.push(`${cursor} pulado · dia evitado (${dow})`);
      cursor = adicionaDia(cursor, 1);
      continue;
    }

    // Conta plantões da semana atual
    const semana = semanaDe(cursor);
    const naSemana = [...sugeridos, ...blocos.filter((b) => b.tipo === 'plantao')].filter((b) =>
      semana.includes(b.data),
    ).length;
    if (naSemana >= preferencias.maxPlantoesPorSemana) {
      cursor = adicionaDia(cursor, 1);
      continue;
    }

    const hospitalId = escolherHospital(cursor, hospitais, preferencias, limites);
    if (!hospitalId) {
      motivos.push(`${cursor} pulado · todos hospitais cheios`);
      cursor = adicionaDia(cursor, 1);
      continue;
    }
    const hosp = hospitais[hospitalId]!;

    const { horaInicio, duracao } = janelaParaPlantao(preferencias);

    const novo: BlocoPlantao = {
      id: `sug-${cursor}-${hospitalId}`,
      tipo: 'plantao',
      hospitalId,
      data: cursor,
      horaInicio,
      duracao,
      setor: hosp.setores[0] ?? '',
    };

    // Anti-conflito: se gerar conflito grave, pula esse dia
    const conflitos = detectarConflitos(
      [...blocos, ...sugeridos, novo],
      hospitais,
    ).filter((c) => c.a.id === novo.id || c.b?.id === novo.id);
    const fatal = conflitos.find(
      (c) => c.tipo === 'sobreposicao' || c.tipo === 'sem_descanso',
    );
    if (fatal) {
      motivos.push(`${cursor} pulado · ${fatal.tipo}`);
      cursor = adicionaDia(cursor, 1);
      continue;
    }

    sugeridos.push(novo);
    limites.porHospitalMes.set(
      hospitalId,
      (limites.porHospitalMes.get(hospitalId) ?? 0) + 1,
    );
    const semKey = semanaKey(cursor);
    if (!limites.porHospitalSemana.has(semKey)) {
      limites.porHospitalSemana.set(semKey, new Map());
    }
    const subSem = limites.porHospitalSemana.get(semKey)!;
    subSem.set(hospitalId, (subSem.get(hospitalId) ?? 0) + 1);
    receitaAcum += calcRemuneracaoBloco(novo, hosp).liquido;

    if (meta > 0 && receitaAcum >= meta) break;

    // Pula 1 dia depois de plantão pra dar respiro (ainda assim conflitos
    // detectados acima cuidam de descanso menor que 11h).
    cursor = adicionaDia(cursor, 2);
  }

  return {
    blocos: sugeridos,
    resumo: {
      sugeridos: sugeridos.length,
      receitaEstimada: receitaAcum,
      metaPct: meta > 0 ? Math.min(100, Math.round((receitaAcum / meta) * 100)) : null,
      motivosPulados: motivos.slice(0, 8),
    },
  };
}
