import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Bloco, HospitaisMap } from '../../src/types/index.js';
import { gerarICS } from '../../src/lib/ics.js';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';

/**
 * /api/ics/[token].ics · feed iCal público (read-only) por token.
 *
 * Como funciona:
 *   1. lookup do `ics_token` em `user_profiles` (RPC ou select via service role)
 *   2. carrega `user_state.state.blocos` do user
 *   3. renderiza VCALENDAR e devolve com `Content-Type: text/calendar`
 *
 * Tokens são gerados por usuário. Rotação/revogação ainda NÃO está
 * implementada — não existe RPC de revogar; invalidar hoje exige trocar
 * o `ics_token` direto em `user_profiles`. Não validamos expiração.
 */

interface UserStateBlob {
  blocos?: Bloco[];
  hospitais?: HospitaisMap;
  preferencias?: { nome?: string };
}

interface PerfilLookup {
  user_id: string;
  nome: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const tokenRaw = req.query['token'];
  const token = typeof tokenRaw === 'string' ? tokenRaw.replace(/\.ics$/i, '') : '';
  if (!token) {
    res.status(400).send('token vazio');
    return;
  }

  const adm = supabaseAdmin();

  // 1. acha o user pelo ICS token
  const { data: perfil, error: errPerfil } = await adm
    .from('user_profiles')
    .select('user_id, nome')
    .eq('ics_token', token)
    .maybeSingle<PerfilLookup>();

  if (errPerfil) {
    console.error('ics: erro ao buscar perfil', errPerfil);
    res.status(500).send('erro ao buscar feed');
    return;
  }

  if (!perfil) {
    res.status(404).send('feed não encontrado · token inválido ou revogado');
    return;
  }

  // 2. carrega estado dele
  const { data: stateRow, error: errState } = await adm
    .from('user_state')
    .select('state')
    .eq('user_id', perfil.user_id)
    .maybeSingle<{ state: UserStateBlob | null }>();

  if (errState) {
    console.error('ics: erro ao carregar state', errState);
    res.status(500).send('erro ao carregar agenda');
    return;
  }

  const state = stateRow?.state ?? null;
  const blocos = state?.blocos ?? [];
  const hospitais = state?.hospitais ?? {};
  const nome = state?.preferencias?.nome ?? perfil.nome ?? 'Colo Ritmo';

  const ics = gerarICS(blocos, hospitais, { nome });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  // private · o feed é autenticado por token na URL — `public` deixaria
  // proxies/CDN cachearem e servirem a agenda pra quem não tem o token.
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', `inline; filename="colo-ritmo-${token.slice(0, 8)}.ics"`);
  res.status(200).send(ics);
}
