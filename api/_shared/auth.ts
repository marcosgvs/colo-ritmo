import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve o user_id do Bearer JWT no header Authorization.
 * null = ausente ou inválido · o handler responde 401.
 *
 * Endpoints que gastam créditos da Anthropic (ou tocam dados de user)
 * precisam disso — sem auth, qualquer um na internet consome a API.
 */
export async function userIdDoJwt(
  req: VercelRequest,
  adm: SupabaseClient,
): Promise<string | null> {
  const auth = req.headers['authorization'];
  const jwt = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!jwt) return null;
  const { data, error } = await adm.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}
