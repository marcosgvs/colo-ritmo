import { useState } from 'react';
import type { Bloco, Hospital, Preferencias } from '@/types';
import { sair } from '@/hooks/useAuth';
import { toISO } from '@/lib/data';
import { usePush } from '@/hooks/usePush';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useSnapshotsShares } from '@/hooks/useSnapshotsShares';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useGcalSync } from '@/hooks/useGcalSync';
import type { GcalConfig } from '@/hooks/useUserState';
import { Eyebrow, Hand, MonthPicker, Mono, Pill } from '@/components/atoms';
import { PageHead } from './_PageHead';

interface UsuarioProps {
  email: string | null;
  userId: string | null;
  preferencias: Preferencias;
  onSalvarPreferencias: (p: Preferencias) => void;
  blocos: Bloco[];
  hospitais: Record<string, Hospital>;
  gcalConfig: GcalConfig | undefined;
  onSalvarGcalConfig: (c: GcalConfig | undefined) => void;
}

export function Usuario({
  email,
  userId,
  preferencias,
  onSalvarPreferencias,
  blocos,
  hospitais,
  gcalConfig,
  onSalvarGcalConfig,
}: UsuarioProps) {
  const isMobile = useIsMobile();
  const push = usePush(userId);
  const install = useInstallPrompt();
  const snapshotsShares = useSnapshotsShares(userId);
  const gcal = useGcalSync({
    blocos,
    hospitais,
    config: gcalConfig,
    onConfig: onSalvarGcalConfig,
  });
  const [draft, setDraft] = useState(preferencias);
  const sujo = JSON.stringify(draft) !== JSON.stringify(preferencias);
  const [criandoShare, setCriandoShare] = useState(false);
  // toISO usa data LOCAL · toISOString (UTC) pularia pro mês seguinte
  // depois das 21h no último dia do mês (Brasília = UTC-3).
  const [shareMes, setShareMes] = useState(() => toISO(new Date()).slice(0, 7));
  const [shareLabel, setShareLabel] = useState('');
  const [shareDias, setShareDias] = useState(30);
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);

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
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: isMobile ? 16 : 24,
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

          <Card titulo="google calendar" eyebrow="espelha plantões no seu agenda">
            {gcal.status === 'desconectado' && (
              <>
                <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
                  cria um calendário separado "plantões colo ritmo" e manda só os plantões pra lá ·
                  não mexe nos seus outros calendários.
                </Hand>
                <button
                  type="button"
                  onClick={() => void gcal.conectar()}
                  style={{
                    marginTop: 14,
                    font: '600 13px/1 var(--font-body)',
                    padding: '11px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    cursor: 'pointer',
                  }}
                >
                  conectar
                </button>
              </>
            )}

            {gcal.status === 'conectando' && (
              <Pill kind="lavender">conectando…</Pill>
            )}

            {(gcal.status === 'conectado' || gcal.status === 'sincronizando') && (
              <>
                <Pill kind="ok" style={{ marginBottom: 12 }}>
                  {gcal.status === 'sincronizando' ? 'sincronizando…' : 'conectado'}
                </Pill>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                  <Mono style={{ color: 'var(--ink-2)' }}>
                    {gcal.sincronizados} plantões no google
                    {gcal.pendentes > 0 ? ` · ${gcal.pendentes} pendentes` : ''}
                  </Mono>
                  {gcal.config?.lastSyncedAt && (
                    <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                      última sync · {new Date(gcal.config.lastSyncedAt).toLocaleString('pt-BR')}
                    </Mono>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void gcal.sincronizar()}
                    disabled={gcal.status === 'sincronizando'}
                    style={{
                      font: '600 13px/1 var(--font-body)',
                      padding: '11px 18px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'var(--ink)',
                      color: 'var(--bg)',
                      cursor: gcal.status === 'sincronizando' ? 'not-allowed' : 'pointer',
                      opacity: gcal.status === 'sincronizando' ? 0.6 : 1,
                      flex: 1,
                    }}
                  >
                    {gcal.pendentes > 0 ? `sincronizar (${gcal.pendentes})` : 'sincronizar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('desconectar do google calendar? os eventos já criados ficam lá.')) return;
                      void gcal.desconectar();
                    }}
                    style={{
                      font: '600 13px/1 var(--font-body)',
                      padding: '11px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    desconectar
                  </button>
                </div>
              </>
            )}

            {gcal.status === 'erro' && (
              <>
                <Mono style={{ display: 'block', marginBottom: 10, color: 'var(--coral-ink)' }}>
                  {gcal.erro}
                </Mono>
                <button
                  type="button"
                  onClick={() => void (gcal.config ? gcal.sincronizar() : gcal.conectar())}
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
                  tentar de novo
                </button>
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
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {install.tipo !== 'indisponivel' && (
            <Card titulo="instalar" eyebrow="vira app no celular">
              {install.tipo === 'instalado' ? (
                <>
                  <Pill kind="ok" style={{ marginBottom: 12 }}>
                    instalado
                  </Pill>
                  <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
                    abre fullscreen, fica no app drawer · pode arquivar a aba.
                  </Hand>
                </>
              ) : install.tipo === 'pode-instalar' ? (
                <>
                  <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
                    coloca o colo na tela inicial · abre fullscreen, sem barra do
                    navegador.
                  </Hand>
                  <button
                    type="button"
                    onClick={() => {
                      void install.instalar();
                    }}
                    style={{
                      marginTop: 14,
                      font: '600 13px/1 var(--font-body)',
                      padding: '11px 18px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'var(--ink)',
                      color: 'var(--bg)',
                      cursor: 'pointer',
                    }}
                  >
                    instalar
                  </button>
                </>
              ) : (
                <>
                  <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
                    no safari do iPhone: toca em compartilhar (□↑) e escolhe
                    "adicionar à tela de início".
                  </Hand>
                </>
              )}
            </Card>
          )}

          <Card titulo="notificações" eyebrow="chega no celular">
            {push.status === 'sem-suporte' ? (
              <Hand color="var(--ink-3)" size={16} style={{ display: 'block' }}>
                este navegador não suporta push · use o celular ou outro browser.
              </Hand>
            ) : push.status === 'ativo' ? (
              <>
                <Pill kind="ok" style={{ marginBottom: 12 }}>
                  ativas
                </Pill>
                <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
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
                <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
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
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Eyebrow>validade em dias</Eyebrow>
                  <input
                    type="number"
                    value={shareDias}
                    onChange={(e) =>
                      // vazio ou 0 não vale · mínimo 1 dia
                      setShareDias(Math.min(365, Math.max(1, Math.round(Number(e.target.value)) || 1)))
                    }
                    min={1}
                    max={365}
                    style={input}
                  />
                </label>
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
                          const url = `${window.location.origin}/ritmo/share/${s.token}`;
                          navigator.clipboard?.writeText(url);
                          setLinkCopiado(s.token);
                          setTimeout(() => setLinkCopiado((t) => (t === s.token ? null : t)), 2000);
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
                        {linkCopiado === s.token ? 'copiado ✓' : 'copiar link'}
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
