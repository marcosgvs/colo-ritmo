import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * useListaMaite · lista de desejos compartilhada (tabelas maite_*, v22).
 *
 * Diferente do user_state, esses dados são do CASAL: a membership em
 * maite_membros dá leitura+escrita pros dois, então aqui se usa o
 * auth.uid real (sem desvio de espelho — o espelho é read-only por
 * design, e a Maitê é dos dois).
 *
 * Realtime em maite_itens refaz o fetch (lista pequena, merge não
 * compensa a complexidade). Se as tabelas ainda não existem (migration
 * v22 pendente), degrada pra estado 'sem-tabela' sem quebrar a UI.
 */

export type StatusMaite =
  | 'pesquisando'
  | 'esperando_bf'
  | 'comprar_agora'
  | 'comprado'
  | 'presente';

export interface ItemMaite {
  id: string;
  listaId: string;
  nome: string;
  categoria: string | null;
  imagemUrl: string | null;
  url: string | null;
  loja: string | null;
  precoAlvo: number | null;
  precoTabela: number | null;
  precoAtual: number | null;
  precoAtualEm: string | null;
  status: StatusMaite;
  obs: string | null;
  monitorar: boolean;
  criadoEm: string;
}

export interface PontoPreco {
  preco: number;
  loja: string | null;
  fonte: string | null;
  coletadoEm: string;
}

export interface NovoItemMaite {
  nome: string;
  categoria?: string;
  imagemUrl?: string;
  url?: string;
  loja?: string;
  precoAlvo?: number;
  precoTabela?: number;
  precoAtual?: number;
  status?: StatusMaite;
  obs?: string;
}

type LoadStatus = 'inativo' | 'carregando' | 'pronto' | 'erro' | 'sem-tabela';

interface ItemRow {
  id: string;
  lista_id: string;
  nome: string;
  categoria: string | null;
  imagem_url: string | null;
  url: string | null;
  loja: string | null;
  preco_alvo: number | null;
  preco_tabela: number | null;
  preco_atual: number | null;
  preco_atual_em: string | null;
  status: string;
  obs: string | null;
  monitorar: boolean;
  criado_em: string;
}

function rowParaItem(r: ItemRow): ItemMaite {
  return {
    id: r.id,
    listaId: r.lista_id,
    nome: r.nome,
    categoria: r.categoria,
    imagemUrl: r.imagem_url,
    url: r.url,
    loja: r.loja,
    precoAlvo: r.preco_alvo == null ? null : Number(r.preco_alvo),
    precoTabela: r.preco_tabela == null ? null : Number(r.preco_tabela),
    precoAtual: r.preco_atual == null ? null : Number(r.preco_atual),
    precoAtualEm: r.preco_atual_em,
    status: (r.status as StatusMaite) ?? 'pesquisando',
    obs: r.obs,
    monitorar: r.monitorar,
    criadoEm: r.criado_em,
  };
}

export interface UseListaMaiteAPI {
  status: LoadStatus;
  erro: string | null;
  listaId: string | null;
  itens: ItemMaite[];
  precos: Record<string, PontoPreco[]>;
  adicionarItem: (novo: NovoItemMaite) => Promise<string | null>;
  atualizarItem: (id: string, patch: Partial<NovoItemMaite> & { monitorar?: boolean }) => Promise<void>;
  removerItem: (id: string) => Promise<void>;
  registrarPreco: (itemId: string, preco: number, loja?: string) => Promise<void>;
  recarregar: () => Promise<void>;
}

export function useListaMaite(userId: string | null): UseListaMaiteAPI {
  const [status, setStatus] = useState<LoadStatus>(userId ? 'carregando' : 'inativo');
  const [erro, setErro] = useState<string | null>(null);
  const [listaId, setListaId] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemMaite[]>([]);
  const [precos, setPrecos] = useState<Record<string, PontoPreco[]>>({});

  const carregar = useCallback(async (): Promise<void> => {
    if (!userId) return;
    const sb = supabase();

    const { data: membro, error: errMembro } = await sb
      .from('maite_membros')
      .select('lista_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (errMembro) {
      // 42P01 = tabela não existe (migration v22 pendente)
      if (errMembro.code === '42P01') {
        setStatus('sem-tabela');
      } else {
        setErro(errMembro.message);
        setStatus('erro');
      }
      return;
    }
    if (!membro) {
      // logado mas fora de qualquer lista · estado vazio honesto
      setListaId(null);
      setItens([]);
      setStatus('pronto');
      return;
    }

    const lid = membro.lista_id as string;
    const [{ data: rows, error: errItens }, { data: pontos }] = await Promise.all([
      sb
        .from('maite_itens')
        .select('*')
        .eq('lista_id', lid)
        .order('criado_em', { ascending: true }),
      sb
        .from('maite_precos')
        .select('item_id,preco,loja,fonte,coletado_em')
        .order('coletado_em', { ascending: true }),
    ]);

    if (errItens) {
      setErro(errItens.message);
      setStatus('erro');
      return;
    }

    const porItem: Record<string, PontoPreco[]> = {};
    for (const p of pontos ?? []) {
      const key = p.item_id as string;
      (porItem[key] ??= []).push({
        preco: Number(p.preco),
        loja: p.loja as string | null,
        fonte: p.fonte as string | null,
        coletadoEm: p.coletado_em as string,
      });
    }

    setListaId(lid);
    setItens(((rows ?? []) as ItemRow[]).map(rowParaItem));
    setPrecos(porItem);
    setErro(null);
    setStatus('pronto');
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setStatus('inativo');
      setItens([]);
      setListaId(null);
      return;
    }
    let mounted = true;
    setStatus('carregando');
    void carregar().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, [userId, carregar]);

  // realtime · qualquer mudança nos itens da lista refaz o fetch
  useEffect(() => {
    if (!listaId) return;
    const sb = supabase();
    const channel: RealtimeChannel = sb
      .channel(`maite:${listaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maite_itens', filter: `lista_id=eq.${listaId}` },
        () => void carregar(),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [listaId, carregar]);

  const adicionarItem = useCallback(
    async (novo: NovoItemMaite): Promise<string | null> => {
      if (!listaId) return null;
      const sb = supabase();
      const { data, error } = await sb
        .from('maite_itens')
        .insert({
          lista_id: listaId,
          nome: novo.nome,
          categoria: novo.categoria ?? null,
          imagem_url: novo.imagemUrl ?? null,
          url: novo.url ?? null,
          loja: novo.loja ?? null,
          preco_alvo: novo.precoAlvo ?? null,
          preco_tabela: novo.precoTabela ?? null,
          preco_atual: novo.precoAtual ?? null,
          preco_atual_em: novo.precoAtual != null ? new Date().toISOString() : null,
          status: novo.status ?? 'pesquisando',
          obs: novo.obs ?? null,
        })
        .select('id')
        .single();
      if (error) {
        console.warn('maite: insert falhou', error.message);
        return null;
      }
      const id = data.id as string;
      if (novo.precoAtual != null) {
        await sb.from('maite_precos').insert({ item_id: id, preco: novo.precoAtual, loja: novo.loja ?? null, fonte: 'manual' });
      }
      await carregar();
      return id;
    },
    [listaId, carregar],
  );

  const atualizarItem = useCallback(
    async (id: string, patch: Partial<NovoItemMaite> & { monitorar?: boolean }): Promise<void> => {
      const sb = supabase();
      const row: Record<string, unknown> = {};
      if (patch.nome !== undefined) row['nome'] = patch.nome;
      if (patch.categoria !== undefined) row['categoria'] = patch.categoria;
      if (patch.imagemUrl !== undefined) row['imagem_url'] = patch.imagemUrl;
      if (patch.url !== undefined) row['url'] = patch.url;
      if (patch.loja !== undefined) row['loja'] = patch.loja;
      if (patch.precoAlvo !== undefined) row['preco_alvo'] = patch.precoAlvo;
      if (patch.precoTabela !== undefined) row['preco_tabela'] = patch.precoTabela;
      if (patch.status !== undefined) row['status'] = patch.status;
      if (patch.obs !== undefined) row['obs'] = patch.obs;
      if (patch.monitorar !== undefined) row['monitorar'] = patch.monitorar;
      if (patch.precoAtual !== undefined) {
        row['preco_atual'] = patch.precoAtual;
        row['preco_atual_em'] = new Date().toISOString();
      }
      const { error } = await sb.from('maite_itens').update(row).eq('id', id);
      if (error) console.warn('maite: update falhou', error.message);
      await carregar();
    },
    [carregar],
  );

  const removerItem = useCallback(
    async (id: string): Promise<void> => {
      const sb = supabase();
      const { error } = await sb.from('maite_itens').delete().eq('id', id);
      if (error) console.warn('maite: delete falhou', error.message);
      await carregar();
    },
    [carregar],
  );

  const registrarPreco = useCallback(
    async (itemId: string, preco: number, loja?: string): Promise<void> => {
      const sb = supabase();
      await sb.from('maite_precos').insert({ item_id: itemId, preco, loja: loja ?? null, fonte: 'manual' });
      await sb
        .from('maite_itens')
        .update({ preco_atual: preco, preco_atual_em: new Date().toISOString() })
        .eq('id', itemId);
      await carregar();
    },
    [carregar],
  );

  return {
    status,
    erro,
    listaId,
    itens,
    precos,
    adicionarItem,
    atualizarItem,
    removerItem,
    registrarPreco,
    recarregar: carregar,
  };
}
