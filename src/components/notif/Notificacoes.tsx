import { useState } from 'react';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface Notificacao {
  id: string;
  tipo: 'troca' | 'conflito' | 'sugestao' | 'aprovacao' | 'limite';
  titulo: string;
  detalhe: string;
  recebidaEm: string;
  lida?: boolean;
}

interface NotificacoesProps {
  notificacoes: Notificacao[];
  onMarcarLida: (id: string) => void;
  /** Conflitos de agenda · entra como item destacado no topo do popover. */
  conflitos?: number;
  onAbrirConflitos?: () => void;
}

/**
 * Sino + drawer · agrega notificações push e conflitos de agenda num
 * único ponto de atenção. Cai do topo direito. Badge é a soma de notif
 * não-lidas + conflitos · entrada destacada de conflitos fica no topo
 * do popover quando count > 0.
 */
export function NotifSino({ notificacoes, onMarcarLida, conflitos = 0, onAbrirConflitos }: NotificacoesProps) {
  const isMobile = useIsMobile();
  const [aberto, setAberto] = useState(false);
  const naoLidas = notificacoes.filter((n) => !n.lida);
  const totalAtencao = naoLidas.length + conflitos;
  const vazio = notificacoes.length === 0 && conflitos === 0;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        style={{
          background: aberto ? 'var(--bg-alt)' : 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 999,
          width: 44,
          height: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--ink-2)',
          position: 'relative',
        }}
        aria-label="avisos"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0" />
        </svg>
        {totalAtencao > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--coral-ink)',
              color: 'var(--bg)',
              font: '700 10px/18px var(--font-body)',
              textAlign: 'center',
              border: '2px solid var(--bg)',
              boxSizing: 'content-box',
            }}
          >
            {totalAtencao}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div
            onClick={() => setAberto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 60 }}
          />
          <div
            role="dialog"
            style={{
              // em mobile o drawer pinga do header e fica preso na viewport
              // (left+right ancorados) · evita estourar pra fora da tela
              ...(isMobile
                ? {
                    position: 'fixed' as const,
                    top: 76,
                    left: 14,
                    right: 14,
                    width: 'auto',
                  }
                : {
                    position: 'absolute' as const,
                    top: '110%',
                    right: 0,
                    width: 'min(360px, calc(100vw - 28px))',
                  }),
              maxHeight: '70vh',
              overflowY: 'auto',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-xl)',
              boxShadow: 'var(--shadow-lg)',
              padding: 18,
              zIndex: 61,
              animation: 'colo-drawer-down 200ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500,
                  fontSize: 18,
                  letterSpacing: '-0.005em',
                  margin: 0,
                }}
              >
                avisos
              </h3>
              {totalAtencao > 0 && <Eyebrow>{totalAtencao} {totalAtencao === 1 ? 'novo' : 'novos'}</Eyebrow>}
            </div>

            {conflitos > 0 && onAbrirConflitos && (
              <button
                type="button"
                onClick={() => {
                  setAberto(false);
                  onAbrirConflitos();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  marginBottom: 14,
                  background: 'var(--coral-surface)',
                  border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  color: 'var(--coral-ink)',
                  font: '600 13px/1.3 var(--font-body)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: 'var(--coral)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>
                  {conflitos} conflito{conflitos > 1 ? 's' : ''} na agenda
                  <span style={{ display: 'block', font: '400 12px/1.4 var(--font-body)', color: 'var(--coral-ink)', opacity: 0.85, marginTop: 2 }}>
                    plantões se sobrepõem · clica pra resolver
                  </span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            )}

            {vazio && (
              <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
                tudo em paz · sem avisos por enquanto.
              </Hand>
            )}

            {naoLidas.length > 0 && (
              <Bloco titulo="novas">
                {naoLidas.map((n) => (
                  <Item key={n.id} n={n} onMarcarLida={onMarcarLida} />
                ))}
              </Bloco>
            )}

            {notificacoes.some((n) => n.lida) && (
              <Bloco titulo="já lidas">
                {notificacoes
                  .filter((n) => n.lida)
                  .map((n) => (
                    <Item key={n.id} n={n} onMarcarLida={onMarcarLida} />
                  ))}
              </Bloco>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Eyebrow style={{ marginBottom: 8, display: 'block' }}>{titulo}</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

const KIND: Record<Notificacao['tipo'], 'info' | 'err' | 'lavender' | 'ok' | 'warn'> = {
  troca: 'lavender',
  conflito: 'err',
  sugestao: 'info',
  aprovacao: 'ok',
  limite: 'warn',
};

const LABEL: Record<Notificacao['tipo'], string> = {
  troca: 'troca',
  conflito: 'conflito',
  sugestao: 'sugestão',
  aprovacao: 'aprovação',
  limite: 'limite',
};

function Item({ n, onMarcarLida }: { n: Notificacao; onMarcarLida: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onMarcarLida(n.id)}
      style={{
        display: 'flex',
        gap: 10,
        textAlign: 'left',
        padding: '10px 12px',
        background: n.lida ? 'transparent' : 'var(--bg-alt)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        opacity: n.lida ? 0.65 : 1,
      }}
    >
      <span style={{ alignSelf: 'flex-start' }}>
        <Pill kind={KIND[n.tipo]}>{LABEL[n.tipo]}</Pill>
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ font: '600 13px/1.3 var(--font-body)', color: 'var(--ink)', margin: 0 }}>
          {n.titulo}
        </p>
        <p style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '4px 0 0' }}>
          {n.detalhe}
        </p>
        <Mono style={{ color: 'var(--ink-3)', display: 'block', marginTop: 6 }}>{n.recebidaEm}</Mono>
      </div>
    </button>
  );
}
