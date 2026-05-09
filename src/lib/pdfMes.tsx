import type { BlocoPlantao, Hospital } from '@/types';
import {
  DOWS_LONG,
  diaSemanaBR,
  fimDoMes,
  fmtHora,
  fromISO,
  inicioDoMes,
  semanaDe,
} from './dates.js';
import { fmtMesAnoExtenso } from './exportar.js';

export interface PdfMesOpts {
  hospital: Hospital;
  plantoes: BlocoPlantao[];
  mesISO: string;
  nomeMedico: string;
  nomeChefe?: string;
}

/**
 * pdfMes · gera PDF nativo (vetor) usando jspdf · A4 landscape com
 * identidade visual fiel ao site:
 *   - Fontes Fraunces, Nunito e Caveat embedadas (.ttf base64)
 *   - Logo ColoMark vetorial (paths convertidos manualmente)
 *   - Blocos arredondados, cores das famílias, layout fiel
 *   - Texto VETORIAL · copiável e leve (~600kb-1MB total)
 *
 * Bloqueios pessoais NÃO entram no PDF · chefe não precisa saber.
 */

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

const COR_FAMILIA_INK: Record<string, [number, number, number]> = {
  sand: [148, 109, 60],
  coral: [148, 65, 50],
  sage: [76, 102, 67],
  olive: [89, 95, 50],
  lavender: [90, 78, 140],
  pink: [142, 76, 100],
  blue: [63, 110, 156],
  aqua: [60, 113, 119],
};

const COR_FAMILIA_WASH: Record<string, [number, number, number]> = {
  sand: [251, 241, 225],
  coral: [251, 233, 229],
  sage: [233, 240, 226],
  olive: [240, 240, 222],
  lavender: [240, 237, 250],
  pink: [250, 234, 242],
  blue: [234, 242, 249],
  aqua: [228, 244, 244],
};

const INK: [number, number, number] = [58, 46, 42];
const INK_2: [number, number, number] = [101, 86, 81];
const INK_3: [number, number, number] = [148, 132, 126];
const CREAM: [number, number, number] = [255, 250, 243];
const LINE: [number, number, number] = [228, 218, 207];

function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDataBR(iso: string): string {
  const d = fromISO(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtRangeFormal(ini: number, dur: number): string {
  return `${fmtHora(ini)} às ${fmtHora((ini + dur) % 24)}`;
}

function pluralPlantao(n: number): string {
  return n === 1 ? '1 plantão' : `${n} plantões`;
}

function tratamento(nome: string): string {
  const t = nome.trim();
  if (/^dr[a]?\.?\s/i.test(t)) return t;
  return `Dr(a). ${t}`;
}

function calcularSemanas(refIso: string): string[][] {
  const inicio = inicioDoMes(refIso);
  const fim = fimDoMes(refIso);
  const out: string[][] = [];
  let cursor = semanaDe(inicio)[0]!;
  const fimDt = fromISO(fim).getTime();
  let safety = 6;
  while (fromISO(cursor).getTime() <= fimDt && safety-- > 0) {
    out.push(semanaDe(cursor));
    const proxSeg = new Date(`${cursor}T12:00:00`);
    proxSeg.setDate(proxSeg.getDate() + 7);
    cursor = proxSeg.toISOString().slice(0, 10);
  }
  return out;
}

/** Cache das fontes em base64 · só fetch uma vez por sessão. */
const fontCache = new Map<string, string>();

async function carregarFonteB64(url: string): Promise<string> {
  const cached = fontCache.get(url);
  if (cached) return cached;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`falha ao carregar fonte ${url}`);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  // Convert byte to binary string in chunks (avoid call stack limit)
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(bin);
  fontCache.set(url, b64);
  return b64;
}

interface PdfFont {
  vfsName: string;
  pdfName: string;
  style: 'normal' | 'italic';
  weight: 'normal' | 'bold' | string;
}

const FONTES: Array<{ url: string; def: PdfFont }> = [
  { url: '/fonts/Fraunces-Regular.ttf', def: { vfsName: 'Fraunces-Regular.ttf', pdfName: 'Fraunces', style: 'normal', weight: 'normal' } },
  { url: '/fonts/Fraunces-Medium.ttf', def: { vfsName: 'Fraunces-Medium.ttf', pdfName: 'Fraunces', style: 'normal', weight: '500' } },
  { url: '/fonts/Nunito-Regular.ttf', def: { vfsName: 'Nunito-Regular.ttf', pdfName: 'Nunito', style: 'normal', weight: 'normal' } },
  { url: '/fonts/Caveat-Medium.ttf', def: { vfsName: 'Caveat-Medium.ttf', pdfName: 'Caveat', style: 'normal', weight: 'normal' } },
];

async function embedarFontes(pdf: import('jspdf').jsPDF): Promise<void> {
  for (const { url, def } of FONTES) {
    try {
      const b64 = await carregarFonteB64(url);
      pdf.addFileToVFS(def.vfsName, b64);
      pdf.addFont(def.vfsName, def.pdfName, def.style, def.weight);
    } catch (err) {
      // Falha em alguma fonte é tolerável · cai pra fallback Helvetica
      console.warn('embedarFontes:', err);
    }
  }
}

/** SVG do ColoMark v3 · usado pelo svg2pdf pra renderizar fielmente. */
const COLO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 313.08 71.53"><g><path fill="#A299CB" d="M94.98,13.83c.69-1.44,1.95-1.97,2.95-1.78,1.66.48,2.26,1.88,1.88,3.51-1.14,5.17-10.47,38.22-12.64,42.4-.72,1.38-2.22,1.79-3.43,1.43s-2.41-1.55-2.14-3.17c.52-3.6,11.19-37.79,13.38-42.39Z"/><path fill="#A299CB" d="M37.98,46.22c-.27-.08-.93.2-1.01.47-.83,3.05-4.08,1.53-4.34,2.87-.07.27.37.9.74.94,2.45.28,4.43-1,5.15-3.14.11-.34-.25-1.02-.54-1.13Z"/><path fill="#A299CB" d="M34.17,45.75c.51-.27.69-1.09.39-1.48-.2-.29-1.06-.31-1.34-.07l-.88.72c-.21.17,0,1.03.23,1.14.35.17,1.16-.05,1.6-.31Z"/><path fill="#A299CB" d="M27.74,44.22c-1.11.48.23,2.45-1.44,3.32-1.67.86-2.67-1.19-3.52-.26-.21.23-.19,1.13.07,1.37,1.4,1.33,3.26,1.28,4.62.36,1.34-.91,2.07-2.68,1.41-4.36-.11-.3-.84-.55-1.14-.43Z"/><path fill="#A299CB" d="M71.18,29.71C66.91,3.97,42.42-1.93,27.8.5,11.91,3.14-3.72,15.2.79,42.37c3.59,21.61,17.08,32.11,39.17,28.44,16.37-2.72,35.34-16.31,31.22-41.1ZM56.14,35.98c-.32.38-1.13.72-1.44.5-.44-.34-1.07-.63-1.43-.51-.46.14-.87.95-.61,1.46.21.42.67.76,1.15,1.07.23,1.76,0,3.68-.78,5.4-.94,2.11-3.04,2.03-2.33,3.56.17.35.78.48,1.35.37-3.23,7.59-12.66,10.3-20.96,8.86-.21-3.07-3.94-4.85-6.58-4.66-.92.05-1.47.01-2.27-.3-1.87-.76-3.05-2.12-2.84-4.22-5.23-4.88-6.14-12.52-3.24-18.85,1.17,2.32,3.5,3.38,5.9,2.85,2.15-.46,4.13-2.29,4.23-4.7.08-1.52-.97-2.77-2.23-3-1.38-.22-2.81.49-3.17,2-.07.31.29.99.59,1.11,1.14.44,1.31-1.19,2.05-1.1.27.02.66.64.63.91-.06,1.28-1.03,2.14-1.98,2.5-1.2.45-2.52.35-3.45-.61-4.15-4.21,5.99-15.05,18.46-13.71,6.93.73,12.49,5.65,14.18,12.3-.46.42-.8.99-.79,1.52,0,.27.43.83.68.91.3.1.9-.17,1.13-.44.83-1.01,2.21-.93,3.2-.09,2,1.68,2.24,4.86.55,6.86Z"/><path fill="#A299CB" d="M41.13,36.3c-1.18.41.21,2.43-1.62,3.3-1.9.9-2.87-1.31-3.74-.31-.21.23-.19,1.11.04,1.33,1.5,1.33,3.2,1.37,4.72.52,1.33-.73,2.13-2.23,1.98-3.93-.07-.66-.81-1.1-1.38-.91Z"/><path fill="#6257A5" d="M154.59,18.59c0,6.99-4.44,10.93-11.34,13.97-2.14.99-2.63,2.79-.9,4.36,5.18,4.69,10.85,10.44,11.51,14.14.99,5.59-2.63,9.21-7.07,9.21-1.48,0-3.04-.41-4.52-1.23-4.19-2.38-8.8-12.58-11.59-19.56-.9-2.14-2.05-2.79-3.21-2.79-.16,0-.41.08-.58.08-1.31.33-2.47,1.64-2.38,3.95.16,3.37.49,7.15-.08,12.17-.9,7.73-4.52,9.37-7.73,9.37-3.7,0-6.58-2.3-6.9-7.73-.41-6.58,1.64-39.21,2.05-43.65.74-7.64,3.12-10.03,12.99-10.03,18.66,0,29.76,4.85,29.76,17.75ZM127.96,25.16c8.88,0,12.25-3.86,12.25-7.4,0-4.03-4.27-7.64-11.59-7.73-2.88,0-4.44.41-4.52,1.97-.08.9-.25,5.67.25,9.62.33,2.96,1.56,3.53,3.62,3.53Z"/><path fill="#6257A5" d="M172.51,49.57c-.9,5.84-3.7,7.07-6.9,7.07-3.7,0-6.58-2.3-6.9-7.73-.41-6.58,1.64-21.54,2.05-26.22.33-3.62,2.38-5.84,5.51-5.84s4.93,2.14,5.01,5.59c.08,5.51,1.97,22.52,1.23,27.12ZM172.27,7.57c-.99,3.29-3.45,4.85-5.84,4.93-3.21,0-5.51-2.3-6.25-5.34-.66-2.88.66-6.82,6.41-6.82s6.66,4.11,5.67,7.23Z"/><path fill="#6257A5" d="M178.59,25.57c.99-.08,2.14-.16,3.37-.25.74-5.67,1.89-10.6,3.53-13.15,1.32-2.05,3.53-3.29,6.25-3.29,3.12,0,5.67,2.05,5.92,5.67.25,3.45-.9,6.9-2.22,10.77,2.63.08,4.77.25,5.75.49,4.44,1.15,4.44,7.4-.08,7.97-2.3.33-5.34.49-8.55.58-.58,2.3-.99,4.69-.99,7.23-.08,4.52,1.4,6.74,3.29,6.82,3.37.08,3.04-6.49,9.29-6.49,8.47,0,8.96,19.48-8.06,19.48-5.75,0-11.51-2.71-13.56-8.47-1.15-3.29-1.64-10.77-1.32-18.49-.99,0-1.89-.08-2.71-.08-5.67-.16-5.84-8.22.08-8.79Z"/><path fill="#6257A5" d="M286.68,57.22c6.99,0,13.73-2.55,17.84-6.08,1.31-1.07,2.63-1.56,3.86-1.56,3.53,0,6.17,4.27,3.78,9.54-2.63,6-11.1,12.08-25.32,12.08-34.93,0-33.37-27.45-31.89-39.62.58-5.18-.41-7.81-3.37-7.81-2.47,0-4.6,3.95-4.6,11.51,0,3.45.82,6.91.49,10.44-.49,4.85-2.55,8.3-7.81,8.3s-7.32-3.86-7.23-8.88c0-4.52,1.81-8.63,1.81-13.07,0-2.38-.66-5.01-3.29-5.01-3.04,0-4.69,4.03-4.69,8.8,0,1.89.82,8.3.49,12.08-.49,4.85-2.55,8.3-7.81,8.3s-7.32-3.86-7.23-8.88c.08-8.3.82-21.7,2.63-29.76.58-2.38,1.89-3.78,4.69-3.78,2.96,0,4.36,1.4,4.85,3.86.49,2.14.82,4.93.82,6.99,1.97-3.95,5.59-7.64,10.27-7.56,2.63.08,7.64,1.64,9.62,7.07,2.79-5.84,7.07-10.36,12.58-10.36,3.86,0,7.32,2.14,8.96,6.66,3.7,10.44-3.53,32.63,15.37,36.25,1.73.33,3.45.49,5.18.49ZM274.35,29.93c0-7.56,5.01-19.4,18.33-19.4s18.08,10.69,18.08,19.15c0,11.43-6.41,17.34-17.59,17.34-14.06,0-18.82-8.88-18.82-17.1ZM286.11,29.52c0,2.96,1.89,6.74,6.41,6.74s6.49-4.19,6.49-6.82c0-2.88-1.73-6.08-6.66-6.08-3.95,0-6.25,2.14-6.25,6.17Z"/></g></svg>`;


/**
 * Rasteriza o SVG do ColoMark em PNG via canvas. Resolução = altura
 * desejada × 3 (DPI alta o suficiente pra ficar nítido em impressão).
 */
async function logoComoPng(alturaPdfPt: number): Promise<{ data: string; w: number; h: number }> {
  const svgRatio = 313.08 / 71.53;
  // 3× pra ficar nítido em impressão (1pt ~ 1.33px @96dpi · 3× scale ~ 240dpi)
  const heightPx = Math.round(alturaPdfPt * 3);
  const widthPx = Math.round(heightPx * svgRatio);

  const blob = new Blob([COLO_MARK_SVG], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = (e) => rej(e);
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d ctx indisponível');
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    return {
      data: canvas.toDataURL('image/png'),
      w: alturaPdfPt * svgRatio,
      h: alturaPdfPt,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Adiciona logo PNG no PDF · retorna largura ocupada em pt. */
async function desenharLogo(
  pdf: import('jspdf').jsPDF,
  x: number,
  y: number,
  h: number,
): Promise<number> {
  try {
    const png = await logoComoPng(h);
    pdf.addImage(png.data, 'PNG', x, y, png.w, png.h, undefined, 'FAST');
    return png.w;
  } catch (err) {
    console.warn('logo falhou:', err);
    return h * (313.08 / 71.53);
  }
}

export async function gerarPdfMes(opts: PdfMesOpts): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('gerarPdfMes só roda no browser');
  }

  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'landscape',
    compress: true,
  });

  await embedarFontes(pdf);
  await renderizarConteudoPdf(pdf, opts);
  return pdf.output('blob');
}

/**
 * Renderiza o conteúdo (depois das fontes já estarem embedadas).
 * Extraído pra permitir teste em Node.js standalone com fontes lidas
 * do filesystem em vez de fetch.
 */
export async function renderizarConteudoPdf(pdf: import('jspdf').jsPDF, opts: PdfMesOpts): Promise<void> {

  const W = pdf.internal.pageSize.getWidth(); // 842
  const H = pdf.internal.pageSize.getHeight(); // 595
  const M = 36;

  const cor = COR_FAMILIA[opts.hospital.cor] ?? [120, 120, 120];
  const corInk = COR_FAMILIA_INK[opts.hospital.cor] ?? [80, 80, 80];
  const wash = COR_FAMILIA_WASH[opts.hospital.cor] ?? [240, 240, 240];

  // Background cream
  pdf.setFillColor(...CREAM);
  pdf.rect(0, 0, W, H, 'F');

  // Faixa colorida no topo
  pdf.setFillColor(...cor);
  pdf.rect(0, 0, W, 5, 'F');

  // ===================== HEADER =====================
  // Logo
  const logoH = 28;
  await desenharLogo(pdf, M, M + 4, logoH);

  // Eyebrow
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...INK_3);
  pdf.text('SUGESTÃO DE ESCALA', M, M + 4 + logoH + 14, { charSpace: 0.6 });

  // Nome do hospital (Fraunces medium)
  pdf.setFont('Fraunces', 'normal', '500');
  pdf.setFontSize(28);
  pdf.setTextColor(...corInk);
  pdf.text(opts.hospital.nome, M, M + 4 + logoH + 42);

  // Sub
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(...INK_2);
  pdf.text(
    `${capitalizar(fmtMesAnoExtenso(opts.mesISO))}  ·  ${pluralPlantao(opts.plantoes.length)}  ·  ${opts.nomeMedico}`,
    M,
    M + 4 + logoH + 60,
  );

  // Linha divisória
  const linhaY = M + 4 + logoH + 72;
  pdf.setDrawColor(...cor);
  pdf.setLineWidth(0.6);
  pdf.line(M, linhaY, W - M, linhaY);

  // ===================== SAUDAÇÃO =====================
  let y = linhaY + 22;
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  const saud = opts.nomeChefe
    ? `Prezado(a) ${tratamento(opts.nomeChefe)},`
    : 'Prezado(a),';
  pdf.text(saud, M, y);
  y += 14;
  const intro = pdf.splitTextToSize(
    `Apresento abaixo a proposta de plantões para ${fmtMesAnoExtenso(opts.mesISO)} no ${opts.hospital.nome}, conforme minha disponibilidade. Fico à disposição para os ajustes que forem necessários.`,
    W - M * 2,
  );
  pdf.text(intro, M, y);
  y += intro.length * 12 + 14;

  // ===================== CALENDÁRIO + LISTA =====================
  const ordenados = [...opts.plantoes].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
  );

  const calX = M;
  const calY = y;
  const calW = (W - M * 2) * 0.66;
  const calH = H - calY - M - 56;
  const listaX = calX + calW + 18;
  const listaW = W - M - listaX;

  desenharCalendario(pdf, {
    plantoes: ordenados,
    mesISO: opts.mesISO,
    hospital: opts.hospital,
    cor,
    corInk,
    wash,
    x: calX,
    y: calY,
    w: calW,
    h: calH,
  });

  desenharLista(pdf, {
    plantoes: ordenados,
    cor,
    corInk,
    x: listaX,
    y: calY,
    w: listaW,
    h: calH,
  });

  // ===================== ASSINATURA + FOOTER =====================
  const sigY = H - M - 26;
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text('Atenciosamente,', M, sigY);
  pdf.setFont('Caveat', 'normal');
  pdf.setFontSize(22);
  pdf.setTextColor(...corInk);
  pdf.text(opts.nomeMedico, M, sigY + 22);

  // Footer
  const footerY = H - 18;
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...INK_3);
  pdf.text('Documento gerado pelo Colo Ritmo', M, footerY);
  pdf.text(new Date().toLocaleDateString('pt-BR'), W - M, footerY, { align: 'right' });
}

interface CalendarioArgs {
  plantoes: BlocoPlantao[];
  mesISO: string;
  hospital: Hospital;
  cor: [number, number, number];
  corInk: [number, number, number];
  wash: [number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
}

function desenharCalendario(pdf: import('jspdf').jsPDF, args: CalendarioArgs) {
  const { plantoes, mesISO, hospital, cor, corInk, wash, x, y, w, h } = args;
  const semanas = calcularSemanas(`${mesISO}-15`);
  const colW = w / 7;
  const headerH = 18;
  const rowH = (h - headerH) / semanas.length;

  const mesAlvo = fromISO(`${mesISO}-15`).getMonth();

  // Borda externa arredondada
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(x, y, w, h, 8, 8, 'S');

  // Header dos dias
  pdf.setFillColor(251, 245, 236);
  pdf.rect(x + 0.5, y + 0.5, w - 1, headerH, 'F');
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.4);
  pdf.line(x, y + headerH, x + w, y + headerH);

  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...INK_3);
  ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].forEach((d, i) => {
    pdf.text(d, x + i * colW + 8, y + 12, { charSpace: 0.6 });
  });

  semanas.forEach((semana, semIdx) => {
    const cellY = y + headerH + semIdx * rowH;
    semana.forEach((iso, dayIdx) => {
      const cellX = x + dayIdx * colW;
      const dia = fromISO(iso);
      const noMes = dia.getMonth() === mesAlvo;

      // Numero do dia (Fraunces)
      pdf.setFont('Fraunces', 'normal');
      pdf.setFontSize(noMes ? 13 : 9);
      pdf.setTextColor(...(noMes ? INK : INK_3));
      pdf.text(String(dia.getDate()), cellX + 8, cellY + 16);

      const p = plantoes.find((pl) => pl.data === iso);
      if (p) {
        const bx = cellX + 6;
        const by = cellY + 22;
        const bw = colW - 12;
        const bh = Math.min(28, rowH - 28);

        // Fundo arredondado wash
        pdf.setFillColor(...wash);
        pdf.roundedRect(bx, by, bw, bh, 4, 4, 'F');
        // Borda esquerda colorida
        pdf.setFillColor(...cor);
        pdf.roundedRect(bx, by, 3, bh, 1.5, 1.5, 'F');

        // Abrev + duração
        pdf.setFont('Nunito', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...corInk);
        pdf.text(`${hospital.abrev}  ·  ${p.duracao}h`, bx + 8, by + 10);

        // Horário
        pdf.setFont('Nunito', 'normal');
        pdf.setFontSize(6.5);
        pdf.setTextColor(...INK_2);
        pdf.text(
          `${fmtHora(p.horaInicio)}–${fmtHora((p.horaInicio + p.duracao) % 24)}`,
          bx + 8,
          by + 20,
        );
      }

      // Linha vertical separadora
      if (dayIdx > 0) {
        pdf.setDrawColor(...LINE);
        pdf.setLineWidth(0.3);
        pdf.line(cellX, cellY, cellX, cellY + rowH);
      }
    });

    // Linha horizontal entre semanas
    if (semIdx < semanas.length - 1) {
      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.3);
      pdf.line(x, cellY + rowH, x + w, cellY + rowH);
    }
  });
}

interface ListaArgs {
  plantoes: BlocoPlantao[];
  cor: [number, number, number];
  corInk: [number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
}

function desenharLista(pdf: import('jspdf').jsPDF, args: ListaArgs) {
  const { plantoes, cor, corInk, x, y, w, h } = args;

  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...INK_3);
  pdf.text('DETALHAMENTO', x, y + 10, { charSpace: 0.6 });

  pdf.setDrawColor(...cor);
  pdf.setLineWidth(0.6);
  pdf.line(x, y + 16, x + w, y + 16);

  let cy = y + 30;
  if (plantoes.length === 0) {
    pdf.setFont('Nunito', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK_3);
    pdf.text('Sem plantões propostos.', x, cy);
    return;
  }

  for (const p of plantoes) {
    if (cy + 30 > y + h - 14) break;
    const dia = fromISO(p.data);
    const dow = capitalizar(DOWS_LONG[diaSemanaBR(p.data)] ?? '');

    pdf.setFont('Fraunces', 'normal', '500');
    pdf.setFontSize(11);
    pdf.setTextColor(...INK);
    pdf.text(
      `${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}  ·  ${dow}`,
      x,
      cy,
    );
    cy += 11;

    pdf.setFont('Nunito', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK_2);
    pdf.text(`${fmtRangeFormal(p.horaInicio, p.duracao)}  (${p.duracao}h)`, x, cy);
    cy += 13;
  }

  // Total
  const totalY = y + h - 6;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.line(x, totalY - 14, x + w, totalY - 14);
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...INK_3);
  pdf.text('TOTAL', x, totalY - 2, { charSpace: 0.6 });
  pdf.setFont('Fraunces', 'normal', '500');
  pdf.setFontSize(11);
  pdf.setTextColor(...corInk);
  pdf.text(pluralPlantao(plantoes.length), x + w, totalY - 2, { align: 'right' });
}

// Reutilizado por exportar.ts caller (mantém compat)
export function fmtDataExtensoFix(iso: string): string {
  return fmtDataBR(iso);
}
