import { useState } from 'react';
import type { Preferencias } from '@/types';
import { sair } from '@/hooks/useAuth';
import { usePush } from '@/hooks/usePush';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { PageHead } from './_PageHead';

interface UsuarioProps {
  email: string | null;
  userId: string | null;
  preferencias: Preferencias;
  onSalvarPreferencias: (p: Preferencias) => void;
}

export function Usuario({ email, userId, preferencias, onSalvarPreferencias }: UsuarioProps) {
  const push = usePush(userId);
  const [draft, setDraft] = useState(preferencias);
  const sujo = JSON.stringify(draft) !== JSON.stringify(preferencias);

  return (
    <>
      <PageHead
        eyebrow="você"
        titulo={preferencias.nome}
        hand="ajustes que mudam o tom do app · sem pressa."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card titulo="identidade" eyebrow="como você aparece">
            <Field label="nome">
              <input
                value={draft.nome}
                onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                style={input}
              />
            </Field>
            {email && (
              <div style={{ marginTop: 12 }}>
                <Eyebrow>email</Eyebrow>
                <Mono style={{ display: 'block', marginTop: 4 }}>{email}</Mono>
              </div>
            )}
          </Card>

          <Card titulo="agenda" eyebrow="meta + preferências">
            <Field label="meta mensal (R$)">
              <input
                type="number"
                value={draft.metaMensal}
                onChange={(e) => setDraft({ ...draft, metaMensal: Number(e.target.value) })}
                style={input}
              />
            </Field>
            <Field label="máx plantões / semana">
              <input
                type="number"
                value={draft.maxPlantoesPorSemana}
                onChange={(e) =>
                  setDraft({ ...draft, maxPlantoesPorSemana: Number(e.target.value) })
                }
                style={input}
              />
            </Field>
            <Field label="janela preferida">
              <select
                value={draft.janelaPreferida}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    janelaPreferida: e.target.value as 'dia' | 'noite' | 'ambos',
                  })
                }
                style={input}
              >
                <option value="dia">dia</option>
                <option value="noite">noite</option>
                <option value="ambos">ambos</option>
              </select>
            </Field>
            <label
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 14,
                font: '500 14px/1.3 var(--font-body)',
                color: 'var(--ink-2)',
              }}
            >
              <input
                type="checkbox"
                checked={draft.evitar24hCorrido}
                onChange={(e) => setDraft({ ...draft, evitar24hCorrido: e.target.checked })}
              />
              evitar 24h corrido (recomendado)
            </label>
          </Card>

          {sujo && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => onSalvarPreferencias(draft)}
                style={{
                  font: '600 13px/1 var(--font-body)',
                  padding: '12px 22px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  cursor: 'pointer',
                }}
              >
                salvar
              </button>
              <button
                type="button"
                onClick={() => setDraft(preferencias)}
                style={{
                  font: '600 13px/1 var(--font-body)',
                  padding: '12px 22px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                descartar
              </button>
            </div>
          )}
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card titulo="notificações" eyebrow="chega no celular">
            {push.status === 'sem-suporte' ? (
              <Hand color="var(--ink-3)" size={16}>
                este navegador não suporta push · use o celular ou outro browser.
              </Hand>
            ) : push.status === 'ativo' ? (
              <>
                <Pill kind="ok" style={{ marginBottom: 12 }}>
                  ativas
                </Pill>
                <Hand color="var(--ink-2)" size={16}>
                  você recebe lembretes 30min antes de cada plantão e o resumo do dia às 9h.
                </Hand>
                <button
                  type="button"
                  onClick={push.desativar}
                  style={{
                    marginTop: 14,
                    font: '600 13px/1 var(--font-body)',
                    padding: '11px 18px',
                    borderRadius: 999,
                    border: '1px solid var(--line)',
                    background: 'transparent',
                    color: 'var(--ink-2)',
                    cursor: 'pointer',
                  }}
                >
                  desativar
                </button>
              </>
            ) : (
              <>
                <Hand color="var(--ink-2)" size={16}>
                  recebe lembretes 30min antes de cada plantão e o resumo do dia às 9h.
                </Hand>
                <button
                  type="button"
                  onClick={push.ativar}
                  disabled={push.status === 'pedindo-permissao' || !userId}
                  style={{
                    marginTop: 14,
                    font: '600 13px/1 var(--font-body)',
                    padding: '11px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    cursor: 'pointer',
                    opacity: !userId ? 0.5 : 1,
                  }}
                >
                  {push.status === 'pedindo-permissao' ? 'pedindo permissão…' : 'ativar'}
                </button>
                {push.status === 'erro' && (
                  <Mono style={{ display: 'block', marginTop: 8, color: 'var(--coral-ink)' }}>
                    permissão negada · ajusta nas configurações do navegador.
                  </Mono>
                )}
              </>
            )}
          </Card>

          <Card titulo="sessão" eyebrow="entrar e sair">
            <button
              type="button"
              onClick={() => void sair()}
              style={{
                font: '600 13px/1 var(--font-body)',
                padding: '11px 18px',
                borderRadius: 999,
                border: '1px solid var(--coral)',
                background: 'transparent',
                color: 'var(--coral-ink)',
                cursor: 'pointer',
              }}
            >
              sair
            </button>
          </Card>
        </aside>
      </div>
    </>
  );
}

const input: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 14px/1.4 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
  width: '100%',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}

function Card({
  titulo,
  eyebrow,
  children,
}: {
  titulo: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '20px 22px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18 }}>
          {titulo}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}
