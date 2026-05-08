/**
 * HMAC-SHA-256 puro · usado pra:
 *   · assinar/verificar links de preview HMAC (Marcos manda magic
 *     links pra Mariana ver o app como X sem precisar logar)
 *   · validar payload de cron interno
 *
 * Implementação via WebCrypto (subtle) — funciona em Node 20+ e Edge.
 * Os helpers retornam strings hex pra simplificar URLs e cookies.
 */

const enc = new TextEncoder();

async function chave(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function hmacAssinar(secret: string, payload: string): Promise<string> {
  const key = await chave(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return bufParaHex(sig);
}

/** Comparação constant-time pra evitar timing attacks. */
export async function hmacVerificar(
  secret: string,
  payload: string,
  hex: string,
): Promise<boolean> {
  const esperado = await hmacAssinar(secret, payload);
  if (esperado.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) {
    diff |= esperado.charCodeAt(i) ^ hex.charCodeAt(i);
  }
  return diff === 0;
}

function bufParaHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Assina um link de preview com expiração. O `as` define o role
 * carregado quando o link é seguido.
 */
export async function gerarPreviewLink(
  secret: string,
  base: string,
  as: 'medica' | 'parceiro' | 'admin-medica',
  expiraEm: number,
): Promise<string> {
  const exp = Date.now() + expiraEm;
  const payload = `${as}:${exp}`;
  const sig = await hmacAssinar(secret, payload);
  const u = new URL(base);
  u.pathname = '/api/preview';
  u.searchParams.set('action', 'start');
  u.searchParams.set('as', as);
  u.searchParams.set('exp', String(exp));
  u.searchParams.set('sig', sig);
  return u.toString();
}

export interface PreviewClaim {
  as: 'medica' | 'parceiro' | 'admin-medica';
  exp: number;
}

/**
 * Verifica os parâmetros de um link de preview e retorna o claim se
 * tudo bater. Retorna null em qualquer falha (sig inválida, expirado,
 * `as` desconhecido).
 */
export async function verificarPreviewLink(
  secret: string,
  params: { as?: string; exp?: string; sig?: string },
): Promise<PreviewClaim | null> {
  const { as, exp, sig } = params;
  if (!as || !exp || !sig) return null;
  if (as !== 'medica' && as !== 'parceiro' && as !== 'admin-medica') return null;
  const expN = Number(exp);
  if (!Number.isFinite(expN) || expN <= Date.now()) return null;
  const ok = await hmacVerificar(secret, `${as}:${expN}`, sig);
  if (!ok) return null;
  return { as, exp: expN };
}
