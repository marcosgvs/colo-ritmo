import { useEffect } from 'react';
import type { Mode } from '@/types';
import { NAV_ITEMS, type NavKey } from './Header';
import { NavIcon } from './NavIcon';

interface MobileMenuProps {
  active: NavKey;
  mode: Mode;
  conflitos?: number;
  onNav: (k: NavKey) => void;
  onClose: () => void;
}

/**
 * MobileMenu · bottom-sheet que aparece em <720px ao tocar no botão ☰
 * do header. Empilha vertical: views (filtradas por mode), conflitos
 * (se houver), usuário no rodapé. ESC e tap-out fecham.
 */
export function MobileMenu({ active, mode, conflitos = 0, onNav, onClose }: MobileMenuProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 'lista' some em mobile porque 'agenda' já renderiza ListaDoDia ·
  // mostrar os dois seria entrada redundante pro mesmo destino.
  const items = NAV_ITEMS.filter((i) => i.roles.includes(mode) && i.key !== 'lista');
  const conflitoAtivo = active === 'conflitos';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.32)',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'colo-fade-in 180ms ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="menu"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: 'var(--shadow-lg)',
          padding: '14px 16px 24px',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          animation: 'colo-sheet-up 240ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: 'var(--line)',
            margin: '0 auto 14px',
          }}
        />

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onNav(item.key);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 12px',
                  minHeight: 48,
                  font: '500 15px/1 var(--font-body)',
                  color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                  background: isActive ? 'var(--bg-alt)' : 'transparent',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {conflitos > 0 && !conflitoAtivo && (
          <>
            <Separador />
            <button
              type="button"
              onClick={() => {
                onNav('conflitos');
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 12px',
                minHeight: 48,
                font: '500 15px/1 var(--font-body)',
                color: 'var(--coral-ink)',
                background: 'var(--coral-surface)',
                border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--coral)',
                  display: 'inline-block',
                }}
              />
              {conflitos} conflito{conflitos > 1 ? 's' : ''} pra revisar
            </button>
          </>
        )}

        <Separador />

        <button
          type="button"
          onClick={() => {
            onNav('usuario');
            onClose();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 12px',
            minHeight: 48,
            font: '500 15px/1 var(--font-body)',
            color: active === 'usuario' ? 'var(--ink)' : 'var(--ink-2)',
            background: active === 'usuario' ? 'var(--bg-alt)' : 'transparent',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '700 11px/1 var(--font-body)',
              color: 'var(--ink)',
            }}
          >
            M
          </div>
          usuário
        </button>
      </div>
    </div>
  );
}

function Separador() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        background: 'var(--line)',
        margin: '10px 0',
      }}
    />
  );
}
