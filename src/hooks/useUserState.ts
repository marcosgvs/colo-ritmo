import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Bloco, Hospital, PadraoMedica, Preferencias, PropostaSalva } from '@/types';
import { supabase } from '@/lib/supabase';
import { BLOCOS_SEMANA, HOSPITAIS, PREFERENCIAS_ME, marcarConflitos } from '@/lib/data';

/**
 * Shape do JSON em `user_state.state`. Mantemos compatibilidade com
 * leitura "vazia" — qualquer campo ausente cai pro default. Quando a
 * tabela é populada pela primeira vez (signup), gravamos um state com
 * defaults sensatos pra Mariana já ver o app montado.
 */
export interface UserStateBlob {
  blocos: Bloco[];
  hospitais?: Record<string, Hospital>;
  preferencias?: Preferencias;
  propostas?: PropostaSalva[];
  padroes?: PadraoMedica[];
  updatedAt?: string;
}

export type LoadStatus = 'inativo' | 'carregando' | 'pronto' | 'erro';

export interface UserStateValor {
  blocos: Bloco[];
  hospitais: Record<string, Hospital>;
  preferencias: Preferencias;
  propostas: PropostaSalva[];
  padroes: PadraoMedica[];
}

export interface UserStateAPI {
  status: LoadStatus;
  erro: string | null;
  state: UserStateValor;
  /** Atualiza in-memory + dispara save debounced. */
  setState: (next: Partial<UserStateValor>) => void;
  /** Save imediato (sem esperar debounce) · pra ações irreversíveis. */
  flushSave: () => Promise<void>;
}

const SAVE_DEBOUNCE_MS = 800;

const FALLBACK: UserStateValor = {
  blocos: BLOCOS_SEMANA,
  hospitais: HOSPITAIS,
  preferencias: PREFERENCIAS_ME,
  propostas: [],
  padroes: [],
};

/**
 * useUserState · só roda quando há `userId` (logado). Antes do login
 * status fica `inativo` e o consumidor decide fallback (sample data).
 *
 *   carregando → pronto · após primeiro select
 *   carregando → erro   · se select falhar (RLS, rede)
 *   pronto · escutando realtime + acumulando saves debounced
 */
export function useUserState(userId: string | null): UserStateAPI {
  const [status, setStatus] = useState<LoadStatus>(userId ? 'carregando' : 'inativo');
  const [erro, setErro] = useState<string | null>(null);
  const [state, setStateInternal] = useState<UserStateValor>(FALLBACK);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UserStateValor | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const persistir = useCallback(
    async (valor: UserStateValor): Promise<void> => {
      if (!userId) return;
      const blob: UserStateBlob = {
        blocos: valor.blocos,
        hospitais: valor.hospitais,
        preferencias: valor.preferencias,
        propostas: valor.propostas,
        padroes: valor.padroes,
        updatedAt: new Date().toISOString(),
      };
      const { error } = await supabase()
        .from('user_state')
        .upsert({ user_id: userId, state: blob }, { onConflict: 'user_id' });
      if (error) setErro(error.message);
    },
    [userId],
  );

  const flushSave = useCallback(async (): Promise<void> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingRef.current) {
      const v = pendingRef.current;
      pendingRef.current = null;
      await persistir(v);
    }
  }, [persistir]);

  const setState = useCallback(
    (next: Partial<UserStateValor>) => {
      setStateInternal((prev) => {
        const merged: UserStateValor = {
          blocos: next.blocos ?? prev.blocos,
          hospitais: next.hospitais ?? prev.hospitais,
          preferencias: next.preferencias ?? prev.preferencias,
          propostas: next.propostas ?? prev.propostas,
          padroes: next.padroes ?? prev.padroes,
        };
        pendingRef.current = merged;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (pendingRef.current) void persistir(pendingRef.current);
          pendingRef.current = null;
          debounceRef.current = null;
        }, SAVE_DEBOUNCE_MS);
        return merged;
      });
    },
    [persistir],
  );

  useEffect(() => {
    if (!userId) {
      setStatus('inativo');
      setStateInternal(FALLBACK);
      return;
    }

    let mounted = true;
    setStatus('carregando');
    setErro(null);

    const sb = supabase();
    sb.from('user_state')
      .select('state')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setErro(error.message);
          setStatus('erro');
          return;
        }
        const blob = (data?.state ?? null) as UserStateBlob | null;
        if (blob) {
          setStateInternal({
            blocos: blob.blocos ?? FALLBACK.blocos,
            hospitais: blob.hospitais ?? FALLBACK.hospitais,
            preferencias: blob.preferencias ?? FALLBACK.preferencias,
            propostas: blob.propostas ?? [],
            padroes: blob.padroes ?? [],
          });
        } else {
          // Primeiro acesso · semeia com defaults pra Mariana ver agenda.
          setStateInternal(FALLBACK);
          void persistir(FALLBACK);
        }
        setStatus('pronto');
      });

    const channel = sb
      .channel(`user_state:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_state',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const novoState = (payload.new as { state?: UserStateBlob } | null)?.state;
          if (!novoState || !mounted) return;
          // Só aplica se o updatedAt for mais novo que o nosso local (ignora echo do próprio save).
          setStateInternal((prev) => ({
            blocos: novoState.blocos ?? prev.blocos,
            hospitais: novoState.hospitais ?? prev.hospitais,
            preferencias: novoState.preferencias ?? prev.preferencias,
            propostas: novoState.propostas ?? prev.propostas,
            padroes: novoState.padroes ?? prev.padroes,
          }));
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      mounted = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // flush pendente sem await — útil pra fechar aba
      if (pendingRef.current) {
        void persistir(pendingRef.current);
        pendingRef.current = null;
      }
      if (channelRef.current) {
        void sb.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, persistir]);

  // State enriquecido · blocos com `conflito: true` marcados a partir de
  // detectarConflitos. Sem isso, o calendário não pinta vermelho os blocos
  // em sobreposição/sem-descanso (apesar do contador no header somar certo).
  const stateEnriquecido = useMemo<UserStateValor>(
    () => ({ ...state, blocos: marcarConflitos(state.blocos, state.hospitais) }),
    [state],
  );

  return { status, erro, state: stateEnriquecido, setState, flushSave };
}
