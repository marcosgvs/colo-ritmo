/**
 * Helpers de leitura de env vars no servidor. Throw se faltar uma var
 * obrigatória — melhor falhar no boot do que em runtime de uma rota
 * pouco usada.
 */

export function envObrigatorio(nome: string): string {
  const v = process.env[nome];
  if (!v || v.length === 0) {
    throw new Error(`env var '${nome}' é obrigatória mas não foi setada`);
  }
  return v;
}

export function envOpcional(nome: string, fallback?: string): string | undefined {
  const v = process.env[nome];
  if (!v || v.length === 0) return fallback;
  return v;
}
