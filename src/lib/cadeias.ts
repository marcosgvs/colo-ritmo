import type { Bloco } from '@/types';
import { adicionaDia } from './dates.js';

/**
 * Uma cadeia é um agrupamento contínuo de blocos relacionados —
 * tipicamente plantão → deslocamento → plantão → sono. A grade Semana
 * usa cadeias pra desenhar as conexões; o detalhe usa pra apresentar a
 * "história" do plantão (quando saiu, quanto tempo no trânsito, quando
 * dorme).
 */

export interface Cadeia {
  id: string;
  blocos: Bloco[];
  /** ISO + hora decimal de início. */
  inicio: { data: string; hora: number };
  /** ISO + hora decimal de fim (pode ser dia seguinte). */
  fim: { data: string; hora: number };
  totalH: number;
}

type BlocoLinha = Bloco & {
  _inicioAbs: number;
  _fimAbs: number;
};

const MS_HORA = 60 * 60 * 1000;
const HORAS_DIA = 24;
const TOLERANCIA_HORAS = 0.6;

/** Posição absoluta do bloco em horas desde 1970, simplificado. */
function abs(b: Bloco): { ini: number; fim: number } {
  const t = new Date(`${b.data}T00:00:00`).getTime() / MS_HORA;
  return { ini: t + b.horaInicio, fim: t + b.horaInicio + b.duracao };
}

/**
 * Agrupa blocos em cadeias. Considera "mesma cadeia" quando o gap entre
 * fim de um e início do próximo for ≤ 0,6h (tolerância pra pequenas
 * diferenças de relógio). Sono que vier logo após plantão entra na
 * cadeia. Bloqueio quebra a cadeia.
 */
export function calcCadeias(blocos: Bloco[]): Cadeia[] {
  if (blocos.length === 0) return [];

  const linhas: BlocoLinha[] = blocos
    .filter((b) => b.tipo !== 'bloqueio')
    .map((b) => {
      const { ini, fim } = abs(b);
      return { ...b, _inicioAbs: ini, _fimAbs: fim };
    })
    .sort((a, b) => a._inicioAbs - b._inicioAbs);

  const cadeias: Cadeia[] = [];
  let atual: BlocoLinha[] = [];

  for (const linha of linhas) {
    if (atual.length === 0) {
      atual.push(linha);
      continue;
    }
    const anterior = atual[atual.length - 1]!;
    const gap = linha._inicioAbs - anterior._fimAbs;
    if (gap <= TOLERANCIA_HORAS) {
      atual.push(linha);
    } else {
      cadeias.push(materializa(atual));
      atual = [linha];
    }
  }
  if (atual.length > 0) cadeias.push(materializa(atual));
  return cadeias;
}

function materializa(linhas: BlocoLinha[]): Cadeia {
  const primeiro = linhas[0]!;
  const ultimo = linhas[linhas.length - 1]!;
  const totalH = ultimo._fimAbs - primeiro._inicioAbs;
  const fimHoras = primeiro.horaInicio + totalH;
  const fimDataOffset = Math.floor(fimHoras / HORAS_DIA);
  const fimHora = fimHoras - fimDataOffset * HORAS_DIA;
  return {
    id: `cadeia-${primeiro.id}`,
    blocos: linhas.map(stripInternos),
    inicio: { data: primeiro.data, hora: primeiro.horaInicio },
    fim: {
      data: adicionaDia(primeiro.data, fimDataOffset),
      hora: fimHora,
    },
    totalH,
  };
}

function stripInternos(linha: BlocoLinha): Bloco {
  // Volta o objeto pro shape público de Bloco. Os campos internos
  // (_inicioAbs/_fimAbs) ficam apenas no escopo de calcCadeias.
  const { _inicioAbs: _i, _fimAbs: _f, ...rest } = linha;
  return rest as Bloco;
}
