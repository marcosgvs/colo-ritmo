import type { Bloco, CargaSemana, Hospital, Nivel } from '@/types';

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
 * user_state carrega. `getHospital` consulta esse map. Se um plantão
 * legado aponta pra um id que o user removeu, retorna undefined · a UI
 * já lida com isso (renderiza "—" ou esconde detalhes).
 */
let hospitaisRuntime: Record<string, Hospital> | null = null;

export function setHospitaisRuntime(map: Record<string, Hospital> | null): void {
  hospitaisRuntime = map;
}

export function getHospital(id: string | undefined): Hospital | undefined {
  if (!id) return undefined;
  return hospitaisRuntime?.[id];
}

export function nivelCarga(h: number): Nivel {
  if (h < 40) return 'ok';
  if (h < 60) return 'warn';
  return 'err';
}

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
