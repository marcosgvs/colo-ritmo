import type { Bloco, BlocoPlantao, HospitaisMap, Preferencias } from '@/types';
import { fimDoMes, inicioDoMes, semanaDe } from './dates.js';
import { analisarDescanso } from './descanso.js';
import { calcRemuneracaoBloco } from './remuneracao.js';

/**
 * diagnostico.ts · lê o mês anterior e classifica como pesado, caro ou
 * tranquilo. Esse diagnóstico vira a "lente" pré-selecionada do Montar.
 *
 *   pesado  → mês forçou demais (3+ dias seguidos ou recuperação invadida)
 *             → sugere descansar
 *   caro    → não bateu meta financeira (< 85%)
 *             → sugere ganhar
 *   tranquilo → não foi pesado nem caro
 *             → sugere equilibrar
 *
 * Prioridade: pesado > caro > tranquilo. Saúde antes de dinheiro.
 */

export type Classificacao = 'pesado' | 'caro' | 'tranquilo';
export type LenteSugerida = 'descansar' | 'equilibrar' | 'ganhar';

export interface DiagnosticoMes {
  mesISO: string;
  receita: number;
  metaMensal: number;
  pctMeta: number | null;
  plantoes: number;
  /** Média do maior bloco contínuo de descanso por semana, em horas. */
  hLivresMedia: number;
  /** Pior caso da janela do mês: maior sequência de dias rodando. */
  diasSeguidosMax: number;
  recuperacoesInvadidas: number;
  classificacao: Classificacao;
  lenteSugerida: LenteSugerida;
  /** Resumo curto pra exibir como Hand no card. */
  recado: string;
}

/** "2026-05" → "2026-04" · "2026-01" → "2025-12". */
export function mesAnteriorISO(mesISO: string): string {
  const [ano, mes] = mesISO.split('-').map(Number);
  if (!ano || !mes) throw new Error(`mesAnteriorISO: '${mesISO}' inválido`);
  if (mes === 1) return `${ano - 1}-12`;
  return `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

const LIMITE_BAIXO_META = 0.85; // < 85% da meta vira "caro"

export function analisarMesAnterior(
  blocos: Bloco[],
  hospitais: HospitaisMap,
  mesAlvoISO: string,
  prefs: Preferencias,
): DiagnosticoMes {
  const mesISO = mesAnteriorISO(mesAlvoISO);
  const ini = inicioDoMes(`${mesISO}-01`);
  const fim = fimDoMes(`${mesISO}-01`);

  const plantoesDoMes = blocos.filter(
    (b): b is BlocoPlantao => b.tipo === 'plantao' && b.data.slice(0, 7) === mesISO,
  );

  let receita = 0;
  for (const p of plantoesDoMes) {
    const hosp = hospitais[p.hospitalId];
    if (!hosp) continue;
    receita += calcRemuneracaoBloco(p, hosp).liquido;
  }

  const meta = prefs.metaMensal;
  const pctMeta = meta > 0 ? Math.round((receita / meta) * 100) : null;

  const analiseGeral = analisarDescanso(blocos, ini, fim);

  // Média de hLivres por semana ISO
  const semanasUnicas = new Set<string>();
  for (const p of plantoesDoMes) {
    const semIni = semanaDe(p.data)[0]!;
    semanasUnicas.add(semIni);
  }
  const hLivresMedia =
    semanasUnicas.size === 0
      ? 0
      : Array.from(semanasUnicas).reduce((soma, semIni) => {
          const semDias = semanaDe(semIni);
          const a = analisarDescanso(blocos, semDias[0]!, semDias[6]!);
          return soma + a.maiorDescansoContinuo;
        }, 0) / semanasUnicas.size;

  const diasSeguidosMax = analiseGeral.diasSeguidos;
  const recuperacoesInvadidas = analiseGeral.recuperacoesInvadidas.length;

  let classificacao: Classificacao;
  let lenteSugerida: LenteSugerida;
  let recado: string;

  if (plantoesDoMes.length === 0) {
    classificacao = 'tranquilo';
    lenteSugerida = 'equilibrar';
    recado = 'sem histórico do mês passado · começa equilibrado.';
  } else if (diasSeguidosMax >= 3 || recuperacoesInvadidas > 0) {
    classificacao = 'pesado';
    lenteSugerida = 'descansar';
    const detalhe =
      diasSeguidosMax >= 3
        ? `${diasSeguidosMax} dias seguidos`
        : `${recuperacoesInvadidas} recuperação${recuperacoesInvadidas > 1 ? 'ões' : ''} invadida${
            recuperacoesInvadidas > 1 ? 's' : ''
          }`;
    recado = `mês passado pesou · ${detalhe} · vale aliviar.`;
  } else if (pctMeta !== null && pctMeta / 100 < LIMITE_BAIXO_META) {
    classificacao = 'caro';
    lenteSugerida = 'ganhar';
    recado = `mês passado ficou caro · ${pctMeta}% da meta · pode acelerar.`;
  } else {
    classificacao = 'tranquilo';
    lenteSugerida = 'equilibrar';
    recado = 'mês passado fechou tranquilo · mantém o ritmo.';
  }

  return {
    mesISO,
    receita,
    metaMensal: meta,
    pctMeta,
    plantoes: plantoesDoMes.length,
    hLivresMedia,
    diasSeguidosMax,
    recuperacoesInvadidas,
    classificacao,
    lenteSugerida,
    recado,
  };
}
