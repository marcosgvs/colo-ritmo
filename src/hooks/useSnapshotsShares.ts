import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Snapshot {
  id: number;
  data_snap: string;
  created_at: string;
}

export interface ShareToken {
  token: string;
  mes: string;
  label: string;
  expires_at: string;
  created_at: string;
}

interface UseSnapshotsSharesAPI {
  snapshots: Snapshot[];
  shares: ShareToken[];
  carregando: boolean;
  recarregar: () => Promise<void>;
  restaurarSnapshot: (id: number) => Promise<{ ok: boolean; erro?: string }>;
  criarShare: (mes: string, label: string, dias: number) => Promise<{ ok: boolean; token?: string; erro?: string }>;
  revogarShare: (token: string) => Promise<{ ok: boolean; erro?: string }>;
}

export function useSnapshotsShares(userId: string | null): UseSnapshotsSharesAPI {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [shares, setShares] = useState<ShareToken[]>([]);
  const [carregando, setCarregando] = useState<boolean>(Boolean(userId));

  const recarregar = useCallback(async () => {
    if (!userId) return;
    setCarregando(true);
    const sb = supabase();
    const [snapResp, shareResp] = await Promise.all([
      sb.rpc('listar_snapshots'),
      sb.rpc('listar_meus_shares'),
    ]);
    if (!snapResp.error && snapResp.data) {
      setSnapshots(snapResp.data as Snapshot[]);
    } else if (snapResp.error) {
      console.warn('listar_snapshots falhou', snapResp.error.message);
    }
    if (!shareResp.error && shareResp.data) {
      setShares(shareResp.data as ShareToken[]);
    } else if (shareResp.error) {
      console.warn('listar_meus_shares falhou', shareResp.error.message);
    }
    setCarregando(false);
  }, [userId]);

  useEffect(() => {
    if (userId) void recarregar();
    else {
      setSnapshots([]);
      setShares([]);
      setCarregando(false);
    }
  }, [userId, recarregar]);

  const restaurarSnapshot = useCallback(async (id: number) => {
    const sb = supabase();
    const { error } = await sb.rpc('restaurar_snapshot', { snap_id: id });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  }, []);

  const criarShare = useCallback(
    async (mes: string, label: string, dias: number) => {
      const sb = supabase();
      const { data, error } = await sb.rpc('criar_share_token', {
        p_mes: mes,
        p_label: label,
        p_dias: dias,
      });
      if (error) return { ok: false, erro: error.message };
      await recarregar();
      return { ok: true, token: data as string };
    },
    [recarregar],
  );

  const revogarShare = useCallback(
    async (token: string) => {
      const sb = supabase();
      const { error } = await sb.rpc('revogar_share', { p_token: token });
      if (error) return { ok: false, erro: error.message };
      await recarregar();
      return { ok: true };
    },
    [recarregar],
  );

  return { snapshots, shares, carregando, recarregar, restaurarSnapshot, criarShare, revogarShare };
}
