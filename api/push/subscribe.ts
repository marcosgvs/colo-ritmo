import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';

/**
 * /api/push/subscribe · grava uma push subscription no banco.
 *
 * Auth: Bearer JWT no header Authorization. O user_id vem do token —
 * nunca do body — senão qualquer um registraria um endpoint próprio sob
 * o user_id de outra pessoa e receberia os lembretes de plantão dela.
 *
 * Body esperado:
 *   {
 *     subscription: {
 *       endpoint: string,
 *       keys: { p256dh: string, auth: string }
 *     },
 *     userAgent?: string
 *   }
 *
 * Tabela `push_subscriptions` (assumida do schema v1):
 *   user_id    uuid
 *   endpoint   text primary key
 *   p256dh     text
 *   auth       text
 *   user_agent text
 *   created_at timestamptz default now()
 */

interface SubscriptionBody {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  userAgent?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  const authHeader = req.headers['authorization'];
  const jwt =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
  if (!jwt) {
    res.status(401).json({ erro: 'token ausente · entra de novo' });
    return;
  }

  const adm = supabaseAdmin();

  const { data: userResp, error: userErr } = await adm.auth.getUser(jwt);
  if (userErr || !userResp.user) {
    res.status(401).json({ erro: 'token inválido' });
    return;
  }
  const userId = userResp.user.id;

  const body = (req.body ?? {}) as SubscriptionBody;
  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ erro: 'payload incompleto · subscription{endpoint,keys}' });
    return;
  }

  const { error } = await adm.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: body.userAgent ?? null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('push/subscribe: erro upsert', error);
    res.status(500).json({ erro: error.message });
    return;
  }

  res.status(200).json({ ok: true });
}
