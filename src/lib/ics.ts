import type { Bloco, BlocoPlantao, Hospital, HospitaisMap } from '../types/index.js';
import { fmtRange, fromISO, toISO } from './dates.js';

/**
 * RFC 5545 simplificado · só suportamos VCALENDAR/VEVENT com DTSTART e
 * DTEND. Suficiente pra gerar feed compatível com Google Calendar /
 * Apple Calendar e parsear escala importada de hospital.
 *
 * Linhas longas são quebradas em 75 octetos com espaço inicial; aqui
 * mantemos curto pra não precisar implementar folding/unfolding além
 * do mínimo necessário.
 */

const VAR_LINE_RE = /^([A-Z][A-Z0-9-]*)(?:;[^:]*)?:(.*)$/;

interface VEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  dtStart?: string; // ISO local (YYYYMMDDTHHmmss) ou data (YYYYMMDD)
  dtEnd?: string;
}

/**
 * Parse cru de ICS. Retorna VEVENTs sem semântica de domínio.
 * Lida com line folding (linhas que começam com espaço continuam a
 * anterior).
 */
export function parsearICS(text: string): VEvent[] {
  const linhas = unfold(text.split(/\r?\n/));
  const eventos: VEvent[] = [];
  let atual: VEvent | null = null;

  for (const raw of linhas) {
    const linha = raw.trim();
    if (linha === 'BEGIN:VEVENT') {
      atual = {};
      continue;
    }
    if (linha === 'END:VEVENT') {
      if (atual) eventos.push(atual);
      atual = null;
      continue;
    }
    if (!atual) continue;
    const m = linha.match(VAR_LINE_RE);
    if (!m) continue;
    const [, prop = '', valor = ''] = m;
    switch (prop) {
      case 'UID':
        atual.uid = valor;
        break;
      case 'SUMMARY':
        atual.summary = unescapeICS(valor);
        break;
      case 'DESCRIPTION':
        atual.description = unescapeICS(valor);
        break;
      case 'LOCATION':
        atual.location = unescapeICS(valor);
        break;
      case 'DTSTART':
        atual.dtStart = valor;
        break;
      case 'DTEND':
        atual.dtEnd = valor;
        break;
    }
  }
  return eventos;
}

function unfold(linhas: string[]): string[] {
  const out: string[] = [];
  for (const linha of linhas) {
    if ((linha.startsWith(' ') || linha.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += linha.slice(1);
    } else {
      out.push(linha);
    }
  }
  return out;
}

function unescapeICS(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/**
 * Converte VEVENT bruto pra Bloco. hospitalId é obrigatório porque o
 * parser não tem como inferir sem heurística do summary.
 */
export function eventoParaBloco(
  evt: VEvent,
  opts: { id: number | string; hospitalId: string },
): BlocoPlantao | null {
  if (!evt.dtStart || !evt.dtEnd) return null;
  const ini = parseICSDate(evt.dtStart);
  const fim = parseICSDate(evt.dtEnd);
  if (!ini || !fim) return null;
  const horaInicio = ini.hora;
  let duracao = fim.hora - ini.hora;
  if (fim.iso !== ini.iso) {
    const diasOffset = (fromISO(fim.iso).getTime() - fromISO(ini.iso).getTime()) / 86_400_000;
    duracao = fim.hora + 24 * diasOffset - ini.hora;
  }
  return {
    id: opts.id,
    tipo: 'plantao',
    hospitalId: opts.hospitalId,
    data: ini.iso,
    horaInicio,
    duracao,
  };
}

function parseICSDate(raw: string): { iso: string; hora: number } | null {
  // YYYYMMDD ou YYYYMMDDTHHmmssZ?
  const dataMatch = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!dataMatch) return null;
  const [, y = '', m = '', d = '', H = '00', M = '00'] = dataMatch;
  const iso = `${y}-${m}-${d}`;
  const hora = parseInt(H, 10) + parseInt(M, 10) / 60;
  return { iso, hora };
}

interface GerarICSOptions {
  nome: string;
  /** Calendário · default "Colo Ritmo · {nome}". */
  calendario?: string;
}

/** Serializa blocos como feed ICS. Apenas plantões (cedido/sono ignorados). */
export function gerarICS(
  blocos: Bloco[],
  hospitais: HospitaisMap,
  opts: GerarICSOptions,
): string {
  const calendario = opts.calendario ?? `Colo Ritmo · ${opts.nome}`;
  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Colo Ritmo//PT-BR//',
    `X-WR-CALNAME:${escapeICS(calendario)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const b of blocos) {
    if (b.tipo !== 'plantao') continue;
    const hosp = hospitais[b.hospitalId];
    if (!hosp) continue;
    linhas.push(...vevent(b, hosp));
  }

  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n') + '\r\n';
}

function vevent(b: BlocoPlantao, hosp: Hospital): string[] {
  const inicio = formatICSStamp(b.data, b.horaInicio);
  const fimDate = somaHoras(b.data, b.horaInicio, b.duracao);
  const fim = formatICSStamp(fimDate.data, fimDate.hora);
  const summary = hosp.abrev;
  const description = `${fmtRange(b.horaInicio, b.duracao)} · ${b.duracao}h · ${hosp.nome}`;
  return [
    'BEGIN:VEVENT',
    `UID:colo-ritmo-${b.id}@${hosp.id.toLowerCase()}.colopediatria`,
    // DTSTAMP é obrigatório no RFC 5545 · Outlook.com rejeita VEVENT sem.
    `DTSTAMP:${dtstampUTC()}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(hosp.nome)}`,
    `DTSTART:${inicio}`,
    `DTEND:${fim}`,
    'END:VEVENT',
  ];
}

/** Agora em UTC no formato YYYYMMDDTHHMMSSZ · gerado na serialização. */
function dtstampUTC(agora: Date = new Date()): string {
  return `${agora.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

function formatICSStamp(iso: string, hora: number): string {
  const yyyyMMdd = iso.replace(/-/g, '');
  const hh = Math.floor(hora);
  const mm = Math.round((hora - hh) * 60);
  const stamp = `${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  return `${yyyyMMdd}T${stamp}`;
}

function somaHoras(iso: string, horaInicio: number, dur: number): { data: string; hora: number } {
  const total = horaInicio + dur;
  if (total <= 24) return { data: iso, hora: total };
  const diasOffset = Math.floor(total / 24);
  const hora = total - diasOffset * 24;
  const d = fromISO(iso);
  d.setDate(d.getDate() + diasOffset);
  return { data: toISO(d), hora };
}
