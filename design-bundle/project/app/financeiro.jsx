// =====================================================================
// financeiro.jsx — Cálculo de remuneração mensal
//   Layout 2-col: principal (totais + lista hospitais) + sidebar (3 cards)
//   Tweaks: dadosFin → cheio | um-hospital | sem-plantoes
// =====================================================================

const FIN_CHEIO = {
  mes: '2026-04', mesLabel: 'abril 2026',
  bruto: 28840, brutoDelta: '+12%',
  liquido: 21630, liquidoDelta: '-3%',
  hospitais: [
    { id: 'HBDF', cor: 'blue',  qtd: 6, horas: 72, base: 13200, addNoite: 1180, addFDS: 480,  bruto: 14860, descontos: 3200, liquido: 11660, ativa: true },
    { id: 'HSL',  cor: 'sand',  qtd: 4, horas: 36, base: 5400,  addNoite: 540,  addFDS: 720,  bruto: 6660,  descontos: 1430, liquido: 5230,  ativa: true },
    { id: 'HCB',  cor: 'aqua',  qtd: 3, horas: 36, base: 5850,  addNoite: 360,  addFDS: 0,    bruto: 6210,  descontos: 1340, liquido: 4870,  ativa: true },
    { id: 'HDS',  cor: 'coral', qtd: 1, horas: 12, base: 2400,  addNoite: 0,    addFDS: 0,    bruto: 2400,  descontos: 0,    liquido: 0,     ativa: false },
  ],
  comparacao6m: [
    { mes: 'nov',  v: 21400 },
    { mes: 'dez',  v: 24800 },
    { mes: 'jan',  v: 18600, baixa: true },
    { mes: 'fev',  v: 26900 },
    { mes: 'mar',  v: 31400, pico: true },
    { mes: 'abr',  v: 28840, atual: true },
  ],
  projecao90: { valor: 86400, label: 'próximos 3 meses' },
};

const FIN_UM_HOSPITAL = {
  mes: '2026-04', mesLabel: 'abril 2026',
  bruto: 14860, brutoDelta: '+8%',
  liquido: 11660, liquidoDelta: '+5%',
  hospitais: [
    { id: 'HBDF', cor: 'blue',  qtd: 6, horas: 72, base: 13200, addNoite: 1180, addFDS: 480, bruto: 14860, descontos: 3200, liquido: 11660, ativa: true },
  ],
  comparacao6m: [
    { mes: 'nov', v: 12200 },
    { mes: 'dez', v: 13600 },
    { mes: 'jan', v: 11800, baixa: true },
    { mes: 'fev', v: 13900 },
    { mes: 'mar', v: 14400 },
    { mes: 'abr', v: 14860, atual: true, pico: true },
  ],
  projecao90: { valor: 44600, label: 'próximos 3 meses' },
};

const FIN_VAZIO = {
  mes: '2026-04', mesLabel: 'abril 2026',
  bruto: 0, brutoDelta: null,
  liquido: 0, liquidoDelta: null,
  hospitais: [],
  comparacao6m: [],
  projecao90: { valor: 0, label: '—' },
};

const FIN_DATA = { cheio: FIN_CHEIO, 'um-hospital': FIN_UM_HOSPITAL, 'sem-plantoes': FIN_VAZIO };

function FinanceiroScreen({ mode, dados = 'cheio' }) {
  const data = FIN_DATA[dados] || FIN_CHEIO;
  return (
    <main data-screen-label="Financeiro · mensal" style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px 96px' }}>
      <RoleBanner mode={mode}/>
      <FinHeader mes={data.mes} mesLabel={data.mesLabel}/>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 24,
        alignItems: 'flex-start',
        marginTop: 24,
      }} className="fin-grid">
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FinTotais data={data}/>
          {data.hospitais.length > 0 ? (
            <FinHospitaisList hospitais={data.hospitais}/>
          ) : (
            <FinVazio/>
          )}
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FinComparacao serie={data.comparacao6m}/>
          <FinProjecao p={data.projecao90}/>
          <FinDicas dados={dados}/>
        </aside>
      </div>

      <style>{`
        @media (max-width: 980px) {
          main[data-screen-label="Financeiro · mensal"] .fin-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function FinHeader({ mes, mesLabel }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 24, flexWrap: 'wrap',
    }}>
      <div>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>cálculo · mensal</Eyebrow>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          fontSize: 'clamp(36px, 4vw, 44px)',
          color: 'var(--ink)', letterSpacing: '-0.02em',
          lineHeight: 1.05, margin: 0,
        }}>Financeiro</h1>
        <p style={{ font: '400 16px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 540 }}>
          Quanto cada hospital pagou neste mês. A calculadora é definida em cada hospital.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 999,
          background: 'var(--bg)', border: '1px solid var(--line)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>
          </svg>
          <input type="month" defaultValue={mes} aria-label="mês"
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              font: '600 13px/1 var(--font-body)', color: 'var(--ink)',
              minWidth: 100,
            }}/>
        </label>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          font: '600 13px/1 var(--font-body)',
          padding: '12px 18px', borderRadius: 999,
          border: 'none', background: 'var(--ink)', color: 'var(--bg)',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Extrato (PDF)
        </button>
      </div>
    </header>
  );
}

// ----------------------------------------------------------
// 2 cards grandes de totais (Bruto / Líquido)
// ----------------------------------------------------------
function FinTotais({ data }) {
  return (
    <CardTotal
      eyebrow="total recebido · mês"
      valor={data.bruto}
      delta={data.brutoDelta}
      deltaPositivo={true}
    />
  );
}

function CardTotal({ eyebrow, valor, delta, deltaPositivo, accent = 'sage' }) {
  const inkVar = `var(--${accent}-ink)`;
  return (
    <article style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, height: 4, width: '100%',
        background: `var(--${accent})`,
      }}/>
      <Eyebrow color={inkVar}>{eyebrow}</Eyebrow>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 'clamp(32px, 3.2vw, 40px)',
        letterSpacing: '-0.02em',
        lineHeight: 1.05,
        color: 'var(--ink)',
        margin: '12px 0 4px',
      }}>
        <span style={{ font: '500 16px/1 var(--font-display)', color: 'var(--ink-3)', marginRight: 6, fontVariationSettings: '"opsz" 14' }}>R$</span>
        {fmtBR(valor)}
      </div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <span style={{
            font: '600 12px/1 var(--font-body)',
            color: deltaPositivo ? 'var(--sage-ink)' : 'var(--coral-ink)',
            background: deltaPositivo ? 'var(--sage-surface)' : 'var(--coral-surface)',
            padding: '4px 10px', borderRadius: 999,
          }}>{delta}</span>
          <span style={{ font: '400 12px/1 var(--font-body)', color: 'var(--ink-3)' }}>vs. mês passado</span>
        </div>
      )}
    </article>
  );
}

function fmtBR(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ----------------------------------------------------------
// Lista de hospitais — cada um seu card colorido com wash da família
// ----------------------------------------------------------
function FinHospitaisList({ hospitais }) {
  return (
    <section>
      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>por hospital</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hospitais.map(h => (
          h.ativa ? <HospFinCard key={h.id} h={h}/> : <HospFinCardOff key={h.id} h={h}/>
        ))}
      </div>
    </section>
  );
}

function HospFinCard({ h }) {
  const meta = HOSPITAIS[h.id] || { nome: h.id, abrev: h.id };
  return (
    <article style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1fr) auto',
      gap: 20, alignItems: 'center',
      background: `linear-gradient(90deg, var(--${h.cor}-surface) 0%, var(--bg) 60%)`,
      border: '1px solid var(--line)',
      borderLeft: `4px solid var(--${h.cor})`,
      borderRadius: 'var(--r-md)',
      padding: '18px 22px',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 999,
            background: 'var(--bg)', color: `var(--${h.cor}-ink)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6M12 11v3M10.5 12.5h3"/></svg>
          </span>
          <div>
            <div style={{ font: '700 11px/1 var(--font-body)', color: `var(--${h.cor}-ink)`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{meta.abrev}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.005em', marginTop: 2 }}>{meta.nome}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>
          {h.qtd} plantões · {h.horas}h
        </div>
      </div>

      {/* breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <BreakRow label="base"            v={h.base}/>
        <BreakRow label="adicional noite" v={h.addNoite}/>
        <BreakRow label="adicional FDS"   v={h.addFDS}/>
      </div>

      {/* total à direita */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '700 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>total</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, color: `var(--${h.cor}-ink)`, letterSpacing: '-0.01em', marginTop: 4 }}>
          R$ {fmtBR(h.bruto)}
        </div>
        <div style={{ font: '400 11px/1 var(--font-body)', color: 'var(--ink-3)', marginTop: 6 }}>
          {h.qtd} plant{h.qtd === 1 ? 'ão' : 'ões'} · R$ {fmtBR(Math.round(h.bruto / h.qtd))}/p
        </div>
      </div>
    </article>
  );
}

function BreakRow({ label, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>+ R$ {fmtBR(v)}</span>
    </div>
  );
}

function HospFinCardOff({ h }) {
  const meta = HOSPITAIS[h.id] || { nome: h.id, abrev: h.id };
  return (
    <article style={{
      display: 'flex', alignItems: 'center', gap: 16,
      background: 'var(--bg-alt)',
      border: '1px dashed var(--line-2)',
      borderRadius: 'var(--r-md)',
      padding: '16px 22px',
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 999,
        background: 'var(--bg)', color: 'var(--ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg>
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink-2)' }}>{meta.nome}</div>
        <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>
          {h.qtd} plantão · {h.horas}h · calculadora desligada — ative em <a href="#" style={{ color: 'var(--ink-2)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Hospitais → editar</a>
        </div>
      </div>
    </article>
  );
}

function FinVazio() {
  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: '56px 32px',
      textAlign: 'center',
    }}>
      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>nada a calcular</Eyebrow>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>
        Nenhum plantão neste mês
      </h3>
      <p style={{ font: '400 15px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '10px auto 0', maxWidth: 380 }}>
        Quando você adicionar plantões em abril, eles aparecem aqui com o cálculo bruto e líquido por hospital.
      </p>
    </section>
  );
}

// ----------------------------------------------------------
// Sidebar · 3 cards
// ----------------------------------------------------------
function FinComparacao({ serie }) {
  if (!serie || serie.length === 0) return null;
  const max = Math.max(...serie.map(s => s.v), 1);
  return (
    <article style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: '20px 22px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <Eyebrow style={{ display: 'block', marginBottom: 4 }}>comparação · 6 meses</Eyebrow>
      <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)', margin: '6px 0 16px', letterSpacing: '-0.005em' }}>
        Total por mês
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {serie.map((s, i) => {
          const pct = (s.v / max) * 100;
          const cor = s.pico ? 'coral' : s.atual ? 'lavender' : 'sand';
          const inkCor = s.pico ? 'var(--coral-ink)' : s.atual ? 'var(--lavender-ink)' : 'var(--ink-2)';
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 70px', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: s.atual ? 'var(--ink)' : 'var(--ink-3)',
                fontWeight: s.atual ? 700 : 400,
              }}>{s.mes}</span>
              <div style={{ position: 'relative', height: 14, background: 'var(--bg-alt)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: `var(--${cor})`,
                  borderRadius: 999,
                }}/>
              </div>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 13,
                color: inkCor, textAlign: 'right',
                letterSpacing: '-0.005em',
              }}>{fmtBR(s.v / 1000)}k</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function FinProjecao({ p }) {
  return (
    <article style={{
      background: 'var(--lavender-surface)',
      border: '1px solid color-mix(in oklab, var(--lavender-ink) 18%, transparent)',
      borderRadius: 'var(--r-lg)',
      padding: '20px 22px',
    }}>
      <Eyebrow color="var(--lavender-ink)" style={{ display: 'block', marginBottom: 4 }}>projeção · 90 dias</Eyebrow>
      <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--lavender-ink)', margin: '6px 0 12px', letterSpacing: '-0.005em' }}>
        Se mantiver o ritmo
      </h4>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 32, color: 'var(--ink)',
        letterSpacing: '-0.02em', lineHeight: 1,
      }}>
        <span style={{ font: '500 14px/1 var(--font-display)', color: 'var(--ink-3)', marginRight: 4 }}>R$</span>
        {fmtBR(p.valor)}
      </div>
      <p style={{
        font: '400 12px/1.45 var(--font-body)',
        color: 'var(--lavender-ink)', opacity: 0.9,
        margin: '12px 0 0',
      }}>
        Baseado nos plantões já marcados + recorrências do seu padrão.
      </p>
    </article>
  );
}

function FinDicas({ dados }) {
  const txt = dados === 'um-hospital'
    ? 'HBDF é seu único hospital ativo no mês. Vale ativar a calculadora dos outros pra ter um panorama mais cheio.'
    : dados === 'sem-plantoes'
    ? 'Esse mês está vazio. Importe a escala do hospital ou monte na mão pra ver os números surgirem aqui.'
    : 'HBDF tem o maior R$/h dos 4. Se quiser concentrar, foca lá nas próximas semanas.';
  return (
    <article style={{
      background: 'var(--sage-surface)',
      border: '1px solid color-mix(in oklab, var(--sage-ink) 16%, transparent)',
      borderRadius: 'var(--r-lg)',
      padding: '20px 22px',
    }}>
      <Eyebrow color="var(--sage-ink)" style={{ display: 'block', marginBottom: 8 }}>dicas</Eyebrow>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontWeight: 400,
        fontSize: 17,
        lineHeight: 1.4,
        color: 'var(--sage-ink)',
        margin: 0,
        textWrap: 'pretty',
        fontVariationSettings: '"opsz" 18',
      }}>
        {txt}
      </p>
    </article>
  );
}

Object.assign(window, { FinanceiroScreen });
