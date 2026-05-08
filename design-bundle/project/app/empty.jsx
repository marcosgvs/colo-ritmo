// =====================================================================
// empty.jsx — Estados vazios (3 variantes)
//   primeira-semana | sem-hospitais | sem-conflitos
// Sempre centrados na coluna; ilustração mínima vetorial em sage/lavender.
// Tom: calmo, adulto, sem emojis decorativos. Lê como uma página, não toast.
// =====================================================================

// ----------------------------------------------------------
// Ilustrações vetoriais — papelaria. NUNCA SVGs realistas.
// Apenas formas geométricas + grade leve, ressoando "página em branco".
// ----------------------------------------------------------

function IlustracaoSemana() {
  // Página em branco com 7 colunas suaves (a "primeira semana")
  return (
    <svg viewBox="0 0 280 180" width="280" height="180" aria-hidden="true">
      <defs>
        <linearGradient id="emp-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBF6EE"/>
          <stop offset="1" stopColor="#F1EDE3"/>
        </linearGradient>
      </defs>
      {/* página */}
      <rect x="40" y="22" width="200" height="148" rx="10"
            fill="url(#emp-paper)" stroke="#E1DAD1" strokeWidth="1"/>
      {/* eyebrow handwritten */}
      <rect x="56" y="36" width="64" height="6" rx="2" fill="#A4D498" opacity="0.55"/>
      {/* 7 colunas */}
      {[0,1,2,3,4,5,6].map(i => (
        <line key={i}
          x1={56 + i * 24.5} y1="58"
          x2={56 + i * 24.5} y2="158"
          stroke="#E1DAD1" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <line x1="56" y1="58" x2="227" y2="58" stroke="#D7CFC4" strokeWidth="1"/>
      {/* dois traços manuscritos sage — promessa, não dado */}
      <path d="M 96 92 q 8 -6 18 -2 t 18 -1"
            fill="none" stroke="#7BB36A" strokeWidth="1.6" strokeLinecap="round" opacity="0.55"/>
      <path d="M 152 124 q 6 -5 14 -2 t 14 0"
            fill="none" stroke="#A299CB" strokeWidth="1.6" strokeLinecap="round" opacity="0.5"/>
    </svg>
  );
}

function IlustracaoHospitais() {
  // 3 fichas vazias inclinadas, cada uma com uma faixa de cor diferente
  // (sand, blue, coral) — comunica "cada hospital, uma cor".
  const cards = [
    { x: 36,  y: 50, r: -4, c: '#E8C79A' },
    { x: 102, y: 30, r:  2, c: '#9BC2E7' },
    { x: 168, y: 50, r:  6, c: '#E7A59C' },
  ];
  return (
    <svg viewBox="0 0 280 180" width="280" height="180" aria-hidden="true">
      {cards.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.r} 38 50)`}>
          <rect x="0" y="0" width="76" height="100" rx="8"
                fill="#FFFAF3" stroke="#E1DAD1" strokeWidth="1"/>
          <rect x="0" y="0" width="76" height="10" rx="8" fill={c.c}/>
          <rect x="0" y="4" width="76" height="6" fill={c.c}/>
          <rect x="12" y="26" width="32" height="4" rx="2" fill="#DAD3CD"/>
          <rect x="12" y="38" width="52" height="6" rx="2" fill="#3A2E2A" opacity="0.42"/>
          <rect x="12" y="52" width="40" height="3" rx="1.5" fill="#DAD3CD"/>
          <rect x="12" y="62" width="28" height="3" rx="1.5" fill="#DAD3CD"/>
          <rect x="12" y="78" width="20" height="10" rx="5" fill="#F1EDE3"/>
          <rect x="36" y="78" width="20" height="10" rx="5" fill="#F1EDE3"/>
        </g>
      ))}
    </svg>
  );
}

function IlustracaoSemConflitos() {
  // Linhas paralelas que NÃO se cruzam — visualmente "sem sobreposição".
  return (
    <svg viewBox="0 0 280 160" width="280" height="160" aria-hidden="true">
      <line x1="40"  y1="40"  x2="240" y2="40"  stroke="#E1DAD1" strokeWidth="1"/>
      <line x1="40"  y1="80"  x2="240" y2="80"  stroke="#E1DAD1" strokeWidth="1"/>
      <line x1="40"  y1="120" x2="240" y2="120" stroke="#E1DAD1" strokeWidth="1"/>
      {/* 3 segmentos coloridos paralelos */}
      <rect x="56"  y="33" width="60" height="14" rx="6" fill="#ECF6E7" stroke="#A4D498" strokeWidth="1"/>
      <rect x="130" y="73" width="80" height="14" rx="6" fill="#EAF2F9" stroke="#9BC2E7" strokeWidth="1"/>
      <rect x="76"  y="113" width="48" height="14" rx="6" fill="#F1EFE0" stroke="#C5BE99" strokeWidth="1"/>
      {/* check sage discreto */}
      <g transform="translate(212 105)">
        <circle r="14" fill="#ECF6E7"/>
        <path d="M -6 0 l 4 4 l 8 -8" fill="none" stroke="#5A6E50"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
}

// ----------------------------------------------------------
// Wrapper genérico — usado pelas 3 variantes
// ----------------------------------------------------------
function EmptyShell({ illustration, eyebrow, titulo, lede, ctas, hint, dataLabel }) {
  return (
    <section data-screen-label={dataLabel || 'Empty state'} style={{
      maxWidth: 640,
      margin: '64px auto',
      padding: '64px 40px 56px',
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-xl)',
      boxShadow: 'var(--shadow-sm)',
      textAlign: 'center',
      animation: 'colo-fade-in 320ms ease-out',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 28,
      }}>
        {illustration}
      </div>

      {eyebrow && (
        <Eyebrow style={{ display: 'block', marginBottom: 12 }}>{eyebrow}</Eyebrow>
      )}

      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: 'clamp(28px, 3.4vw, 36px)',
        letterSpacing: '-0.015em',
        lineHeight: 1.08,
        color: 'var(--ink)',
        margin: 0,
        textWrap: 'balance',
      }}>{titulo}</h2>

      {lede && (
        <p style={{
          font: '400 16px/1.5 var(--font-body)',
          color: 'var(--ink-2)',
          margin: '14px auto 0',
          maxWidth: 460,
          textWrap: 'pretty',
        }}>{lede}</p>
      )}

      {ctas && ctas.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
          marginTop: 28,
        }}>
          {ctas.map((c, i) => (
            <button key={i} onClick={c.onClick} style={{
              font: '600 13px/1 var(--font-body)',
              padding: '14px 22px',
              borderRadius: 999,
              border: c.kind === 'primary' ? 'none' : '1px solid var(--line)',
              background: c.kind === 'primary' ? 'var(--ink)' : 'var(--bg)',
              color: c.kind === 'primary' ? 'var(--bg)' : 'var(--ink)',
              cursor: 'pointer',
              boxShadow: c.kind === 'primary' ? 'var(--shadow-sm)' : 'none',
            }}>{c.label}</button>
          ))}
        </div>
      )}

      {hint && (
        <p style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 14,
          color: 'var(--ink-3)',
          margin: '20px 0 0',
          fontVariationSettings: '"opsz" 14',
        }}>{hint}</p>
      )}
    </section>
  );
}

// ----------------------------------------------------------
// 1. Primeira semana
// ----------------------------------------------------------
function EmptyPrimeiraSemana({ onImportar, onAdicionar }) {
  return (
    <EmptyShell
      dataLabel="Empty · primeira semana"
      illustration={<IlustracaoSemana/>}
      eyebrow="primeira semana"
      titulo="Sua primeira semana, em branco"
      lede="Tudo começa com um plantão. Importe a escala que o hospital te mandou ou cadastre na mão — depois a gente cuida do resto."
      ctas={[
        { label: 'Importar escala em PDF', kind: 'primary', onClick: onImportar },
        { label: '+ Adicionar plantão na mão', onClick: onAdicionar },
      ]}
      hint="A IA lê PDF e foto da escala — basta arrastar."
    />
  );
}

// ----------------------------------------------------------
// 2. Sem hospitais
// ----------------------------------------------------------
function EmptySemHospitais({ onAdicionar }) {
  return (
    <EmptyShell
      dataLabel="Empty · sem hospitais"
      illustration={<IlustracaoHospitais/>}
      eyebrow="hospitais"
      titulo="Cadastre o primeiro hospital"
      lede="A cor que você escolher aqui vira a cor desse plantão na grade, na lista e nos relatórios — uma família por hospital."
      ctas={[
        { label: '+ Adicionar hospital', kind: 'primary', onClick: onAdicionar },
      ]}
    />
  );
}

// ----------------------------------------------------------
// 3. Sem conflitos
// ----------------------------------------------------------
function EmptySemConflitos({ onIrAgenda }) {
  return (
    <EmptyShell
      dataLabel="Empty · sem conflitos"
      illustration={<IlustracaoSemConflitos/>}
      eyebrow="conflitos"
      titulo={<span>Sem conflitos por aqui <span style={{ color: 'var(--sage-ink)' }}>✓</span></span>}
      lede="Sua semana caminha sem sobreposições. Volte aqui quando algum plantão pisar no outro — a gente avisa antes."
      ctas={[
        { label: 'Voltar pra agenda', onClick: onIrAgenda },
      ]}
    />
  );
}

Object.assign(window, {
  EmptyPrimeiraSemana, EmptySemHospitais, EmptySemConflitos,
  IlustracaoSemana, IlustracaoHospitais, IlustracaoSemConflitos,
});
