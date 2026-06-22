interface Props {
  total: number;
  lado1: number;
  lado2: number;
}

export function Contadores({ total, lado1, lado2 }: Props) {
  if (total === 0) return null;
  const palavra = total === 1 ? 'sobrenome' : 'sobrenomes';
  return (
    <p style={{ font: '400 14px/1.45 var(--font-body)', color: 'var(--ink-3)' }}>
      {total} {palavra} · {lado1} do lado 1, {lado2} do lado 2
    </p>
  );
}
