import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from '../_shared/env.js';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';
import { BLOCOS_SEMANA, HOSPITAIS, PREFERENCIAS_ME } from '../../src/lib/data.js';

/**
 * /api/admin/seed-claude · cria um usuário de teste pra Claude (agente)
 * conseguir logar e validar a app sem inbox real.
 *
 * Gate: header `x-seed-secret` com valor de `CLAUDE_SEED_SECRET`.
 *
 * Whitelist de domínios permitidos pra evitar abuso caso o secret vaze.
 *
 * Resposta: `{ user_id, action_link }` — action_link é um magic link
 * gerado server-side via auth admin · não precisa receber email.
 *
 * Pode ser removido após estabilizar (esse endpoint é descartável).
 */

const DOMINIOS_PERMITIDOS = [
  'anthropic.com',
  'colo-ritmo.dev',
  'agent-test.local',
];

interface SeedBody {
  email?: string;
  nome?: string;
  /** Se true, popula user_state com sample data. */
  popularSample?: boolean;
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

  const recebido = req.headers['x-seed-secret'];
  if (typeof recebido !== 'string' || recebido !== secret) {
    res.status(401).json({ erro: 'unauthorized' });
    return;
  }

  const body = (req.body ?? {}) as SeedBody;
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    res.status(400).json({ erro: 'email obrigatório' });
    return;
  }

  const dominio = email.split('@')[1];
  if (!dominio || !DOMINIOS_PERMITIDOS.includes(dominio)) {
    res.status(403).json({ erro: `domínio não permitido · use um dos ${DOMINIOS_PERMITIDOS.join(', ')}` });
    return;
  }

  const adm = supabaseAdmin();

  try {
    // 1. cria ou pega user
    let userId: string;
    const { data: existente } = await adm.auth.admin.listUsers();
    const found = existente?.users?.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      userId = found.id;
    } else {
      const { data: created, error: errCreate } = await adm.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nome: body.nome ?? 'Claude (agente teste)' },
      });
      if (errCreate || !created.user) {
        res.status(500).json({ erro: errCreate?.message ?? 'falha ao criar user' });
        return;
      }
      userId = created.user.id;
    }

    // 2. profile
    const { error: errProfile } = await adm.from('user_profiles').upsert(
      {
        user_id: userId,
        nome: body.nome ?? 'Claude',
        role: 'medico',
        tipo_usuario: 'medica',
      },
      { onConflict: 'user_id' },
    );
    if (errProfile) {
      console.warn('seed-claude: erro upsert profile', errProfile.message);
      // não fatal · profile pode já existir
    }

    // 3. user_state (opcional)
    if (body.popularSample !== false) {
      const blob = {
        blocos: BLOCOS_SEMANA,
        hospitais: HOSPITAIS,
        preferencias: { ...PREFERENCIAS_ME, nome: body.nome ?? 'Claude (teste)' },
        updatedAt: new Date().toISOString(),
      };
      await adm.from('user_state').upsert(
        { user_id: userId, state: blob },
        { onConflict: 'user_id' },
      );
    }

    // 4. magic link sem precisar de inbox
    const { data: linkData, error: errLink } = await adm.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `https://colopediatria.com.br/`,
      },
    });
    if (errLink) {
      res.status(500).json({ erro: errLink.message });
      return;
    }

    res.status(200).json({
      user_id: userId,
      email,
      action_link: linkData?.properties?.action_link,
      hashed_token: linkData?.properties?.hashed_token,
      // pode usar pra exchange manual se preferir
    });
  } catch (err) {
    console.error('seed-claude: exceção', err);
    res.status(500).json({ erro: String(err) });
  }
}
