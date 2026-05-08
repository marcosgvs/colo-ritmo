import { useMemo } from 'react';
import type { CSSProperties } from 'react';

interface MonthPickerProps {
  /** Valor no formato YYYY-MM. */
  value: string;
  onChange: (v: string) => void;
  style?: CSSProperties;
  /** Quantos meses pra trás e pra frente listar. Default 12+12. */
  janela?: number;
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Substituto pro <input type="month"> nativo · evita locale do browser
 * mostrar "May 2026" em inglês. Lista 25 meses (12 antes + atual + 12
 * depois) em PT-BR ("maio 2026"). Mantém value/onChange iguais ao input
 * nativo pra reuso fácil.
 */
export function MonthPicker({ value, onChange, style, janela = 12 }: MonthPickerProps) {
  const opcoes = useMemo(() => buildOpcoes(value, janela), [value, janela]);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--line)',
        background: 'var(--bg)',
        font: '500 14px/1.4 var(--font-body)',
        color: 'var(--ink)',
        outline: 'none',
        ...style,
      }}
    >
      {opcoes.map((iso) => (
        <option key={iso} value={iso}>
          {labelPT(iso)}
        </option>
      ))}
    </select>
  );
}

function labelPT(iso: string): string {
  const [ano, mes] = iso.split('-').map((s) => parseInt(s, 10));
  if (!ano || !mes) return iso;
  return `${MESES_PT[mes - 1]} ${ano}`;
}

function buildOpcoes(centro: string, janela: number): string[] {
  const ref = parseISOMonth(centro) ?? parseISOMonth(currentISOMonth())!;
  const out: string[] = [];
  for (let off = -janela; off <= janela; off++) {
    out.push(addMonths(ref, off));
  }
  return out;
}

function parseISOMonth(iso: string): { ano: number; mes: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const ano = parseInt(m[1]!, 10);
  const mes = parseInt(m[2]!, 10);
  if (mes < 1 || mes > 12) return null;
  return { ano, mes };
}

function currentISOMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(ref: { ano: number; mes: number }, offset: number): string {
  let total = ref.ano * 12 + (ref.mes - 1) + offset;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}`;
}
