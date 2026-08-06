import type { EscalaImportada, Janela, TurnoEquipe } from '@/types';
import { diaSemanaBR, fimDoMes, fromISO, inicioDoMes, semanaDe, toISO } from './dates';

/**
 * Helpers puros da escala de EQUIPE (página onde a chefe monta o mês do
 * time inteiro). Nada aqui toca estado · a view compõe.
 */

/** Médicos únicos de uma escala importada · mais escalados primeiro. */
export function medicosDaImportada(esc: EscalaImportada): string[] {
  const freq = new Map<string, number>();
  for (const c of esc.celulas) {
    for (const nome of c.nomes) {
      const limpo = nome.trim();
      if (!limpo) continue;
      freq.set(limpo, (freq.get(limpo) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([nome]) => nome);
}

/** Semanas seg→dom que tocam o mês (mesmas linhas do calendário). */
export function semanasDoMes(mesISO: string): string[][] {
  const inicio = inicioDoMes(`${mesISO}-01`);
  const fim = fimDoMes(`${mesISO}-01`);
  const out: string[][] = [];
  let cursor = semanaDe(inicio)[0]!;
  const fimMs = new Date(`${fim}T12:00:00`).getTime();
  for (let i = 0; i < 6; i++) {
    if (new Date(`${cursor}T12:00:00`).getTime() > fimMs) break;
    out.push([...semanaDe(cursor)]);
    const prox = new Date(`${cursor}T12:00:00`);
    prox.setDate(prox.getDate() + 7);
    cursor = toISO(prox);
  }
  return out;
}

export interface ResumoMedicoEquipe {
  medico: string;
  plantoes: number;
  /** Horas totais no mês. */
  total: number;
  /** Horas em sábado/domingo (pelo dia de início do turno). */
  fds: number;
  /** Horas por linha do calendário (semana seg→dom). */
  porSemana: number[];
}

/** Resumo por médico, na ordem do roster (inclui quem está zerado). */
export function resumoPorMedico(
  medicos: string[],
  turnos: TurnoEquipe[],
  janelas: Janela[],
  mesISO: string,
): ResumoMedicoEquipe[] {
  const dur = new Map(janelas.map((j) => [j.rotulo, j.duracao]));
  const semanas = semanasDoMes(mesISO);
  const semanaDoDia = new Map<string, number>();
  semanas.forEach((sem, i) => sem.forEach((d) => semanaDoDia.set(d, i)));

  const porMedico = new Map<string, ResumoMedicoEquipe>(
    medicos.map((m) => [
      m,
      { medico: m, plantoes: 0, total: 0, fds: 0, porSemana: semanas.map(() => 0) },
    ]),
  );

  for (const t of turnos) {
    const r = porMedico.get(t.medico);
    if (!r) continue; // médico removido do roster · turno órfão não conta
    const h = dur.get(t.janela) ?? 0;
    r.plantoes += 1;
    r.total += h;
    if (diaSemanaBR(t.data) >= 5) r.fds += h;
    const sem = semanaDoDia.get(t.data);
    if (sem !== undefined) r.porSemana[sem] = (r.porSemana[sem] ?? 0) + h;
  }
  return medicos.map((m) => porMedico.get(m)!);
}

const MS_HORA = 60 * 60 * 1000;

function faixaAbs(t: TurnoEquipe, dur: Map<string, Janela>): { ini: number; fim: number } | null {
  const j = dur.get(t.janela);
  if (!j) return null;
  const base = new Date(`${t.data}T00:00:00`).getTime() / MS_HORA;
  return { ini: base + j.inicio, fim: base + j.inicio + j.duracao };
}

/**
 * Chaves "medico|data" com sobreposição de horário pro MESMO médico —
 * inclusive noturno que vira o dia e colide com a manhã seguinte.
 * A view pinta os dois lados do choque.
 */
export function conflitosEquipe(turnos: TurnoEquipe[], janelas: Janela[]): Set<string> {
  const mapa = new Map(janelas.map((j) => [j.rotulo, j]));
  const out = new Set<string>();
  const porMedico = new Map<string, TurnoEquipe[]>();
  for (const t of turnos) {
    const arr = porMedico.get(t.medico) ?? [];
    arr.push(t);
    porMedico.set(t.medico, arr);
  }
  for (const [, lista] of porMedico) {
    for (let i = 0; i < lista.length; i++) {
      for (let k = i + 1; k < lista.length; k++) {
        const a = faixaAbs(lista[i]!, mapa);
        const b = faixaAbs(lista[k]!, mapa);
        if (!a || !b) continue;
        if (a.ini < b.fim && b.ini < a.fim) {
          out.add(`${lista[i]!.medico}|${lista[i]!.data}|${lista[i]!.janela}`);
          out.add(`${lista[k]!.medico}|${lista[k]!.data}|${lista[k]!.janela}`);
        }
      }
    }
  }
  return out;
}

/**
 * Ids usados pelo drag-and-drop da página de equipe. Ficam aqui (e não
 * inline na view) porque a resolução do drop é a parte com regra — e
 * regra a gente testa.
 *
 *   chip do roster        → `med|{medico}`
 *   chip já escalado      → `turno|{data}|{janela}|{medico}`
 *   alvo (slot de turno)  → `slot|{data}|{janela}`
 */
export function idChipRoster(medico: string): string {
  return `med|${medico}`;
}

export function idChipEscalado(t: TurnoEquipe): string {
  return `turno|${t.data}|${t.janela}|${t.medico}`;
}

export function idSlot(data: string, janela: string): string {
  return `slot|${data}|${janela}`;
}

export interface RetanguloSlot {
  id: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * Escolhe o slot alvo de um drop pela PONTA DO CURSOR.
 *
 * A detecção default do dnd-kit usa a área do chip arrastado, que numa
 * grade de dia-por-linha atravessa duas linhas e escala no dia vizinho do
 * que a pessoa mirou. Aqui:
 *   1. slot sob o cursor → esse
 *   2. senão, slot na MESMA FAIXA VERTICAL (mesmo dia), o mais próximo na
 *      horizontal → cobre o vão de 6px entre colunas
 *   3. senão → null · não adivinha dia. Escalar silenciosamente no dia
 *      errado é pior que não escalar (a pessoa só repete o gesto).
 */
export function escolherSlotPorPonteiro(
  ponteiro: { x: number; y: number } | null,
  rects: RetanguloSlot[],
): string | null {
  if (!ponteiro) return null;
  const { x, y } = ponteiro;
  const dentro = rects.find(
    (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
  );
  if (dentro) return dentro.id;

  const mesmaFaixa = rects.filter((r) => y >= r.top && y <= r.bottom);
  if (mesmaFaixa.length === 0) return null;
  return mesmaFaixa.reduce((melhor, r) => {
    const dist = (rr: RetanguloSlot) =>
      x < rr.left ? rr.left - x : x > rr.right ? x - rr.right : 0;
    return dist(r) < dist(melhor) ? r : melhor;
  }).id;
}

export type AcaoDrop =
  | { tipo: 'nada' }
  | { tipo: 'escalar'; medico: string; data: string; janela: string }
  | { tipo: 'mover'; de: TurnoEquipe; data: string; janela: string };

/**
 * Traduz (o que foi arrastado, onde soltou) na ação a executar.
 * Soltar fora de um slot, ou de volta no mesmo slot, não faz nada.
 */
export function resolverDrop(activeId: string, overId: string | null): AcaoDrop {
  if (!overId || !overId.startsWith('slot|')) return { tipo: 'nada' };
  const [, data, janela] = overId.split('|');
  if (!data || !janela) return { tipo: 'nada' };

  if (activeId.startsWith('med|')) {
    const medico = activeId.slice('med|'.length);
    if (!medico) return { tipo: 'nada' };
    return { tipo: 'escalar', medico, data, janela };
  }

  if (activeId.startsWith('turno|')) {
    const [, dataOrigem, janelaOrigem, ...resto] = activeId.split('|');
    const medico = resto.join('|');
    if (!dataOrigem || !janelaOrigem || !medico) return { tipo: 'nada' };
    if (dataOrigem === data && janelaOrigem === janela) return { tipo: 'nada' };
    return {
      tipo: 'mover',
      de: { data: dataOrigem, janela: janelaOrigem, medico },
      data,
      janela,
    };
  }

  return { tipo: 'nada' };
}

/** Janelas default quando o hospital não tem cadastro nem escala importada. */
export const JANELAS_DEFAULT: Janela[] = [
  { rotulo: 'dia', inicio: 7, duracao: 12 },
  { rotulo: 'noite', inicio: 19, duracao: 12 },
];

/** Ordinal do dia-da-semana dentro do mês (1º sábado, 2º sábado…). */
function ordinalNoMes(iso: string): number {
  return Math.floor((fromISO(iso).getDate() - 1) / 7) + 1;
}

/** ISO do N-ésimo dia-da-semana `dow` (0=seg…6=dom) do mês · null se não existe. */
function dataDoOrdinal(mesISO: string, dow: number, ordinal: number): string | null {
  const primeiro = `${mesISO}-01`;
  const offset = (dow - diaSemanaBR(primeiro) + 7) % 7;
  const dia = 1 + offset + (ordinal - 1) * 7;
  const fim = fromISO(fimDoMes(primeiro)).getDate();
  if (dia > fim) return null;
  return `${mesISO}-${String(dia).padStart(2, '0')}`;
}

/**
 * Pré-posiciona a escala nova a partir de uma escala antiga: cada célula
 * migra pro MESMO dia-da-semana e MESMA posição no mês (2ª terça → 2ª
 * terça). Célula sem correspondente (5ª ocorrência que o mês novo não
 * tem), janela que não existe mais ou médico fora do roster ficam de fora
 * — é ponto de partida, não gabarito.
 */
export function turnosDeReferencia(
  referencia: EscalaImportada,
  mesAlvoISO: string,
  janelasAlvo: Janela[],
  roster: string[],
): TurnoEquipe[] {
  const rotulos = new Map(janelasAlvo.map((j) => [j.rotulo.toLowerCase(), j.rotulo]));
  const nomesRoster = new Set(roster);
  const out: TurnoEquipe[] = [];
  const vistos = new Set<string>();
  for (const c of referencia.celulas) {
    const janela = rotulos.get(c.turno.toLowerCase());
    if (!janela) continue;
    const data = dataDoOrdinal(mesAlvoISO, diaSemanaBR(c.data), ordinalNoMes(c.data));
    if (!data) continue;
    for (const nomeCru of c.nomes) {
      const medico = nomeCru.trim();
      if (!medico || !nomesRoster.has(medico)) continue;
      const chave = `${data}|${janela}|${medico}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push({ data, janela, medico });
    }
  }
  return out;
}
