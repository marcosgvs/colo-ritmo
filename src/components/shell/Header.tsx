import type { Mode } from '@/types';
import { ColoMark } from '@/components/atoms';
import { CargaBadge } from './CargaBadge';
import { NavIcon, type IconName } from './NavIcon';

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
  | 'inbox';

interface NavItem {
  key: NavKey;
  label: string;
  icon: IconName;
  roles: Mode[];
}

/** Modo coordenador foi removido v2 (decisão registrada em V2-NEXT-SESSION.md). */
export const NAV_ITEMS: NavItem[] = [
  { key: 'agenda',     label: 'agenda',      icon: 'calendar', roles: ['medica', 'parceiro', 'admin'] },
  { key: 'mes',        label: 'mês',         icon: 'grid',     roles: ['medica', 'parceiro', 'admin'] },
  { key: 'lista',      label: 'lista',       icon: 'list',     roles: ['medica', 'parceiro', 'admin'] },
  { key: 'montar',     label: 'montar',      icon: 'sparkle',  roles: ['medica'] },
  { key: 'trocas',     label: 'trocas',      icon: 'swap',     roles: ['medica', 'admin'] },
  { key: 'inbox',      label: 'inbox',       icon: 'list',     roles: ['admin'] },
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
}

export function Header({ active, mode, carga, onCmdK, onNav, conflitos = 0 }: HeaderProps) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(mode));
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
