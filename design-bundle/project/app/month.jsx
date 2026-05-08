// =====================================================================
// month.jsx — Visão Mês (decisões de carga macro)
// Não é o calendário tradicional. Aqui o foco é:
//   - cada SEMANA é uma linha com sua carga + ritmo
//   - o mês inteiro tem um indicador de tendência
//   - dias específicos viram pontos densos (heatmap por carga)
// =====================================================================

function MesScreen({ mode, onSelectDia, onSelectSemana }) {
  // Construir 5 semanas do mês (mai 2026)
  const semanas = [
    { id: 's1', label: '4–10 mai', range: 'mai 04 → mai 10', h: 48, nivel: 'warn', dias: gerarDias('2026-05-04', BLOCOS_PARA_MES_S1) },
    { id: 's2', label: '11–17 mai', range: 'mai 11 → mai 17', h: 36, nivel: 'ok', dias: gerarDias('2026-05-11', BLOCOS_PARA_MES_S2) },
    { id: 's3', label: '18–24 mai', range: 'mai 18 → mai 24', h: 64, nivel: 'err', dias: gerarDias('2026-05-18', BLOCOS_PARA_MES_S3) },
    { id: 's4', label: '25–31 mai', range: 'mai 25 → mai 31', h: 32, nivel: 'ok', dias: gerarDias('2026-05-25', BLOCOS_PARA_MES_S4) },
  ];

  const totalH = semanas.reduce((s, w) => s + w.h, 0);
  const mediaH = Math.round(totalH / semanas.length);

  return (
    <main data-screen-label="Mês" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 32px',
    }}>
      {/* Page head */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 28,
      }}>
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 6 }}>maio · 2026</Eyebrow>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 'clamp(36px, 4vw, 44px)',
            color: 'var(--ink)', letterSpacing: '-0.02em',
            lineHeight: 1.05, margin: 0,
          }}>seu mês</h1>
          <p style={{
            font: '400 16px/1.4 var(--font-body)',
            color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 600,
          }}>
            {totalH}h totais · média {mediaH}h/sem · 1 semana acima do limite saudável
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ViewSwitchMini active="mes" />
          <MonthNav />
        </div>
      </div>

      {/* Resumo + Detalhe lado a lado */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 28,
        alignItems: 'flex-start',
      }}>
        <div>
          {/* Cabeçalho da grade */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px repeat(7, 1fr) 110px',
            gap: 6,
            paddingBottom: 8,
            borderBottom: '1px solid var(--line)',
            marginBottom: 4,
          }}>
            <div></div>
            {DOWS.map(d => (
              <div key={d} style={{
                font: '600 11px/1 var(--font-body)',
                color: 'var(--ink-3)',
                letterSpacing: '0.05em',
                textTransform: 'lowercase',
                textAlign: 'center',
              }}>{d}</div>
            ))}
            <div style={{
              font: '600 11px/1 var(--font-body)',
              color: 'var(--ink-3)',
              letterSpacing: '0.05em',
              textTransform: 'lowercase',
              textAlign: 'right',
              paddingRight: 4,
            }}>total</div>
          </div>

          {semanas.map(s => (
            <SemanaRow key={s.id} sem={s} onClick={() => onSelectSemana && onSelectSemana(s)} onClickDia={onSelectDia} />
          ))}

          {/* Linha de média */}
          <div style={{
            marginTop: 18,
            padding: '14px 16px',
            background: 'var(--bg-alt)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <Eyebrow color="var(--ink-3)">tendência do mês</Eyebrow>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 22,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}>{mediaH}h/sem</span>
            <span style={{
              font: '500 13px/1.3 var(--font-body)',
              color: 'var(--ink-2)',
              fontStyle: 'italic',
              flex: 1,
            }}>
              dentro do saudável na média, mas com um pico na 3ª semana — vale espaçar.
            </span>
          </div>
        </div>

        {/* Coluna de insights */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InsightCard
            tone="coral"
            eyebrow="atenção"
            title="semana 18–24"
            body="64h previstas · 4h acima do limite CFM. ainda dá pra ceder o turno de quarta sem perder o pagamento mensal."
            cta="ver opções de troca"
          />
          <InsightCard
            tone="sage"
            eyebrow="ótimo"
            title="semana 25–31"
            body="32h e três janelas de sono protegido. semana de fôlego."
          />
          <InsightCard
            tone="lavender"
            eyebrow="próxima decisão"
            title="3 plantões em aberto"
            body="o HBDF está chamando para 25, 26 e 30. você não precisa decidir hoje."
            cta="ver propostas"
          />
        </aside>
      </div>
    </main>
  );
}

// ---- Semana row ----
function SemanaRow({ sem, onClick, onClickDia }) {
  const tokens = {
    ok:   { bg: 'var(--sage-surface)',  ink: 'var(--sage-ink)',  marca: 'var(--sage)' },
    warn: { bg: 'var(--sand-surface)',  ink: '#B8884A',          marca: '#D9A85A' },
    err:  { bg: 'var(--coral-surface)', ink: 'var(--coral-ink)', marca: 'var(--coral)' },
  }[sem.nivel];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '120px repeat(7, 1fr) 110px',
      gap: 6,
      alignItems: 'stretch',
      padding: '14px 0',
      borderBottom: '1px solid var(--line)',
      cursor: 'pointer',
    }} onClick={onClick}>
      {/* Label da semana */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingLeft: 4,
      }}>
        <Eyebrow color="var(--ink-3)">semana</Eyebrow>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500, fontSize: 16,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
          marginTop: 2,
        }}>{sem.label}</span>
      </div>

      {/* 7 dias */}
      {sem.dias.map((d, i) => (
        <MesDiaCell key={i} dia={d} onClick={(e) => { e.stopPropagation(); onClickDia && onClickDia(d); }} />
      ))}

      {/* Total da semana */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        paddingRight: 4,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: tokens.marca }} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500, fontSize: 22,
          color: tokens.ink,
          letterSpacing: '-0.01em',
        }}>{sem.h}h</span>
      </div>
    </div>
  );
}

function MesDiaCell({ dia, onClick }) {
  const blocos = dia.blocos || [];
  if (!blocos.length && !dia.bloqueio) {
    return (
      <div onClick={onClick} style={{
        minHeight: 80,
        borderRadius: 10,
        background: 'var(--bg-alt)',
        opacity: 0.4,
        cursor: 'pointer',
      }}/>
    );
  }
  return (
    <div onClick={onClick} style={{
      minHeight: 80,
      borderRadius: 10,
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      padding: '6px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      cursor: 'pointer',
      transition: 'background 120ms',
    }}>
      <div style={{
        font: '600 11px/1 var(--font-body)',
        color: 'var(--ink-3)',
        marginBottom: 2,
      }}>{dia.dia}</div>
      {blocos.slice(0, 2).map((b, i) => (
        <div key={i} style={{
          height: 4,
          borderRadius: 2,
          background: `var(--${(HOSPITAIS[b.hosp] && HOSPITAIS[b.hosp].cor) || 'sand'})`,
        }}/>
      ))}
      {blocos.length > 2 && (
        <div style={{
          font: '500 10px/1 var(--font-body)',
          color: 'var(--ink-3)',
        }}>+{blocos.length - 2}</div>
      )}
      {blocos.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500, fontSize: 12,
          color: 'var(--ink-2)',
          letterSpacing: '-0.01em',
          marginTop: 'auto',
        }}>{dia.h}h</div>
      )}
      {dia.bloqueio && !blocos.length && (
        <div style={{
          font: '500 10px/1.3 var(--font-body)',
          color: 'var(--ink-3)',
          fontStyle: 'italic',
        }}>livre</div>
      )}
    </div>
  );
}

function InsightCard({ tone, eyebrow, title, body, cta }) {
  return (
    <div style={{
      background: `var(--${tone}-surface)`,
      borderRadius: 14,
      padding: '18px 20px',
    }}>
      <Eyebrow color={`var(--${tone}-ink)`} style={{ opacity: 0.85 }}>{eyebrow}</Eyebrow>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 18, color: `var(--${tone}-ink)`,
        margin: '6px 0 8px',
        letterSpacing: '-0.01em',
      }}>{title}</h3>
      <p style={{
        font: '400 13px/1.45 var(--font-body)',
        color: `var(--${tone}-ink)`,
        margin: 0,
        opacity: 0.9,
      }}>{body}</p>
      {cta && (
        <button style={{
          marginTop: 12,
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: 'none',
          background: `var(--${tone}-ink)`,
          color: 'var(--bg)',
          cursor: 'pointer',
        }}>{cta} →</button>
      )}
    </div>
  );
}

function ViewSwitchMini({ active }) {
  const tabs = [
    { k: 'sem', label: 'semana' },
    { k: 'mes', label: 'mês' },
    { k: 'lis', label: 'lista' },
  ];
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-alt)',
      border: '1px solid var(--line)',
      borderRadius: 999,
      padding: 3,
      gap: 2,
    }}>
      {tabs.map(t => (
        <button key={t.k} style={{
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: 'none',
          background: t.k === active ? 'var(--bg)' : 'transparent',
          color: t.k === active ? 'var(--ink)' : 'var(--ink-2)',
          boxShadow: t.k === active ? 'var(--shadow-sm)' : 'none',
          cursor: 'pointer',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function MonthNav() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button style={navBtnStyle}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 500, fontSize: 16,
        color: 'var(--ink)',
        padding: '0 14px',
        letterSpacing: '-0.01em',
      }}>maio · 2026</span>
      <button style={navBtnStyle}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
    </div>
  );
}

const navBtnStyle = {
  width: 32, height: 32,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  borderRadius: 999,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-2)',
};

// ---- gerador de dias para o mês (sintético) ----
const BLOCOS_PARA_MES_S1 = [
  { dia: 4, hosp: 'HSL', h: 6 },
  { dia: 4, hosp: 'HCB', h: 12 },
  { dia: 6, hosp: 'HBDF', h: 6 },
  { dia: 8, hosp: 'HSL', h: 12 },
  { dia: 10, hosp: 'HCB', h: 12 },
];
const BLOCOS_PARA_MES_S2 = [
  { dia: 11, hosp: 'HBDF', h: 12 },
  { dia: 13, hosp: 'HSL', h: 12 },
  { dia: 16, hosp: 'HCB', h: 12 },
];
const BLOCOS_PARA_MES_S3 = [
  { dia: 18, hosp: 'HBDF', h: 12 },
  { dia: 19, hosp: 'HSL', h: 12 },
  { dia: 21, hosp: 'HCB', h: 12 },
  { dia: 22, hosp: 'HSL', h: 12 },
  { dia: 23, hosp: 'HBDF', h: 8 },
  { dia: 24, hosp: 'HCB', h: 8 },
];
const BLOCOS_PARA_MES_S4 = [
  { dia: 26, hosp: 'HBDF', h: 8 },
  { dia: 28, hosp: 'HSL', h: 12 },
  { dia: 30, hosp: 'HCB', h: 12 },
];

function gerarDias(inicioISO, blocos) {
  const inicio = new Date(inicioISO + 'T12:00:00');
  const safeBlocos = Array.isArray(blocos) ? blocos : [];
  return [...Array(7)].map((_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const dia = d.getDate();
    const blocosDoDia = safeBlocos.filter(b => b.dia === dia);
    const h = blocosDoDia.reduce((s, b) => s + b.h, 0);
    return {
      dia,
      iso: d.toISOString().slice(0, 10),
      blocos: blocosDoDia,
      h,
      bloqueio: blocosDoDia.length === 0,
    };
  });
}

Object.assign(window, { MesScreen });
