import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Bloco,
  EscalaEquipe,
  EscalaImportada,
  Hospital,
  Preferencias,
  PropostaHistorico,
} from '@/types';
import { supabase } from '@/lib/supabase';
import { marcarConflitos } from '@/lib/data';

const MAX_PROPOSTAS_HISTORICO = 10;
const MAX_ESCALAS_EQUIPE = 6;

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
  escalasEquipe?: EscalaEquipe[];
  /** null explícito = desconectado · chave ausente = blob antigo (preserva). */
  gcalConfig?: GcalConfig | null;
  updatedAt?: string;
  /** Id da aba que gravou · o Realtime usa pra distinguir echo do próprio save
   * de mudança vinda de outra aba/dispositivo (ou da conta espelhada). */
  clientId?: string;
}

export type LoadStatus = 'inativo' | 'carregando' | 'pronto' | 'erro';

export interface UserStateValor {
  blocos: Bloco[];
  hospitais: Record<string, Hospital>;
  preferencias: Preferencias;
  escalasImportadas: EscalaImportada[];
  propostasMontar: PropostaHistorico[];
  escalasEquipe: EscalaEquipe[];
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
const SAVE_RETRY_MS = 3000;

/** Id desta aba · marca os saves pro handler do Realtime ignorar o echo. */
function gerarClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Math.random().toString(36).slice(2)}`;
  }
}

/** State vazio · usado pro render inicial (antes do select retornar) e
 * pra users novos (força onboarding · hospitais={} dispara o fluxo). */
const STATE_VAZIO: UserStateValor = {
  blocos: [],
  hospitais: {},
  preferencias: { nome: '', hospitaisPreferidos: [] },
  escalasImportadas: [],
  propostasMontar: [],
  escalasEquipe: [],
};

function mergeState(prev: UserStateValor, next: Partial<UserStateValor>): UserStateValor {
  return {
    blocos: next.blocos ?? prev.blocos,
    hospitais: next.hospitais ?? prev.hospitais,
    preferencias: next.preferencias ?? prev.preferencias,
    escalasImportadas: next.escalasImportadas ?? prev.escalasImportadas,
    propostasMontar: next.propostasMontar ?? prev.propostasMontar,
    escalasEquipe: next.escalasEquipe ?? prev.escalasEquipe,
    gcalConfig:
      // setar como null/undefined zera (desconectar) · sem chave preserva
      'gcalConfig' in next ? next.gcalConfig ?? undefined : prev.gcalConfig,
  };
}

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
  const clientIdRef = useRef<string>(gerarClientId());
  // Saves em série · sem isso, um upsert lento pode aterrissar DEPOIS de um
  // mais novo e o banco fica com dado antigo (last-write-wins fora de ordem).
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  // Edições feitas ANTES do select inicial retornar seriam mescladas sobre o
  // STATE_VAZIO e o upsert apagaria a conta inteira. Até o load terminar,
  // elas ficam nesta fila (aplicadas localmente, sem persistir) e são
  // reaplicadas por cima do blob carregado.
  const loadedRef = useRef(false);
  const preLoadEditsRef = useRef<Partial<UserStateValor>[]>([]);

  const persistir = useCallback(
    (valor: UserStateValor): Promise<void> => {
      if (!userId) return Promise.resolve();
      // Em modo espelho, não persistir · evita sobrescrever a conta espelhada.
      if (espelho) return Promise.resolve();
      const salvar = async (): Promise<void> => {
        const blob: UserStateBlob = {
          blocos: valor.blocos,
          hospitais: valor.hospitais,
          preferencias: valor.preferencias,
          escalasImportadas: valor.escalasImportadas,
          propostasMontar: valor.propostasMontar.slice(0, MAX_PROPOSTAS_HISTORICO),
          escalasEquipe: valor.escalasEquipe.slice(0, MAX_ESCALAS_EQUIPE),
          // null explícito propaga "desconectado" pros outros devices via realtime
          gcalConfig: valor.gcalConfig ?? null,
          updatedAt: new Date().toISOString(),
          clientId: clientIdRef.current,
        };
        const { error } = await supabase()
          .from('user_state')
          .upsert({ user_id: userId, state: blob }, { onConflict: 'user_id' });
        if (error) {
          setErro(error.message);
          // Não descarta a edição · re-enfileira pra retry, a menos que uma
          // edição mais nova já esteja na fila (ela cobre esta).
          if (!pendingRef.current) {
            pendingRef.current = valor;
            if (!debounceRef.current) {
              debounceRef.current = setTimeout(() => {
                debounceRef.current = null;
                const v = pendingRef.current;
                pendingRef.current = null;
                if (v) void persistir(v);
              }, SAVE_RETRY_MS);
            }
          }
        } else {
          setErro(null);
        }
      };
      const next = saveChainRef.current.then(salvar, salvar);
      saveChainRef.current = next;
      return next;
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
      // Load inicial ainda em voo: aplica localmente e enfileira · persistir
      // agora gravaria um blob quase-vazio por cima da conta.
      if (!loadedRef.current) {
        preLoadEditsRef.current.push(next);
        setStateInternal((prev) => mergeState(prev, next));
        return;
      }
      setStateInternal((prev) => {
        const merged = mergeState(prev, next);
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
    loadedRef.current = false;
    preLoadEditsRef.current = [];
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
        const base: UserStateValor = blob
          ? {
              blocos: blob.blocos ?? STATE_VAZIO.blocos,
              hospitais: blob.hospitais ?? STATE_VAZIO.hospitais,
              preferencias: blob.preferencias ?? STATE_VAZIO.preferencias,
              escalasImportadas: blob.escalasImportadas ?? [],
              propostasMontar: blob.propostasMontar ?? [],
              escalasEquipe: blob.escalasEquipe ?? [],
              gcalConfig: blob.gcalConfig ?? undefined,
            }
          : // Primeiro acesso · começa vazio · App detecta hospitais={} e
            // dispara onboarding. NÃO persiste seed da Mariana pra outros users.
            STATE_VAZIO;
        // Edições feitas durante o load entram por cima do blob (não o contrário).
        const edits = preLoadEditsRef.current;
        preLoadEditsRef.current = [];
        const comEdits = edits.reduce(mergeState, base);
        loadedRef.current = true;
        setStateInternal(comEdits);
        // Persiste se houve edição durante o load, ou pra criar a row no
        // primeiro acesso. Em modo espelho nunca persiste (read-only).
        if (!espelho && (edits.length > 0 || !blob)) void persistir(comEdits);
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
          // Echo do save desta própria aba: aplicar de volta reverteria edições
          // feitas enquanto o upsert viajava (o user continua digitando). Só
          // aplica mudança vinda de OUTRA origem (outra aba, outro device,
          // ou a conta espelhada no modo dev).
          if (novoState.clientId && novoState.clientId === clientIdRef.current) return;
          setStateInternal((prev) => ({
            blocos: novoState.blocos ?? prev.blocos,
            hospitais: novoState.hospitais ?? prev.hospitais,
            preferencias: novoState.preferencias ?? prev.preferencias,
            escalasImportadas: novoState.escalasImportadas ?? prev.escalasImportadas,
            propostasMontar: novoState.propostasMontar ?? prev.propostasMontar,
            escalasEquipe: novoState.escalasEquipe ?? prev.escalasEquipe,
            gcalConfig:
              // null explícito = desconectou em outro device · chave ausente =
              // blob antigo, preserva o local
              'gcalConfig' in novoState ? novoState.gcalConfig ?? undefined : prev.gcalConfig,
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
