import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Bloco, HospitaisMap } from '../../src/types/index.js';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';

/**
 * /api/parceiro/agenda · vista casal read-only.
 *
 * Como funciona:
 *   1. lê o JWT do header Authorization (já vem do client logado)
 *   2. resolve o user atual via Supabase auth
 *   3. lê `parceiro_user_id` em user_profiles (assumido no schema v1)
 *   4. exige RECIPROCIDADE: o alvo também precisa apontar de volta pro
 *      requerente — senão qualquer user poderia se auto-declarar parceiro
 *      de qualquer UUID e ler a agenda alheia via service role
 *   5. carrega user_state.state da Mariana
 *   6. devolve `{ blocos, hospitais, nome, atualizadoEm }`
 *
 * Sem auth, retorna 401. Sem parceiro vinculado, 200 com `vinculado: false`.
 * Vínculo sem reciprocidade, 403.
 */

interface PerfilParceiro {
  user_id: string;
  parceiro_user_id: string | null;
  nome: string | null;
}

interface UserStateBlob {
  blocos?: Bloco[];
  hospitais?: HospitaisMap;
  preferencias?: { nome?: string };
  updatedAt?: string;
}

interface PerfilDestino {
  user_id: string;
  parceiro_user_id: string | null;
  nome: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const auth = req.headers['authorization'];
  const jwt = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
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

  const { data: perfil, error: perfilErr } = await adm
    .from('user_profiles')
    .select('user_id, parceiro_user_id, nome')
    .eq('user_id', userId)
    .maybeSingle<PerfilParceiro>();

  if (perfilErr) {
    res.status(500).json({ erro: perfilErr.message });
    return;
  }

  if (!perfil?.parceiro_user_id) {
    res.status(200).json({ vinculado: false });
    return;
  }

  // Reciprocidade: o alvo precisa apontar de volta pro requerente.
  // Sem isso, declarar `parceiro_user_id` no próprio profile bastaria
  // pra ler a agenda de qualquer pessoa.
  const parceiroResp = await adm
    .from('user_profiles')
    .select('user_id, parceiro_user_id, nome')
    .eq('user_id', perfil.parceiro_user_id)
    .maybeSingle<PerfilDestino>();

  if (parceiroResp.error) {
    res.status(500).json({ erro: parceiroResp.error.message });
    return;
  }

  if (parceiroResp.data?.parceiro_user_id !== userId) {
    res.status(403).json({ erro: 'essa pessoa ainda não te adicionou como parceiro' });
    return;
  }

  const stateResp = await adm
    .from('user_state')
    .select('state')
    .eq('user_id', perfil.parceiro_user_id)
    .maybeSingle<{ state: UserStateBlob | null }>();

  if (stateResp.error) {
    res.status(500).json({ erro: stateResp.error.message });
    return;
  }

  const state = stateResp.data?.state ?? null;
  const blocos = state?.blocos ?? [];
  const hospitais = state?.hospitais ?? {};
  const nome = state?.preferencias?.nome ?? parceiroResp.data?.nome ?? 'parceira';
  const atualizadoEm = state?.updatedAt ?? null;

  res.setHeader('Cache-Control', 'private, max-age=30');
  res.status(200).json({
    vinculado: true,
    nome,
    atualizadoEm,
    blocos,
    hospitais,
  });
}
