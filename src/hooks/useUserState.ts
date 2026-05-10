import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Bloco,
  EscalaImportada,
  Hospital,
  Preferencias,
} from '@/types';
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
  escalasImportadas?: EscalaImportada[];
  updatedAt?: string;
}

export type LoadStatus = 'inativo' | 'carregando' | 'pronto' | 'erro';

export interface UserStateValor {
  blocos: Bloco[];
  hospitais: Record<string, Hospital>;
  preferencias: Preferencias;
  escalasImportadas: EscalaImportada[];
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
  escalasImportadas: [],
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
        escalasImportadas: valor.escalasImportadas,
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
          escalasImportadas: next.escalasImportadas ?? prev.escalasImportadas,
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
            escalasImportadas: blob.escalasImportadas ?? [],
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
            escalasImportadas: novoState.escalasImportadas ?? prev.escalasImportadas,
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

  // State enriquecido:
  //   1. Garante que hospitais referenciados por plantões antigos existam
  //      no map ativo (preenche com defaults pra evitar plantões "fantasmas"
  //      sem nome/regras/valor).
  //   2. Marca `conflito: true` nos plantões em sobreposição/sem-descanso
  //      pra UI pintar vermelho.
  const stateEnriquecido = useMemo<UserStateValor>(() => {
    const hospitaisFinal = preencherFantasmas(state.blocos, state.hospitais);
    return {
      ...state,
      hospitais: hospitaisFinal,
      blocos: marcarConflitos(state.blocos, hospitaisFinal),
    };
  }, [state]);

  return { status, erro, state: stateEnriquecido, setState, flushSave };
}

/**
 * Quando um plantão antigo aponta pra hospitalId que não está no map
 * (porque o usuário removeu o hospital mas o plantão sobreviveu), busca
 * no `HOSPITAIS` default. Sem isso, calcRemuneracaoBloco devolve 0 e o
 * solver nem considera o hospital.
 */
function preencherFantasmas(
  blocos: Bloco[],
  atuais: Record<string, Hospital>,
): Record<string, Hospital> {
  const idsUsados = new Set<string>();
  for (const b of blocos) {
    if (b.tipo === 'plantao' || b.tipo === 'cedido') idsUsados.add(b.hospitalId);
  }
  const extras: Record<string, Hospital> = {};
  for (const id of idsUsados) {
    if (!atuais[id] && HOSPITAIS[id]) extras[id] = HOSPITAIS[id]!;
  }
  if (Object.keys(extras).length === 0) return atuais;
  return { ...extras, ...atuais };
}
