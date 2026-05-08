import { useState } from 'react';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';

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
}

/**
 * Sino + drawer de notificações. Cai do topo direito. Agrupa em
 * "novas" e "já lidas". Cada item tem ícone tipado e ação inline.
 */
export function NotifSino({ notificacoes, onMarcarLida }: NotificacoesProps) {
  const [aberto, setAberto] = useState(false);
  const naoLidas = notificacoes.filter((n) => !n.lida);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        style={{
          background: aberto ? 'var(--bg-alt)' : 'transparent',
          border: '1px solid var(--line)',
          borderRadius: 999,
          padding: 8,
          cursor: 'pointer',
          color: 'var(--ink-2)',
          position: 'relative',
        }}
        aria-label="notificações"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0" />
        </svg>
        {naoLidas.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: 'var(--coral-ink)',
              color: 'var(--bg)',
              font: '700 9px/16px var(--font-body)',
              textAlign: 'center',
            }}
          >
            {naoLidas.length}
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
              position: 'absolute',
              top: '110%',
              right: 0,
              width: 360,
              maxHeight: 480,
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
              {naoLidas.length > 0 && <Eyebrow>{naoLidas.length} novos</Eyebrow>}
            </div>

            {notificacoes.length === 0 && (
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
