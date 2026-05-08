// =====================================================================
// atoms.jsx — Bloco, Pill, Eyebrow, Hand, RoleBanner, ColoMark
// =====================================================================

function Eyebrow({ children, color, style }) {
  return (
    <span style={{
      font: '700 11px/1 var(--font-body)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: color || 'var(--ink-3)',
      ...style,
    }}>{children}</span>
  );
}

function Hand({ children, color, size = 22, style }) {
  // Hand respeita a variante escolhida em Tweaks via context.
  // Variantes: 'italic' (Fraunces italic), 'sans-italic' (Nunito italic),
  //            'plain' (texto normal em lavender), 'handwritten' (cursiva)
  const variant = React.useContext(HandVariantContext) || 'italic';

  const common = {
    color: color || 'var(--lavender-ink)',
    display: 'inline',
    ...style,
  };

  if (variant === 'handwritten') {
    return (
      <span style={{
        ...common,
        fontFamily: 'var(--font-handwritten)',
        fontWeight: 400,
        lineHeight: 1.05,
        fontSize: size + 2,
      }}>{children}</span>
    );
  }

  if (variant === 'sans-italic') {
    return (
      <span style={{
        ...common,
        fontFamily: 'var(--font-body)',
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: size - 4,
        lineHeight: 1.35,
        letterSpacing: '0.005em',
      }}>{children}</span>
    );
  }

  if (variant === 'plain') {
    return (
      <span style={{
        ...common,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        fontSize: size - 4,
        lineHeight: 1.35,
        letterSpacing: '-0.005em',
      }}>{children}</span>
    );
  }

  // 'italic' (default) — Fraunces italic, peso 400, opsz baixo para mais soft
  return (
    <span style={{
      ...common,
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontWeight: 400,
      fontSize: size - 2,
      lineHeight: 1.2,
      letterSpacing: '-0.005em',
      fontVariationSettings: '"opsz" 14',
    }}>{children}</span>
  );
}

const HandVariantContext = React.createContext('italic');

function Mono({ children, style }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--ink-2)',
      ...style,
    }}>{children}</span>
  );
}

function Pill({ children, kind = 'neutral', style, dot = true }) {
  const map = {
    ok:   { bg: 'var(--sage-surface)',   ink: 'var(--sage-ink)' },
    warn: { bg: 'var(--sand-surface)',   ink: '#B8884A' },
    err:  { bg: 'var(--coral-surface)',  ink: 'var(--coral-ink)' },
    info: { bg: 'var(--blue-surface)',   ink: 'var(--blue-text)' },
    neutral: { bg: 'var(--bg-alt)',      ink: 'var(--ink-2)' },
    lavender: { bg: 'var(--lavender-surface)', ink: 'var(--lavender-ink)' },
    aqua: { bg: 'var(--aqua-surface)', ink: '#3D7884' },
  };
  const c = map[kind] || map.neutral;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      borderRadius: 'var(--r-pill)',
      padding: '6px 12px',
      font: '700 11px/1 var(--font-body)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: c.bg,
      color: c.ink,
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', opacity: 0.7 }} />}
      {children}
    </span>
  );
}

// =====================================================================
// Bloco — átomo central. Variantes:
//   plantao | cedido | trocado | sono | bloqueio | deslocamento
//   modificadores: viaTroca, conflito, conflitoAceito
// =====================================================================
function Bloco({ b, density = 48, onClick, compact = false }) {
  const h = b.duracao * density;
  const hosp = b.hospitalId ? HOSPITAIS[b.hospitalId] : null;
  const cor = hosp ? hosp.cor : null;

  const base = {
    position: 'relative',
    borderRadius: 12,
    padding: compact ? '8px 10px' : '10px 12px',
    height: h,
    minHeight: 36,
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'box-shadow 120ms cubic-bezier(.2,.7,.2,1), transform 120ms',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };

  const onMouseEnter = (e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; };
  const onMouseLeave = (e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; };

  if (b.tipo === 'plantao') {
    const conflitoStyle = b.conflito ? {
      animation: 'colo-pulse-conflict 2.4s ease-in-out infinite',
    } : {};
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: `var(--${cor}-surface)`,
          borderLeft: `4px solid var(--${cor})`,
          color: 'var(--ink)',
          ...conflitoStyle,
        }}>
        {b.viaTroca && (
          <span title="recebido em troca" style={{
            position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 999,
            background: 'var(--lavender)', boxShadow: '0 0 0 2px var(--bg)',
          }} />
        )}
        {b.conflito && (
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            border: '2px solid var(--coral-ink)', pointerEvents: 'none',
          }} />
        )}
        <Eyebrow color={`var(--${cor}-ink)`}>{hosp.abrev} · {b.setor}</Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
        {h > 70 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', marginTop: 'auto' }}>
            {b.duracao}h
          </div>
        )}
      </div>
    );
  }

  if (b.tipo === 'sono') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{ ...base, background: 'var(--sage-surface)', color: 'var(--sage-ink)' }}>
        <Hand color="var(--sage-ink)" size={h > 80 ? 22 : 16}>sono protegido</Hand>
        {h > 60 && <Mono style={{ color: 'var(--sage-ink)', opacity: 0.8 }}>{b.duracao}h livres</Mono>}
      </div>
    );
  }

  if (b.tipo === 'bloqueio') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'repeating-linear-gradient(135deg, var(--bg-alt), var(--bg-alt) 6px, var(--bg) 6px, var(--bg) 12px)',
          border: '1px dashed rgba(58,46,42,0.18)',
          color: 'var(--ink-2)',
        }}>
        <Eyebrow>bloqueio</Eyebrow>
        {b.motivo && <div style={{ font: '500 12px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>{b.motivo}</div>}
      </div>
    );
  }

  if (b.tipo === 'cedido') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'repeating-linear-gradient(135deg, var(--sand-surface), var(--sand-surface) 5px, transparent 5px, transparent 10px)',
          opacity: 0.7,
        }}>
        <Eyebrow style={{ textDecoration: 'line-through' }}>cedido · {b.cedidoPara}</Eyebrow>
        <div style={{ font: '500 12px/1.3 var(--font-body)', color: 'var(--ink-3)' }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
        {b.motivo && h > 60 && <Mono style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>{b.motivo}</Mono>}
      </div>
    );
  }

  if (b.tipo === 'trocado') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'repeating-linear-gradient(135deg, var(--lavender-surface), var(--lavender-surface) 8px, color-mix(in oklab, var(--lavender-ink) 12%, transparent) 8px, color-mix(in oklab, var(--lavender-ink) 12%, transparent) 14px)',
          border: '1.5px dashed var(--lavender-ink)',
          opacity: 1,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ font: '700 14px/1 var(--font-body)', color: 'var(--lavender-ink)' }}>↔</span>
          <Eyebrow color="var(--lavender-ink)" style={{ opacity: 0.95 }}>trocado</Eyebrow>
        </div>
        <div style={{ font: '600 13px/1.3 var(--font-body)', color: 'var(--lavender-ink)', marginTop: 2 }}>{b.trocadoCom}</div>
      </div>
    );
  }

  // Tipos universais — agenda do médico além do plantão
  if (b.tipo === 'consulta') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--bg)',
          border: '1px solid var(--coral)',
          borderLeft: '4px solid var(--coral-ink)',
          color: 'var(--ink)',
        }}>
        <Eyebrow color="var(--coral-ink)">consulta · {b.local || 'consultório'}</Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>{fmtRange(b.horaInicio, b.duracao)}</div>
        {h > 70 && b.detalhe && <div style={{ font: '400 11px/1.3 var(--font-body)', color: 'var(--ink-2)', marginTop: 'auto' }}>{b.detalhe}</div>}
      </div>
    );
  }
  if (b.tipo === 'estudo') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--blue-surface)',
          borderLeft: '4px solid var(--blue-ink)',
          color: 'var(--ink)',
        }}>
        <Eyebrow color="var(--blue-ink)">{b.subtipo || 'estudo'} · {b.titulo || ''}</Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>{fmtRange(b.horaInicio, b.duracao)}</div>
      </div>
    );
  }
  if (b.tipo === 'pessoal') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--sand-surface)',
          borderLeft: '4px solid var(--sand-ink)',
          color: 'var(--ink)',
        }}>
        <Eyebrow color="var(--sand-ink)">pessoal</Eyebrow>
        <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>{b.titulo || 'compromisso'}</div>
        {h > 60 && <Mono style={{ color: 'var(--ink-3)' }}>{fmtRange(b.horaInicio, b.duracao)}</Mono>}
      </div>
    );
  }
  if (b.tipo === 'outros') {
    return (
      <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderLeft: `4px solid var(--ink-3)`,
          color: 'var(--ink)',
        }}>
        <Eyebrow>{b.categoria || 'outros'}</Eyebrow>
        <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>{b.titulo || 'evento'}</div>
        {h > 60 && <Mono style={{ color: 'var(--ink-3)' }}>{fmtRange(b.horaInicio, b.duracao)}</Mono>}
      </div>
    );
  }

  if (b.tipo === 'deslocamento') {
    return (
      <div style={{
        height: 14, minHeight: 14,
        background: 'var(--blue-surface)',
        borderRadius: 6,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        font: '500 10px/1 var(--font-body)',
        color: 'var(--blue-text)',
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        {b.de} → {b.para} · {Math.round(b.duracao * 60)}min
      </div>
    );
  }

  return null;
}

// =====================================================================
// RoleBanner — modo parceiro/coordenador
// =====================================================================
function RoleBanner({ mode }) {
  if (mode === 'medica') return null;
  if (mode === 'parceiro') {
    return (
      <div style={{
        background: 'var(--lavender-surface)',
        borderRadius: 'var(--r-md)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 'var(--s-4)',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999, background: 'var(--lavender)',
        }} />
        <span style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--lavender-ink)' }}>
          modo parceiro · você está vendo a agenda da Mariana
        </span>
        <span style={{ flex: 1 }} />
        <Mono style={{ color: 'var(--lavender-ink)', opacity: 0.8 }}>somente leitura</Mono>
      </div>
    );
  }
  if (mode === 'admin') {
    return (
      <div style={{
        background: 'var(--coral-surface)',
        borderRadius: 'var(--r-md)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 'var(--s-4)',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--coral-ink)' }} />
        <span style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--coral-ink)' }}>
          admin · editando agenda alheia · ações registradas em audit log
        </span>
        <span style={{ flex: 1 }} />
        <Mono style={{ color: 'var(--coral-ink)' }}>Marcos · sessão admin</Mono>
      </div>
    );
  }
  return null;
}

// =====================================================================
// ColoMark — wordmark
// =====================================================================
function ColoMark({ size = 22 }) {
  // Logo oficial Colo Ritmo (v2) — wordmark + ícone do coração/colo.
  // Inline SVG para aceitar fill currentColor.
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      color: 'var(--lavender-ink)',
      height: size + 12,
    }}>
      <svg viewBox="0 0 283.08 75.27" style={{ height: size + 4, display: 'block' }} fill="currentColor" aria-label="Colo Ritmo">
        <path d="M37.98,46.22c-.27-.08-.93.2-1.01.47-.83,3.05-4.08,1.53-4.34,2.87-.07.27.37.9.74.94,2.45.28,4.43-1,5.15-3.14.11-.34-.25-1.02-.54-1.13Z"/>
        <path d="M34.17,45.75c.51-.27.69-1.09.39-1.48-.2-.29-1.06-.31-1.34-.07l-.88.72c-.21.17,0,1.03.23,1.14.35.17,1.16-.05,1.6-.31Z"/>
        <path d="M27.74,44.22c-1.11.48.23,2.45-1.44,3.32-1.67.86-2.67-1.19-3.52-.26-.21.23-.19,1.13.07,1.37,1.4,1.33,3.26,1.28,4.62.36,1.34-.91,2.07-2.68,1.41-4.36-.11-.3-.84-.55-1.14-.43Z"/>
        <path d="M71.18,29.71C66.91,3.97,42.42-1.93,27.8.5,11.91,3.14-3.72,15.2.79,42.37c3.59,21.61,17.08,32.11,39.17,28.44,16.37-2.72,35.34-16.31,31.22-41.1ZM56.14,35.98c-.32.38-1.13.72-1.44.5-.44-.34-1.07-.63-1.43-.51-.46.14-.87.95-.61,1.46.21.42.67.76,1.15,1.07.23,1.76,0,3.68-.78,5.4-.94,2.11-3.04,2.03-2.33,3.56.17.35.78.48,1.35.37-3.23,7.59-12.66,10.3-20.96,8.86-.21-3.07-3.94-4.85-6.58-4.66-.92.05-1.47.01-2.27-.3-1.87-.76-3.05-2.12-2.84-4.22-5.23-4.88-6.14-12.52-3.24-18.85,1.17,2.32,3.5,3.38,5.9,2.85,2.15-.46,4.13-2.29,4.23-4.7.08-1.52-.97-2.77-2.23-3-1.38-.22-2.81.49-3.17,2-.07.31.29.99.59,1.11,1.14.44,1.31-1.19,2.05-1.1.27.02.66.64.63.91-.06,1.28-1.03,2.14-1.98,2.5-1.2.45-2.52.35-3.45-.61-4.15-4.21,5.99-15.05,18.46-13.71,6.93.73,12.49,5.65,14.18,12.3-.46.42-.8.99-.79,1.52,0,.27.43.83.68.91.3.1.9-.17,1.13-.44.83-1.01,2.21-.93,3.2-.09,2,1.68,2.24,4.86.55,6.86Z"/>
        <path d="M41.13,36.3c-1.18.41.21,2.43-1.62,3.3-1.9.9-2.87-1.31-3.74-.31-.21.23-.19,1.11.04,1.33,1.5,1.33,3.2,1.37,4.72.52,1.33-.73,2.13-2.23,1.98-3.93-.07-.66-.81-1.1-1.38-.91Z"/>
        <path d="M124.59,22.67c0,6.99-4.44,10.93-11.34,13.97-2.14.99-2.63,2.79-.9,4.36,5.18,4.69,10.85,10.44,11.51,14.14.99,5.59-2.63,9.21-7.07,9.21-1.48,0-3.04-.41-4.52-1.23-4.19-2.38-8.8-12.58-11.59-19.56-.9-2.14-2.05-2.79-3.21-2.79-.16,0-.41.08-.58.08-1.31.33-2.47,1.64-2.38,3.95.16,3.37.49,7.15-.08,12.17-.9,7.73-4.52,9.37-7.73,9.37-3.7,0-6.58-2.3-6.9-7.73-.41-6.58,1.64-39.21,2.05-43.65.74-7.64,3.12-10.03,12.99-10.03,18.66,0,29.76,4.85,29.76,17.75ZM97.96,29.24c8.88,0,12.25-3.86,12.25-7.4,0-4.03-4.27-7.64-11.59-7.73-2.88,0-4.44.41-4.52,1.97-.08.9-.25,5.67.25,9.62.33,2.96,1.56,3.53,3.62,3.53Z"/>
        <path d="M142.51,53.65c-.9,5.84-3.7,7.07-6.9,7.07-3.7,0-6.58-2.3-6.9-7.73-.41-6.58,1.64-21.54,2.05-26.22.33-3.62,2.38-5.84,5.51-5.84s4.93,2.14,5.01,5.59c.08,5.51,1.97,22.52,1.23,27.12ZM142.27,11.65c-.99,3.29-3.45,4.85-5.84,4.93-3.21,0-5.51-2.3-6.25-5.34-.66-2.88.66-6.82,6.41-6.82s6.66,4.11,5.67,7.23Z"/>
        <path d="M148.59,29.65c.99-.08,2.14-.16,3.37-.25.74-5.67,1.89-10.6,3.53-13.15,1.32-2.05,3.53-3.29,6.25-3.29,3.12,0,5.67,2.05,5.92,5.67.25,3.45-.9,6.9-2.22,10.77,2.63.08,4.77.25,5.75.49,4.44,1.15,4.44,7.4-.08,7.97-2.3.33-5.34.49-8.55.58-.58,2.3-.99,4.69-.99,7.23-.08,4.52,1.4,6.74,3.29,6.82,3.37.08,3.04-6.49,9.29-6.49,8.47,0,8.96,19.48-8.06,19.48-5.75,0-11.51-2.71-13.56-8.47-1.15-3.29-1.64-10.77-1.32-18.49-.99,0-1.89-.08-2.71-.08-5.67-.16-5.84-8.22.08-8.79Z"/>
        <path d="M256.68,61.3c6.99,0,13.73-2.55,17.84-6.08,1.31-1.07,2.63-1.56,3.86-1.56,3.53,0,6.17,4.27,3.78,9.54-2.63,6-11.1,12.08-25.32,12.08-34.93,0-33.37-27.45-31.89-39.62.58-5.18-.41-7.81-3.37-7.81-2.47,0-4.6,3.95-4.6,11.51,0,3.45.82,6.91.49,10.44-.49,4.85-2.55,8.3-7.81,8.3s-7.32-3.86-7.23-8.88c0-4.52,1.81-8.63,1.81-13.07,0-2.38-.66-5.01-3.29-5.01-3.04,0-4.69,4.03-4.69,8.8,0,1.89.82,8.3.49,12.08-.49,4.85-2.55,8.3-7.81,8.3s-7.32-3.86-7.23-8.88c.08-8.3.82-21.7,2.63-29.76.58-2.38,1.89-3.78,4.69-3.78,2.96,0,4.36,1.4,4.85,3.86.49,2.14.82,4.93.82,6.99,1.97-3.95,5.59-7.64,10.27-7.56,2.63.08,7.64,1.64,9.62,7.07,2.79-5.84,7.07-10.36,12.58-10.36,3.86,0,7.32,2.14,8.96,6.66,3.7,10.44-3.53,32.63,15.37,36.25,1.73.33,3.45.49,5.18.49ZM244.35,34.01c0-7.56,5.01-19.4,18.33-19.4s18.08,10.69,18.08,19.15c0,11.43-6.41,17.34-17.59,17.34-14.06,0-18.82-8.88-18.82-17.1ZM256.11,33.6c0,2.96,1.89,6.74,6.41,6.74s6.49-4.19,6.49-6.82c0-2.88-1.73-6.08-6.66-6.08-3.95,0-6.25,2.14-6.25,6.17Z"/>
      </svg>
    </div>
  );
}

Object.assign(window, { Eyebrow, Hand, Mono, Pill, Bloco, RoleBanner, ColoMark, HandVariantContext });
