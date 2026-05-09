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

export { cargaSemanal, detectarConflitos } from './conflitos.js';
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

export {
  analisarMesAnterior,
  mesAnteriorISO,
} from './diagnostico.js';
export type {
  DiagnosticoMes,
  Classificacao,
  LenteSugerida,
} from './diagnostico.js';

export {
  agruparPorHospital,
  copiarTexto,
  download,
  downloadString,
  fmtMesAnoExtenso,
  gerarPDF,
  montarCSV,
  montarMensagem,
  nomeArquivo,
} from './exportar.js';
export type { DadosExportacao, AgrupadoPorHospital } from './exportar.js';

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
      intervaloMinHoras: 11,
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
      intervaloMinHoras: 12,
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
      intervaloMinHoras: 11,
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
      intervaloMinHoras: 11,
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

export const HOJE = '2026-05-08';

export function getHospital(id: string | undefined): Hospital | undefined {
  return id ? HOSPITAIS[id] : undefined;
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

/** Carga das 4 semanas do mês — usado no Rail (ritmo do mês). */
export const CARGA_MES: CargaSemana[] = [
  { sem: '4–10 mai',  h: 48, nivel: 'warn' },
  { sem: '11–17 mai', h: 36, nivel: 'ok' },
  { sem: '18–24 mai', h: 64, nivel: 'err' },
  { sem: '25–31 mai', h: 32, nivel: 'ok' },
];
