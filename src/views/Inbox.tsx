import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface InboxProps {
  pendencias?: Array<{
    id: string;
    tipo: 'troca' | 'cessao' | 'conflito';
    titulo: string;
    detalhe: string;
    de?: string;
  }>;
}

const PENDENCIAS_DEFAULT = [
  {
    id: 'p1',
    tipo: 'troca' as const,
    titulo: 'Dr. João pediu troca · sex 8 mai · 19h',
    detalhe: 'casamento da irmã · sugere passar pra Rafa',
    de: 'Dr. João Pereira',
  },
  {
    id: 'p2',
    tipo: 'cessao' as const,
    titulo: 'Dra. Carla cedeu · qui 7 mai · 7h',
    detalhe: 'aniversário do filho · Ana topou',
    de: 'Dra. Carla',
  },
];

export function Inbox({ pendencias = PENDENCIAS_DEFAULT }: InboxProps) {
  return (
    <>
      <PageHead
        eyebrow="admin"
        titulo={
          pendencias.length === 0
            ? 'inbox limpa.'
            : `${pendencias.length} pendência${pendencias.length > 1 ? 's' : ''}.`
        }
        hand="cada item é uma decisão · aprovar, recusar ou só ler."
      />

      {pendencias.length === 0 ? (
        <EmptyState
          eyebrow="status"
          titulo="ninguém esperando."
          recado="sem pedidos pendentes · tudo no fluxo."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pendencias.map((p) => (
            <article
              key={p.id}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Pill kind={p.tipo === 'conflito' ? 'err' : 'lavender'}>
                    {p.tipo}
                  </Pill>
                  {p.de && <Eyebrow>{p.de}</Eyebrow>}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 20,
                    letterSpacing: '-0.005em',
                    margin: 0,
                  }}
                >
                  {p.titulo}
                </h3>
                <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 6 }}>
                  {p.detalhe}
                </Hand>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{
                    font: '600 12px/1 var(--font-body)',
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    cursor: 'pointer',
                  }}
                >
                  aprovar
                </button>
                <button
                  type="button"
                  style={{
                    font: '600 12px/1 var(--font-body)',
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--coral)',
                    background: 'transparent',
                    color: 'var(--coral-ink)',
                    cursor: 'pointer',
                  }}
                >
                  recusar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Mono style={{ display: 'block', marginTop: 24, color: 'var(--ink-3)' }}>
        sessão 4 entrega o frame · próxima iteração liga as ações no audit log do Supabase.
      </Mono>
    </>
  );
}
