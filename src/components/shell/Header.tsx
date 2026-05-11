import { useState } from 'react';
import type { Mode } from '@/types';
import { ColoMark } from '@/components/atoms';
import { NotifSino, type Notificacao } from '@/components/notif';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CargaBadge } from './CargaBadge';
import { NavIcon, type IconName } from './NavIcon';
import { MobileMenu } from './MobileMenu';

export type NavKey =
  | 'agenda'
  | 'mes'
  | 'montar'
  | 'trocas'
  | 'lista'
  | 'time'
  | 'hospitais'
  | 'financeiro'
  | 'sync'
  | 'conflitos'
  | 'usuario'
  | 'inbox'
  | 'auditoria';

interface NavItem {
  key: NavKey;
  label: string;
  icon: IconName;
  roles: Mode[];
}

/**
 * Modo médico isolado · v2 atual.
 *
 * Nav reduzido pro foco do médico individual: agenda, mês, lista,
 * montar, hospitais, financeiro, sync.
 *
 * Funções de equipe (trocas como tela, inbox, time, auditoria) ficam em
 * standby até a feature de equipe ser ativada — código continua nas
 * views, só sumiram do nav. Trocas é acessada inline via Detalhe agora.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'agenda',     label: 'agenda',      icon: 'calendar', roles: ['medica', 'parceiro', 'admin'] },
  { key: 'mes',        label: 'mês',         icon: 'grid',     roles: ['medica', 'parceiro', 'admin'] },
  { key: 'lista',      label: 'lista',       icon: 'list',     roles: ['medica', 'parceiro', 'admin'] },
  { key: 'montar',     label: 'montar',      icon: 'sparkle',  roles: ['medica'] },
  { key: 'hospitais',  label: 'hospitais',   icon: 'hospital', roles: ['medica'] },
  { key: 'financeiro', label: 'financeiro',  icon: 'coin',     roles: ['medica'] },
  { key: 'sync',       label: 'sincronizar', icon: 'sync',     roles: ['medica'] },
];

interface HeaderProps {
  active: NavKey;
  mode: Mode;
  carga: number;
  onCmdK?: () => void;
  onNav?: (k: NavKey) => void;
  conflitos?: number;
  notificacoes?: Notificacao[];
  onMarcarLida?: (id: string) => void;
}

export function Header({
  active,
  mode,
  carga,
  onCmdK,
  onNav,
  conflitos = 0,
  notificacoes,
  onMarcarLida,
}: HeaderProps) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV_ITEMS.filter((i) => i.roles.includes(mode));

  if (isMobile) {
    return (
      <>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            height: 56,
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 10,
            borderBottom: '1px solid var(--line)',
          }}
        >
          <ColoMark size={22} />
          <div style={{ flex: 1 }} />
          <CargaBadge horas={carga} compact />
          {notificacoes && onMarcarLida && (
            <NotifSino notificacoes={notificacoes} onMarcarLida={onMarcarLida} />
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="abrir menu"
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              cursor: 'pointer',
              color: 'var(--ink)',
              position: 'relative',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            {conflitos > 0 && active !== 'conflitos' && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: 'var(--coral)',
                  border: '1.5px solid var(--bg)',
                }}
              />
            )}
          </button>
        </header>
        {menuOpen && (
          <MobileMenu
            active={active}
            mode={mode}
            conflitos={conflitos}
            onNav={(k) => onNav?.(k)}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        height: 60,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 24,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <ColoMark size={22} />

      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 24 }}>
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNav?.(item.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                font: '500 13px/1 var(--font-body)',
                color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                textDecoration: 'none',
                padding: '8px 12px',
                borderRadius: 999,
                background: isActive ? 'var(--bg-alt)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 120ms cubic-bezier(.2,.7,.2,1)',
              }}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {conflitos > 0 && active !== 'conflitos' && (
        <button
          type="button"
          onClick={() => onNav?.('conflitos')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px 6px 10px',
            borderRadius: 999,
            background: 'var(--coral-surface)',
            border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
            color: 'var(--coral-ink)',
            font: '600 12px/1 var(--font-body)',
            cursor: 'pointer',
            animation: 'colo-pulse-conflict 2.4s ease-in-out infinite',
          }}
          title="resolver conflitos"
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
          {conflitos} conflito{conflitos > 1 ? 's' : ''}
        </button>
      )}

      <CargaBadge horas={carga} />

      <button
        type="button"
        onClick={onCmdK}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-alt)',
          border: '1px solid var(--line)',
          borderRadius: 999,
          padding: '7px 8px 7px 14px',
          font: '400 12px/1 var(--font-body)',
          color: 'var(--ink-3)',
          cursor: 'pointer',
        }}
      >
        buscar
        <kbd
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            background: 'var(--bg)',
            padding: '3px 7px',
            borderRadius: 5,
            border: '1px solid var(--line)',
            color: 'var(--ink-2)',
          }}
        >
          ⌘K
        </kbd>
      </button>

      {notificacoes && onMarcarLida && (
        <NotifSino notificacoes={notificacoes} onMarcarLida={onMarcarLida} />
      )}

      <button
        type="button"
        onClick={() => onNav?.('usuario')}
        title="abrir perfil"
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          background:
            mode === 'parceiro'
              ? 'var(--lavender-surface)'
              : mode === 'admin'
                ? 'var(--coral-surface)'
                : 'var(--bg-alt)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '700 12px/1 var(--font-body)',
          color:
            mode === 'parceiro'
              ? 'var(--lavender-ink)'
              : mode === 'admin'
                ? 'var(--coral-ink)'
                : 'var(--ink)',
          border: active === 'usuario' ? '2px solid var(--ink)' : '1px solid var(--line)',
          cursor: 'pointer',
        }}
      >
        {mode === 'admin' ? 'A' : 'M'}
      </button>
    </header>
  );
}
