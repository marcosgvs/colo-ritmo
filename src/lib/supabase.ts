import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase único para toda a aplicação.
 *
 * URL e anon key são públicos por design — o anon key é "publishable"
 * e a RLS no banco é quem garante a segurança. Default hardcoded
 * espelha V2-CREDENTIALS.md §3 (sobrescrito por VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY no env quando disponível).
 */

const URL_FALLBACK = 'https://xlefxpcmruhuyexdvzru.supabase.co';
const ANON_FALLBACK = 'sb_publishable_lrEzOdS4RnrwsDmCUsXEuQ_ElUajQ3W';

export const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] ?? URL_FALLBACK;
export const SUPABASE_ANON_KEY = import.meta.env['VITE_SUPABASE_ANON_KEY'] ?? ANON_FALLBACK;

let _cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!_cliente) {
    _cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // implicit · magic links via admin API e signInWithOtp default mandam
        // tokens no hash. PKCE ignoraria o hash e quebraria o fluxo.
        flowType: 'implicit',
      },
    });
  }
  return _cliente;
}
