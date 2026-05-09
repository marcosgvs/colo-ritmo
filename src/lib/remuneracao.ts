import type {
  Bloco,
  BlocoPlantao,
  Hospital,
  HospitaisMap,
} from '@/types';
import { fromISO } from './dates.js';

/**
 * Cálculo de remuneração — primeira aproximação. Bruto vem da regra do
 * hospital (público com valorFixo, privado com valorHora). Líquido é
 * uma estimativa: PJ ~94%, CLT/cooperativa ~72.5%. A tela Financeiro
 * (Sessão 4) refina com IRPF por faixa, INSS, etc.
 */

export interface ResumoBloco {
  hospitalId: string;
  bruto: number;
  liquido: number;
  noturno: boolean;
}

export interface ResumoMes {
  mes: string; // ISO YYYY-MM
  total: { bruto: number; liquido: number };
  porHospital: Record<string, { bruto: number; liquido: number; plantoes: number }>;
}

/** Considera noturno qualquer bloco que cruze a faixa 22h-06h. */
export function ehNoturno(b: BlocoPlantao): boolean {
  const ini = b.horaInicio;
  const fim = ini + b.duracao;
  return ini >= 19 || fim > 24 || ini < 6;
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
  const factor = hosp.tipo === 'privado' ? 0.94 : 0.725;
  const liquido = Math.round(bruto * factor);
  return { hospitalId: hosp.id, bruto, liquido, noturno };
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
    total: { bruto: 0, liquido: 0 },
    porHospital: {},
  };

  for (const b of blocos) {
    if (b.tipo !== 'plantao') continue;
    if (mesISO(b.data) !== mes) continue;
    const hosp = hospitais[b.hospitalId];
    if (!hosp) continue;
    const res = calcRemuneracaoBloco(b, hosp);
    out.total.bruto += res.bruto;
    out.total.liquido += res.liquido;
    if (!out.porHospital[hosp.id]) {
      out.porHospital[hosp.id] = { bruto: 0, liquido: 0, plantoes: 0 };
    }
    const sub = out.porHospital[hosp.id]!;
    sub.bruto += res.bruto;
    sub.liquido += res.liquido;
    sub.plantoes += 1;
  }

  // Adiciona valorFixo (CLT mensal) UMA vez por hospital com >=1 plantão no mês.
  for (const [hospId, sub] of Object.entries(out.porHospital)) {
    const hosp = hospitais[hospId];
    if (!hosp) continue;
    if (typeof hosp.valorFixo === 'number' && hosp.valorFixo > 0) {
      const liquidoFixo = Math.round(hosp.valorFixo * 0.725);
      sub.bruto += hosp.valorFixo;
      sub.liquido += liquidoFixo;
      out.total.bruto += hosp.valorFixo;
      out.total.liquido += liquidoFixo;
    }
  }
  return out;
}

function mesISO(iso: string): string {
  const d = fromISO(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
