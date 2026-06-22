export type Lado = 1 | 2;

export interface Sobrenome {
  nome: string;
  lado: Lado;
  /** Peso de "comprimento" sonoro, usado pelo algoritmo de fluidez. */
  peso: number;
}

export const SOBRENOMES: Sobrenome[] = [
  { nome: 'Garcia', lado: 1, peso: 2 },
  { nome: 'Vasconcellos', lado: 1, peso: 5 },
  { nome: 'Silva', lado: 1, peso: 1 },
  { nome: 'Pinheiro', lado: 2, peso: 3 },
  { nome: 'Barbosa', lado: 2, peso: 3 },
  { nome: 'Araújo', lado: 2, peso: 4 },
];

export const PESOS: Record<string, number> = Object.fromEntries(
  SOBRENOMES.map((s) => [s.nome, s.peso] as const),
);

export const LADO_DE: Record<string, Lado> = Object.fromEntries(
  SOBRENOMES.map((s) => [s.nome, s.lado] as const),
);

export interface NomeSugerido {
  nome: string;
  apelido: string;
}

export interface Categoria {
  titulo: string;
  nomes: NomeSugerido[];
}

export const CATEGORIAS: Categoria[] = [
  {
    titulo: 'modernos',
    nomes: [
      { nome: 'Nina', apelido: 'Nina' },
      { nome: 'Olívia', apelido: 'Lívia' },
      { nome: 'Cora', apelido: 'Corinha' },
      { nome: 'Maya', apelido: 'Mayinha' },
    ],
  },
  {
    titulo: 'meio-termo',
    nomes: [
      { nome: 'Manuela', apelido: 'Manu' },
      { nome: 'Clara', apelido: 'Clarinha' },
      { nome: 'Cecília', apelido: 'Ceci' },
      { nome: 'Antonella', apelido: 'Nella' },
      { nome: 'Iris', apelido: 'Iris' },
    ],
  },
  {
    titulo: 'clássicos',
    nomes: [
      { nome: 'Luiza', apelido: 'Lu' },
      { nome: 'Maria', apelido: 'Maria' },
      { nome: 'Beatriz', apelido: 'Bia' },
      { nome: 'Alice', apelido: 'Lili' },
      { nome: 'Helena', apelido: 'Lena' },
    ],
  },
];

/** Normaliza para comparar sem acento e sem caixa. */
const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const APELIDOS = new Map<string, string>(
  CATEGORIAS.flatMap((c) => c.nomes).map((n) => [semAcento(n.nome), n.apelido] as const),
);

/** Apelido quando o primeiro nome está na lista conhecida; senão null. */
export function apelidoDe(nome: string): string | null {
  const chave = semAcento(nome);
  if (!chave) return null;
  return APELIDOS.get(chave) ?? null;
}
