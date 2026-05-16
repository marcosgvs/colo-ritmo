import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Bloco,
  EscalaImportada,
  Hospital,
  Preferencias,
  PropostaHistorico,
} from '@/types';
import { supabase } from '@/lib/supabase';
import { marcarConflitos } from '@/lib/data';

const MAX_PROPOSTAS_HISTORICO = 10;

/**
 * Modo espelho · Marcos (dev) vê o state da Mariana (usuária real) ao vivo
 * pra debugar/observar uso. Realtime mantém em sincronia. Saves do Marcos
 * são ignorados pra não sobrescrever o que ela está fazendo.
 */
const ESPELHOS: Record<string, { userId: string; email: string }> = {
  '911a0e2b-4eec-4634-9ede-469805cc4a0e': {
    userId: '70c443bc-1657-4528-ad62-c1ae9352cb66',
    email: 'araujo.mpb@gmail.com',
  },
};

/**
 * Mapping persistente bloco↔event do Google Calendar. v1 (push-only)
 * já guarda etag pra sessão 2 (2-way) detectar conflitos via If-Match.
 */
export interface GcalConfig {
  calendarId: string;
  mapping: Record<string, { eventId: string; etag?: string }>;
  lastSyncedAt?: string;
}

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
  propostasMontar?: PropostaHistorico[];
  gcalConfig?: GcalConfig;
  updatedAt?: string;
}

export type LoadStatus = 'inativo' | 'carregando' | 'pronto' | 'erro';

export interface UserStateValor {
  blocos: Bloco[];
  hospitais: Record<string, Hospital>;
  preferencias: Preferencias;
  escalasImportadas: EscalaImportada[];
  propostasMontar: PropostaHistorico[];
  gcalConfig?: GcalConfig;
}

export interface UserStateAPI {
  status: LoadStatus;
  erro: string | null;
  state: UserStateValor;
  /** Atualiza in-memory + dispara save debounced. */
  setState: (next: Partial<UserStateValor>) => void;
  /** Save imediato (sem esperar debounce) · pra ações irreversíveis. */
  flushSave: () => Promise<void>;
  /** Email da conta sendo espelhada (modo dev/QA · só Marcos). null = sessão normal. */
  espelhandoDe: string | null;
}

const SAVE_DEBOUNCE_MS = 800;

/** State vazio · usado pro render inicial (antes do select retornar) e
 * pra users novos (força onboarding · hospitais={} dispara o fluxo). */
const STATE_VAZIO: UserStateValor = {
  blocos: [],
  hospitais: {},
  preferencias: { nome: '', hospitaisPreferidos: [] },
  escalasImportadas: [],
  propostasMontar: [],
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
  const espelho = userId ? ESPELHOS[userId] ?? null : null;
  const targetUserId = espelho?.userId ?? userId;

  const [status, setStatus] = useState<LoadStatus>(targetUserId ? 'carregando' : 'inativo');
  const [erro, setErro] = useState<string | null>(null);
  const [state, setStateInternal] = useState<UserStateValor>(STATE_VAZIO);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UserStateValor | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const persistir = useCallback(
    async (valor: UserStateValor): Promise<void> => {
      if (!userId) return;
      // Em modo espelho, não persistir · evita sobrescrever a conta espelhada.
      if (espelho) return;
      const blob: UserStateBlob = {
        blocos: valor.blocos,
        hospitais: valor.hospitais,
        preferencias: valor.preferencias,
        escalasImportadas: valor.escalasImportadas,
        propostasMontar: valor.propostasMontar.slice(0, MAX_PROPOSTAS_HISTORICO),
        ...(valor.gcalConfig ? { gcalConfig: valor.gcalConfig } : {}),
        updatedAt: new Date().toISOString(),
      };
      const { error } = await supabase()
        .from('user_state')
        .upsert({ user_id: userId, state: blob }, { onConflict: 'user_id' });
      if (error) setErro(error.message);
    },
    [userId, espelho],
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
          propostasMontar: next.propostasMontar ?? prev.propostasMontar,
          gcalConfig:
            // setar como null/undefined zera (desconectar) · sem chave preserva
            'gcalConfig' in next ? next.gcalConfig : prev.gcalConfig,
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
    if (!targetUserId) {
      setStatus('inativo');
      setStateInternal(STATE_VAZIO);
      return;
    }

    let mounted = true;
    setStatus('carregando');
    setErro(null);

    const sb = supabase();
    sb.from('user_state')
      .select('state')
      .eq('user_id', targetUserId)
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
            blocos: blob.blocos ?? STATE_VAZIO.blocos,
            hospitais: blob.hospitais ?? STATE_VAZIO.hospitais,
            preferencias: blob.preferencias ?? STATE_VAZIO.preferencias,
            escalasImportadas: blob.escalasImportadas ?? [],
            propostasMontar: blob.propostasMontar ?? [],
            gcalConfig: blob.gcalConfig,
          });
        } else {
          // Primeiro acesso · começa vazio · App detecta hospitais={} e
          // dispara onboarding. NÃO persiste seed da Mariana pra outros users.
          // Em modo espelho, não persiste row do dono (Marcos): a conta
          // espelhada já tem state, então esse branch só dispararia se o
          // alvo não existisse · improvável.
          setStateInternal(STATE_VAZIO);
          if (!espelho) void persistir(STATE_VAZIO);
        }
        setStatus('pronto');
      });

    const channel = sb
      .channel(`user_state:${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_state',
          filter: `user_id=eq.${targetUserId}`,
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
            propostasMontar: novoState.propostasMontar ?? prev.propostasMontar,
            gcalConfig: novoState.gcalConfig ?? prev.gcalConfig,
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
      if (pendingRef.current && !espelho) {
        void persistir(pendingRef.current);
        pendingRef.current = null;
      }
      if (channelRef.current) {
        void sb.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [targetUserId, espelho, persistir]);

  // Marca `conflito: true` nos plantões em sobreposição/sem-descanso pra
  // UI pintar vermelho. Plantão cujo hospitalId não está no map atual
  // (user removeu o hospital) aparece sem nome/cor · UI lida com getHospital
  // devolvendo undefined.
  const stateEnriquecido = useMemo<UserStateValor>(() => {
    return {
      ...state,
      blocos: marcarConflitos(state.blocos, state.hospitais),
    };
  }, [state]);

  return {
    status,
    erro,
    state: stateEnriquecido,
    setState,
    flushSave,
    espelhandoDe: espelho?.email ?? null,
  };
}
