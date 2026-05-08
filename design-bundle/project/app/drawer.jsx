// =====================================================================
// drawer.jsx — Detalhe de um Bloco (clicar abre)
// Ações divididas: primárias (editar) vs secundárias (ceder/trocar/excluir)
// =====================================================================

function Drawer({ bloco, onClose, mode }) {
  if (!bloco) return null;
  const hosp = bloco.hospitalId ? HOSPITAIS[bloco.hospitalId] : null;
  const podeEditar = mode === 'medica' || mode === 'admin';

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(58,46,42,0.18)',
        animation: 'colo-fade-in 200ms cubic-bezier(.2,.7,.2,1)',
      }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, zIndex: 51,
        background: 'var(--bg)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column',
        animation: 'colo-drawer-in 240ms cubic-bezier(.2,.7,.2,1)',
        borderLeft: '1px solid var(--line)',
      }}>
        {/* Topo */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--line)',
          background: hosp ? `var(--${hosp.cor}-surface)` : 'var(--bg-alt)',
          position: 'relative',
        }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: 999,
            background: 'var(--bg)', border: '1px solid var(--line)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-2)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <Eyebrow color={hosp ? `var(--${hosp.cor}-ink)` : 'var(--ink-3)'}>
            {bloco.tipo} {bloco.viaTroca ? '· via troca' : ''}
          </Eyebrow>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28,
            color: 'var(--ink)', letterSpacing: '-0.015em', marginTop: 6,
          }}>
            {hosp ? hosp.nome : (bloco.tipo === 'sono' ? 'sono protegido' : 'bloqueio')}
          </h2>
          {bloco.setor && (
            <div style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--ink-2)', marginTop: 4 }}>
              {bloco.setor}
            </div>
          )}
        </div>

        {/* Detalhes */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DetailRow label="quando">
            <div style={{ font: '500 16px/1.3 var(--font-body)', color: 'var(--ink)' }}>
              {fmtDate(bloco.data)}
            </div>
            <Mono>{fmtRange(bloco.horaInicio, bloco.duracao)} · {bloco.duracao}h</Mono>
          </DetailRow>

          {bloco.viaTroca && (
            <DetailRow label="origem da troca">
              <div style={{
                background: 'var(--lavender-surface)',
                borderRadius: 10, padding: '10px 12px',
                font: '500 13px/1.3 var(--font-body)', color: 'var(--lavender-ink)',
              }}>
                {bloco.trocaInfo}
              </div>
            </DetailRow>
          )}

          {bloco.conflito && (
            <DetailRow label="conflito detectado">
              <div style={{
                background: 'var(--coral-surface)', borderRadius: 10, padding: '10px 12px',
                font: '500 13px/1.3 var(--font-body)', color: 'var(--coral-ink)',
              }}>
                sobreposição com outro plantão · revisar antes de confirmar
              </div>
            </DetailRow>
          )}

          {bloco.tipo === 'plantao' && (
            <DetailRow label="impacto na semana">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Pill kind="warn">+{bloco.duracao}h carga</Pill>
                <Pill kind="ok">{bloco.duracao >= 12 ? '12h' : '8h'} sono garantido</Pill>
                <Pill kind="info">{Math.round(20)}min deslocamento</Pill>
              </div>
            </DetailRow>
          )}
        </div>

        {/* Ações — divididas em primárias / secundárias */}
        {podeEditar && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--line)',
            background: 'var(--bg-alt)',
          }}>
            {/* Primárias */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button style={primaryBtn}>editar</button>
              <button style={ghostBtn}>duplicar</button>
            </div>
            {/* Secundárias — recolhidas em uma trilha sutil */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <button style={textBtn}>↔ trocar</button>
              <span style={{ width: 1, height: 12, background: 'var(--line-2)' }} />
              <button style={textBtn}>→ ceder</button>
              <span style={{ width: 1, height: 12, background: 'var(--line-2)' }} />
              <button style={{ ...textBtn, color: 'var(--coral-ink)' }}>excluir</button>
            </div>
          </div>
        )}

        {mode === 'parceiro' && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--line)',
            background: 'var(--lavender-surface)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--lavender)' }} />
            <Mono style={{ color: 'var(--lavender-ink)' }}>modo parceiro · sem ações de edição</Mono>
          </div>
        )}
      </div>
    </>
  );
}

function DetailRow({ label, children }) {
  return (
    <div>
      <Eyebrow style={{ display: 'block', marginBottom: 8 }}>{label}</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

const primaryBtn = {
  flex: 1, font: '600 14px/1 var(--font-body)',
  padding: '12px 18px', borderRadius: 999, border: 'none',
  background: 'var(--ink)', color: 'var(--bg)', cursor: 'pointer',
};
const ghostBtn = {
  flex: 1, font: '600 14px/1 var(--font-body)',
  padding: '12px 18px', borderRadius: 999,
  border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer',
};
const textBtn = {
  font: '500 12px/1 var(--font-body)',
  padding: 6, border: 'none', background: 'transparent',
  color: 'var(--ink-2)', cursor: 'pointer',
  letterSpacing: '0.01em',
};

Object.assign(window, { Drawer });
