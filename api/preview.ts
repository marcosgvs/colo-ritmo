import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarPreviewLink } from '../src/lib/hmac.js';
import { clearCookie, setCookie } from './_shared/cookies.js';
import { envObrigatorio } from './_shared/env.js';

/**
 * /api/preview · sessão de preview HMAC-assinada.
 *
 *   GET ?action=start&as=…&exp=…&sig=…  → valida link, seta cookie httpOnly,
 *                                          redireciona pra `/`
 *   GET ?action=end                      → limpa cookie, redireciona pra `/`
 *
 * O cookie `colo_preview` carrega o role atual em texto puro (já está
 * assinado pela URL — ele só sobrevive enquanto a aba durar). Os hooks
 * client-side leem ele via /api/preview?action=status (httpOnly).
 *
 * Roles aceitos: `medica`, `parceiro`, `admin-medica`. `coordenadora` foi
 * removido v2.
 */

const COOKIE = 'colo_preview';
const SETE_DIAS = 7 * 24 * 60 * 60;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = req.query['action'];

  if (action === 'end') {
    clearCookie(res, COOKIE);
    res.redirect(302, '/');
    return;
  }

  if (action === 'status') {
    const raw = req.headers.cookie ?? '';
    const m = raw.match(/(?:^|;\s*)colo_preview=([^;]+)/);
    if (!m) {
      res.status(200).json({ ativo: false });
      return;
    }
    res.status(200).json({ ativo: true, as: decodeURIComponent(m[1] ?? '') });
    return;
  }

  if (action === 'start') {
    const secret = envObrigatorio('PREVIEW_SECRET');
    const claim = await verificarPreviewLink(secret, {
      as: typeof req.query['as'] === 'string' ? req.query['as'] : undefined,
      exp: typeof req.query['exp'] === 'string' ? req.query['exp'] : undefined,
      sig: typeof req.query['sig'] === 'string' ? req.query['sig'] : undefined,
    });
    if (!claim) {
      res.status(400).json({ erro: 'link inválido ou expirado' });
      return;
    }
    setCookie(res, COOKIE, claim.as, { maxAge: SETE_DIAS, sameSite: 'Lax' });
    res.redirect(302, '/');
    return;
  }

  res.status(400).json({ erro: 'action desconhecida · use start | end | status' });
}
