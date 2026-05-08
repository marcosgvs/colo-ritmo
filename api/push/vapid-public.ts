import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from '../_shared/env.js';

/**
 * /api/push/vapid-public · expõe o VAPID public key pra o client
 * conseguir gerar PushSubscriptions. A private key fica no server.
 */

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  try {
    const key = envObrigatorio('VAPID_PUBLIC');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).json({ vapidPublic: key });
  } catch (err) {
    res.status(500).json({ erro: String(err) });
  }
}
