import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envObrigatorio, envOpcional } from './env.js';

/**
 * Cliente Supabase server-side com SERVICE_ROLE_KEY. Bypassa RLS —
 * use apenas em endpoints `/api/*` que precisam ler/escrever na conta
 * de outros usuários (cron, ICS por token, audit log).
 *
 * Nunca importar isso no front · `import.meta.env` não tem essas keys
 * e o Vite reclamaria, mas a regra principal é: SERVICE_ROLE NÃO VAI
 * PRO CLIENT.
 */

let _adm: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!_adm) {
    const url = envOpcional('VITE_SUPABASE_URL') ?? envObrigatorio('SUPABASE_URL');
    const key = envObrigatorio('SUPABASE_SERVICE_ROLE_KEY');
    _adm = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _adm;
}
