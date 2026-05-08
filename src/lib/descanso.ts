import type { Bloco, BlocoPlantao } from '@/types';
import { adicionaDia, ehISO } from './dates.js';
import { ehNoturno } from './remuneracao.js';

/**
 * descanso.ts · motor de "descanso real". A diferença pra cargaSemanal
 * é que aqui janela vazia depois de plantão noturno NÃO conta como
 * descanso · conta como recuperação (sono pós-plantão).
 *
 * Conceito-chave que isso resolve: Mariana vê quarta de manhã "livre"
 * depois de plantão ter-noite e pega plantão extra ali, achando que
 * descansou. Aqui essa janela é marcada como ocupada-recuperando, e o
 * "maior descanso contínuo" reflete o tempo livre de verdade.
 */

const MS_HORA = 60 * 60 * 1000;

/** Janela de recuperação após plantão noturno · 12h ≈ sono + retomada. */
export const RECUPERACAO_NOITE_HORAS = 12;

/** Descanso mínimo "saudável" entre plantões · gatilho de alerta. */
export const DESCANSO_MIN_SAUDAVEL = 11;

export interface Faixa {
  /** horas absolutas desde epoch (Date.now / 3600_000). */
  ini: number;
  fim: number;
}

export function faixaAbsoluta(b: { data: string; horaInicio: number; duracao: number }): Faixa {
  const t = new Date(`${b.data}T00:00:00`).getTime() / MS_HORA;
  return { ini: t + b.horaInicio, fim: t + b.horaInicio + b.duracao };
}

/** Faixa cinza de recuperação pós-plantão noturno · null se diurno. */
export function faixaRecuperacao(p: BlocoPlantao): Faixa | null {
  if (!ehNoturno(p)) return null;
  const f = faixaAbsoluta(p);
  return { ini: f.fim, fim: f.fim + RECUPERACAO_NOITE_HORAS };
}

export interface RecuperacaoInvadida {
  plantao: BlocoPlantao;
  invadidoPor: BlocoPlantao;
  /** Quantas horas da recuperação foram "comidas" pelo plantão seguinte. */
  horasInvadidas: number;
}

export interface AnaliseDescanso {
  /** Maior bloco contínuo de descanso real na janela (em horas). */
  maiorDescansoContinuo: number;
  /** Total de horas livres na janela (soma de todos os gaps). */
  horasLivresTotal: number;
  /** Soma de horas de recuperação que foram invadidas por outro plantão. */
  horasRecuperacaoInvadidas: number;
  /** Sequência máxima de dias consecutivos com plantão na janela. */
  diasSeguidos: number;
  /** Plantões cuja recuperação é invadida por outro plantão. */
  recuperacoesInvadidas: RecuperacaoInvadida[];
  /** True se algum descanso real cai abaixo do limite saudável. */
  alertaDescansoCurto: boolean;
  /** True se o cenário cria 3+ dias consecutivos de plantão. */
  alerta3DiasSeguidos: boolean;
}

/**
 * Analisa descanso real numa janela [janelaIni, janelaFim] · ambos
 * inclusive em ISO YYYY-MM-DD. Plantão e faixa de recuperação contam
 * como ocupado · "descanso real" é o que sobra.
 */
export function analisarDescanso(
  blocos: Bloco[],
  janelaIni: string,
  janelaFim: string,
  incluindoNovo?: BlocoPlantao,
): AnaliseDescanso {
  if (!ehISO(janelaIni) || !ehISO(janelaFim)) {
    throw new Error(`analisarDescanso: janela inválida (${janelaIni} → ${janelaFim})`);
  }
  const iniAbs = new Date(`${janelaIni}T00:00:00`).getTime() / MS_HORA;
  const fimAbs = new Date(`${janelaFim}T00:00:00`).getTime() / MS_HORA + 24;

  const todos: BlocoPlantao[] = [
    ...blocos.filter((b): b is BlocoPlantao => b.tipo === 'plantao'),
    ...(incluindoNovo ? [incluindoNovo] : []),
  ];
  const naJanela = todos
    .map((p) => ({ p, faixa: faixaAbsoluta(p) }))
    .filter(({ faixa }) => faixa.fim > iniAbs && faixa.ini < fimAbs)
    .sort((a, b) => a.faixa.ini - b.faixa.ini);

  // Recuperações invadidas: outro plantão começa dentro da janela cinza
  const recuperacoesInvadidas: RecuperacaoInvadida[] = [];
  for (const { p } of naJanela) {
    const rec = faixaRecuperacao(p);
    if (!rec) continue;
    for (const { p: q, faixa: qFaixa } of naJanela) {
      if (q.id === p.id) continue;
      if (qFaixa.ini >= rec.ini && qFaixa.ini < rec.fim) {
        recuperacoesInvadidas.push({
          plantao: p,
          invadidoPor: q,
          horasInvadidas: Math.min(rec.fim, qFaixa.fim) - qFaixa.ini,
        });
      }
    }
  }
  const horasRecuperacaoInvadidas = recuperacoesInvadidas.reduce(
    (s, r) => s + r.horasInvadidas,
    0,
  );

  // Faixas ocupadas = plantão + recuperação · merge antes de medir gaps
  const ocupados: Faixa[] = [];
  for (const { p, faixa } of naJanela) {
    ocupados.push({ ...faixa });
    const rec = faixaRecuperacao(p);
    if (rec) ocupados.push(rec);
  }
  ocupados.sort((a, b) => a.ini - b.ini);
  const merged: Faixa[] = [];
  for (const f of ocupados) {
    const ult = merged[merged.length - 1];
    if (ult && f.ini <= ult.fim) {
      ult.fim = Math.max(ult.fim, f.fim);
    } else {
      merged.push({ ...f });
    }
  }

  let maiorDescanso = 0;
  let horasLivresTotal = 0;
  let cursor = iniAbs;
  for (const f of merged) {
    if (f.ini > cursor) {
      const gapFim = Math.min(f.ini, fimAbs);
      const gap = gapFim - cursor;
      maiorDescanso = Math.max(maiorDescanso, gap);
      horasLivresTotal += gap;
    }
    cursor = Math.max(cursor, f.fim);
    if (cursor >= fimAbs) break;
  }
  if (cursor < fimAbs) {
    const gap = fimAbs - cursor;
    maiorDescanso = Math.max(maiorDescanso, gap);
    horasLivresTotal += gap;
  }

  const diasComPlantao = new Set<string>();
  for (const { p } of naJanela) {
    diasComPlantao.add(p.data);
    if (p.horaInicio + p.duracao > 24) {
      diasComPlantao.add(adicionaDia(p.data, 1));
    }
  }
  let diasSeguidos = 0;
  let atual = 0;
  let cursorDia = janelaIni;
  while (cursorDia <= janelaFim) {
    if (diasComPlantao.has(cursorDia)) {
      atual++;
      diasSeguidos = Math.max(diasSeguidos, atual);
    } else {
      atual = 0;
    }
    cursorDia = adicionaDia(cursorDia, 1);
  }

  return {
    maiorDescansoContinuo: maiorDescanso,
    horasLivresTotal,
    horasRecuperacaoInvadidas,
    diasSeguidos,
    recuperacoesInvadidas,
    alertaDescansoCurto: maiorDescanso < DESCANSO_MIN_SAUDAVEL,
    alerta3DiasSeguidos: diasSeguidos >= 3,
  };
}

export interface FaixaRecuperacaoNoDia {
  /** ISO YYYY-MM-DD do dia onde a faixa aparece. */
  data: string;
  /** Hora de início no dia (0-24). */
  iniHora: number;
  /** Duração em horas dentro do dia. */
  duracao: number;
  /** ID do plantão noturno que gerou essa faixa. */
  plantaoId: string | number;
}

/**
 * Retorna faixas de recuperação invadida (= o gap entre um plantão
 * noturno e o próximo plantão dentro da janela de 12h pós-fim) já
 * projetadas em dias. Só retorna se houver invasão · vazia caso a
 * recuperação esteja preservada.
 *
 * Usado pelo WeekGrid pra pintar overlay cinza-listrado.
 */
export function faixasRecuperacaoNaSemana(
  blocos: Bloco[],
  diasISO: readonly string[],
): FaixaRecuperacaoNoDia[] {
  if (diasISO.length === 0) return [];
  const plantoes = blocos.filter((b): b is BlocoPlantao => b.tipo === 'plantao');

  // Ordenar plantões por início pra achar o "próximo" rapidamente
  const ordenados = plantoes
    .map((p) => ({ p, faixa: faixaAbsoluta(p) }))
    .sort((a, b) => a.faixa.ini - b.faixa.ini);

  const out: FaixaRecuperacaoNoDia[] = [];
  for (let i = 0; i < ordenados.length; i++) {
    const { p, faixa } = ordenados[i]!;
    const rec = faixaRecuperacao(p);
    if (!rec) continue;
    const proximo = ordenados.slice(i + 1).find(({ faixa: f }) => f.ini > faixa.fim);
    if (!proximo) continue;
    if (proximo.faixa.ini >= rec.fim) continue; // recuperação preservada

    const cinza: Faixa = { ini: faixa.fim, fim: proximo.faixa.ini };

    for (const dia of diasISO) {
      const t = new Date(`${dia}T00:00:00`).getTime() / MS_HORA;
      const start = Math.max(cinza.ini, t);
      const end = Math.min(cinza.fim, t + 24);
      if (start >= end) continue;
      out.push({
        data: dia,
        iniHora: start - t,
        duracao: end - start,
        plantaoId: p.id,
      });
    }
  }
  return out;
}

export interface EspelhoDescanso {
  antes: AnaliseDescanso;
  depois: AnaliseDescanso;
  janelaIni: string;
  janelaFim: string;
  /** depois - antes em maiorDescansoContinuo · negativo = piora */
  deltaMaiorDescanso: number;
  /** depois - antes em horasRecuperacaoInvadidas · positivo = piora */
  deltaInvasao: number;
  /** True se aceitar piora algum sinal (descanso menor, mais invasão ou novo dia rodando). */
  piora: boolean;
}

/**
 * Compara descanso antes/depois de aceitar um plantão. Janela = data
 * do novo plantão ± raioDias. Usado pelo modal de aceitação.
 */
export function espelhoDescanso(
  blocos: Bloco[],
  novoBloco: BlocoPlantao,
  raioDias = 1,
): EspelhoDescanso {
  const janelaIni = adicionaDia(novoBloco.data, -raioDias);
  let dataFim = novoBloco.data;
  if (novoBloco.horaInicio + novoBloco.duracao > 24) {
    dataFim = adicionaDia(novoBloco.data, 1);
  }
  const janelaFim = adicionaDia(dataFim, raioDias);
  const antes = analisarDescanso(blocos, janelaIni, janelaFim);
  const depois = analisarDescanso(blocos, janelaIni, janelaFim, novoBloco);
  const deltaMaiorDescanso = depois.maiorDescansoContinuo - antes.maiorDescansoContinuo;
  const deltaInvasao = depois.horasRecuperacaoInvadidas - antes.horasRecuperacaoInvadidas;
  const piora =
    deltaMaiorDescanso < 0 ||
    deltaInvasao > 0 ||
    depois.diasSeguidos > antes.diasSeguidos;
  return {
    antes,
    depois,
    janelaIni,
    janelaFim,
    deltaMaiorDescanso,
    deltaInvasao,
    piora,
  };
}
