/**
 * Exportação da proposta do Montar · 1 export por hospital.
 *
 * Formatos:
 *   - texto: mensagem pronta pra copiar (português padrão, formal)
 *   - xlsx: planilha com cabeçalho + linhas dos plantões + total
 *   - pdf: gerador em pdfMontar.tsx (lazy)
 *
 * Bloqueios pessoais NÃO entram em nenhum formato · só plantões.
 */

import type { BlocoPlantao, Hospital, Preferencias } from '@/types';
import { DOWS_LONG, MESES, capitalize, fmtHora, fromISO } from './dates.js';
import { rotuloTurno } from './turno.js';

interface DadosExport {
  hospital: Hospital;
  plantoes: BlocoPlantao[];
  ano: number;
  /** 1-12 */
  mes: number;
  preferencias: Preferencias;
  /** Nome do chefe pra saudação · opcional. */
  chefe?: string;
}

// --- TEXTO -------------------------------------------------------------------

export function montarMensagem(dados: DadosExport): string {
  const ordenados = [...dados.plantoes].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
  );
  const mesNome = MESES[dados.mes - 1] ?? '';
  const trat = dados.chefe ? trataChefe(dados.chefe) : 'Doutor(a)';
  const cabecalho = `Prezado(a) ${trat},\n\nSegue minha proposta de plantões para ${capitalize(mesNome)} de ${dados.ano} no ${dados.hospital.nome}, conforme minha disponibilidade:\n\n`;

  const linhas = ordenados.map((p) => {
    const d = fromISO(p.data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mesPad = String(d.getMonth() + 1).padStart(2, '0');
    const dowIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const dow = capitalize(DOWS_LONG[dowIdx] ?? '');
    const fim = (p.horaInicio + p.duracao) % 24;
    const ini = fmtHora(p.horaInicio);
    const fimStr = fmtHora(fim);
    const rotulo = rotuloTurno(p.horaInicio, p.duracao, dados.hospital);
    const rotuloPart = rotulo ? `${rotulo} · ` : '';
    return `- ${dow} ${dia}/${mesPad} · ${rotuloPart}das ${ini} às ${fimStr} (${p.duracao}h)`;
  });

  const horas = ordenados.reduce((s, p) => s + p.duracao, 0);
  // Sem nome cadastrado, assina só "Atenciosamente," · nada de fallback
  // com gênero (o produto é neutro).
  const nome = (dados.preferencias.nome ?? '').trim();
  const rodape = `\n\nTotal: ${ordenados.length} plantões, ${horas} horas.\n\nFico à disposição para os ajustes que forem necessários.\n\nAtenciosamente,${nome ? `\n${nome}` : ''}`;

  return cabecalho + linhas.join('\n') + rodape;
}

// --- EXCEL (xlsx) ------------------------------------------------------------

export async function baixarExcelMontar(dados: DadosExport): Promise<void> {
  const xlsxMod = await import('xlsx');
  const XLSX = xlsxMod.default ?? xlsxMod;

  const ordenados = [...dados.plantoes].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
  );

  const linhas: Array<Record<string, string | number>> = ordenados.map((p) => {
    const d = fromISO(p.data);
    const dia = String(d.getDate()).padStart(2, '0');
    const mesPad = String(d.getMonth() + 1).padStart(2, '0');
    const dowIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const fim = (p.horaInicio + p.duracao) % 24;
    const rotulo = rotuloTurno(p.horaInicio, p.duracao, dados.hospital);
    return {
      Data: `${dia}/${mesPad}/${dados.ano}`,
      'Dia da semana': capitalize(DOWS_LONG[dowIdx] ?? ''),
      Turno: rotulo ? capitalize(rotulo) : '',
      Início: fmtHora(p.horaInicio),
      Fim: fmtHora(fim),
      'Duração (h)': p.duracao,
      Hospital: dados.hospital.nome,
    };
  });

  // Linha em branco + total
  const horas = ordenados.reduce((s, p) => s + p.duracao, 0);
  linhas.push({
    Data: '',
    'Dia da semana': '',
    Turno: '',
    Início: '',
    Fim: 'Total',
    'Duração (h)': horas,
    Hospital: `${ordenados.length} plantões`,
  });

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 32 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${dados.hospital.abrev ?? 'Plantões'}`);

  const arquivo = `colo-ritmo_${(dados.hospital.abrev ?? 'hospital').toLowerCase()}_${dados.ano}-${String(dados.mes).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, arquivo);
}

// --- PDF (lazy) --------------------------------------------------------------

export async function baixarPDFMontar(dados: DadosExport): Promise<void> {
  const mod = await import('./pdfMontar.js');
  await mod.baixarPDFMontar(dados);
}

// --- Helpers -----------------------------------------------------------------

function trataChefe(nome: string): string {
  const limpo = nome.trim();
  if (/^dr[a]?\.?\s/i.test(limpo)) return limpo;
  return `Dr(a). ${limpo}`;
}
