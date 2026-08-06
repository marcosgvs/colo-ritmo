/**
 * Exportadores da escala de EQUIPE além do PDF (pdfEquipe.ts):
 *
 *   - texto: escala completa ou de um médico, pronta pra copiar/colar
 *     no grupo ou mandar individualmente (português FORMAL · documento
 *     externo, diferente do app).
 *   - ics: feed de calendário — escala inteira ou só os turnos de um
 *     médico. Mesmo approach do ics.ts: hora local flutuante (sem Z),
 *     DTSTAMP UTC obrigatório, CRLF, escape RFC 5545.
 *   - xlsx: planilha dia × janela + resumo por médico (dynamic import,
 *     como no exportarMontar).
 *
 * Tudo aqui é função pura exceto os `baixar*` (Blob/anchor + xlsx).
 */

import type { Janela, TurnoEquipe } from '@/types';
import { DOWS, capitalize, diaSemanaBR, fromISO, toISO } from './dates.js';
import { resumoPorMedico } from './equipe.js';
import type { DadosPDFEquipe } from './pdfEquipe.js';
import {
  agruparPorDiaJanela,
  diasDoMes,
  fmtDuracao,
  fmtHorarioJanela,
  mesPorExtenso,
  nomeArquivoEquipe,
  rotuloDiaCurto,
  rotuloDiaLongo,
  slugNome,
  turnosDoMedicoOrdenados,
} from './pdfEquipe.js';

// --- Helpers locais -----------------------------------------------------------

/** "Seg 01/09" · dia curto + dd/mm, pro texto da escala completa. */
function rotuloDiaComMes(iso: string): string {
  const dow = DOWS[diaSemanaBR(iso)] ?? '?';
  const d = fromISO(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${capitalize(dow)} ${dia}/${mes}`;
}

/** Troca a extensão .pdf do nomeArquivoEquipe pela pedida. */
function nomeComExtensao(d: DadosPDFEquipe, ext: string, medico?: string): string {
  return nomeArquivoEquipe(d.hospitalAbrev, d.mesISO, medico).replace(/\.pdf$/, `.${ext}`);
}

// --- TEXTO ---------------------------------------------------------------------

/** Texto formal da escala completa (vai pro grupo/mural · português formal). */
export function textoEquipeGeral(d: DadosPDFEquipe): string {
  const cabecalho = `Escala de Plantões — ${d.hospitalNome}\n${mesPorExtenso(d.mesISO)}\n\n`;
  const celulas = agruparPorDiaJanela(d.turnos, d.medicos);
  const obs = d.obs ?? {};

  const blocos: string[] = [];
  for (const iso of diasDoMes(d.mesISO)) {
    const linhas: string[] = [];
    for (const j of d.janelas) {
      const nomes = celulas.get(`${iso}|${j.rotulo}`);
      if (!nomes || nomes.length === 0) continue;
      linhas.push(`  ${capitalize(j.rotulo)} (${fmtHorarioJanela(j)}): ${nomes.join(' · ')}`);
    }
    const textoObs = (obs[iso] ?? '').trim();
    if (textoObs) linhas.push(`  Obs.: ${textoObs}`);
    if (linhas.length === 0) continue; // dia vazio fica de fora
    blocos.push([rotuloDiaComMes(iso), ...linhas].join('\n'));
  }

  return `${cabecalho}${blocos.join('\n\n')}\n\nGerado pelo Colo Ritmo`;
}

/** Texto formal da escala de UM médico. */
export function textoEquipeMedico(d: DadosPDFEquipe, medico: string): string {
  const cabecalho = `Escala de Plantões — ${d.hospitalNome}\n${mesPorExtenso(d.mesISO)}\nDr(a). ${medico}\n\n`;
  const janelaPorRotulo = new Map(d.janelas.map((j) => [j.rotulo, j]));
  const turnos = turnosDoMedicoOrdenados(d.turnos, d.janelas, medico);

  const linhas = turnos.map((t) => {
    const j = janelaPorRotulo.get(t.janela);
    const horario = j ? ` (${fmtHorarioJanela(j)})` : '';
    return `${rotuloDiaLongo(t.data)} — ${capitalize(t.janela)}${horario}`;
  });

  const corpo =
    linhas.length > 0 ? linhas.join('\n') : 'Nenhum plantão registrado neste mês.';

  const resumo = resumoPorMedico([medico], turnos, d.janelas, d.mesISO)[0]!;
  const total = `\nTotal no mês: ${fmtDuracao(resumo.total)} · Fins de semana: ${fmtDuracao(resumo.fds)} · Plantões: ${resumo.plantoes}`;

  return `${cabecalho}${corpo}\n${total}`;
}

// --- ICS -----------------------------------------------------------------------

function escapeICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Agora em UTC no formato YYYYMMDDTHHMMSSZ · obrigatório no RFC 5545. */
function dtstampUTC(agora: Date = new Date()): string {
  return `${agora.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/** Hora local flutuante YYYYMMDDTHHMMSS (sem Z · mesmo approach do ics.ts). */
function stampLocal(iso: string, hora: number): string {
  const hh = Math.floor(hora);
  const mm = Math.round((hora - hh) * 60);
  return `${iso.replace(/-/g, '')}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
}

/** Fim do turno · hora que passa de 24 rola pro(s) dia(s) seguinte(s). */
function fimDoTurno(iso: string, inicio: number, dur: number): { data: string; hora: number } {
  const total = inicio + dur;
  if (total < 24) return { data: iso, hora: total };
  const diasOffset = Math.floor(total / 24);
  const d = fromISO(iso);
  d.setDate(d.getDate() + diasOffset);
  return { data: toISO(d), hora: total - diasOffset * 24 };
}

/**
 * Conteúdo .ics · sem `medico` = escala inteira (SUMMARY inclui o nome de
 * cada médico) · com `medico` = só os turnos dele.
 */
export function icsEquipe(d: DadosPDFEquipe, medico?: string): string {
  const janelaPorRotulo = new Map<string, Janela>(d.janelas.map((j) => [j.rotulo, j]));
  const inicioDe = (t: TurnoEquipe): number => janelaPorRotulo.get(t.janela)?.inicio ?? 99;

  const turnos = d.turnos
    .filter((t) => (medico ? t.medico === medico : true))
    .sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        inicioDe(a) - inicioDe(b) ||
        a.medico.localeCompare(b.medico),
    );

  const stamp = dtstampUTC();
  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Colo Ritmo//Equipe//PT',
    'CALSCALE:GREGORIAN',
  ];

  for (const t of turnos) {
    const j = janelaPorRotulo.get(t.janela);
    if (!j) continue; // janela removida · sem horário não dá pra gerar evento
    const fim = fimDoTurno(t.data, j.inicio, j.duracao);
    const summary = medico
      ? `Plantão ${d.hospitalAbrev} — ${capitalize(t.janela)}`
      : `Plantão ${d.hospitalAbrev} — ${capitalize(t.janela)} — ${t.medico}`;
    linhas.push(
      'BEGIN:VEVENT',
      `UID:equipe-${slugNome(d.hospitalAbrev)}-${t.data}-${slugNome(t.janela)}-${slugNome(t.medico)}@colopediatria.com.br`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${escapeICS(summary)}`,
      `LOCATION:${escapeICS(d.hospitalNome)}`,
      `DTSTART:${stampLocal(t.data, j.inicio)}`,
      `DTEND:${stampLocal(fim.data, fim.hora)}`,
      'END:VEVENT',
    );
  }

  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n') + '\r\n';
}

// --- DOWNLOADS -------------------------------------------------------------------

const MIME_POR_EXTENSAO: Record<string, string> = {
  txt: 'text/plain;charset=utf-8',
  ics: 'text/calendar;charset=utf-8',
};

/** Baixa arquivo .txt / .ics (Blob + anchor). Extensão decide o MIME. */
export function baixarArquivoTexto(nomeArquivo: string, conteudo: string): void {
  const ext = nomeArquivo.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_POR_EXTENSAO[ext] ?? 'application/octet-stream';
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * XLSX da escala completa: aba "Escala" = linhas dias, colunas janelas +
 * coluna "Obs."; aba "Resumo" = por médico (plantões, horas, horas fds).
 */
export async function baixarXLSXEquipe(d: DadosPDFEquipe): Promise<void> {
  const xlsxMod = await import('xlsx');
  const XLSX = xlsxMod.default ?? xlsxMod;

  // --- Aba 1 · Escala (dia × janela) ---
  const celulas = agruparPorDiaJanela(d.turnos, d.medicos);
  const obs = d.obs ?? {};
  const header = [
    'Dia',
    ...d.janelas.map((j) => `${capitalize(j.rotulo)} (${fmtHorarioJanela(j)})`),
    'Obs.',
  ];
  const linhas = diasDoMes(d.mesISO).map((iso) => [
    rotuloDiaCurto(iso), // "Seg 01"
    ...d.janelas.map((j) => (celulas.get(`${iso}|${j.rotulo}`) ?? []).join(' · ')),
    (obs[iso] ?? '').trim(),
  ]);
  const wsEscala = XLSX.utils.aoa_to_sheet([header, ...linhas]);
  wsEscala['!cols'] = [
    { wch: 8 },
    ...d.janelas.map(() => ({ wch: 28 })),
    { wch: 36 },
  ];

  // --- Aba 2 · Resumo por médico ---
  const resumo = resumoPorMedico(d.medicos, d.turnos, d.janelas, d.mesISO);
  const wsResumo = XLSX.utils.aoa_to_sheet([
    ['Médico', 'Plantões', 'Horas totais', 'Horas em fins de semana'],
    ...resumo.map((r) => [r.medico, r.plantoes, r.total, r.fds]),
  ]);
  wsResumo['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsEscala, 'Escala');
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  XLSX.writeFile(wb, nomeComExtensao(d, 'xlsx'));
}
