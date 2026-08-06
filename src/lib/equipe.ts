import type { EscalaImportada, Janela, TurnoEquipe } from '@/types';
import { diaSemanaBR, fimDoMes, inicioDoMes, semanaDe, toISO } from './dates';

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

/** Janelas default quando o hospital não tem cadastro nem escala importada. */
export const JANELAS_DEFAULT: Janela[] = [
  { rotulo: 'dia', inicio: 7, duracao: 12 },
  { rotulo: 'noite', inicio: 19, duracao: 12 },
];
