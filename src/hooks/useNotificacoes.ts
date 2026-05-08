import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Notificacao } from '@/components/notif';

interface NotifRow {
  id: string;
  tipo: 'troca' | 'conflito' | 'sugestao' | 'aprovacao' | 'limite';
  titulo: string;
  detalhe: string;
  lida: boolean;
  criada_em: string;
}

export interface UseNotificacoesAPI {
  notificacoes: Notificacao[];
  carregando: boolean;
  marcarLida: (id: string) => Promise<void>;
  marcarTodasLidas: () => Promise<void>;
}

const LIMITE_RECENTES = 50;

/**
 * useNotificacoes · carrega últimas N do user (RLS por auth.uid),
 * escuta realtime pra inserts/updates e expõe `marcarLida`.
 *
 * Faltando user_id, retorna lista vazia · não tenta query.
 *
 * Nota: a tabela `notificacoes` precisa do schema v19 aplicado. Se a
 * tabela não existir, o select falha em silêncio e a lista fica vazia
 * (sem quebrar a UI).
 */
export function useNotificacoes(userId: string | null): UseNotificacoesAPI {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setNotificacoes([]);
      setCarregando(false);
      return;
    }

    let mounted = true;
    let channel: RealtimeChannel | null = null;
    setCarregando(true);

    const sb = supabase();

    sb.from('notificacoes')
      .select('id,tipo,titulo,detalhe,lida,criada_em')
      .eq('user_id', userId)
      .order('criada_em', { ascending: false })
      .limit(LIMITE_RECENTES)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          // tabela pode não existir ainda · não derruba a UI
          console.warn('useNotificacoes: select falhou', error.message);
          setNotificacoes([]);
        } else if (data) {
          setNotificacoes((data as NotifRow[]).map(rowParaNotif));
        }
        setCarregando(false);
      });

    channel = sb
      .channel(`notificacoes:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted) return;
          if (payload.eventType === 'INSERT' && payload.new) {
            const nova = rowParaNotif(payload.new as NotifRow);
            setNotificacoes((prev) => [nova, ...prev].slice(0, LIMITE_RECENTES));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const atualizada = rowParaNotif(payload.new as NotifRow);
            setNotificacoes((prev) =>
              prev.map((n) => (n.id === atualizada.id ? atualizada : n)),
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const oldRow = payload.old as { id: string };
            setNotificacoes((prev) => prev.filter((n) => n.id !== oldRow.id));
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      if (channel) void sb.removeChannel(channel);
    };
  }, [userId]);

  const marcarLida = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;
      const sb = supabase();
      const { error } = await sb
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) console.warn('useNotificacoes: marcar lida falhou', error.message);
      // o realtime channel vai atualizar local · mas atualizamos
      // otimisticamente pra responsividade
      setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    },
    [userId],
  );

  const marcarTodasLidas = useCallback(async (): Promise<void> => {
    if (!userId) return;
    const sb = supabase();
    const { error } = await sb.rpc('marcar_todas_notificacoes_lidas');
    if (error) console.warn('useNotificacoes: marcar todas lidas falhou', error.message);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  }, [userId]);

  return { notificacoes, carregando, marcarLida, marcarTodasLidas };
}

function rowParaNotif(r: NotifRow): Notificacao {
  return {
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    detalhe: r.detalhe,
    recebidaEm: fmtRelativo(r.criada_em),
    lida: r.lida,
  };
}

function fmtRelativo(iso: string): string {
  const data = new Date(iso);
  const agora = Date.now();
  const diff = (agora - data.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
