import type { Bloco, CargaSemana, Hospital, HospitaisMap, Nivel, Preferencias } from '@/types';

/**
 * data.ts · ponto único de import pra dados de domínio. Em vez de uma
 * pilha gigante, esse módulo redireciona pra os arquivos focados:
 *
 *   - dates.ts        (toISO/fromISO/fmtDate/fmtHora/...)
 *   - cadeias.ts      (calcCadeias)
 *   - conflitos.ts    (cargaSemanal, detectarConflitos)
 *   - remuneracao.ts  (calcRemuneracaoBloco/Mes, ehNoturno)
 *   - ics.ts          (parsearICS, gerarICS, eventoParaBloco)
 *
 * Sample data + hospitais default ficam aqui (pra Sessão 1 e fallback
 * quando o user_state está vazio).
 */

import {
  MESES,
  fromISO,
  toISO,
  adicionaDia,
  inicioDaSemana,
  inicioDoMes,
  fimDoMes,
} from './dates.js';

export {
  DOWS,
  DOWS_LONG,
  MESES,
  ehISO,
  toISO,
  fromISO,
  adicionaDia,
  diasEntre,
  diaSemanaBR,
  inicioDaSemana,
  fimDaSemana,
  inicioDoMes,
  fimDoMes,
  fmtDate,
  fmtHora,
  fmtRange,
  semanaDe,
} from './dates.js';

export { calcCadeias } from './cadeias.js';
export type { Cadeia } from './cadeias.js';

export { cargaSemanal, detectarConflitos, marcarConflitos } from './conflitos.js';
export type { Conflito, TipoConflito } from './conflitos.js';

export {
  calcRemuneracaoBloco,
  calcRemuneracaoMes,
  ehNoturno,
} from './remuneracao.js';
export type { ResumoBloco, ResumoMes } from './remuneracao.js';

export {
  parsearICS,
  gerarICS,
  eventoParaBloco,
} from './ics.js';

export {
  analisarDescanso,
  espelhoDescanso,
  faixaRecuperacao,
  faixaAbsoluta,
  faixasRecuperacaoNaSemana,
  RECUPERACAO_NOITE_HORAS,
  DESCANSO_MIN_SAUDAVEL,
} from './descanso.js';
export type {
  AnaliseDescanso,
  EspelhoDescanso,
  RecuperacaoInvadida,
  FaixaRecuperacaoNoDia,
  Faixa,
} from './descanso.js';

export const HOSPITAIS: HospitaisMap = {
  HSL: {
    id: 'HSL',
    nome: 'Hospital Santa Lúcia',
    abrev: 'HSL',
    cor: 'sand',
    tipo: 'privado',
    valorPlantao: 1800,
    valorHora: 150,
    adicionalNoite: 200,
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 1,
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00'],
      maxPorMes: 8,
    },
  },
  HBDF: {
    id: 'HBDF',
    nome: 'Hospital de Base do DF',
    abrev: 'HBDF',
    cor: 'blue',
    tipo: 'publico',
    valorPlantao: 1800,
    valorFixo: 1800,
    adicionalNoite: 250,
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 2,
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00', '13:00–19:00'],
      maxPorMes: 10,
    },
  },
  HDS: {
    id: 'HDS',
    nome: 'Hospital DF Star',
    abrev: 'HDS',
    cor: 'coral',
    tipo: 'privado',
    valorPlantao: 2400,
    valorHora: 200,
    adicionalNoite: 250,
    regras: {
      maxPorSemana: 1,
      minFimDeSemana: 0,
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00'],
      maxPorMes: 6,
    },
  },
  HCB: {
    id: 'HCB',
    nome: 'Hospital da Criança',
    abrev: 'HCB',
    cor: 'aqua',
    tipo: 'publico',
    valorPlantao: 1600,
    valorFixo: 1600,
    adicionalNoite: 200,
    regras: {
      maxPorSemana: 2,
      minFimDeSemana: 1,
      duracaoPlantao: 12,
      janelas: ['07:00–19:00', '19:00–07:00'],
      maxPorMes: 8,
    },
  },
};

export const PREFERENCIAS_ME: Preferencias = {
  nome: 'Dra. Mariana',
  metaMensal: 22000,
  diasPreferidos: ['ter', 'qua', 'qui'],
  diasEvitar: ['dom'],
  hospitaisPreferidos: ['HBDF', 'HCB'],
  evitar24hCorrido: true,
  maxPlantoesPorSemana: 4,
  janelaPreferida: 'dia',
};

/** Semana de referência mockada — segunda 4 mai a domingo 10 mai 2026. */
export const SEMANA: readonly string[] = [
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
  '2026-05-07',
  '2026-05-08',
  '2026-05-09',
  '2026-05-10',
];

/**
 * Data de hoje em ISO (YYYY-MM-DD). Avaliada uma vez no carregamento do
 * módulo · refresh recalcula. Suficiente pra UX (a página recarrega ao
 * acordar/atualizar).
 */
export const HOJE: string = toISO(new Date());

/**
 * Map de hospitais do usuário em runtime · setado pelo App.tsx quando o
 * user_state carrega. `getHospital` consulta primeiro esse map (cobre
 * hospitais customizados com id "H-...") e cai pra constante default.
 */
let hospitaisRuntime: Record<string, Hospital> | null = null;

export function setHospitaisRuntime(map: Record<string, Hospital> | null): void {
  hospitaisRuntime = map;
}

export function getHospital(id: string | undefined): Hospital | undefined {
  if (!id) return undefined;
  return hospitaisRuntime?.[id] ?? HOSPITAIS[id];
}

export function nivelCarga(h: number): Nivel {
  if (h < 40) return 'ok';
  if (h < 60) return 'warn';
  return 'err';
}

/**
 * Estado "cheia" da semana 4–10 mai · 48h de plantão, troca, cedido,
 * deslocamento, bloqueio. Espelha BLOCOS_CHEIA de design-bundle/data.jsx.
 * Usado como fallback até o user_state real carregar do Supabase.
 */
export const BLOCOS_SEMANA: Bloco[] = [
  { id: 1, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-04', horaInicio: 7,  duracao: 6 },
  { id: 2, tipo: 'deslocamento', data: '2026-05-04', horaInicio: 13, duracao: 0.5, de: 'HSL', para: 'HCB', auto: true },
  { id: 3, tipo: 'plantao', hospitalId: 'HCB',  data: '2026-05-04', horaInicio: 19, duracao: 12 },
  { id: 4, tipo: 'sono',                          data: '2026-05-05', horaInicio: 8,  duracao: 8 },
  { id: 5, tipo: 'plantao', hospitalId: 'HBDF', data: '2026-05-06', horaInicio: 13, duracao: 6 },
  { id: 6, tipo: 'cedido',  hospitalId: 'HSL',  data: '2026-05-07', horaInicio: 7,  duracao: 6,  cedidoPara: 'Dra. Ana', motivo: 'aniversário do filho' },
  { id: 7, tipo: 'plantao', hospitalId: 'HSL',  data: '2026-05-08', horaInicio: 19, duracao: 12, viaTroca: true, trocaInfo: 'Dr. João · HBDF sex' },
  { id: 8, tipo: 'bloqueio',                       data: '2026-05-09', horaInicio: 0,  duracao: 24, motivo: 'aniversário Mariana' },
  { id: 9, tipo: 'plantao', hospitalId: 'HCB',  data: '2026-05-10', horaInicio: 7,  duracao: 12 },
];

/**
 * Calcula a carga (h de plantão) das semanas SEG–DOM que tocam o mês de
 * `mesISO`. Cada item vira uma linha no card "ritmo do mês" do Rail.
 */
export function cargaSemanasDoMes(
  blocos: Bloco[],
  mesISO: string = HOJE,
): CargaSemana[] {
  const ini = inicioDaSemana(inicioDoMes(mesISO));
  const fim = fimDoMes(mesISO);
  const out: CargaSemana[] = [];
  let cursor = ini;
  // Safety cap: 6 iterações (qualquer mês cabe em até 6 semanas).
  for (let i = 0; i < 6 && cursor <= fim; i++) {
    const seg = cursor;
    const dom = adicionaDia(cursor, 6);
    const horas = blocos.reduce((s, b) => {
      if (b.tipo !== 'plantao') return s;
      if (b.data >= seg && b.data <= dom) return s + b.duracao;
      return s;
    }, 0);
    out.push({ sem: labelSemana(seg, dom), h: horas, nivel: nivelCarga(horas) });
    cursor = adicionaDia(cursor, 7);
  }
  return out;
}

function labelSemana(seg: string, dom: string): string {
  const dSeg = fromISO(seg);
  const dDom = fromISO(dom);
  const diaSeg = dSeg.getDate();
  const diaDom = dDom.getDate();
  const mesSeg = MESES[dSeg.getMonth()];
  const mesDom = MESES[dDom.getMonth()];
  if (mesSeg === mesDom) return `${diaSeg}–${diaDom} ${mesSeg}`;
  // Cruza mês · formato compacto dd/mm pra não quebrar linha
  const mmSeg = String(dSeg.getMonth() + 1).padStart(2, '0');
  const mmDom = String(dDom.getMonth() + 1).padStart(2, '0');
  return `${diaSeg}/${mmSeg} – ${diaDom}/${mmDom}`;
}
