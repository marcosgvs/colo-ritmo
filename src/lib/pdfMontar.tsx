/**
 * Gerador de PDF da proposta do Montar · 1 PDF por hospital.
 *
 * Identidade visual fiel ao site:
 *   - Fundo creme (--bg #FFFAF3)
 *   - Texto marrom-cinza (--ink #3A2E2A · --ink-2 #6B5C56 · --ink-3 #9A8A82)
 *   - Lavender do logo/destaque (#5A4E8C)
 *   - Bloquinhos de plantão na cor da família do hospital
 *   - Fontes: Fraunces (display) · Nunito (body) · Caveat (assinatura)
 *
 * Layout (A4 landscape · 297×210mm):
 *   Header  · logo Colo/Ritmo + eyebrow "ESCALA · HOSPITAL · MM/YYYY"
 *           + título "Escala Dra. <Nome>" grande
 *           + subtítulo "<N> plantões"
 *   Saudação · "Prezado(a) Dr(a). <Chefe>, ..."
 *   Coluna esquerda 2/3 · calendário do mês com bloquinhos coloridos
 *   Coluna direita 1/3 · detalhamento dos plantões
 *   Total · rodapé direito
 *   Assinatura · "Atenciosamente, <Nome>" em Caveat italic
 *   Footer · "Documento gerado pelo Colo Ritmo · DD/MM/YYYY"
 *
 * Bloqueios pessoais NÃO entram no PDF · só plantões propostos.
 * Vetorial puro · texto copiável · ~150kb.
 */

import jsPDF from 'jspdf';
import type { BlocoPlantao, Hospital, Preferencias } from '@/types';
import {
  DOWS_LONG,
  MESES,
  fimDoMes,
  fromISO,
  inicioDaSemana,
  inicioDoMes,
  toISO,
} from './dates.js';
import { rotuloTurno } from './turno.js';

// Cores do site (de tokens/colors_and_type.css)
const COR_BG = '#FFFAF3';
const COR_INK = '#3A2E2A';
const COR_INK_2 = '#6B5C56';
const COR_INK_3 = '#9A8A82';
const COR_LINHA = '#E8DDC9';
const COR_LAVENDER = '#5A4E8C';

// Famílias de cor por hospital (ink + surface)
const CORES_HOSPITAL: Record<string, { ink: string; surface: string }> = {
  sand: { ink: '#C5AE99', surface: '#FBF1E1' },
  coral: { ink: '#C77264', surface: '#FBE9E5' },
  sage: { ink: '#5A6E50', surface: '#ECF6E7' },
  olive: { ink: '#99A36B', surface: '#F1EFE0' },
  lavender: { ink: '#5A4E8C', surface: '#ECEAF4' },
  pink: { ink: '#B25A8C', surface: '#FAEAF2' },
  blue: { ink: '#3D7884', surface: '#EAF2F9' },
  aqua: { ink: '#6FA6CF', surface: '#E8F6F8' },
};

// Logo SVG da marca · cores fiéis ao asset oficial
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 313.08 71.53"><g><path fill="#A299CB" d="M94.98,13.83c.69-1.44,1.95-1.97,2.95-1.78,1.66.48,2.26,1.88,1.88,3.51-1.14,5.17-10.47,38.22-12.64,42.4-.72,1.38-2.22,1.79-3.43,1.43s-2.41-1.55-2.14-3.17c.52-3.6,11.19-37.79,13.38-42.39Z"/><path fill="#A299CB" d="M37.98,46.22c-.27-.08-.93.2-1.01.47-.83,3.05-4.08,1.53-4.34,2.87-.07.27.37.9.74.94,2.45.28,4.43-1,5.15-3.14.11-.34-.25-1.02-.54-1.13Z"/><path fill="#A299CB" d="M34.17,45.75c.51-.27.69-1.09.39-1.48-.2-.29-1.06-.31-1.34-.07l-.88.72c-.21.17,0,1.03.23,1.14.35.17,1.16-.05,1.6-.31Z"/><path fill="#A299CB" d="M27.74,44.22c-1.11.48.23,2.45-1.44,3.32-1.67.86-2.67-1.19-3.52-.26-.21.23-.19,1.13.07,1.37,1.4,1.33,3.26,1.28,4.62.36,1.34-.91,2.07-2.68,1.41-4.36-.11-.3-.84-.55-1.14-.43Z"/><path fill="#A299CB" d="M71.18,29.71C66.91,3.97,42.42-1.93,27.8.5,11.91,3.14-3.72,15.2.79,42.37c3.59,21.61,17.08,32.11,39.17,28.44,16.37-2.72,35.34-16.31,31.22-41.1ZM56.14,35.98c-.32.38-1.13.72-1.44.5-.44-.34-1.07-.63-1.43-.51-.46.14-.87.95-.61,1.46.21.42.67.76,1.15,1.07.23,1.76,0,3.68-.78,5.4-.94,2.11-3.04,2.03-2.33,3.56.17.35.78.48,1.35.37-3.23,7.59-12.66,10.3-20.96,8.86-.21-3.07-3.94-4.85-6.58-4.66-.92.05-1.47.01-2.27-.3-1.87-.76-3.05-2.12-2.84-4.22-5.23-4.88-6.14-12.52-3.24-18.85,1.17,2.32,3.5,3.38,5.9,2.85,2.15-.46,4.13-2.29,4.23-4.7.08-1.52-.97-2.77-2.23-3-1.38-.22-2.81.49-3.17,2-.07.31.29.99.59,1.11,1.14.44,1.31-1.19,2.05-1.1.27.02.66.64.63.91-.06,1.28-1.03,2.14-1.98,2.5-1.2.45-2.52.35-3.45-.61-4.15-4.21,5.99-15.05,18.46-13.71,6.93.73,12.49,5.65,14.18,12.3-.46.42-.8.99-.79,1.52,0,.27.43.83.68.91.3.1.9-.17,1.13-.44.83-1.01,2.21-.93,3.2-.09,2,1.68,2.24,4.86.55,6.86Z"/><path fill="#A299CB" d="M41.13,36.3c-1.18.41.21,2.43-1.62,3.3-1.9.9-2.87-1.31-3.74-.31-.21.23-.19,1.11.04,1.33,1.5,1.33,3.2,1.37,4.72.52,1.33-.73,2.13-2.23,1.98-3.93-.07-.66-.81-1.1-1.38-.91Z"/><path fill="#6257A5" d="M154.59,18.59c0,6.99-4.44,10.93-11.34,13.97-2.14.99-2.63,2.79-.9,4.36,5.18,4.69,10.85,10.44,11.51,14.14.99,5.59-2.63,9.21-7.07,9.21-1.48,0-3.04-.41-4.52-1.23-4.19-2.38-8.8-12.58-11.59-19.56-.9-2.14-2.05-2.79-3.21-2.79-.16,0-.41.08-.58.08-1.31.33-2.47,1.64-2.38,3.95.16,3.37.49,7.15-.08,12.17-.9,7.73-4.52,9.37-7.73,9.37-3.7,0-6.58-2.3-6.9-7.73-.41-6.58,1.64-39.21,2.05-43.65.74-7.64,3.12-10.03,12.99-10.03,18.66,0,29.76,4.85,29.76,17.75ZM127.96,25.16c8.88,0,12.25-3.86,12.25-7.4,0-4.03-4.27-7.64-11.59-7.73-2.88,0-4.44.41-4.52,1.97-.08.9-.25,5.67.25,9.62.33,2.96,1.56,3.53,3.62,3.53Z"/><path fill="#6257A5" d="M172.51,49.57c-.9,5.84-3.7,7.07-6.9,7.07-3.7,0-6.58-2.3-6.9-7.73-.41-6.58,1.64-21.54,2.05-26.22.33-3.62,2.38-5.84,5.51-5.84s4.93,2.14,5.01,5.59c.08,5.51,1.97,22.52,1.23,27.12ZM172.27,7.57c-.99,3.29-3.45,4.85-5.84,4.93-3.21,0-5.51-2.3-6.25-5.34-.66-2.88.66-6.82,6.41-6.82s6.66,4.11,5.67,7.23Z"/><path fill="#6257A5" d="M178.59,25.57c.99-.08,2.14-.16,3.37-.25.74-5.67,1.89-10.6,3.53-13.15,1.32-2.05,3.53-3.29,6.25-3.29,3.12,0,5.67,2.05,5.92,5.67.25,3.45-.9,6.9-2.22,10.77,2.63.08,4.77.25,5.75.49,4.44,1.15,4.44,7.4-.08,7.97-2.3.33-5.34.49-8.55.58-.58,2.3-.99,4.69-.99,7.23-.08,4.52,1.4,6.74,3.29,6.82,3.37.08,3.04-6.49,9.29-6.49,8.47,0,8.96,19.48-8.06,19.48-5.75,0-11.51-2.71-13.56-8.47-1.15-3.29-1.64-10.77-1.32-18.49-.99,0-1.89-.08-2.71-.08-5.67-.16-5.84-8.22.08-8.79Z"/><path fill="#6257A5" d="M286.68,57.22c6.99,0,13.73-2.55,17.84-6.08,1.31-1.07,2.63-1.56,3.86-1.56,3.53,0,6.17,4.27,3.78,9.54-2.63,6-11.1,12.08-25.32,12.08-34.93,0-33.37-27.45-31.89-39.62.58-5.18-.41-7.81-3.37-7.81-2.47,0-4.6,3.95-4.6,11.51,0,3.45.82,6.91.49,10.44-.49,4.85-2.55,8.3-7.81,8.3s-7.32-3.86-7.23-8.88c0-4.52,1.81-8.63,1.81-13.07,0-2.38-.66-5.01-3.29-5.01-3.04,0-4.69,4.03-4.69,8.8,0,1.89.82,8.3.49,12.08-.49,4.85-2.55,8.3-7.81,8.3s-7.32-3.86-7.23-8.88c.08-8.3.82-21.7,2.63-29.76.58-2.38,1.89-3.78,4.69-3.78,2.96,0,4.36,1.4,4.85,3.86.49,2.14.82,4.93.82,6.99,1.97-3.95,5.59-7.64,10.27-7.56,2.63.08,7.64,1.64,9.62,7.07,2.79-5.84,7.07-10.36,12.58-10.36,3.86,0,7.32,2.14,8.96,6.66,3.7,10.44-3.53,32.63,15.37,36.25,1.73.33,3.45.49,5.18.49ZM274.35,29.93c0-7.56,5.01-19.4,18.33-19.4s18.08,10.69,18.08,19.15c0,11.43-6.41,17.34-17.59,17.34-14.06,0-18.82-8.88-18.82-17.1ZM286.11,29.52c0,2.96,1.89,6.74,6.41,6.74s6.49-4.19,6.49-6.82c0-2.88-1.73-6.08-6.66-6.08-3.95,0-6.25,2.14-6.25,6.17Z"/></g></svg>`;

interface DadosPDF {
  hospital: Hospital;
  plantoes: BlocoPlantao[];
  ano: number;
  /** 1-12 */
  mes: number;
  preferencias: Preferencias;
  /** Nome do chefe destinatário · entra na saudação. Opcional. */
  chefe?: string;
}

// Cache do BASE64 das fontes (não do estado do jsPDF). Cada nova instância
// de jsPDF precisa registrar as fontes em si · o estado não é compartilhado.
// Bug anterior: cache global de "fontesCarregadas: bool" pulava o registro
// no segundo PDF da sessão, que caía no Helvetica fallback · daí
// inconsistência de fonte entre exports do mesmo wizard.
type FonteRecord = { arquivo: string; nome: string; estilo: string; b64: string };
let fontesCache: FonteRecord[] | null = null;
let logoCache: string | null = null;

async function carregarFontes(pdf: jsPDF): Promise<void> {
  if (!fontesCache) {
    const lista = [
      { arquivo: 'Fraunces-Regular.ttf', nome: 'Fraunces', estilo: 'normal' },
      { arquivo: 'Fraunces-Medium.ttf', nome: 'Fraunces', estilo: 'bold' },
      { arquivo: 'Nunito-Regular.ttf', nome: 'Nunito', estilo: 'normal' },
      { arquivo: 'Nunito-Bold.ttf', nome: 'Nunito', estilo: 'bold' },
      { arquivo: 'Caveat-Medium.ttf', nome: 'Caveat', estilo: 'italic' },
    ];
    fontesCache = await Promise.all(
      lista.map(async (f) => {
        // BASE_URL = '/ritmo/' em prod · prefixa as fontes que ficam em
        // dist/ritmo/fonts/. Se voltar pra root no futuro, segue sozinho.
        const resp = await fetch(`${import.meta.env.BASE_URL}fonts/${f.arquivo}`);
        if (!resp.ok) throw new Error(`fonte ${f.arquivo}: ${resp.status}`);
        const buf = await resp.arrayBuffer();
        return { ...f, b64: arrayBufferToBase64(buf) };
      }),
    );
  }
  // Registra TODAS as fontes nesta instância · sempre, mesmo no segundo PDF.
  for (const f of fontesCache) {
    pdf.addFileToVFS(f.arquivo, f.b64);
    pdf.addFont(f.arquivo, f.nome, f.estilo);
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function logoComoPNG(): Promise<string> {
  if (logoCache) return logoCache;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = 4;
        const w = 313;
        const h = 72;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas 2d ctx unavailable'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w * scale, h * scale);
        logoCache = canvas.toDataURL('image/png');
        resolve(logoCache);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => reject(new Error('logo svg failed to load'));
    // Data URL com base64 é mais confiável que blob:URL pra imagens síncronas
    const utf8 = new TextEncoder().encode(LOGO_SVG);
    let binary = '';
    for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]!);
    img.src = `data:image/svg+xml;base64,${btoa(binary)}`;
  });
}

export async function baixarPDFMontar(dados: DadosPDF): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  await carregarFontes(pdf);
  const logoPng = await logoComoPNG();

  // A4 landscape = 297 × 210 mm
  const W = 297;
  const H = 210;
  const margemX = 16;
  const margemY = 12;

  // --- Pinta o fundo creme ---
  pdf.setFillColor(COR_BG);
  pdf.rect(0, 0, W, H, 'F');

  let y = margemY;

  // --- HEADER · compacto, ocupa ~50mm ---
  // Logo
  pdf.addImage(logoPng, 'PNG', margemX, y, 36, 8.3);
  y += 11;

  // Eyebrow: SUGESTÃO DE ESCALA · HOSPITAL · MM/YYYY
  pdf.setFont('Nunito', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(COR_INK_3);
  const mesNome = MESES[dados.mes - 1] ?? '?';
  const eyebrow = `SUGESTÃO DE ESCALA · ${(dados.hospital.abrev ?? dados.hospital.nome).toUpperCase()} · ${capitalize(mesNome)} ${dados.ano}`;
  pdf.text(eyebrow, margemX, y, { charSpace: 1.1 });

  y += 5;

  // Título principal: "Escala · Nome" · neutro de gênero. Se o user já
  // colocou Dr./Dra. no nome de preferência, respeitamos o prefixo dele.
  pdf.setFont('Fraunces', 'bold');
  pdf.setFontSize(26);
  pdf.setTextColor(COR_LAVENDER);
  const nomeLimpo = (dados.preferencias.nome ?? '').trim();
  const tituloPrincipal = nomeLimpo ? `Escala · ${nomeLimpo}` : 'Sugestão de escala';
  pdf.text(tituloPrincipal, margemX, y + 8.5);

  y += 13;

  // Subtítulo: Hospital · N plantões
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(COR_INK_2);
  const subtitle = `${dados.hospital.nome} · ${dados.plantoes.length} ${dados.plantoes.length === 1 ? 'plantão' : 'plantões'}`;
  pdf.text(subtitle, margemX, y);

  y += 3.5;
  pdf.setDrawColor(COR_LINHA);
  pdf.setLineWidth(0.4);
  pdf.line(margemX, y, W - margemX, y);

  // --- SAUDAÇÃO · compacta ---
  y += 5;
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(COR_INK);
  const trat = dados.chefe ? trataChefe(dados.chefe) : 'Dr(a).';
  pdf.text(`Prezado(a) ${trat},`, margemX, y);

  y += 4.2;
  const saudacao = `Apresento abaixo a proposta de plantões para ${capitalize(mesNome)} de ${dados.ano} no ${dados.hospital.nome}, conforme minha disponibilidade. Fico à disposição para os ajustes que forem necessários.`;
  const saudacaoLinhas = pdf.splitTextToSize(saudacao, W - 2 * margemX);
  pdf.setTextColor(COR_INK_2);
  pdf.text(saudacaoLinhas, margemX, y);
  y += saudacaoLinhas.length * 3.8 + 3;

  // --- LAYOUT 2 COLS · CALENDÁRIO E DETALHAMENTO ---
  const corpoY = y;
  const calLargura = (W - 2 * margemX) * 0.62;
  const calX = margemX;
  const detX = margemX + calLargura + 8;
  const detLargura = W - margemX - detX;

  // Calendário
  desenharCalendario(pdf, dados, calX, corpoY, calLargura);

  // Detalhamento
  desenharDetalhamento(pdf, dados, detX, corpoY, detLargura);

  // --- ASSINATURA ---
  const assinaturaY = H - 24;
  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(COR_INK_2);
  pdf.text('Atenciosamente,', margemX, assinaturaY);
  pdf.setFont('Caveat', 'italic');
  pdf.setFontSize(22);
  pdf.setTextColor(COR_INK);
  pdf.text(nomeLimpo, margemX, assinaturaY + 9);

  // --- FOOTER ---
  pdf.setDrawColor(COR_LINHA);
  pdf.line(margemX, H - 9, W - margemX, H - 9);

  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(COR_INK_3);
  pdf.text('Documento gerado pelo Colo Ritmo', margemX, H - 5);
  const hoje = new Date();
  const dataDoc = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
  pdf.text(dataDoc, W - margemX, H - 5, { align: 'right' });

  // --- Save ---
  const arquivoNome = `escala-${(dados.hospital.abrev ?? 'hospital').toLowerCase()}-${dados.ano}-${String(dados.mes).padStart(2, '0')}.pdf`;
  pdf.save(arquivoNome);
}

// --- Calendário (esquerda) ---------------------------------------------------

function desenharCalendario(
  pdf: jsPDF,
  dados: DadosPDF,
  x: number,
  y: number,
  largura: number,
): void {
  const mesISO = `${dados.ano}-${String(dados.mes).padStart(2, '0')}-01`;
  const ini = inicioDaSemana(inicioDoMes(mesISO));
  const fim = fimDoMes(mesISO);

  // Coleta dias até cobrir todo o mês com semanas SEG-DOM completas
  const dias: string[] = [];
  let cursor = ini;
  while (cursor <= fim || dias.length % 7 !== 0) {
    dias.push(cursor);
    const d = fromISO(cursor);
    d.setDate(d.getDate() + 1);
    cursor = toISO(d);
    if (dias.length > 42) break;
  }

  const colW = largura / 7;
  const semanas = dias.length / 7;
  const headH = 7;
  // Calendário precisa caber até y=170 (acima do total/assinatura)
  // Espaço disponível: 170 - y - headH = altura útil pras semanas
  const espacoDisponivel = 170 - y - headH;
  const linhaH = Math.max(13, Math.min(21, espacoDisponivel / semanas));

  // Header dias da semana
  pdf.setFont('Nunito', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(COR_INK_3);
  const dows = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
  for (let i = 0; i < 7; i++) {
    pdf.text(dows[i] ?? '', x + i * colW + colW / 2, y + 4, { align: 'center', charSpace: 0.8 });
  }

  // Borda externa arredondada
  pdf.setDrawColor(COR_LINHA);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(x, y + headH, largura, linhaH * semanas, 2.5, 2.5);

  // Linhas internas
  pdf.setLineWidth(0.25);
  for (let i = 1; i < 7; i++) {
    pdf.line(x + i * colW, y + headH, x + i * colW, y + headH + linhaH * semanas);
  }
  for (let i = 1; i < semanas; i++) {
    pdf.line(x, y + headH + i * linhaH, x + largura, y + headH + i * linhaH);
  }

  // Plantões agrupados por dia
  const porDia = new Map<string, BlocoPlantao[]>();
  for (const p of dados.plantoes) {
    const arr = porDia.get(p.data) ?? [];
    arr.push(p);
    porDia.set(p.data, arr);
  }

  const corHosp = CORES_HOSPITAL[dados.hospital.cor] ?? CORES_HOSPITAL.lavender!;

  // Sempre tenta mostrar 2 bloquinhos por célula · em mês apertado eles
  // ficam menores mas todos os plantões ficam visíveis. Detalhamento
  // ao lado é a fonte canônica de verdade.
  const espacoBloquinho = linhaH - 4.5; // 4.5 mm reservados pro número do dia
  const blocosMax = 2;
  const blocoH = (espacoBloquinho - 0.5) / 2;

  // Conteúdo de cada célula
  for (let i = 0; i < dias.length; i++) {
    const iso = dias[i]!;
    const col = i % 7;
    const row = Math.floor(i / 7);
    const cx = x + col * colW;
    const cy = y + headH + row * linhaH;
    const dataMes = iso.startsWith(`${dados.ano}-${String(dados.mes).padStart(2, '0')}`);

    // Número do dia · Fraunces, cor do site
    pdf.setFont('Fraunces', 'bold');
    pdf.setFontSize(linhaH < 16 ? 9 : 11);
    pdf.setTextColor(dataMes ? COR_INK : COR_INK_3);
    const dia = fromISO(iso).getDate();
    pdf.text(String(dia), cx + 1.8, cy + 4);

    // Bloquinhos do plantão
    const lista = porDia.get(iso) ?? [];
    let by = cy + 4.5;
    const visiveis = lista.slice(0, blocosMax);
    for (const p of visiveis) {
      const rotulo = rotuloTurno(p.horaInicio, p.duracao, dados.hospital);
      const labelTurno = rotulo ?? `${formatarHora(p.horaInicio)} · ${p.duracao}h`;

      // Background pill
      pdf.setFillColor(corHosp.surface);
      pdf.setDrawColor(corHosp.ink);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(cx + 1.2, by, colW - 2.4, blocoH, 1, 1, 'FD');
      // Tira lateral colorida
      pdf.setFillColor(corHosp.ink);
      pdf.rect(cx + 1.2, by, 0.7, blocoH, 'F');

      // Texto · 1 linha compacta sempre · só rotulo no calendário,
      // o detalhamento (à direita) tem o horário completo.
      pdf.setFont('Nunito', 'bold');
      pdf.setFontSize(blocoH >= 5 ? 6 : 5.4);
      pdf.setTextColor(corHosp.ink);
      pdf.text(
        `${dados.hospital.abrev ?? '?'} · ${labelTurno}`,
        cx + 2.6,
        by + (blocoH >= 5 ? blocoH / 2 + 1 : blocoH / 2 + 0.8),
      );

      by += blocoH + 0.4;
    }

    // Indicador "+N" se sobrou (mais de 2 num dia · raríssimo)
    if (lista.length > visiveis.length) {
      pdf.setFont('Nunito', 'bold');
      pdf.setFontSize(6);
      pdf.setTextColor(COR_INK_3);
      pdf.text(`+${lista.length - visiveis.length}`, cx + colW - 5, cy + linhaH - 1.5);
    }
  }
}

// --- Detalhamento (direita) --------------------------------------------------

function desenharDetalhamento(
  pdf: jsPDF,
  dados: DadosPDF,
  x: number,
  y: number,
  largura: number,
): void {
  pdf.setFont('Nunito', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(COR_INK_3);
  pdf.text('DETALHAMENTO', x, y + 4, { charSpace: 1.2 });

  pdf.setDrawColor(COR_LINHA);
  pdf.setLineWidth(0.4);
  pdf.line(x, y + 6, x + largura, y + 6);

  const ordenados = [...dados.plantoes].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
  );
  const horas = ordenados.reduce((s, p) => s + p.duracao, 0);

  // Layout em 2 colunas pra caber até ~22 plantões sem cortar
  const limiteY = 175;
  const startY = y + 11;
  const colGap = 4;
  const colW = (largura - colGap) / 2;
  const colX1 = x;
  const colX2 = x + colW + colGap;
  const itemH = 8.5; // altura de cada plantão (título + horário + gap)
  const linhasPorCol = Math.floor((limiteY - startY) / itemH);

  for (let i = 0; i < ordenados.length; i++) {
    const p = ordenados[i]!;
    const col = Math.floor(i / linhasPorCol);
    const row = i % linhasPorCol;
    if (col >= 2) {
      // Não cabe nem em 2 colunas · indica
      pdf.setFont('Nunito', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(COR_INK_3);
      pdf.text(
        `+ ${ordenados.length - i} plantões no calendário`,
        colX2,
        startY + linhasPorCol * itemH + 2,
      );
      break;
    }
    const cx = col === 0 ? colX1 : colX2;
    const cur = startY + row * itemH;

    const d = fromISO(p.data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mesPad = String(d.getMonth() + 1).padStart(2, '0');
    const dowIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const dow = capitalize(DOWS_LONG[dowIdx] ?? '');
    const fim = (p.horaInicio + p.duracao) % 24;
    const horaIni = formatarHora(p.horaInicio);
    const horaFim = formatarHora(fim);
    const rotulo = rotuloTurno(p.horaInicio, p.duracao, dados.hospital);
    const prefixoTurno = rotulo ? `${rotulo} · ` : '';

    pdf.setFont('Fraunces', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(COR_INK);
    pdf.text(`${dia}/${mesPad} · ${dow}`, cx, cur);

    pdf.setFont('Nunito', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(COR_INK_2);
    pdf.text(`${prefixoTurno}${horaIni} às ${horaFim} (${p.duracao}h)`, cx, cur + 3.5);
  }

  // Total · linha + label + valor
  pdf.setDrawColor(COR_LINHA);
  pdf.setLineWidth(0.4);
  pdf.line(x, 178, x + largura, 178);

  pdf.setFont('Nunito', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(COR_INK_3);
  pdf.text('TOTAL', x, 184, { charSpace: 1.2 });

  pdf.setFont('Fraunces', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(COR_LAVENDER);
  pdf.text(`${ordenados.length} plantões`, x + largura, 184, { align: 'right' });

  pdf.setFont('Nunito', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(COR_INK_3);
  pdf.text(`${horas}h totais`, x + largura, 188.5, { align: 'right' });
}

// --- Helpers -----------------------------------------------------------------

function formatarHora(h: number): string {
  const inteiro = Math.floor(h);
  const min = Math.round((h - inteiro) * 60);
  return `${String(inteiro).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function trataChefe(nome: string): string {
  const limpo = nome.trim();
  if (/^dr[a]?\.?\s/i.test(limpo)) return limpo;
  return `Dr(a). ${limpo}`;
}
