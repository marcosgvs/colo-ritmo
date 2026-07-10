import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Eyebrow, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface AuditRow {
  id: number;
  user_id: string;
  acao: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const KIND_POR_ACAO: Record<string, 'lavender' | 'warn' | 'err' | 'ok' | 'info' | 'neutral'> = {
  invite: 'lavender',
  role_change: 'warn',
  state_change: 'info',
  admin_set_state: 'err',
  share_create: 'ok',
  share_revoke: 'warn',
};

export function Auditoria() {
  const [linhas, setLinhas] = useState<AuditRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const sb = supabase();
    sb.from('audit_log')
      .select('id,user_id,acao,payload,created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setErro(error.message);
          setCarregando(false);
          return;
        }
        setLinhas((data ?? []) as AuditRow[]);
        setCarregando(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <PageHead
        eyebrow="admin · audit log"
        titulo={
          carregando ? 'carregando…' : linhas.length === 0 ? 'sem ações registradas.' : `últimas ${linhas.length} ações.`
        }
        hand={
          erro
            ? `algo travou · ${erro}`
            : 'cada ação destrutiva ou de admin fica aqui · ordem cronológica reversa.'
        }
      />

      {linhas.length === 0 && !carregando && !erro && (
        <EmptyState
          titulo="silêncio."
          recado="nenhuma ação registrada nos últimos 100 eventos."
        />
      )}

      {erro && (
        <div
          role="alert"
          style={{
            background: 'var(--coral-surface)',
            border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
            borderRadius: 'var(--r-md)',
            padding: '12px 16px',
            color: 'var(--coral-ink)',
            font: '500 13px/1.4 var(--font-body)',
            marginBottom: 18,
          }}
        >
          erro ao buscar audit log · você precisa de role admin? · {erro}
        </div>
      )}

      {linhas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {linhas.map((r) => {
            const kind = KIND_POR_ACAO[r.acao] ?? 'neutral';
            return (
              <article
                key={r.id}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  display: 'grid',
                  // em telas estreitas as colunas quebram de linha em vez de
                  // estourar os 375px (as larguras fixas somavam ~340px)
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <Mono style={{ color: 'var(--ink-3)' }}>
                  {new Date(r.created_at).toLocaleString('pt-BR')}
                </Mono>
                <span>
                  <Pill kind={kind}>{r.acao}</Pill>
                </span>
                <Mono style={{ color: 'var(--ink-2)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.payload ? JSON.stringify(r.payload).slice(0, 120) : ''}
                </Mono>
                <Eyebrow>{r.user_id.slice(0, 8)}</Eyebrow>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
