import type { BlocoPlantao, Hospital } from '@/types';
import { DOWS_LONG, diaSemanaBR, fmtHora, fromISO } from './dates.js';

/**
 * exportar.ts · transforma plantões propostos em saídas pra
 * compartilhar com o chefe (mensagem texto, CSV). Saídas externas usam
 * Português padrão (capitalização, pontuação) — o sentence-case
 * minúsculo é só pro app interno.
 */

const MES_LONGO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDataBR(iso: string): string {
  const d = fromISO(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}

function fmtDataExtenso(iso: string): string {
  const d = fromISO(iso);
  const dow = capitalizar(DOWS_LONG[diaSemanaBR(iso)] ?? '');
  return `${dow}, ${d.getDate()} de ${MES_LONGO[d.getMonth()]}`;
}

export function fmtMesAnoExtenso(mesISO: string): string {
  const [ano, mes] = mesISO.split('-').map(Number);
  if (!ano || !mes) return mesISO;
  return `${MES_LONGO[mes - 1]} de ${ano}`;
}

function fmtRangeFormal(ini: number, dur: number): string {
  const fim = (ini + dur) % 24;
  return `${fmtHora(ini)} às ${fmtHora(fim)}`;
}

function pluralPlantao(n: number): string {
  return n === 1 ? '1 plantão' : `${n} plantões`;
}

/**
 * Adiciona Dr(a). se o nome ainda não vem com tratamento. Aceita
 * "Roberto", "Dr. Roberto", "Dra. Ana", "Dr Roberto" etc · não
 * duplica.
 */
function formatarTratamento(nome: string): string {
  const t = nome.trim();
  if (/^dr[a]?\.?\s/i.test(t)) return t;
  return `Dr(a). ${t}`;
}

export interface DadosExportacao {
  /** Hospital ao qual a sugestão se refere. */
  hospital: Hospital;
  /** Plantões dentro desse hospital, ordenados ou não · função reordena. */
  plantoes: BlocoPlantao[];
  /** Mês ISO YYYY-MM. */
  mesISO: string;
  /** Nome da médica (ela). */
  nomeMedico: string;
  /** Nome do chefe da equipe naquele hospital · opcional. */
  nomeChefe?: string;
}

function ordenar(plantoes: BlocoPlantao[]): BlocoPlantao[] {
  return [...plantoes].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
  );
}

/**
 * Mensagem em Português padrão para enviar via WhatsApp/email pro
 * chefe. NÃO usa o sentence-case minúsculo do app — saída externa,
 * formal, bem escrita.
 */
export function montarMensagem(opts: DadosExportacao): string {
  const { hospital, mesISO, nomeMedico, nomeChefe } = opts;
  const plantoes = ordenar(opts.plantoes);
  const saudacao = nomeChefe ? `Olá, ${formatarTratamento(nomeChefe)}!` : 'Olá!';
  const linhas = plantoes.map(
    (p) =>
      `• ${fmtDataExtenso(p.data)}, das ${fmtRangeFormal(p.horaInicio, p.duracao)} (${p.duracao}h)`,
  );

  const corpo = plantoes.length === 0
    ? 'Esse mês não tenho plantões a propor neste hospital.'
    : `Segue minha sugestão de plantões para ${fmtMesAnoExtenso(mesISO)} no ${hospital.nome}:\n\n${linhas.join('\n')}\n\nTotal: ${pluralPlantao(plantoes.length)}.`;

  return `${saudacao}

${corpo}

Fico à disposição para ajustar conforme a necessidade da escala.

Atenciosamente,
${nomeMedico}`;
}

/**
 * CSV simples · separador `;` (Excel-pt-BR amigável). Cabeçalho em
 * Português padrão. Encoding: UTF-8 com BOM pra Excel reconhecer.
 */
export function montarCSV(opts: DadosExportacao): string {
  const plantoes = ordenar(opts.plantoes);
  const linhas: string[] = [
    'Data;Dia;Início;Fim;Duração (h);Hospital',
  ];
  for (const p of plantoes) {
    const dow = capitalizar(DOWS_LONG[diaSemanaBR(p.data)] ?? '');
    const fim = (p.horaInicio + p.duracao) % 24;
    linhas.push([
      fmtDataBR(p.data),
      dow,
      fmtHora(p.horaInicio),
      fmtHora(fim),
      String(p.duracao),
      escapeCSV(opts.hospital.nome),
    ].join(';'));
  }
  return '﻿' + linhas.join('\r\n');
}

function escapeCSV(s: string): string {
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface AgrupadoPorHospital {
  hospital: Hospital;
  plantoes: BlocoPlantao[];
}

/**
 * Agrupa plantões por hospital · cada item da saída tem o hospital e
 * só os plantões daquele hospital. Hospitais sem plantão sugerido NÃO
 * aparecem (não tem sentido exportar planilha vazia).
 */
export function agruparPorHospital(
  plantoes: BlocoPlantao[],
  hospitais: Record<string, Hospital>,
): AgrupadoPorHospital[] {
  const mapa = new Map<string, BlocoPlantao[]>();
  for (const p of plantoes) {
    if (!mapa.has(p.hospitalId)) mapa.set(p.hospitalId, []);
    mapa.get(p.hospitalId)!.push(p);
  }
  const out: AgrupadoPorHospital[] = [];
  for (const [hospId, ps] of mapa) {
    const hospital = hospitais[hospId];
    if (!hospital) continue;
    out.push({ hospital, plantoes: ps });
  }
  return out;
}

// Mapeamento das cores das famílias usadas nos PDFs · espelha tokens
// CSS pra manter coerência visual com o app.
const COR_FAMILIA: Record<string, [number, number, number]> = {
  sand: [196, 159, 110],
  coral: [212, 124, 110],
  sage: [120, 145, 109],
  olive: [137, 142, 91],
  lavender: [162, 153, 203],
  pink: [203, 138, 156],
  blue: [125, 156, 184],
  aqua: [114, 167, 174],
};

const INK: [number, number, number] = [58, 46, 42];
const INK_2: [number, number, number] = [101, 86, 81];
const INK_3: [number, number, number] = [148, 132, 126];
const CREAM: [number, number, number] = [255, 250, 243];

/**
 * Gera PDF da escala proposta · uma página por hospital. Usa jspdf
 * carregado via dynamic import pra não inflar o bundle inicial.
 */
export async function gerarPDF(opts: DadosExportacao): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const margem = 50;
  const cor = COR_FAMILIA[opts.hospital.cor] ?? [120, 120, 120];

  // Background cream
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F');

  // Faixa colorida no topo
  doc.setFillColor(...cor);
  doc.rect(0, 0, W, 6, 'F');

  let y = margem + 20;

  // Eyebrow Colo Ritmo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK_3);
  doc.text('COLO RITMO', margem, y);
  y += 18;

  // Nome do hospital (display)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(...cor);
  doc.text(opts.hospital.nome, margem, y);
  y += 12;

  // Mês/ano + tipo
  doc.setFontSize(12);
  doc.setTextColor(...INK_2);
  doc.text(
    `Sugestão de plantões · ${capitalizar(fmtMesAnoExtenso(opts.mesISO))}`,
    margem,
    y + 14,
  );
  y += 36;

  // Linha divisória
  doc.setDrawColor(...cor);
  doc.setLineWidth(0.6);
  doc.line(margem, y, W - margem, y);
  y += 22;

  // Saudação + parágrafo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  const saudacao = opts.nomeChefe
    ? `Prezado(a) ${formatarTratamento(opts.nomeChefe)},`
    : 'Prezado(a),';
  doc.text(saudacao, margem, y);
  y += 18;
  const intro = doc.splitTextToSize(
    `Apresento abaixo a proposta de plantões para ${fmtMesAnoExtenso(opts.mesISO)} no ${opts.hospital.nome}, organizada com base na minha disponibilidade e nas regras da instituição. Fico à disposição para os ajustes que forem necessários.`,
    W - margem * 2,
  );
  doc.text(intro, margem, y);
  y += intro.length * 14 + 18;

  // Tabela de plantões
  const plantoes = ordenar(opts.plantoes);
  if (plantoes.length === 0) {
    doc.setTextColor(...INK_3);
    doc.setFontSize(10);
    doc.text('Nenhum plantão proposto neste hospital.', margem, y);
    y += 24;
  } else {
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK_3);
    doc.text('DATA', margem, y);
    doc.text('DIA', margem + 80, y);
    doc.text('HORÁRIO', margem + 160, y);
    doc.text('DURAÇÃO', margem + 250, y);
    y += 6;
    doc.setDrawColor(...INK_3);
    doc.setLineWidth(0.3);
    doc.line(margem, y, W - margem, y);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    for (const p of plantoes) {
      const dow = capitalizar(DOWS_LONG[diaSemanaBR(p.data)] ?? '');
      doc.text(fmtDataBR(p.data), margem, y);
      doc.text(dow, margem + 80, y);
      doc.text(fmtRangeFormal(p.horaInicio, p.duracao), margem + 160, y);
      doc.text(`${p.duracao}h`, margem + 250, y);
      y += 16;
      if (y > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage();
        doc.setFillColor(...CREAM);
        doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F');
        y = margem;
      }
    }
    y += 8;
    doc.setDrawColor(...INK_3);
    doc.line(margem, y, W - margem, y);
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`Total: ${pluralPlantao(plantoes.length)}`, margem, y);
    y += 28;
  }

  // Assinatura
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Atenciosamente,', margem, y);
  y += 18;
  doc.setFontSize(12);
  doc.text(opts.nomeMedico, margem, y);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setFontSize(8);
  doc.setTextColor(...INK_3);
  const hoje = new Date().toLocaleDateString('pt-BR');
  doc.text(`Documento gerado pelo Colo Ritmo em ${hoje}.`, margem, footerY);

  return doc.output('blob');
}

/** Dispara download de string como arquivo. Funciona em browser. */
export function downloadString(conteudo: string, nomeArquivo: string, mime = 'text/plain'): void {
  const blob = new Blob([conteudo], { type: `${mime};charset=utf-8` });
  download(blob, nomeArquivo);
}

/** Dispara download de qualquer Blob. */
export function download(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Copia texto pra clipboard · retorna true se conseguiu. */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export function nomeArquivo(hospital: Hospital, mesISO: string, ext: string): string {
  const slug = hospital.abrev.toLowerCase().replace(/\s+/g, '-');
  return `colo-ritmo_${slug}_${mesISO}.${ext}`;
}
