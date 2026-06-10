import { useCallback, useEffect, useState } from 'react';
import { assinarPush, cancelarPush, registrarServiceWorker, suportaPush } from '@/lib/push';

export type PushStatus =
  | 'sem-suporte'
  | 'desativado'
  | 'pedindo-permissao'
  | 'ativo'
  | 'erro';

export interface PushAPI {
  status: PushStatus;
  ativar: () => Promise<void>;
  desativar: () => Promise<void>;
}

/**
 * usePush · gerencia o ciclo de PushSubscription pro user logado.
 *
 *   1. registra o SW no mount
 *   2. detecta se já há subscription ativa
 *   3. expõe ativar/desativar pro UI (settings)
 *
 * Não pede permissão automaticamente — só quando o usuário clica.
 */
export function usePush(userId: string | null): PushAPI {
  const [status, setStatus] = useState<PushStatus>('desativado');

  useEffect(() => {
    if (!suportaPush()) {
      setStatus('sem-suporte');
      return;
    }
    let mounted = true;
    void registrarServiceWorker().then(async (reg) => {
      if (!reg || !mounted) return;
      const sub = await reg.pushManager.getSubscription();
      if (mounted) setStatus(sub ? 'ativo' : 'desativado');
    });
    return () => {
      mounted = false;
    };
  }, []);

  const ativar = useCallback(async () => {
    if (!userId) return;
    if (!suportaPush()) {
      setStatus('sem-suporte');
      return;
    }
    setStatus('pedindo-permissao');
    const sub = await assinarPush();
    setStatus(sub ? 'ativo' : 'erro');
  }, [userId]);

  const desativar = useCallback(async () => {
    await cancelarPush();
    setStatus('desativado');
  }, []);

  return { status, ativar, desativar };
}
