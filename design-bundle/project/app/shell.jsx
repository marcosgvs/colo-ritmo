// =====================================================================
// shell.jsx — Header (uma trilha só), CommandHint, FAB
// =====================================================================

const NAV_ITEMS = [
  { key: 'agenda',     label: 'agenda',     icon: 'calendar', roles: ['medica', 'parceiro', 'admin'] },
  { key: 'mes',        label: 'mês',        icon: 'grid',     roles: ['medica', 'parceiro', 'admin'] },
  { key: 'montar',     label: 'montar',     icon: 'sparkle',  roles: ['medica'] },
  { key: 'trocas',     label: 'trocas',     icon: 'swap',     roles: ['medica', 'parceiro', 'admin'] },
  { key: 'lista',      label: 'lista',      icon: 'list',     roles: ['admin'] },
  { key: 'time',       label: 'time',       icon: 'people',   roles: ['admin'] },
  { key: 'hospitais',  label: 'hospitais',  icon: 'hospital', roles: ['medica'] },
  { key: 'financeiro', label: 'financeiro', icon: 'coin',     roles: ['medica'] },
  { key: 'sync',       label: 'sincronizar',icon: 'sync',     roles: ['medica'] },
];

function NavIcon({ name }) {
  const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'list') return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
  if (name === 'people') return <svg {...props}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 14.5c2-.5 6 .5 6 4"/></svg>;
  if (name === 'swap') return <svg {...props}><path d="M7 7h13l-3-3M17 17H4l3 3"/></svg>;
  if (name === 'grid') return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (name === 'calendar') return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>;
  if (name === 'radar') return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12L19 7"/></svg>;
  if (name === 'hospital') return <svg {...props}><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6M12 11v3M10.5 12.5h3"/></svg>;
  if (name === 'sparkle') return <svg {...props}><path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19"/></svg>;
  if (name === 'sync') return <svg {...props}><path d="M21 12a9 9 0 01-15 6.7L3 16M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/></svg>;
  if (name === 'coin') return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9 9h4a2 2 0 010 4h-3a2 2 0 000 4h5"/><path d="M12 6v2M12 16v2"/></svg>;
  return null;
}

// CargaBadge — cor dinâmica
function CargaBadge({ horas, big = false }) {
  const nivel = nivelCarga(horas);
  const tokens = {
    ok:   { bg: 'var(--sage-surface)',  ink: 'var(--sage-ink)',  marca: 'var(--sage)' },
    warn: { bg: 'var(--sand-surface)',  ink: '#B8884A',          marca: '#D9A85A' },
    err:  { bg: 'var(--coral-surface)', ink: 'var(--coral-ink)', marca: 'var(--coral)' },
  }[nivel];
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: big ? 10 : 8,
      padding: big ? '8px 14px 8px 10px' : '5px 12px 5px 8px',
      background: tokens.bg,
      borderRadius: 999,
      lineHeight: 1,
    }}>
      <span style={{
        width: big ? 8 : 6, height: big ? 8 : 6, borderRadius: 999, background: tokens.marca,
      }} />
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: big ? 18 : 14,
        color: tokens.ink,
        letterSpacing: '-0.01em',
      }}>{horas}h</span>
      <span style={{
        font: '600 10px/1 var(--font-body)',
        color: tokens.ink,
        opacity: 0.75,
        textTransform: 'lowercase',
        letterSpacing: '0.02em',
      }}>esta sem.</span>
    </div>
  );
}

// =====================================================================
// Header — uma linha só. Marca à esq, nav central, ações + perfil à dir.
// =====================================================================
function Header({ active, mode, carga, onCmdK, onNav, notifs, notifOpen, onNotifToggle, conflitos = 0 }) {
  const items = NAV_ITEMS.filter(i => i.roles.includes(mode));
  return (
    <header style={{
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
    }}>
      <ColoMark size={22} />

      <nav style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 24 }}>
        {items.map(item => {
          const isActive = item.key === active;
          return (
            <button key={item.key}
              onClick={(e) => { e.preventDefault(); onNav && onNav(item.key); }}
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
              }}>
              <NavIcon name={item.icon} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {conflitos > 0 && active !== 'conflitos' && (
        <button onClick={() => onNav && onNav('conflitos')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px 6px 10px', borderRadius: 999,
          background: 'var(--coral-surface)',
          border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
          color: 'var(--coral-ink)',
          font: '600 12px/1 var(--font-body)',
          cursor: 'pointer',
          animation: 'colo-pulse-conflict 2.4s ease-in-out infinite',
        }} title="resolver conflitos">
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--coral)', display: 'inline-block' }}/>
          {conflitos} conflito{conflitos > 1 ? 's' : ''}
        </button>
      )}

      <CargaBadge horas={carga} />

      {notifs && (
        <NotifSino notifs={notifs} ativo={notifOpen} onClick={onNotifToggle} />
      )}

      <button onClick={onCmdK} style={{
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
      }}>
        buscar
        <kbd style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          background: 'var(--bg)',
          padding: '3px 7px',
          borderRadius: 5,
          border: '1px solid var(--line)',
          color: 'var(--ink-2)',
        }}>⌘K</kbd>
      </button>

      <div style={{
        width: 34, height: 34,
        borderRadius: 999,
        background: mode === 'parceiro' ? 'var(--lavender-surface)' : mode === 'admin' ? 'var(--coral-surface)' : 'var(--bg-alt)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: '700 12px/1 var(--font-body)',
        color: mode === 'parceiro' ? 'var(--lavender-ink)' : mode === 'admin' ? 'var(--coral-ink)' : 'var(--ink)',
        border: '1px solid var(--line)',
      }}>{mode === 'parceiro' ? 'M' : mode === 'admin' ? 'A' : 'M'}</div>
    </header>
  );
}

// =====================================================================
// FAB — ações rápidas (+ Plantão / + Sono / + Bloqueio)
// =====================================================================
function FAB({ mode, onAdd }) {
  const [open, setOpen] = React.useState(false);
  if (mode !== 'medica' && mode !== 'admin') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 32, right: 32,
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 10,
    }}>
      {open && (
        <>
          <FabAction label="outros"   sub="o que mais cabe no dia"     color="ink-2"      onClick={() => { onAdd('outros');    setOpen(false); }} />
          <FabAction label="pessoal"  sub="médico fora da medicina"    color="sand-ink"   onClick={() => { onAdd('pessoal');   setOpen(false); }} />
          <FabAction label="estudo"   sub="curso, congresso, aula"     color="blue-ink"   onClick={() => { onAdd('estudo');    setOpen(false); }} />
          <FabAction label="consulta" sub="consultório, ambulatório"   color="coral-ink"  onClick={() => { onAdd('consulta');  setOpen(false); }} />
          <FabAction label="bloqueio" sub="dia livre"                  color="ink-3"      onClick={() => { onAdd('bloqueio');  setOpen(false); }} />
          <FabAction label="sono"     sub="janela protegida"           color="sage-ink"   onClick={() => { onAdd('sono');      setOpen(false); }} />
          <FabAction label="plantão"  sub="novo turno"                 color="lavender-ink" primary onClick={() => { onAdd('plantao');   setOpen(false); }} />
        </>
      )}
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'var(--ink)',
        color: 'var(--bg)',
        border: 'none',
        borderRadius: 999,
        padding: '14px 22px',
        font: '600 14px/1 var(--font-body)',
        boxShadow: 'var(--shadow-lg)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'transform 180ms cubic-bezier(.2,.7,.2,1)',
        transform: open ? 'rotate(45deg)' : 'none',
      }} aria-label="adicionar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        {!open && <span style={{ marginLeft: 2 }}>adicionar</span>}
      </button>
    </div>
  );
}

function FabAction({ label, sub, color, primary, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 999,
      padding: '10px 18px 10px 14px',
      cursor: 'pointer',
      boxShadow: 'var(--shadow-md)',
      animation: 'colo-fab-in 200ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999,
        background: primary ? 'var(--lavender)' : `var(--${color})`,
      }} />
      <span style={{
        font: '600 13px/1 var(--font-body)',
        color: 'var(--ink)',
      }}>{label}</span>
      <span style={{
        font: '400 12px/1 var(--font-body)',
        color: 'var(--ink-3)',
      }}>{sub}</span>
    </button>
  );
}

Object.assign(window, { Header, FAB, CargaBadge, NAV_ITEMS });
