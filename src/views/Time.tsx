import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Eyebrow, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

function labelRole(r: string): string {
  if (r === 'medico') return 'médico';
  return r;
}
function labelTipo(t: string): string {
  if (t === 'medica') return 'médica';
  return t;
}

interface PerfilRow {
  user_id: string;
  nome: string | null;
  role: string | null;
  tipo_usuario: string | null;
  especialidade: string | null;
  crm: string | null;
  telefone: string | null;
  ics_token: string | null;
  parceiro_user_id: string | null;
  created_at: string;
}

/**
 * Tela admin · lista todos os user_profiles. Sem schema novo de equipe ·
 * mostra todo mundo com role + tipo_usuario + parceiro vinculado.
 *
 * RLS espera que apenas admins consigam SELECT em todos os profiles.
 * Se a policy não está liberada pra o user atual, mostra fallback.
 */
export function Time() {
  const [linhas, setLinhas] = useState<PerfilRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const sb = supabase();
    sb.from('user_profiles')
      .select('user_id, nome, role, tipo_usuario, especialidade, crm, telefone, ics_token, parceiro_user_id, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setErro(error.message);
          setCarregando(false);
          return;
        }
        setLinhas((data ?? []) as PerfilRow[]);
        setCarregando(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <PageHead
        eyebrow="admin · time"
        titulo={
          carregando
            ? 'carregando…'
            : linhas.length === 0
              ? 'nenhum perfil cadastrado.'
              : `${linhas.length} ${linhas.length === 1 ? 'perfil' : 'perfis'}.`
        }
        hand={
          erro
            ? 'precisa de role admin pra ver isso aqui'
            : 'todo mundo que entrou no app · ordenado pela data de cadastro.'
        }
      />

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
          {erro}
        </div>
      )}

      {!carregando && linhas.length === 0 && !erro && (
        <EmptyState
          titulo="ninguém aqui ainda."
          recado="conforme o time crescer, todos aparecem nesta lista."
        />
      )}

      {linhas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {linhas.map((p) => {
            const ehAdmin = p.role === 'admin';
            const corBg = ehAdmin
              ? 'var(--coral-surface)'
              : p.tipo_usuario === 'parceiro'
                ? 'var(--lavender-surface)'
                : 'var(--bg)';
            return (
              <article
                key={p.user_id}
                style={{
                  background: corBg,
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto auto',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: ehAdmin ? 'var(--coral-ink)' : 'var(--lavender)',
                    color: 'var(--bg)',
                    font: '700 13px/1 var(--font-body)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(p.nome ?? '?')
                    .split(' ')
                    .map((s) => s[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 18,
                      letterSpacing: '-0.005em',
                      margin: 0,
                    }}
                  >
                    {p.nome ?? 'sem nome'}
                  </p>
                  <Mono style={{ display: 'block', color: 'var(--ink-3)', marginTop: 4 }}>
                    {[p.especialidade, p.crm].filter(Boolean).join(' · ') || '—'}
                  </Mono>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {p.role && (
                    <Pill kind={ehAdmin ? 'err' : 'neutral'}>{labelRole(p.role)}</Pill>
                  )}
                  {p.tipo_usuario && (
                    <Pill kind={p.tipo_usuario === 'parceiro' ? 'lavender' : 'info'}>
                      {labelTipo(p.tipo_usuario)}
                    </Pill>
                  )}
                </div>
                <div style={{ minWidth: 140, textAlign: 'right' }}>
                  <Eyebrow>cadastrado</Eyebrow>
                  <Mono style={{ display: 'block', marginTop: 4 }}>
                    {new Date(p.created_at).toLocaleDateString('pt-BR')}
                  </Mono>
                  {p.parceiro_user_id && (
                    <Mono style={{ color: 'var(--lavender-ink)', display: 'block', marginTop: 2, fontSize: 10 }}>
                      tem parceiro
                    </Mono>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
