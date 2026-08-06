/**
 * Gerador de PDF da escala de EQUIPE · o documento oficial do mês.
 *
 * Dois formatos:
 *   1. COMPLETO  · tabela dia × janela com todos os médicos · vai pro
 *      mural/grupo do hospital. Retrato até 3 janelas · paisagem com 4+.
 *   2. POR MÉDICO · lista dos turnos de UMA pessoa + totais · pra mandar
 *      individualmente.
 *
 * Voz: português FORMAL (documento externo, vai pro hospital) · diferente
 * do app, que é minúsculo informal.
 *
 * Identidade visual idêntica ao pdfMontar: fundo creme, Fraunces pra
 * títulos, Nunito pro corpo, lavender de destaque. Vetorial puro · texto
 * copiável. Fontes e logo reusados de pdfMontar (cache compartilhado).
 */

import jsPDF from 'jspdf';
import type { Janela, TurnoEquipe } from '@/types';
import { DOWS, DOWS_LONG, adicionaDia, capitalize, diaSemanaBR, fimDoMes, fmtHora, fromISO } from './dates.js';
import { resumoPorMedico } from './equipe.js';
import { carregarFontes, logoComoPNG } from './pdfMontar.js';

// Cores do site (mesmas do pdfMontar · tokens/colors_and_type.css)
const COR_BG = '#FFFAF3';
const COR_INK = '#3A2E2A';
const COR_INK_2 = '#6B5C56';
const COR_INK_3 = '#9A8A82';
const COR_LINHA = '#E8DDC9';
const COR_LAVENDER = '#5A4E8C';
const COR_FDS = '#F3EFE9';

const MESES_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

export interface DadosPDFEquipe {
  hospitalNome: string;
  hospitalAbrev: string;
  /** YYYY-MM. */
  mesISO: string;
  /** Colunas da escala, na ordem. */
  janelas: Janela[];
  /** Todas as atribuições do mês. */
  turnos: TurnoEquipe[];
  /** Roster completo, na ordem do roster. */
  medicos: string[];
  /** Observações por dia (data ISO → texto) · os "asteriscos" da escala oficial. */
  obs?: Record<string, string>;
}

// --- Funções puras (testáveis sem jsPDF) -------------------------------------

/** "07:00–19:00" · fim cruza meia-noite implícito. Decimais viram :MM. */
export function fmtHorarioJanela(j: Janela): string {
  const fim = (j.inicio + j.duracao) % 24;
  return `${fmtHora(j.inicio)}–${fmtHora(fim)}`;
}

/** "12h" · decimais viram "7h30". */
export function fmtDuracao(horas: number): string {
  const hh = Math.floor(horas);
  const mm = Math.round((horas - hh) * 60);
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`;
}

/** Minúsculo, sem acento, tudo que não é [a-z0-9] vira hífen. */
export function slugNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Todas as datas ISO do mês, em ordem. */
export function diasDoMes(mesISO: string): string[] {
  const primeiro = `${mesISO}-01`;
  const ultimo = fimDoMes(primeiro);
  const out: string[] = [];
  let cursor = primeiro;
  while (cursor <= ultimo) {
    out.push(cursor);
    cursor = adicionaDia(cursor, 1);
  }
  return out;
}

/** "Julho de 2026" · capitalizado, pro cabeçalho formal. */
export function mesPorExtenso(mesISO: string): string {
  const [ano, mes] = mesISO.split('-');
  const nome = MESES_LONG[Number(mes) - 1] ?? '?';
  return `${capitalize(nome)} de ${ano}`;
}

/** "Seg 01" · coluna de dia da tabela completa. */
export function rotuloDiaCurto(iso: string): string {
  const dow = DOWS[diaSemanaBR(iso)] ?? '?';
  return `${capitalize(dow)} ${String(fromISO(iso).getDate()).padStart(2, '0')}`;
}

/** "Segunda-feira, 01/07" · coluna de data da escala individual. */
export function rotuloDiaLongo(iso: string): string {
  const idx = diaSemanaBR(iso);
  const base = DOWS_LONG[idx] ?? '?';
  const nome = idx < 5 ? `${capitalize(base)}-feira` : capitalize(base);
  const d = fromISO(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${nome}, ${dia}/${mes}`;
}

/**
 * Célula da tabela completa: médicos escalados em cada "data|janela",
 * na ordem do roster (turnos de gente fora do roster vão pro fim).
 */
export function agruparPorDiaJanela(
  turnos: TurnoEquipe[],
  medicos: string[],
): Map<string, string[]> {
  const idx = new Map(medicos.map((m, i) => [m, i]));
  const out = new Map<string, string[]>();
  for (const t of turnos) {
    const chave = `${t.data}|${t.janela}`;
    const arr = out.get(chave) ?? [];
    arr.push(t.medico);
    out.set(chave, arr);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => (idx.get(a) ?? Infinity) - (idx.get(b) ?? Infinity) || a.localeCompare(b));
  }
  return out;
}

/**
 * Observações do mês em ordem de data · só dias DENTRO do mês e com texto
 * não-vazio (obs de outro mês que sobrou no registro fica de fora).
 */
export function obsDoMesOrdenadas(
  obs: Record<string, string> | undefined,
  mesISO: string,
): Array<{ data: string; texto: string }> {
  if (!obs) return [];
  return Object.entries(obs)
    .filter(([data, texto]) => data.startsWith(`${mesISO}-`) && texto.trim() !== '')
    .map(([data, texto]) => ({ data, texto: texto.trim() }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Turnos de um médico, ordenados por data e horário de início da janela. */
export function turnosDoMedicoOrdenados(
  turnos: TurnoEquipe[],
  janelas: Janela[],
  medico: string,
): TurnoEquipe[] {
  const inicio = new Map(janelas.map((j) => [j.rotulo, j.inicio]));
  return turnos
    .filter((t) => t.medico === medico)
    .sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        (inicio.get(a.janela) ?? 99) - (inicio.get(b.janela) ?? 99),
    );
}

/** Nome de arquivo · completo ou individual. */
export function nomeArquivoEquipe(abrev: string, mesISO: string, medico?: string): string {
  const base = `escala-${slugNome(abrev) || 'hospital'}-${mesISO}`;
  return medico ? `${base}-${slugNome(medico)}.pdf` : `${base}.pdf`;
}

// --- Primitivas de desenho ----------------------------------------------------

interface Pagina {
  W: number;
  H: number;
  margemX: number;
}

/** Ajusta texto à largura: reduz a fonte até `tamMin`, depois trunca com "…". */
function ajustarTexto(
  pdf: jsPDF,
  texto: string,
  maxW: number,
  tamBase: number,
  tamMin: number,
): { texto: string; tamanho: number } {
  let tam = tamBase;
  pdf.setFontSize(tam);
  while (pdf.getTextWidth(texto) > maxW && tam > tamMin) {
    tam -= 0.4;
    pdf.setFontSize(tam);
  }
  if (pdf.getTextWidth(texto) <= maxW) return { texto, tamanho: tam };
  let cortado = texto;
  while (cortado.length > 1 && pdf.getTextWidth(`${cortado}…`) > maxW) {
    cortado = cortado.slice(0, -1);
  }
  return { texto: `${cortado.trimEnd()}…`, tamanho: tam };
}

function pintarFundo(pdf: jsPDF, p: Pagina): void {
  pdf.setFillColor(COR_BG);
  pdf.rect(0, 0, p.W, p.H, 'F');
}

/** Cabeçalho formal · retorna o Y onde o conteúdo começa. */
function desenharCabecalho(
  pdf: jsPDF,
  p: Pagina,
  logoPng: string,
  d: DadosPDFEquipe,
  medico?: string,
): number {
  let y = 12;
  pdf.addImage(logoPng, 'PNG', p.margemX, y, 36, 8.3);
  y += 15.5;

  pdf.setFont('Fraunces', 'bold');
  pdf.setTextColor(COR_LAVENDER);
  const titulo = `Escala de Plantões — ${d.hospitalNome}`;
  const tituloFit = ajustarTexto(pdf, titulo, p.W - 2 * p.margemX, 17, 11);
  pdf.setFontSize(tituloFit.tamanho);
  pdf.text(tituloFit.texto, p.margemX, y);
  y += 7;

  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(COR_INK_2);
  pdf.text(mesPorExtenso(d.mesISO), p.margemX, y);
  y += 3;

  if (medico) {
    y += 4.5;
    pdf.setFont('Nunito', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(COR_INK);
    pdf.text(`Dr(a). ${medico}`, p.margemX, y);
    y += 3;
  }

  pdf.setDrawColor(COR_LINHA);
  pdf.setLineWidth(0.4);
  pdf.line(p.margemX, y, p.W - p.margemX, y);
  return y + 5;
}

function desenharRodape(pdf: jsPDF, p: Pagina): void {
  pdf.setDrawColor(COR_LINHA);
  pdf.setLineWidth(0.4);
  pdf.line(p.margemX, p.H - 9, p.W - p.margemX, p.H - 9);

  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(COR_INK_3);
  pdf.text('Gerado pelo Colo Ritmo · colopediatria.com.br', p.margemX, p.H - 5);
  const hoje = new Date();
  const dataDoc = `Gerado em ${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
  pdf.text(dataDoc, p.W - p.margemX, p.H - 5, { align: 'right' });
}

// --- 1 · Escala completa do mês ------------------------------------------------

/** Escala completa do mês · o documento que vai pro mural/grupo. */
export async function baixarPDFEquipeCompleto(d: DadosPDFEquipe): Promise<void> {
  // Retrato cabe bem até 3 janelas · com 4+ as células ficam estreitas
  // demais pra nomes lado a lado, então vira paisagem.
  const paisagem = d.janelas.length >= 4;
  const pdf = new jsPDF({
    orientation: paisagem ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  await carregarFontes(pdf);
  const logoPng = await logoComoPNG();

  const p: Pagina = paisagem
    ? { W: 297, H: 210, margemX: 14 }
    : { W: 210, H: 297, margemX: 14 };

  const dias = diasDoMes(d.mesISO);
  const celulas = agruparPorDiaJanela(d.turnos, d.medicos);

  // Geometria da tabela
  const colDiaW = paisagem ? 22 : 20;
  const larguraTotal = p.W - 2 * p.margemX;
  const colJanW = (larguraTotal - colDiaW) / Math.max(1, d.janelas.length);
  const headH = 10;
  const limiteY = p.H - 13; // acima do rodapé

  pintarFundo(pdf, p);
  let y = desenharCabecalho(pdf, p, logoPng, d);
  desenharRodape(pdf, p);

  // Altura da linha: tenta caber o mês inteiro numa página; se ficar
  // espremido demais (< 5.4mm), fixa uma altura legível e pagina.
  const alturaDisponivel = limiteY - y - headH;
  let rowH = Math.min(8.5, alturaDisponivel / dias.length);
  if (rowH < 5.4) rowH = 6.4;

  const desenharCabecalhoTabela = (topo: number): void => {
    pdf.setFillColor(COR_BG);
    pdf.setDrawColor(COR_LINHA);
    pdf.setLineWidth(0.4);

    pdf.setFont('Nunito', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(COR_INK_3);
    pdf.text('DIA', p.margemX + 2, topo + 6.2, { charSpace: 0.8 });

    for (let c = 0; c < d.janelas.length; c++) {
      const j = d.janelas[c]!;
      const cx = p.margemX + colDiaW + c * colJanW;
      pdf.setFont('Nunito', 'bold');
      pdf.setTextColor(COR_INK);
      const rot = ajustarTexto(pdf, capitalize(j.rotulo), colJanW - 4, 8, 6);
      pdf.setFontSize(rot.tamanho);
      pdf.text(rot.texto, cx + 2, topo + 4.2);

      pdf.setFont('Nunito', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(COR_INK_3);
      pdf.text(fmtHorarioJanela(j), cx + 2, topo + 7.8);
    }
    pdf.setDrawColor(COR_LINHA);
    pdf.setLineWidth(0.4);
    pdf.line(p.margemX, topo + headH, p.W - p.margemX, topo + headH);
  };

  const linhasPorPagina = Math.max(1, Math.floor((limiteY - y - headH) / rowH));
  let indice = 0;
  let topoTabela = y;
  let fimTabelaY = y;

  while (indice < dias.length) {
    if (indice > 0) {
      pdf.addPage();
      pintarFundo(pdf, p);
      desenharRodape(pdf, p);
      topoTabela = desenharCabecalho(pdf, p, logoPng, d);
    }
    const lote = dias.slice(indice, indice + linhasPorPagina);
    desenharCabecalhoTabela(topoTabela);
    const corpoY = topoTabela + headH;

    // Fundos de fim de semana primeiro (por baixo do grid)
    for (let r = 0; r < lote.length; r++) {
      if (diaSemanaBR(lote[r]!) >= 5) {
        pdf.setFillColor(COR_FDS);
        pdf.rect(p.margemX, corpoY + r * rowH, larguraTotal, rowH, 'F');
      }
    }

    // Grid
    pdf.setDrawColor(COR_LINHA);
    pdf.setLineWidth(0.15);
    for (let r = 1; r < lote.length; r++) {
      pdf.line(p.margemX, corpoY + r * rowH, p.W - p.margemX, corpoY + r * rowH);
    }
    pdf.setLineWidth(0.25);
    for (let c = 0; c <= d.janelas.length; c++) {
      const cx = p.margemX + colDiaW + c * colJanW;
      pdf.line(cx, topoTabela, cx, corpoY + lote.length * rowH);
    }
    pdf.setLineWidth(0.4);
    pdf.roundedRect(p.margemX, topoTabela, larguraTotal, headH + lote.length * rowH, 2, 2);

    // Conteúdo das linhas
    for (let r = 0; r < lote.length; r++) {
      const iso = lote[r]!;
      const cy = corpoY + r * rowH;
      const baseline = cy + rowH / 2 + 1.1;

      pdf.setFont('Fraunces', 'bold');
      pdf.setFontSize(rowH >= 7 ? 8.5 : 7.5);
      pdf.setTextColor(COR_INK);
      pdf.text(rotuloDiaCurto(iso), p.margemX + 2, baseline);

      for (let c = 0; c < d.janelas.length; c++) {
        const nomes = celulas.get(`${iso}|${d.janelas[c]!.rotulo}`);
        if (!nomes || nomes.length === 0) continue;
        const cx = p.margemX + colDiaW + c * colJanW;
        pdf.setFont('Nunito', 'normal');
        pdf.setTextColor(COR_INK_2);
        const fit = ajustarTexto(pdf, nomes.join(' · '), colJanW - 4, rowH >= 7 ? 8 : 7.2, 5.6);
        pdf.setFontSize(fit.tamanho);
        pdf.text(fit.texto, cx + 2, baseline);
      }
    }
    indice += lote.length;
    fimTabelaY = corpoY + lote.length * rowH;
  }

  // --- Observações do mês · abaixo da tabela, uma linha por dia ---
  const observacoes = obsDoMesOrdenadas(d.obs, d.mesISO);
  if (observacoes.length > 0) {
    const alturaLinha = 4.2;
    let oy = fimTabelaY + 8;

    const quebrarPagina = (): void => {
      pdf.addPage();
      pintarFundo(pdf, p);
      desenharRodape(pdf, p);
      oy = desenharCabecalho(pdf, p, logoPng, d) + 3;
    };

    // Título + pelo menos uma linha juntos · senão vai pra próxima página
    if (oy + 6 + alturaLinha > limiteY) quebrarPagina();
    pdf.setFont('Nunito', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(COR_INK_3);
    pdf.text('OBSERVAÇÕES', p.margemX, oy, { charSpace: 1.2 });
    oy += 5.5;

    for (const { data, texto } of observacoes) {
      pdf.setFont('Nunito', 'normal');
      pdf.setFontSize(8.5);
      const linhas = pdf.splitTextToSize(
        `${rotuloDiaCurto(data)} — ${texto}`,
        larguraTotal,
      ) as string[];
      const alt = linhas.length * alturaLinha;
      if (oy + alt > limiteY) {
        quebrarPagina();
        pdf.setFont('Nunito', 'normal');
        pdf.setFontSize(8.5);
      }
      pdf.setTextColor(COR_INK_2);
      pdf.text(linhas, p.margemX, oy);
      oy += alt + 1;
    }
  }

  pdf.save(nomeArquivoEquipe(d.hospitalAbrev, d.mesISO));
}

// --- 2 · Escala individual de um médico -----------------------------------------

/** Escala individual de UM médico · pra mandar pra pessoa. */
export async function baixarPDFEquipeMedico(d: DadosPDFEquipe, medico: string): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  await carregarFontes(pdf);
  const logoPng = await logoComoPNG();

  const p: Pagina = { W: 210, H: 297, margemX: 14 };
  const janelaPorRotulo = new Map(d.janelas.map((j) => [j.rotulo, j]));
  const turnos = turnosDoMedicoOrdenados(d.turnos, d.janelas, medico);

  // Colunas: Data · Turno · Horário · Horas (largura útil = 182mm)
  const larguraTotal = p.W - 2 * p.margemX;
  const colunas = [
    { titulo: 'Data', w: 72 },
    { titulo: 'Turno', w: 40 },
    { titulo: 'Horário', w: 42 },
    { titulo: 'Horas', w: larguraTotal - 72 - 40 - 42 },
  ];
  const headH = 8;
  const rowH = 8;
  const limiteY = p.H - 36; // reserva rodapé + bloco de totais

  pintarFundo(pdf, p);
  desenharRodape(pdf, p);
  let y = desenharCabecalho(pdf, p, logoPng, d, medico);

  const colX = (i: number): number =>
    p.margemX + colunas.slice(0, i).reduce((s, c) => s + c.w, 0);

  const desenharCabecalhoTabela = (topo: number): void => {
    pdf.setFont('Nunito', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(COR_INK_3);
    for (let i = 0; i < colunas.length; i++) {
      pdf.text(colunas[i]!.titulo.toUpperCase(), colX(i) + 2, topo + 5.4, { charSpace: 0.8 });
    }
    pdf.setDrawColor(COR_LINHA);
    pdf.setLineWidth(0.4);
    pdf.line(p.margemX, topo + headH, p.W - p.margemX, topo + headH);
  };

  if (turnos.length === 0) {
    pdf.setFont('Nunito', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(COR_INK_2);
    pdf.text('Nenhum plantão registrado neste mês.', p.margemX, y + 6);
    y += 14;
  } else {
    const linhasPorPagina = Math.max(1, Math.floor((limiteY - y - headH) / rowH));
    let indice = 0;
    while (indice < turnos.length) {
      if (indice > 0) {
        pdf.addPage();
        pintarFundo(pdf, p);
        desenharRodape(pdf, p);
        y = desenharCabecalho(pdf, p, logoPng, d, medico);
      }
      const lote = turnos.slice(indice, indice + linhasPorPagina);
      desenharCabecalhoTabela(y);
      const corpoY = y + headH;

      for (let r = 0; r < lote.length; r++) {
        const t = lote[r]!;
        const cy = corpoY + r * rowH;
        const baseline = cy + rowH / 2 + 1.2;
        const j = janelaPorRotulo.get(t.janela);

        // Fim de semana levemente destacado, como na escala completa
        if (diaSemanaBR(t.data) >= 5) {
          pdf.setFillColor(COR_FDS);
          pdf.rect(p.margemX, cy, larguraTotal, rowH, 'F');
        }
        pdf.setDrawColor(COR_LINHA);
        pdf.setLineWidth(0.15);
        if (r > 0) pdf.line(p.margemX, cy, p.W - p.margemX, cy);

        pdf.setFont('Fraunces', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(COR_INK);
        pdf.text(rotuloDiaLongo(t.data), colX(0) + 2, baseline);

        pdf.setFont('Nunito', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(COR_INK_2);
        pdf.text(capitalize(t.janela), colX(1) + 2, baseline);
        pdf.text(j ? fmtHorarioJanela(j) : '—', colX(2) + 2, baseline);
        pdf.text(j ? fmtDuracao(j.duracao) : '—', colX(3) + 2, baseline);
      }

      y = corpoY + lote.length * rowH;
      indice += lote.length;
    }
  }

  // --- Bloco de totais · sempre na última página, abaixo da tabela ---
  const resumo = resumoPorMedico([medico], turnos, d.janelas, d.mesISO)[0]!;
  const totaisY = y + 6;
  pdf.setDrawColor(COR_LINHA);
  pdf.setLineWidth(0.4);
  pdf.line(p.margemX, totaisY, p.W - p.margemX, totaisY);

  pdf.setFont('Nunito', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(COR_INK_3);
  pdf.text('TOTAIS', p.margemX, totaisY + 6, { charSpace: 1.2 });

  pdf.setFont('Fraunces', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(COR_LAVENDER);
  const linhaTotais = `Total no mês: ${fmtDuracao(resumo.total)} · Fins de semana: ${fmtDuracao(resumo.fds)} · Plantões: ${resumo.plantoes}`;
  pdf.text(linhaTotais, p.W - p.margemX, totaisY + 6, { align: 'right' });

  pdf.save(nomeArquivoEquipe(d.hospitalAbrev, d.mesISO, medico));
}
