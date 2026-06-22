interface Props {
  temPrimeiroNome: boolean;
  totalSobrenomes: number;
  lado1: number;
  lado2: number;
}

export function Dicas({ temPrimeiroNome, totalSobrenomes, lado1, lado2 }: Props) {
  const dicas: string[] = [];

  if (!temPrimeiroNome) dicas.push('escolha ou digite um primeiro nome.');

  if (totalSobrenomes === 0) {
    dicas.push('toque nos sobrenomes para montar a ordem.');
  } else if (lado1 === 0 || lado2 === 0) {
    dicas.push('que tal incluir ao menos um sobrenome de cada lado?');
  }

  if (dicas.length === 0) return null;

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
      {dicas.map((d) => (
        <li key={d} style={{ font: '400 14px/1.45 var(--font-body)', color: 'var(--ink-3)' }}>
          · {d}
        </li>
      ))}
    </ul>
  );
}
