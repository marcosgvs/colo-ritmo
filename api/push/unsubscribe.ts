import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';

/** /api/push/unsubscribe · remove uma subscription pelo endpoint. */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }
  const body = (req.body ?? {}) as { endpoint?: string };
  if (!body.endpoint) {
    res.status(400).json({ erro: 'endpoint obrigatório' });
    return;
  }
  const adm = supabaseAdmin();
  const { error } = await adm.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
  if (error) {
    res.status(500).json({ erro: error.message });
    return;
  }
  res.status(200).json({ ok: true });
}
