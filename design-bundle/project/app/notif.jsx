// =====================================================================
// notif.jsx — Central de notificações (sino no header → drawer do topo)
// =====================================================================

const NOTIFS_ME = [
  {
    id: 'n1', tipo: 'conflito', urgente: true,
    titulo: 'conflito no HSL',
    corpo: 'sex 9, 19h–07h se sobrepõe ao plantão do HBDF',
    quando: 'há 12 min', acao: 'resolver',
  },
  {
    id: 'n2', tipo: 'troca-aceita',
    titulo: 'Dra. Helena topou sua troca',
    corpo: 'plantão de qua 7, HCB · falta confirmação do coordenador',
    quando: 'há 1h', acao: 'ver troca',
  },
  {
    id: 'n3', tipo: 'sugestao',
    titulo: '3 plantões sugeridos para mai',
    corpo: 'cobrem R$ 6.600 da sua meta · respeitam suas preferências',
    quando: 'hoje, 09:14', acao: 'ver no montar',
  },
  {
    id: 'n4', tipo: 'aprovacao',
    titulo: 'coordenador aprovou seu pedido de troca',
    corpo: 'plantão de seg 5, HBDF cedido para Dr. Pedro',
    quando: 'ontem', lida: true,
  },
  {
    id: 'n5', tipo: 'limite',
    titulo: 'você está em 48h esta semana',
    corpo: 'mais 12h e cruza o limite saudável CFM',
    quando: 'ontem', lida: true, acao: 'ver carga',
  },
];

const NOTIF_ICON = {
  'conflito':     { icon: '!', bg: 'var(--coral-surface)', fg: 'var(--coral-ink)' },
  'troca-aceita': { icon: '↔', bg: 'var(--lavender-surface)', fg: 'var(--lavender-ink)' },
  'sugestao':     { icon: '✦', bg: 'var(--sage-surface)', fg: 'var(--sage-ink)' },
  'aprovacao':    { icon: '✓', bg: 'var(--bg-alt)', fg: 'var(--ink-2)' },
  'limite':       { icon: '◴', bg: 'var(--sand-surface)', fg: '#B8884A' },
};

function NotifSino({ notifs, onClick, ativo }) {
  const naoLidas = notifs.filter(n => !n.lida).length;
  const temUrgente = notifs.some(n => n.urgente && !n.lida);
  return (
    <button onClick={onClick} aria-label="notificações" style={{
      position: 'relative',
      width: 36, height: 36,
      borderRadius: 999,
      background: ativo ? 'var(--bg-alt)' : 'transparent',
      border: '1px solid ' + (ativo ? 'var(--line-2)' : 'transparent'),
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-2)',
      transition: 'all 120ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/>
        <path d="M10 21a2 2 0 004 0"/>
      </svg>
      {naoLidas > 0 && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          minWidth: 16, height: 16, padding: '0 4px',
          background: temUrgente ? 'var(--coral)' : 'var(--lavender)',
          color: 'var(--bg)',
          borderRadius: 999,
          font: '700 9px/16px var(--font-body)',
          textAlign: 'center',
          border: '2px solid var(--bg)',
          boxSizing: 'content-box',
        }}>{naoLidas}</span>
      )}
    </button>
  );
}

function NotifDrawer({ open, notifs, onClose, onAcao }) {
  if (!open) return null;
  const naoLidas = notifs.filter(n => !n.lida);
  const lidas = notifs.filter(n => n.lida);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(45,42,50,0.18)',
        animation: 'colo-fade-in 160ms ease',
      }} />
      <div style={{
        position: 'fixed',
        top: 60, right: 24,
        width: 420, maxHeight: 'calc(100vh - 80px)',
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-lg)',
        zIndex: 51,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
      }}>
        {/* head */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            <Eyebrow style={{ display: 'block', marginBottom: 4 }}>avisos</Eyebrow>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22,
              margin: 0, color: 'var(--ink)', letterSpacing: '-0.01em',
            }}>o que pediu sua atenção</h3>
          </div>
          <button onClick={onClose} style={{
            font: '500 12px/1 var(--font-body)',
            color: 'var(--ink-3)', background: 'transparent',
            border: 'none', cursor: 'pointer', padding: 4,
          }}>fechar</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {naoLidas.length > 0 && (
            <div>
              {naoLidas.map(n => <NotifItem key={n.id} n={n} onAcao={onAcao} />)}
            </div>
          )}

          {lidas.length > 0 && (
            <div style={{ paddingTop: 8 }}>
              <div style={{ padding: '12px 20px 6px' }}>
                <Eyebrow style={{ opacity: 0.6 }}>já lidas</Eyebrow>
              </div>
              {lidas.map(n => <NotifItem key={n.id} n={n} onAcao={onAcao} />)}
            </div>
          )}

          {notifs.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Hand color="var(--ink-3)" size={22} style={{ display: 'block' }}>
                tudo em paz por aqui
              </Hand>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--line)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button style={{
            font: '500 12px/1 var(--font-body)', color: 'var(--ink-2)',
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          }}>marcar tudo como lido</button>
          <Mono style={{ color: 'var(--ink-3)' }}>{notifs.length} avisos</Mono>
        </div>
      </div>
    </>
  );
}

function NotifItem({ n, onAcao }) {
  const t = NOTIF_ICON[n.tipo];
  return (
    <div style={{
      padding: '14px 20px',
      borderBottom: '1px solid var(--line)',
      display: 'flex', gap: 12,
      opacity: n.lida ? 0.65 : 1,
      background: n.urgente && !n.lida ? 'rgba(199,114,100,0.04)' : 'transparent',
      cursor: 'pointer',
      transition: 'background 120ms',
    }}
    onMouseEnter={e => e.currentTarget.style.background = n.urgente && !n.lida ? 'rgba(199,114,100,0.08)' : 'var(--bg-alt)'}
    onMouseLeave={e => e.currentTarget.style.background = n.urgente && !n.lida ? 'rgba(199,114,100,0.04)' : 'transparent'}
    >
      <div style={{
        flex: '0 0 32px', width: 32, height: 32,
        background: t.bg, color: t.fg,
        borderRadius: 10,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: '700 14px/1 var(--font-body)',
      }}>{t.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          font: '600 14px/1.3 var(--font-body)',
          color: 'var(--ink)',
          marginBottom: 4,
        }}>{n.titulo}</div>
        <div style={{
          font: '400 13px/1.4 var(--font-body)',
          color: 'var(--ink-2)',
          marginBottom: 6,
        }}>{n.corpo}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Mono style={{ color: 'var(--ink-3)' }}>{n.quando}</Mono>
          {n.acao && !n.lida && (
            <button onClick={(e) => { e.stopPropagation(); onAcao && onAcao(n); }} style={{
              font: '600 11px/1 var(--font-body)',
              color: t.fg, background: 'transparent',
              border: 'none', cursor: 'pointer', padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>{n.acao} →</button>
          )}
        </div>
      </div>
      {!n.lida && (
        <div style={{
          flex: '0 0 6px', width: 6, height: 6, borderRadius: 999,
          background: n.urgente ? 'var(--coral)' : 'var(--lavender)',
          marginTop: 6,
        }} />
      )}
    </div>
  );
}

Object.assign(window, { NOTIFS_ME, NotifSino, NotifDrawer });
