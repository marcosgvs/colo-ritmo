interface Props {
  temPrimeiroNome: boolean;
  totalSobrenomes: number;
  lado1: number;
  lado2: number;
}

export function Dicas({ temPrimeiroNome, totalSobrenomes, lado1, lado2 }: Props) {
  const dicas: string[] = [];

  if (!temPrimeiroNome) dicas.push('Escolha ou digite um primeiro nome.');

  if (totalSobrenomes === 0) {
    dicas.push('Toque nos sobrenomes para montar a ordem.');
  } else if (lado1 === 0 || lado2 === 0) {
    dicas.push('Que tal incluir ao menos um sobrenome de cada lado?');
  }

  if (dicas.length === 0) return null;

  return (
    <ul className="space-y-1">
      {dicas.map((d) => (
        <li key={d} className="text-sm text-muted">
          · {d}
        </li>
      ))}
    </ul>
  );
}
