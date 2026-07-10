import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';
import { userIdDoJwt } from '../_shared/auth.js';

/**
 * /api/push/unsubscribe · remove uma subscription pelo endpoint.
 *
 * Auth: Bearer JWT no header Authorization (mesmo padrão do subscribe).
 * Só deleta subscriptions do próprio user — sem isso qualquer um
 * apagaria a subscription alheia sabendo o endpoint.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  const adm = supabaseAdmin();

  const userId = await userIdDoJwt(req, adm);
  if (!userId) {
    res.status(401).json({ erro: 'token ausente ou inválido · entra de novo' });
    return;
  }

  const body = (req.body ?? {}) as { endpoint?: string };
  if (!body.endpoint) {
    res.status(400).json({ erro: 'endpoint obrigatório' });
    return;
  }

  const { error } = await adm
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', body.endpoint);
  if (error) {
    res.status(500).json({ erro: error.message });
    return;
  }
  res.status(200).json({ ok: true });
}
