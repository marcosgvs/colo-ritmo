/**
 * Helpers de data · puros, sem dependência de timezone do navegador.
 * Convenção: toda data passa em ISO YYYY-MM-DD. Quando precisamos
 * combinar com hora, usamos T12:00:00 (meio-dia local) pra evitar drift
 * por DST e timezones com offsets fracionários.
 */

export const DOWS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;
export const DOWS_LONG = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
] as const;
export const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Throw se a string não estiver em YYYY-MM-DD. */
export function ehISO(s: unknown): s is string {
  return typeof s === 'string' && ISO_RE.test(s);
}

/** YYYY-MM-DD · não usa timezone do JS pra evitar drift. */
export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Converte YYYY-MM-DD pra Date (meio-dia local pra estabilidade). */
export function fromISO(iso: string): Date {
  if (!ehISO(iso)) throw new Error(`fromISO: esperado YYYY-MM-DD, recebeu '${iso}'`);
  return new Date(`${iso}T12:00:00`);
}

/** Soma N dias e retorna ISO. Aceita N negativo. */
export function adicionaDia(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Diferença em dias inteiros (b - a). Negativo se b < a. */
export function diasEntre(a: string, b: string): number {
  const da = fromISO(a).getTime();
  const db = fromISO(b).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** Conversão JS → BR · 0=segunda, 6=domingo. */
export function diaSemanaBR(iso: string): number {
  const js = fromISO(iso).getDay();
  return js === 0 ? 6 : js - 1;
}

/** ISO da segunda da semana de `iso`. */
export function inicioDaSemana(iso: string): string {
  return adicionaDia(iso, -diaSemanaBR(iso));
}

/** ISO do domingo da semana de `iso`. */
export function fimDaSemana(iso: string): string {
  return adicionaDia(iso, 6 - diaSemanaBR(iso));
}

/** Primeiro dia (ISO) do mês de `iso`. */
export function inicioDoMes(iso: string): string {
  const d = fromISO(iso);
  d.setDate(1);
  return toISO(d);
}

/** Último dia (ISO) do mês de `iso`. */
export function fimDoMes(iso: string): string {
  const d = fromISO(iso);
  d.setMonth(d.getMonth() + 1, 0);
  return toISO(d);
}

/** "qua 7 mai" · usado em listas, drawer, recibos. */
export function fmtDate(iso: string): string {
  const d = fromISO(iso);
  const dow = DOWS[diaSemanaBR(iso)];
  const mes = MESES[d.getMonth()];
  return `${dow} ${d.getDate()} ${mes}`;
}

/** "07:30" · zero-padded, sem segundos. */
export function fmtHora(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** "19:00 → 07:00" · cruza meia-noite implícito. */
export function fmtRange(inicio: number, dur: number): string {
  const fim = (inicio + dur) % 24;
  return `${fmtHora(inicio)} → ${fmtHora(fim)}`;
}

/** Lista das 7 datas (segunda a domingo) que contêm `iso`. */
export function semanaDe(iso: string): string[] {
  const seg = inicioDaSemana(iso);
  return Array.from({ length: 7 }, (_, i) => adicionaDia(seg, i));
}
