import { useState } from 'react';
import type { Preferencias } from '@/types';
import { sair } from '@/hooks/useAuth';
import { usePush } from '@/hooks/usePush';
import { useSnapshotsShares } from '@/hooks/useSnapshotsShares';
import { Eyebrow, Hand, MonthPicker, Mono, Pill } from '@/components/atoms';
import { PageHead } from './_PageHead';

interface UsuarioProps {
  email: string | null;
  userId: string | null;
  preferencias: Preferencias;
  onSalvarPreferencias: (p: Preferencias) => void;
}

export function Usuario({ email, userId, preferencias, onSalvarPreferencias }: UsuarioProps) {
  const push = usePush(userId);
  const snapshotsShares = useSnapshotsShares(userId);
  const [draft, setDraft] = useState(preferencias);
  const sujo = JSON.stringify(draft) !== JSON.stringify(preferencias);
  const [criandoShare, setCriandoShare] = useState(false);
  const [shareMes, setShareMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [shareLabel, setShareLabel] = useState('');
  const [shareDias, setShareDias] = useState(30);

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
            <Field label="telefone">
              <input
                type="tel"
                value={draft.telefone ?? ''}
                onChange={(e) => setDraft({ ...draft, telefone: e.target.value })}
                placeholder="(61) 9 9999-9999"
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

          <Card titulo="snapshots" eyebrow="histórico do user_state">
            {snapshotsShares.snapshots.length === 0 ? (
              <Mono style={{ color: 'var(--ink-3)', display: 'block' }}>
                {snapshotsShares.carregando ? 'carregando…' : 'sem snapshots ainda · cron diário gera'}
              </Mono>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {snapshotsShares.snapshots.slice(0, 8).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: 'var(--bg-alt)',
                      borderRadius: 'var(--r-sm)',
                      gap: 8,
                    }}
                  >
                    <Mono style={{ color: 'var(--ink-2)', fontSize: 11 }}>
                      {new Date(s.data_snap).toLocaleDateString('pt-BR')}
                    </Mono>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('restaurar esse snapshot? sobrescreve a agenda atual.')) return;
                        const r = await snapshotsShares.restaurarSnapshot(s.id);
                        if (!r.ok) alert('erro: ' + r.erro);
                      }}
                      style={{
                        font: '600 11px/1 var(--font-body)',
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1px solid var(--line)',
                        background: 'transparent',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                      }}
                    >
                      restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Hand color="var(--ink-3)" size={14} style={{ display: 'block', marginTop: 12 }}>
              backups automáticos · 30 dias retidos
            </Hand>
          </Card>

          <Card titulo="compartilhar mês" eyebrow="link público read-only">
            {!criandoShare ? (
              <button
                type="button"
                onClick={() => setCriandoShare(true)}
                style={{
                  font: '600 13px/1 var(--font-body)',
                  padding: '11px 18px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}
              >
                criar novo link
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <MonthPicker value={shareMes} onChange={setShareMes} />
                <input
                  value={shareLabel}
                  onChange={(e) => setShareLabel(e.target.value)}
                  placeholder="rótulo (ex: pra mãe)"
                  style={input}
                />
                <input
                  type="number"
                  value={shareDias}
                  onChange={(e) => setShareDias(Number(e.target.value))}
                  min={1}
                  max={365}
                  style={input}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await snapshotsShares.criarShare(shareMes, shareLabel || shareMes, shareDias);
                      if (r.ok) {
                        setCriandoShare(false);
                        setShareLabel('');
                      } else {
                        alert('erro: ' + r.erro);
                      }
                    }}
                    style={{
                      font: '600 12px/1 var(--font-body)',
                      padding: '9px 14px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'var(--ink)',
                      color: 'var(--bg)',
                      cursor: 'pointer',
                      flex: 1,
                    }}
                  >
                    criar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCriandoShare(false)}
                    style={{
                      font: '600 12px/1 var(--font-body)',
                      padding: '9px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    cancelar
                  </button>
                </div>
              </div>
            )}
            {snapshotsShares.shares.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {snapshotsShares.shares.map((s) => (
                  <div
                    key={s.token}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--bg-alt)',
                      borderRadius: 'var(--r-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ font: '500 13px/1.3 var(--font-body)' }}>{s.label}</span>
                      <Pill kind="lavender">{s.mes}</Pill>
                    </div>
                    <Mono style={{ color: 'var(--ink-3)', fontSize: 10, display: 'block', marginTop: 4 }}>
                      expira {new Date(s.expires_at).toLocaleDateString('pt-BR')}
                    </Mono>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/share/${s.token}`;
                          navigator.clipboard?.writeText(url);
                        }}
                        style={{
                          font: '600 11px/1 var(--font-body)',
                          padding: '5px 10px',
                          borderRadius: 999,
                          border: '1px solid var(--line)',
                          background: 'transparent',
                          color: 'var(--ink-2)',
                          cursor: 'pointer',
                          flex: 1,
                        }}
                      >
                        copiar link
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('revogar esse link?')) return;
                          await snapshotsShares.revogarShare(s.token);
                        }}
                        style={{
                          font: '600 11px/1 var(--font-body)',
                          padding: '5px 10px',
                          borderRadius: 999,
                          border: '1px solid var(--coral)',
                          background: 'transparent',
                          color: 'var(--coral-ink)',
                          cursor: 'pointer',
                        }}
                      >
                        revogar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
