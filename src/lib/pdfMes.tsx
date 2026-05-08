import type { Bloco, BlocoPlantao, Hospital } from '@/types';
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
  bloqueios: Bloco[];
  mesISO: string;
  nomeMedico: string;
  nomeChefe?: string;
}

/**
 * pdfMes · gera PDF nativo (vetor) usando jspdf · A4 landscape, texto
 * copiável, calendário desenhado em vetor. Sem html2canvas, sem raster:
 * arquivo final ~50–150kb em vez de ~10MB e abre rápido.
 *
 * Layout: cabeçalho identitário · saudação · calendário visual · tabela
 * de detalhamento ao lado · assinatura · footer.
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

// Versões "surface" (lavadas) das cores · pra fundo dos bloquinhos
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

function ordenar(plantoes: BlocoPlantao[]): BlocoPlantao[] {
  return [...plantoes].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
  );
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

export async function gerarPdfMes(opts: PdfMesOpts): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape', compress: true });

  const W = pdf.internal.pageSize.getWidth(); // 842pt
  const H = pdf.internal.pageSize.getHeight(); // 595pt
  const M = 36; // margem

  const cor = COR_FAMILIA[opts.hospital.cor] ?? [120, 120, 120];
  const wash = COR_FAMILIA_WASH[opts.hospital.cor] ?? [240, 240, 240];

  // Background cream
  pdf.setFillColor(...CREAM);
  pdf.rect(0, 0, W, H, 'F');

  // Faixa colorida no topo
  pdf.setFillColor(...cor);
  pdf.rect(0, 0, W, 4, 'F');

  // ===================== HEADER =====================
  let y = M + 18;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...INK_3);
  pdf.text('COLO RITMO  ·  SUGESTÃO DE ESCALA', M, y);

  y += 26;
  pdf.setFont('times', 'normal');
  pdf.setFontSize(28);
  pdf.setTextColor(...cor);
  pdf.text(opts.hospital.nome, M, y);

  y += 16;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(...INK_2);
  pdf.text(
    `${capitalizar(fmtMesAnoExtenso(opts.mesISO))}  ·  ${pluralPlantao(opts.plantoes.length)}  ·  ${opts.nomeMedico}`,
    M,
    y,
  );

  // Linha divisória
  y += 10;
  pdf.setDrawColor(...cor);
  pdf.setLineWidth(0.6);
  pdf.line(M, y, W - M, y);

  // ===================== SAUDAÇÃO =====================
  y += 22;
  pdf.setFont('helvetica', 'normal');
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
  y += intro.length * 12 + 16;

  // ===================== CALENDÁRIO + LISTA =====================
  const ordenados = ordenar(opts.plantoes);
  const bloqueiosNoMes = opts.bloqueios.filter((b) => b.data.startsWith(opts.mesISO));

  // Calendário ocupa 70% da largura, lista 30%
  const calX = M;
  const calY = y;
  const calW = (W - M * 2) * 0.66;
  const calH = H - calY - M - 60; // deixa espaço pra footer
  const listaX = calX + calW + 18;
  const listaW = W - M - listaX;

  desenharCalendario(pdf, {
    plantoes: ordenados,
    bloqueios: bloqueiosNoMes,
    mesISO: opts.mesISO,
    hospital: opts.hospital,
    cor,
    wash,
    x: calX,
    y: calY,
    w: calW,
    h: calH,
  });

  desenharLista(pdf, {
    plantoes: ordenados,
    cor,
    wash,
    x: listaX,
    y: calY,
    w: listaW,
    h: calH,
  });

  // ===================== ASSINATURA + FOOTER =====================
  const sigY = H - M - 30;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text('Atenciosamente,', M, sigY);
  pdf.setFont('times', 'italic');
  pdf.setFontSize(14);
  pdf.setTextColor(...cor);
  pdf.text(opts.nomeMedico, M, sigY + 18);

  // Footer
  const footerY = H - 18;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...INK_3);
  pdf.text('Documento gerado pelo Colo Ritmo', M, footerY);
  pdf.text(new Date().toLocaleDateString('pt-BR'), W - M, footerY, { align: 'right' });

  return pdf.output('blob');
}

interface CalendarioArgs {
  plantoes: BlocoPlantao[];
  bloqueios: Bloco[];
  mesISO: string;
  hospital: Hospital;
  cor: [number, number, number];
  wash: [number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
}

// Helper local · jsPDF type sem 'any'
type Pdf = ReturnType<typeof import('jspdf').jsPDF.prototype.output> extends infer _ ? import('jspdf').jsPDF : never;

function desenharCalendario(pdf: Pdf, args: CalendarioArgs) {
  const { plantoes, bloqueios, mesISO, hospital, cor, wash, x, y, w, h } = args;
  const semanas = calcularSemanas(`${mesISO}-15`);
  const colW = w / 7;
  const headerH = 16;
  const rowH = (h - headerH) / semanas.length;

  const mesAlvo = fromISO(`${mesISO}-15`).getMonth();

  // Borda externa
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(x, y, w, h, 6, 6, 'S');

  // Header dos dias (SEG TER ...)
  pdf.setFillColor(...CREAM);
  pdf.rect(x + 0.5, y + 0.5, w - 1, headerH, 'F');
  pdf.setDrawColor(...LINE);
  pdf.line(x, y + headerH, x + w, y + headerH);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...INK_3);
  ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].forEach((d, i) => {
    pdf.text(d, x + i * colW + 6, y + 11);
  });

  semanas.forEach((semana, semIdx) => {
    const cellY = y + headerH + semIdx * rowH;
    semana.forEach((iso, dayIdx) => {
      const cellX = x + dayIdx * colW;
      const dia = fromISO(iso);
      const noMes = dia.getMonth() === mesAlvo;

      // Numero do dia
      pdf.setFont('times', 'normal');
      pdf.setFontSize(noMes ? 12 : 9);
      pdf.setTextColor(...(noMes ? INK : INK_3));
      pdf.text(String(dia.getDate()), cellX + 6, cellY + 14);

      // Plantão proposto naquele dia
      const p = plantoes.find((pl) => pl.data === iso);
      if (p) {
        const blocY = cellY + 18;
        const blocH = Math.min(28, rowH - 22);
        pdf.setFillColor(...wash);
        pdf.roundedRect(cellX + 4, blocY, colW - 8, blocH, 3, 3, 'F');
        // Borda esquerda colorida
        pdf.setFillColor(...cor);
        pdf.rect(cellX + 4, blocY, 2.5, blocH, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...cor);
        pdf.text(`${hospital.abrev}  ·  ${p.duracao}h`, cellX + 10, blocY + 9);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...INK_2);
        pdf.text(
          `${fmtHora(p.horaInicio)}–${fmtHora((p.horaInicio + p.duracao) % 24)}`,
          cellX + 10,
          blocY + 19,
        );
      }

      // Bloqueio · faixa cinza diagonal
      const blq = bloqueios.find((b) => b.data === iso);
      if (blq && blq.tipo === 'bloqueio' && noMes) {
        pdf.setFillColor(...LINE);
        pdf.setGState(pdf.GState({ opacity: 0.35 }));
        pdf.rect(cellX + 1, cellY + 1, colW - 2, rowH - 2, 'F');
        pdf.setGState(pdf.GState({ opacity: 1 }));
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.setTextColor(...INK_3);
        const motivo = blq.motivo ? `· ${blq.motivo.slice(0, 14)}` : '';
        pdf.text(`bloq ${motivo}`.slice(0, 16), cellX + 6, cellY + rowH - 6);
      }

      // Linha vertical separadora (entre dias)
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
  wash: [number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
}

function desenharLista(pdf: Pdf, args: ListaArgs) {
  const { plantoes, cor, x, y, w, h } = args;

  // Título
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...INK_3);
  pdf.text('DETALHAMENTO', x, y + 10);

  pdf.setDrawColor(...cor);
  pdf.setLineWidth(0.6);
  pdf.line(x, y + 16, x + w, y + 16);

  let cy = y + 30;
  if (plantoes.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK_3);
    pdf.text('Sem plantões propostos.', x, cy);
    return;
  }

  pdf.setFontSize(9);
  for (const p of plantoes) {
    if (cy + 30 > y + h) break; // não estoura
    const dia = fromISO(p.data);
    const dow = capitalizar(DOWS_LONG[diaSemanaBR(p.data)] ?? '');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...INK);
    pdf.text(`${String(dia.getDate()).padStart(2, '0')}/${String(dia.getMonth() + 1).padStart(2, '0')}  ·  ${dow}`, x, cy);
    cy += 11;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...INK_2);
    pdf.text(`${fmtRangeFormal(p.horaInicio, p.duracao)}  (${p.duracao}h)`, x, cy);
    cy += 10;

    if (p.setor) {
      pdf.setFontSize(8);
      pdf.setTextColor(...INK_3);
      pdf.text(p.setor, x, cy);
      cy += 12;
    } else {
      cy += 4;
    }
    pdf.setFontSize(9);
  }

  // Total
  const totalY = y + h - 6;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.line(x, totalY - 14, x + w, totalY - 14);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...INK);
  pdf.text(`Total · ${pluralPlantao(plantoes.length)}`, x, totalY - 2);
}
