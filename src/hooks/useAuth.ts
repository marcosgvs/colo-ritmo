import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AuthStatus = 'verificando' | 'logado' | 'deslogado';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
}

/**
 * useAuth · escuta sessão Supabase.
 *
 * Estados:
 *   verificando  · primeiro carregamento, ainda não sabemos se há sessão
 *   logado       · há user válido
 *   deslogado    · sem sessão · UI deve mostrar Login
 *
 * Magic link: usuário recebe email com link que volta pra `/`. Supabase
 * detecta o token na URL automaticamente (detectSessionInUrl=true) e
 * dispara `onAuthStateChange('SIGNED_IN', session)`.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    status: 'verificando',
    user: null,
    session: null,
  });

  useEffect(() => {
    const sb = supabase();
    let mounted = true;

    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({
        status: data.session ? 'logado' : 'deslogado',
        user: data.session?.user ?? null,
        session: data.session ?? null,
      });
    });

    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setState({
        status: session ? 'logado' : 'deslogado',
        user: session?.user ?? null,
        session: session ?? null,
      });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function enviarMagicLink(email: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = supabase();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      // App vive em /ritmo · magic link precisa voltar pra dentro do scope.
      emailRedirectTo:
        typeof window !== 'undefined' ? `${window.location.origin}/ritmo/` : undefined,
    },
  });
  if (error) return { ok: false, erro: traduzirErroAuth(error.message) };
  return { ok: true };
}

/**
 * OAuth Google · resolve o problema do magic link em PWA (storage
 * isolado). O redirect volta pra `/ritmo/` no mesmo contexto onde o
 * user clicou (PWA standalone ou browser) e Supabase JS detecta
 * `?code=...` na URL automaticamente.
 */
export async function entrarComGoogle(): Promise<{ ok: true } | { ok: false; erro: string }> {
  const sb = supabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo:
        typeof window !== 'undefined' ? `${window.location.origin}/ritmo/` : undefined,
    },
  });
  if (error) return { ok: false, erro: traduzirErroAuth(error.message) };
  return { ok: true };
}

export async function sair(): Promise<void> {
  await supabase().auth.signOut();
}

function traduzirErroAuth(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('rate limit')) return 'muita tentativa em pouco tempo · espera 1 min';
  if (lower.includes('invalid email')) return 'esse email parece inválido';
  if (lower.includes('not allowed') || lower.includes('user not allowed'))
    return 'esse email não tem acesso ainda · acesso por convite';
  return 'algo travou aqui · tenta de novo em instantes';
}
