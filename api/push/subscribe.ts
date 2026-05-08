import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';

/**
 * /api/push/subscribe · grava uma push subscription no banco.
 *
 * Body esperado:
 *   {
 *     userId: string,
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
  userId?: string;
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

  const body = (req.body ?? {}) as SubscriptionBody;
  const userId = body.userId;
  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (!userId || !endpoint || !p256dh || !auth) {
    res.status(400).json({ erro: 'payload incompleto · userId + subscription{endpoint,keys}' });
    return;
  }

  const adm = supabaseAdmin();
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
