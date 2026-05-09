import type {
  Bloco,
  BlocoPlantao,
  HospitaisMap,
  PadraoMedica,
  Preferencias,
} from '@/types';
import { adicionaDia, diaSemanaBR, fimDoMes, fromISO, inicioDoMes, semanaDe } from './dates.js';
import { detectarConflitos } from './conflitos.js';
import { calcRemuneracaoBloco } from './remuneracao.js';
import { analisarDescanso } from './descanso.js';
import { bonusPadrao } from './padroes.js';

/**
 * Solver heurístico greedy · sugere plantões pro mês respeitando
 * preferências, regras de hospital e a "lente" escolhida:
 *
 *   descansar  → maximiza descanso real (pula 3 dias entre sugestões,
 *                deixa 1 plantão de margem em max/semana, rejeita se
 *                invade recuperação ou cria 3 dias seguidos, ignora meta)
 *   equilibrar → comportamento original (pula 2 dias, para na meta,
 *                rejeita invasão de recuperação)
 *   ganhar     → maximiza receita (pula 1 dia, prefere janela noturna
 *                quando paga mais, não para na meta, só esbarra em
 *                conflito de agenda ou limite do hospital)
 *
 * Bloqueios e sono entram via `diasOcupados` no `calcularLimites` —
 * solver nunca sugere em dia já ocupado.
 */

const DOWS_BR = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export type Lente = 'descansar' | 'equilibrar' | 'ganhar';

interface LenteCfg {
  pulosEntreSugestoes: number;
  margemMaxSemana: number;
  pararQuandoMetaBate: boolean;
  rejeitarSeInvadeRecuperacao: boolean;
  rejeitarSe3DiasSeguidos: boolean;
  preferirNoturno: boolean;
}

const LENTES: Record<Lente, LenteCfg> = {
  descansar: {
    pulosEntreSugestoes: 3,
    margemMaxSemana: 1,
    pararQuandoMetaBate: false,
    rejeitarSeInvadeRecuperacao: true,
    rejeitarSe3DiasSeguidos: true,
    preferirNoturno: false,
  },
  equilibrar: {
    pulosEntreSugestoes: 2,
    margemMaxSemana: 0,
    pararQuandoMetaBate: true,
    rejeitarSeInvadeRecuperacao: true,
    rejeitarSe3DiasSeguidos: false,
    preferirNoturno: false,
  },
  ganhar: {
    pulosEntreSugestoes: 1,
    margemMaxSemana: 0,
    pararQuandoMetaBate: false,
    rejeitarSeInvadeRecuperacao: false,
    rejeitarSe3DiasSeguidos: false,
    preferirNoturno: true,
  },
};

export interface SugerirOpts {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  /** Mês ISO `YYYY-MM`. */
  mes: string;
  /** Default `equilibrar`. */
  lente?: Lente;
  /** Padrões observados · usados como bônus no scoring de hospital/janela. */
  padroes?: PadraoMedica[];
}

export interface SugestaoSolver {
  blocos: BlocoPlantao[];
  lente: Lente;
  resumo: {
    sugeridos: number;
    receitaEstimada: number;
    metaPct: number | null;
    /** Maior bloco contínuo de descanso real do mês com sugestões aplicadas. */
    maiorDescansoContinuo: number;
    /** Maior sequência de dias rodando após aplicar. */
    diasSeguidosMax: number;
    /** Recuperações invadidas após aplicar (idealmente 0). */
    recuperacoesInvadidas: number;
    motivosPulados: string[];
  };
}

export interface ComparativoLentes {
  descansar: SugestaoSolver;
  equilibrar: SugestaoSolver;
  ganhar: SugestaoSolver;
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

/**
 * Score de receita de um plantão por janela. Usado pela lente "ganhar"
 * pra escolher a janela mais lucrativa quando o hospital aceita ambas.
 */
function receitaJanela(
  hospitalId: string,
  hospitais: HospitaisMap,
  noturno: boolean,
): number {
  const hosp = hospitais[hospitalId];
  if (!hosp) return 0;
  const fake: BlocoPlantao = {
    id: 'tmp',
    tipo: 'plantao',
    hospitalId,
    data: '2000-01-01',
    horaInicio: noturno ? 19 : 7,
    duracao: 12,
  };
  return calcRemuneracaoBloco(fake, hosp).liquido;
}

function escolherHospital(
  diaISO: string,
  hospitais: HospitaisMap,
  prefs: Preferencias,
  limites: Limites,
  cfg: LenteCfg,
  padroes: PadraoMedica[],
): string | null {
  const ordemBase = [
    ...prefs.hospitaisPreferidos.filter((id) => hospitais[id]),
    ...Object.keys(hospitais).filter((id) => !prefs.hospitaisPreferidos.includes(id)),
  ];

  // Score por hospital: combina preferência + padrão observado pra esse DOW + (lente ganhar) receita
  const scored = ordemBase.map((id) => {
    let score = prefs.hospitaisPreferidos.includes(id) ? 1 : 0;
    // Padrão pesa MUITO · médica fazendo o que costuma fazer >> heurística genérica
    const bonus = bonusPadrao(
      { hospitalId: id, data: diaISO, horaInicio: 0, duracao: 0 },
      padroes,
    );
    score += bonus * 3;
    if (cfg.preferirNoturno) {
      score += receitaJanela(id, hospitais, true) / 10000;
    }
    return { id, score };
  });
  scored.sort((a, b) => b.score - a.score);

  for (const { id } of scored) {
    const hosp = hospitais[id];
    if (!hosp || !hosp.regras) continue;
    const usadoMes = limites.porHospitalMes.get(id) ?? 0;
    if (usadoMes >= hosp.regras.maxPorMes) continue;
    const limiteSemana = Math.max(1, hosp.regras.maxPorSemana - cfg.margemMaxSemana);
    const usadoSemana =
      limites.porHospitalSemana.get(semanaKey(diaISO))?.get(id) ?? 0;
    if (usadoSemana >= limiteSemana) continue;
    return id;
  }
  return null;
}

function janelaParaPlantao(
  prefs: Preferencias,
  hospitalId: string,
  hospitais: HospitaisMap,
  cfg: LenteCfg,
  diaISO: string,
  padroes: PadraoMedica[],
): { horaInicio: number; duracao: number } {
  // Padrão observado pro mesmo DOW × hospital tem prioridade (mantém rotina natural)
  const dow = fromISO(diaISO).getDay();
  const padraoMatch = padroes
    .filter((p) => p.hospitalId === hospitalId && p.diaDeSemana === dow)
    .sort((a, b) => b.observadoEm / b.totalMeses - a.observadoEm / a.totalMeses)[0];
  if (padraoMatch) {
    return { horaInicio: padraoMatch.inicio, duracao: padraoMatch.duracao };
  }
  if (cfg.preferirNoturno) {
    const dia = receitaJanela(hospitalId, hospitais, false);
    const noite = receitaJanela(hospitalId, hospitais, true);
    if (noite > dia) return { horaInicio: 19, duracao: 12 };
  }
  if (prefs.janelaPreferida === 'noite') return { horaInicio: 19, duracao: 12 };
  return { horaInicio: 7, duracao: 12 };
}

export function sugerirPlantoes(opts: SugerirOpts): SugestaoSolver {
  const { blocos, hospitais, preferencias, mes } = opts;
  const lente: Lente = opts.lente ?? 'equilibrar';
  const cfg = LENTES[lente];
  const padroes = opts.padroes ?? [];

  const ini = inicioDoMes(`${mes}-01`);
  const fim = fimDoMes(`${mes}-01`);
  const fimT = fromISO(fim).getTime();

  const limites = calcularLimites(blocos, mes);
  const sugeridos: BlocoPlantao[] = [];
  const motivos: string[] = [];

  const meta = preferencias.metaMensal;
  let receitaAcum = 0;
  for (const b of blocos) {
    if (b.tipo !== 'plantao') continue;
    if (b.data.slice(0, 7) !== mes) continue;
    const hosp = hospitais[b.hospitalId];
    if (!hosp) continue;
    receitaAcum += calcRemuneracaoBloco(b, hosp).liquido;
  }

  const limitePorSemana = preferencias.maxPlantoesPorSemana - cfg.margemMaxSemana;
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

    const semana = semanaDe(cursor);
    const naSemana = [...sugeridos, ...blocos.filter((b) => b.tipo === 'plantao')].filter((b) =>
      semana.includes(b.data),
    ).length;
    if (naSemana >= limitePorSemana) {
      cursor = adicionaDia(cursor, 1);
      continue;
    }

    const hospitalId = escolherHospital(cursor, hospitais, preferencias, limites, cfg, padroes);
    if (!hospitalId) {
      motivos.push(`${cursor} pulado · hospitais cheios`);
      cursor = adicionaDia(cursor, 1);
      continue;
    }
    const hosp = hospitais[hospitalId]!;
    const { horaInicio, duracao } = janelaParaPlantao(preferencias, hospitalId, hospitais, cfg, cursor, padroes);

    const novo: BlocoPlantao = {
      id: `sug-${cursor}-${hospitalId}`,
      tipo: 'plantao',
      hospitalId,
      data: cursor,
      horaInicio,
      duracao,
    };

    // Conflito de agenda (sobreposição ou sem descanso) · sempre rejeita
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

    // Lente-específico: rejeitar se invade recuperação ou cria 3 dias seguidos
    if (cfg.rejeitarSeInvadeRecuperacao || cfg.rejeitarSe3DiasSeguidos) {
      const proxIni = adicionaDia(cursor, -2);
      const proxFim = adicionaDia(cursor, 2);
      const pre = analisarDescanso([...blocos, ...sugeridos], proxIni, proxFim);
      const pos = analisarDescanso([...blocos, ...sugeridos, novo], proxIni, proxFim);
      if (
        cfg.rejeitarSeInvadeRecuperacao &&
        pos.recuperacoesInvadidas.length > pre.recuperacoesInvadidas.length
      ) {
        motivos.push(`${cursor} pulado · invade recuperação`);
        cursor = adicionaDia(cursor, 1);
        continue;
      }
      if (cfg.rejeitarSe3DiasSeguidos && pos.diasSeguidos >= 3) {
        motivos.push(`${cursor} pulado · 3 dias seguidos`);
        cursor = adicionaDia(cursor, 1);
        continue;
      }
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

    if (cfg.pararQuandoMetaBate && meta > 0 && receitaAcum >= meta) break;

    cursor = adicionaDia(cursor, 1 + cfg.pulosEntreSugestoes - 1);
  }

  // Resumo · análise final do mês com sugestões aplicadas
  const finalAnalise = analisarDescanso([...blocos, ...sugeridos], ini, fim);

  return {
    blocos: sugeridos,
    lente,
    resumo: {
      sugeridos: sugeridos.length,
      receitaEstimada: receitaAcum,
      metaPct: meta > 0 ? Math.min(100, Math.round((receitaAcum / meta) * 100)) : null,
      maiorDescansoContinuo: finalAnalise.maiorDescansoContinuo,
      diasSeguidosMax: finalAnalise.diasSeguidos,
      recuperacoesInvadidas: finalAnalise.recuperacoesInvadidas.length,
      motivosPulados: motivos.slice(0, 8),
    },
  };
}

export function compararLentes(opts: Omit<SugerirOpts, 'lente'>): ComparativoLentes {
  return {
    descansar: sugerirPlantoes({ ...opts, lente: 'descansar' }),
    equilibrar: sugerirPlantoes({ ...opts, lente: 'equilibrar' }),
    ganhar: sugerirPlantoes({ ...opts, lente: 'ganhar' }),
  };
}
