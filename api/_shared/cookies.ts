import type { VercelResponse } from '@vercel/node';

/**
 * Helpers de cookie httpOnly assinados. Usados pelo /api/preview pra
 * setar/limpar a sessão de "vendo como X" sem JWT real do Supabase.
 */

export interface CookieOpts {
  maxAge?: number;
  path?: string;
  domain?: string;
  /** Default: true. Use false só pra cookies de display read pelo client. */
  httpOnly?: boolean;
  /** Default: true. */
  secure?: boolean;
  /** Default: 'Lax'. */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export function setCookie(res: VercelResponse, nome: string, valor: string, opts: CookieOpts = {}): void {
  const partes = [`${nome}=${encodeURIComponent(valor)}`];
  if (opts.maxAge !== undefined) partes.push(`Max-Age=${opts.maxAge}`);
  partes.push(`Path=${opts.path ?? '/'}`);
  if (opts.domain) partes.push(`Domain=${opts.domain}`);
  if (opts.httpOnly !== false) partes.push('HttpOnly');
  if (opts.secure !== false) partes.push('Secure');
  partes.push(`SameSite=${opts.sameSite ?? 'Lax'}`);
  appendSetCookie(res, partes.join('; '));
}

export function clearCookie(res: VercelResponse, nome: string, opts: CookieOpts = {}): void {
  setCookie(res, nome, '', { ...opts, maxAge: 0 });
}

export function lerCookie(req: { headers: { cookie?: string } }, nome: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const alvo = `${nome}=`;
  for (const parte of raw.split(';')) {
    const trimmed = parte.trim();
    if (trimmed.startsWith(alvo)) {
      return decodeURIComponent(trimmed.slice(alvo.length));
    }
  }
  return null;
}

function appendSetCookie(res: VercelResponse, header: string): void {
  const atual = res.getHeader('Set-Cookie');
  if (!atual) {
    res.setHeader('Set-Cookie', header);
  } else if (Array.isArray(atual)) {
    res.setHeader('Set-Cookie', [...atual, header]);
  } else {
    res.setHeader('Set-Cookie', [String(atual), header]);
  }
}
