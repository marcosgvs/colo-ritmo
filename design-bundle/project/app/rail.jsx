// =====================================================================
// rail.jsx — Coluna lateral: próximos plantões, ritmo do mês, recados
// =====================================================================

function Rail({ blocos, mode, carga }) {
  const proximos = blocos
    .filter(b => b.tipo === 'plantao' && !b.cedidoPara)
    .sort((a,b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio)
    .slice(0, 3);

  const cedidos = blocos.filter(b => b.tipo === 'cedido');
  const trocas  = blocos.filter(b => b.viaTroca);

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Próximo plantão — destaque */}
      {proximos[0] && <ProximoCard b={proximos[0]} mode={mode} />}

      {/* Ritmo do mês */}
      <Card title="ritmo do mês" eyebrow="carga · 4 semanas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CARGA_MES.map((sem, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mono style={{ width: 78, fontSize: 11, color: 'var(--ink-3)' }}>{sem.sem}</Mono>
              <CargaBar h={sem.h} nivel={sem.nivel} />
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 500,
                color: nivelColor(sem.nivel),
                width: 32,
                textAlign: 'right',
                letterSpacing: '-0.01em',
              }}>{sem.h}h</span>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 14, paddingTop: 12,
          borderTop: '1px dashed var(--line-2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <Mono style={{ color: 'var(--ink-3)' }}>limite saudável</Mono>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>60h/sem · CFM</span>
        </div>
      </Card>

      {/* Recados / status secundário */}
      {(cedidos.length > 0 || trocas.length > 0) && (
        <Card title="movimentações" eyebrow="cedido · trocado">
          {cedidos.map(b => (
            <Row key={b.id} dot="sand">
              <span style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>
                cedido para {b.cedidoPara}
              </span>
              <Mono style={{ color: 'var(--ink-3)' }}>
                {fmtDate(b.data)} · {fmtRange(b.horaInicio, b.duracao)}
              </Mono>
            </Row>
          ))}
          {trocas.map(b => (
            <Row key={b.id} dot="lavender">
              <span style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>
                troca aceita
              </span>
              <Mono style={{ color: 'var(--lavender-ink)' }}>{b.trocaInfo}</Mono>
            </Row>
          ))}
        </Card>
      )}

      {/* Recado em handwritten */}
      <div style={{
        background: 'var(--sage-surface)',
        borderRadius: 16,
        padding: '16px 18px',
        position: 'relative',
      }}>
        <Eyebrow color="var(--sage-ink)" style={{ opacity: 0.7 }}>lembrete</Eyebrow>
        <Hand color="var(--sage-ink)" size={20} style={{ display: 'block', marginTop: 6, lineHeight: 1.2 }}>
          o sono protegido começa 19h depois do último plantão de quarta — proteja essa janela
        </Hand>
      </div>
    </aside>
  );
}

function ProximoCard({ b, mode }) {
  const hosp = HOSPITAIS[b.hospitalId];
  return (
    <div style={{
      background: 'var(--bg)',
      border: `1px solid var(--line)`,
      borderLeft: `4px solid var(--${hosp.cor})`,
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <Eyebrow color="var(--ink-3)">próximo plantão</Eyebrow>
      <Hand color={`var(--${hosp.cor}-ink)`} size={26} style={{ display: 'block', marginTop: 8, marginBottom: 4 }}>
        sex 9 · daqui a pouco
      </Hand>
      <div style={{ font: '600 18px/1.2 var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em', marginTop: 6 }}>
        {hosp.nome}
      </div>
      <Mono style={{ display: 'block', marginTop: 4 }}>
        {b.setor} · {fmtRange(b.horaInicio, b.duracao)} · {b.duracao}h
      </Mono>
      {mode === 'medica' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <SmallBtn>trocar</SmallBtn>
          <SmallBtn ghost>detalhes</SmallBtn>
        </div>
      )}
    </div>
  );
}

function CargaBar({ h, nivel }) {
  const max = 70; // visualização: 70h é o "máximo desenhável"
  const pct = Math.min(100, (h / max) * 100);
  const limit60 = (60 / max) * 100;
  return (
    <div style={{
      flex: 1, height: 8, background: 'var(--bg-alt)', borderRadius: 999, position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: `${pct}%`, height: '100%',
        background: nivelColor(nivel),
        borderRadius: 999,
        opacity: 0.85,
      }} />
      {/* Marcação 60h */}
      <div style={{
        position: 'absolute', top: -2, bottom: -2,
        left: `${limit60}%`, width: 1,
        background: 'var(--ink-3)',
        opacity: 0.4,
      }} />
    </div>
  );
}

function nivelColor(n) {
  return n === 'ok' ? 'var(--sage-ink)' : n === 'warn' ? '#B8884A' : 'var(--coral-ink)';
}

function Card({ title, eyebrow, children }) {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 16,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
        }}>{title}</span>
        {eyebrow && <Eyebrow style={{ fontSize: 10 }}>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}

function Row({ dot, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px dashed var(--line-2)' }}>
      <span style={{
        marginTop: 6,
        width: 6, height: 6, borderRadius: 999,
        background: `var(--${dot})`, flexShrink: 0,
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function SmallBtn({ children, ghost, onClick }) {
  return (
    <button onClick={onClick} style={{
      font: '600 12px/1 var(--font-body)',
      padding: '8px 14px',
      borderRadius: 999,
      border: ghost ? '1px solid var(--line)' : 'none',
      background: ghost ? 'transparent' : 'var(--ink)',
      color: ghost ? 'var(--ink)' : 'var(--bg)',
      cursor: 'pointer',
    }}>{children}</button>
  );
}

Object.assign(window, { Rail, Card, ProximoCard });
