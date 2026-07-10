import type {
  Bloco,
  BlocoPlantao,
  Hospital,
  HospitaisMap,
} from '@/types';
import { fromISO } from './dates.js';

/**
 * Cálculo de remuneração · SEMPRE BRUTO.
 *
 * Não estimamos líquido nem aplicamos factor de imposto. Quem precisa
 * saber líquido tem o contador. Pro app, bruto é o número de verdade.
 *
 * Bruto vem da regra do hospital:
 *   - valorFixo (público CLT) entra UMA vez no mês · plantões adicionam
 *     só adicionalNoite quando noturnos
 *   - valorHora (privado PJ) multiplica pela duração · noturno adiciona
 *     adicionalNoite
 *   - valorPlantao (fallback) entra por plantão
 */

export interface ResumoBloco {
  hospitalId: string;
  bruto: number;
  noturno: boolean;
}

export interface ResumoMes {
  mes: string; // ISO YYYY-MM
  total: { bruto: number };
  porHospital: Record<string, { bruto: number; plantoes: number }>;
}

/** Considera noturno qualquer bloco que cruze a faixa 22h-06h.
 * `fim` pode passar de 24 (vira madrugada do dia seguinte): fim > 22 cobre
 * tanto "entra na janela 22-24h" quanto "cruza a meia-noite". */
export function ehNoturno(b: BlocoPlantao): boolean {
  const ini = b.horaInicio;
  const fim = ini + b.duracao;
  return ini < 6 || fim > 22;
}

export function calcRemuneracaoBloco(b: BlocoPlantao, hosp: Hospital): ResumoBloco {
  const noturno = ehNoturno(b);
  let bruto: number;
  if (typeof hosp.valorFixo === 'number' && hosp.valorFixo > 0) {
    // Público CLT · valorFixo é mensal · por plantão só adicional noturno
    // (o fixo entra UMA vez no mês via calcRemuneracaoMes)
    bruto = noturno ? hosp.adicionalNoite : 0;
  } else if (typeof hosp.valorHora === 'number' && hosp.valorHora > 0) {
    bruto = hosp.valorHora * b.duracao;
    if (noturno) bruto += hosp.adicionalNoite;
  } else {
    bruto = hosp.valorPlantao || 0;
    if (noturno) bruto += hosp.adicionalNoite;
  }
  return { hospitalId: hosp.id, bruto, noturno };
}

/**
 * Resumo mensal · agrupa todos os plantões cujo `data` cai no mês ISO
 * informado (`'2026-05'`). Cedidos não contam (o plantão foi de outra
 * pessoa). Trocados via `viaTroca: true` contam — você assumiu o turno.
 */
export function calcRemuneracaoMes(
  blocos: Bloco[],
  hospitais: HospitaisMap,
  mes: string,
): ResumoMes {
  const out: ResumoMes = {
    mes,
    total: { bruto: 0 },
    porHospital: {},
  };

  for (const b of blocos) {
    if (b.tipo !== 'plantao') continue;
    if (mesISO(b.data) !== mes) continue;
    const hosp = hospitais[b.hospitalId];
    if (!hosp) continue;
    const res = calcRemuneracaoBloco(b, hosp);
    out.total.bruto += res.bruto;
    if (!out.porHospital[hosp.id]) {
      out.porHospital[hosp.id] = { bruto: 0, plantoes: 0 };
    }
    const sub = out.porHospital[hosp.id]!;
    sub.bruto += res.bruto;
    sub.plantoes += 1;
  }

  // Adiciona valorFixo (CLT mensal) UMA vez por hospital com >=1 plantão no mês.
  for (const [hospId, sub] of Object.entries(out.porHospital)) {
    const hosp = hospitais[hospId];
    if (!hosp) continue;
    if (typeof hosp.valorFixo === 'number' && hosp.valorFixo > 0) {
      sub.bruto += hosp.valorFixo;
      out.total.bruto += hosp.valorFixo;
    }
  }
  return out;
}

function mesISO(iso: string): string {
  const d = fromISO(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
