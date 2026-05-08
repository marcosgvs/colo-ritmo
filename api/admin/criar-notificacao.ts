import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from '../_shared/env.js';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';

/**
 * /api/admin/criar-notificacao · debug + futuro hook de triggers.
 *
 * Gate: header `x-seed-secret` (mesmo secret do seed-claude · privado).
 *
 * Body:
 *   { user_id, tipo, titulo, detalhe?, payload_json? }
 *
 * tipo aceito: troca | conflito | sugestao | aprovacao | limite
 *
 * Por enquanto é o caminho pra disparar notificação manual e ver o
 * realtime entregar no sino. Em iteração futura, esse endpoint vira
 * pluggable na lógica de troca/conflito (ou triggers SQL substituem).
 */

const TIPOS_OK = new Set(['troca', 'conflito', 'sugestao', 'aprovacao', 'limite']);

interface Body {
  user_id?: string;
  tipo?: string;
  titulo?: string;
  detalhe?: string;
  payload_json?: Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

  let secret: string;
  try {
    secret = envObrigatorio('CLAUDE_SEED_SECRET');
  } catch {
    res.status(503).json({ erro: 'endpoint indisponível · CLAUDE_SEED_SECRET ausente' });
    return;
  }

  if (req.headers['x-seed-secret'] !== secret) {
    res.status(401).json({ erro: 'unauthorized' });
    return;
  }

  const body = (req.body ?? {}) as Body;
  if (!body.user_id || !body.tipo || !body.titulo) {
    res.status(400).json({ erro: 'user_id, tipo, titulo obrigatórios' });
    return;
  }
  if (!TIPOS_OK.has(body.tipo)) {
    res.status(400).json({ erro: `tipo inválido · use ${[...TIPOS_OK].join(' | ')}` });
    return;
  }

  const adm = supabaseAdmin();
  const { data, error } = await adm
    .from('notificacoes')
    .insert({
      user_id: body.user_id,
      tipo: body.tipo,
      titulo: body.titulo,
      detalhe: body.detalhe ?? '',
      payload_json: body.payload_json ?? null,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ erro: error.message, hint: 'rodou v19-notificacoes.sql?' });
    return;
  }

  res.status(200).json({ ok: true, notificacao: data });
}
