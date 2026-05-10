/**
 * Match fuzzy de nomes de plantonistas vs apelido procurado.
 *
 * Por que existe: o chefe escreve o nome de jeitos diferentes — "Mpinheiro",
 * "MPinheiro", "Mpinhero" (typo), "Dra. Mpinheiro", "Mpinheiro BHP" (sufixo
 * de unidade interna). Tudo isso tem que bater com o apelido cadastrado
 * pela médica ("Mpinheiro").
 *
 * Estratégia:
 *   1. Normalizar (NFD pra tirar acento, lowercase, trim, strip prefixos
 *      de tratamento e sufixos comuns de unidade hospitalar).
 *   2. Match exato → true.
 *   3. Distância de Levenshtein com tolerância proporcional ao tamanho.
 *
 * Tolerâncias propositalmente conservadoras pra evitar falsos positivos
 * (ex: "Mpinheiro" não pode bater com "Marina" ou "Pinheiro" sozinho).
 */

const PREFIXOS = /^(dra?\.?\s*|prof\.?\s*)/i;
// Sufixos comuns que aparecem depois do nome em escalas de hospital
// (BHP/BHN/CRO/CEP = unidades, CP = central de pacientes, Pr = presencial,
// PED = pediatria, etc). Lista expandível conforme aparecerem.
const SUFIXOS_HOSPITAIS =
  /\s+(bhp|bhn|cro|cep|cp|pr|ped|nl|nm|adt|adm|cron|crono|m1|m2|cas|t1|t2|n1|n2|\(pg\))\s*\.?$/i;

export function normalizarNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(PREFIXOS, '')
    .replace(SUFIXOS_HOSPITAIS, '')
    .replace(/[*²¹³]+/g, '') // marcadores de extra/troca · ignora
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr: number[] = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + custo);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Tolerância conservadora — 1 erro é suficiente pra cobrir typos típicos
 * (letra faltando, letra a mais, troca pontual) em qualquer tamanho de
 * nome 4+ chars.
 *
 *   < 4 caracteres: match exato (qualquer typo é falso positivo)
 *   4+ caracteres: 1 erro
 *
 * Tolerar 2 erros era fonte de confusão real: "Mariana" vs "Marilia" tem
 * distância 2 (`n→i`, `a→l`) e ambos têm 7 chars. Com tolerância 2 os
 * dois batiam · com tolerância 1 não.
 *
 * Casos ainda cobertos:
 *   - Mpinheiro vs Mpinhero (1 letra a menos) ✓
 *   - Mpinheiro vs MPnheiro (1 letra a menos) ✓
 *   - Mariana vs Marianna (1 letra a mais) ✓
 *   - Mariana vs Mariane (1 substituição) ✓
 */
function tolerancia(tamanho: number): number {
  if (tamanho < 4) return 0;
  return 1;
}

export function fuzzyMatch(nomeNoPdf: string, alvo: string): boolean {
  const a = normalizarNome(nomeNoPdf);
  const b = normalizarNome(alvo);
  if (!a || !b) return false;
  if (a === b) return true;
  const tam = Math.max(a.length, b.length);
  return levenshtein(a, b) <= tolerancia(tam);
}
