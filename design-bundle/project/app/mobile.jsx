// =====================================================================
// mobile.jsx — Lista do dia (mobile, 390x844)
// =====================================================================

function MobileFrame({ blocos, mode, carga, dia = '2026-05-08', onSelectBloco }) {
  const dts = SEMANA.map(d => ({ data: d, blocos: blocos.filter(b => b.data === d && b.tipo !== 'deslocamento') }));
  const hosp_proximo = HOSPITAIS;

  return (
    <div style={{
      width: 390, height: 844,
      background: 'var(--bg)',
      borderRadius: 44,
      border: '10px solid #1a1411',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-lg)',
      position: 'relative',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
        width: 110, height: 28, background: '#1a1411', borderRadius: 18, zIndex: 5,
      }} />
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', font: '700 14px/1 var(--font-body)', color: 'var(--ink)',
      }}>
        <span>9:41</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>● ●●● ▮</span>
      </div>

      <div style={{ height: 'calc(100% - 44px - 76px)', overflowY: 'auto', padding: '6px 18px 24px' }}>
        {/* Header mobile */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '8px 0 16px' }}>
          <div>
            <Eyebrow style={{ fontSize: 10 }}>{mode === 'parceiro' ? 'agenda · Mariana' : 'sua semana'}</Eyebrow>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500,
              color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 4,
            }}>4–10 mai</h2>
          </div>
          <CargaBadge horas={carga} />
        </div>

        {/* Banner se modo parceiro/admin */}
        {mode === 'parceiro' && (
          <div style={{
            background: 'var(--lavender-surface)', borderRadius: 12,
            padding: '8px 12px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--lavender)' }} />
            <span style={{ font: '500 12px/1.2 var(--font-body)', color: 'var(--lavender-ink)' }}>
              modo parceiro · só leitura
            </span>
          </div>
        )}

        {/* Próximo */}
        {(() => {
          const prox = blocos.find(b => b.tipo === 'plantao' && !b.cedidoPara);
          if (!prox) return null;
          const h = HOSPITAIS[prox.hospitalId];
          return (
            <div style={{
              background: `var(--${h.cor}-surface)`,
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 16,
              borderLeft: `4px solid var(--${h.cor})`,
            }}>
              <Eyebrow color={`var(--${h.cor}-ink)`}>próximo · {fmtDate(prox.data)}</Eyebrow>
              <Hand color={`var(--${h.cor}-ink)`} size={20} style={{ display: 'block', marginTop: 6 }}>
                daqui a pouco
              </Hand>
              <div style={{ font: '600 16px/1.2 var(--font-body)', color: 'var(--ink)', marginTop: 6 }}>
                {h.nome}
              </div>
              <Mono style={{ display: 'block', marginTop: 3 }}>
                {prox.setor} · {fmtRange(prox.horaInicio, prox.duracao)} · {prox.duracao}h
              </Mono>
            </div>
          );
        })()}

        {/* Lista por dia */}
        {dts.map(({ data, blocos }) => {
          if (blocos.length === 0) return (
            <DayHeader key={data} data={data} empty />
          );
          return (
            <div key={data}>
              <DayHeader data={data} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {blocos.map(b => (
                  <MobileBlocoRow key={b.id} b={b} onClick={() => onSelectBloco(b)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabbar */}
      <nav style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 76, background: 'var(--bg)',
        borderTop: '1px solid var(--line)',
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        paddingBottom: 18,
      }}>
        {[
          { k: 'agenda', label: 'agenda', active: true },
          { k: 'mes', label: 'mês' },
          { k: 'radar', label: 'radar' },
          { k: 'conta', label: 'conta' },
        ].map(t => (
          <a key={t.k} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, color: t.active ? 'var(--lavender-ink)' : 'var(--ink-3)',
            textDecoration: 'none', font: '600 10px/1 var(--font-body)',
          }}>
            <TabIcon name={t.k} active={t.active} />
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

function DayHeader({ data, empty }) {
  const dt = new Date(data + 'T12:00:00');
  const dow = DOWS[diaSemanaBR(data)];
  const isHoje = data === '2026-05-08';
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '10px 0 6px',
      borderBottom: '1px dashed var(--line-2)',
      marginBottom: empty ? 14 : 8,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18,
        color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
        letterSpacing: '-0.01em',
      }}>{dt.getDate()}</span>
      <Eyebrow color={isHoje ? 'var(--lavender-ink)' : 'var(--ink-3)'}>{dow}</Eyebrow>
      {isHoje && <Hand color="var(--lavender-ink)" size={14}>hoje</Hand>}
      <span style={{ flex: 1 }} />
      {empty && <Mono style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>livre</Mono>}
    </div>
  );
}

function MobileBlocoRow({ b, onClick }) {
  const hosp = b.hospitalId ? HOSPITAIS[b.hospitalId] : null;
  if (b.tipo === 'plantao') {
    return (
      <div onClick={onClick} style={{
        display: 'flex', alignItems: 'stretch', gap: 12,
        background: `var(--${hosp.cor}-surface)`,
        borderRadius: 12, padding: '12px 14px',
        position: 'relative', cursor: 'pointer',
      }}>
        <div style={{ width: 3, background: `var(--${hosp.cor})`, borderRadius: 2 }} />
        <div style={{ flex: 1 }}>
          <Eyebrow color={`var(--${hosp.cor}-ink)`}>{hosp.abrev} · {b.setor}</Eyebrow>
          <div style={{ font: '600 15px/1.2 var(--font-body)', color: 'var(--ink)', marginTop: 4 }}>
            {fmtRange(b.horaInicio, b.duracao)}
          </div>
          <Mono style={{ display: 'block', marginTop: 2 }}>{b.duracao}h{b.viaTroca ? ' · troca' : ''}</Mono>
        </div>
        {b.conflito && (
          <span style={{
            alignSelf: 'center',
            font: '700 9px/1 var(--font-body)', letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--coral-ink)', background: 'var(--coral-surface)',
            padding: '4px 8px', borderRadius: 999,
          }}>conflito</span>
        )}
        {b.viaTroca && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            width: 8, height: 8, borderRadius: 999, background: 'var(--lavender)',
          }} />
        )}
      </div>
    );
  }
  if (b.tipo === 'sono') {
    return (
      <div style={{ background: 'var(--sage-surface)', borderRadius: 12, padding: '10px 14px' }}>
        <Hand color="var(--sage-ink)" size={18}>sono protegido · {b.duracao}h</Hand>
      </div>
    );
  }
  if (b.tipo === 'bloqueio') {
    return (
      <div style={{
        background: 'repeating-linear-gradient(135deg, var(--bg-alt), var(--bg-alt) 6px, var(--bg) 6px, var(--bg) 12px)',
        border: '1px dashed rgba(58,46,42,0.18)',
        borderRadius: 12, padding: '10px 14px',
      }}>
        <Eyebrow>bloqueio</Eyebrow>
        <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink-2)', marginTop: 3 }}>
          {b.motivo || 'dia livre'}
        </div>
      </div>
    );
  }
  if (b.tipo === 'cedido') {
    return (
      <div style={{
        background: 'repeating-linear-gradient(135deg, var(--sand-surface), var(--sand-surface) 5px, transparent 5px, transparent 10px)',
        opacity: 0.7,
        borderRadius: 12, padding: '10px 14px',
      }}>
        <Eyebrow style={{ textDecoration: 'line-through' }}>cedido · {b.cedidoPara}</Eyebrow>
        <Mono style={{ display: 'block', marginTop: 3 }}>{fmtRange(b.horaInicio, b.duracao)} · não soma carga</Mono>
      </div>
    );
  }
  return null;
}

function TabIcon({ name, active }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: active ? 2 : 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'agenda') return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>;
  if (name === 'mes') return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (name === 'radar') return <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12L19 7"/></svg>;
  if (name === 'conta') return <svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></svg>;
  return null;
}

Object.assign(window, { MobileFrame });
