import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';
import { envObrigatorio, envOpcional } from '../_shared/env.js';

/**
 * /api/cron/lembrete-plantao · disparado por pg_cron via HTTP.
 *
 * Modos:
 *   `lead`  · 30 em 30 min · plantões que começam em ~30 min
 *   `today` · 1x ao dia (9h)  · resumo dos plantões do dia
 *
 * O Supabase tem RPC `cron_lembretes_payload(secret)` que devolve a
 * lista pronta de notificações a enviar. Esta função só:
 *   1. valida o CRON_SECRET via header `Authorization: Bearer …`
 *      (só header — o pg_cron do v16 manda por header; query vazaria em logs)
 *   2. chama RPC com o secret
 *   3. faz web-push pra cada subscription
 *   4. devolve `{ tentadas, sucesso, falhas }`
 *
 * Tolerante a falhas individuais — uma subscription expirada não
 * derruba o batch.
 */

interface PayloadEntry {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
  notificacao: {
    titulo: string;
    corpo: string;
    url?: string;
    tag?: string;
    badge?: string;
    icon?: string;
  };
}

let vapidConfigured = false;
function configurarVapid(): void {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    envObrigatorio('VAPID_SUBJECT'),
    envObrigatorio('VAPID_PUBLIC'),
    envObrigatorio('VAPID_PRIVATE'),
  );
  vapidConfigured = true;
}

function extrairSecret(req: VercelRequest): string | null {
  // Só header Authorization — o pg_cron (schemas-legacy/supabase-v16.sql)
  // manda `Authorization: Bearer <secret>`. Query string vazaria em logs.
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Comparação constant-time · não vaza prefixo do secret via timing. */
function secretConfere(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = envObrigatorio('CRON_SECRET');
  const recebido = extrairSecret(req);
  if (!secretConfere(recebido, cronSecret)) {
    res.status(401).json({ erro: 'unauthorized' });
    return;
  }

  // Aceita `modo` e `mode` · o pg_cron do v16 manda `?mode=`, o CUTOVER
  // documenta `?modo=` — sem os dois, o digest diário rodaria como 'lead'.
  const modoRaw = req.query['modo'] ?? req.query['mode'];
  const modo = modoRaw === 'today' ? 'today' : 'lead';

  configurarVapid();
  const adm = supabaseAdmin();

  const { data, error } = await adm.rpc('cron_lembretes_payload', {
    secret: cronSecret,
    modo,
  });

  if (error) {
    console.error('cron: rpc falhou', error);
    res.status(500).json({ erro: error.message });
    return;
  }

  const lista = Array.isArray(data) ? (data as PayloadEntry[]) : [];

  let sucesso = 0;
  let falhas = 0;
  const expirados: string[] = [];

  await Promise.all(
    lista.map(async (item) => {
      const sub: WebPushSubscription = {
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth },
      };
      const payload = JSON.stringify(item.notificacao);
      try {
        await webpush.sendNotification(sub, payload, { TTL: 600 });
        sucesso += 1;
      } catch (err: unknown) {
        falhas += 1;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expirados.push(item.endpoint);
      }
    }),
  );

  // limpa subscriptions mortas
  if (expirados.length > 0) {
    await adm.from('push_subscriptions').delete().in('endpoint', expirados);
  }

  res.status(200).json({
    modo,
    tentadas: lista.length,
    sucesso,
    falhas,
    expirados: expirados.length,
    timestamp: new Date().toISOString(),
    debug: envOpcional('VERCEL_ENV'),
  });
}
