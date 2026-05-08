// =====================================================================
// hospital_detalhe.jsx — Detalhe de um hospital (clicar num card)
//   Hero com cor da família · 4 zonas:
//     1. Resumo (próximo plantão · contrato · valor)
//     2. Histórico (últimos 30 dias · hora real vs. paga)
//     3. Pessoas (coordenação, contatos)
//     4. Anotações (texto livre que persiste — papelaria)
// =====================================================================

const HOSP_DETALHE_DATA = {
  HBDF: {
    eyebrow: 'hospital · setor público',
    proximoPlantao: { dia: 'sex 8 mai', hora: '19h → 07h', setor: 'UTI Pediátrica' },
    valorPlantao: 2200, formaPag: 'cooperativa · 5 dias após mês fechado',
    horasMes: { real: 96, paga: 96, delta: 0 },
    cadeiaMaxima: '24h+',
    contatos: [
      { nome: 'Dra. Sílvia Tavares', papel: 'coordenadora pediatria', tel: '(61) 9...' },
      { nome: 'Carlos · enfermeiro chefe', papel: 'noite UTI', tel: '(61) 9...' },
    ],
    anotacoes: 'estacionamento P3 (atrás) tem mais vaga depois das 19h.\nuti tem 12 leitos, posso fechar plantão direto com a Dra. Sílvia.\nrouparia abre 18h45.',
    historico: [
      { dia: 4, h: 12, ok: true },
      { dia: 6, h: 6,  ok: true },
      { dia: 8, h: 12, ok: true },
      { dia: 11, h: 12, ok: true },
      { dia: 15, h: 12, ok: true },
      { dia: 18, h: 6,  ok: false, nota: 'saí 30min depois — passagem demorou' },
      { dia: 22, h: 12, ok: true },
      { dia: 25, h: 12, ok: true },
    ],
  },
};

function HospitalDetalheScreen({ id = 'HBDF', mode, onBack }) {
  const meta = HOSPITAIS[id];
  const det = HOSP_DETALHE_DATA[id] || HOSP_DETALHE_DATA.HBDF;
  const cor = meta?.cor || 'lavender';

  return (
    <main data-screen-label={`Hospital · ${id}`} style={{
      animation: 'colo-page-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      {/* Hero com a cor da família — full-bleed */}
      <header style={{
        background: `var(--${cor}-surface)`,
        borderBottom: `1px solid var(--${cor})`,
        padding: '32px 0 28px',
      }}>
        <div style={{ maxWidth: 1480, margin: '0 auto', padding: '0 32px' }}>
          <RoleBanner mode={mode}/>
          <button onClick={onBack} style={{
            font: '500 13px/1 var(--font-body)', color: 'var(--ink-2)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, marginBottom: 18, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>
            voltar pra hospitais
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: 'var(--bg)', border: `2px solid var(--${cor})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: '700 22px/1 var(--font-body)', color: `var(--${cor}-ink)`,
            }}>{meta?.abrev || id}</div>
            <div>
              <Eyebrow style={{ display: 'block', marginBottom: 4, color: `var(--${cor}-ink)` }}>{det.eyebrow}</Eyebrow>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(32px, 4vw, 44px)', color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
                {meta?.nome || id}
              </h1>
              <p style={{ font: '400 15px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0' }}>
                <Hand color={`var(--${cor}-ink)`} size={18}>seu hospital · {(meta?.setores || []).join(' · ')}</Hand>
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button style={btnAux}>editar</button>
              <button style={{ ...btnAux, background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}>+ plantão aqui</button>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '32px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Próximo plantão */}
          <Section eyebrow="próximo plantão">
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 20, borderRadius: 14, background: `var(--${cor}-surface)`, borderLeft: `4px solid var(--${cor})` }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{det.proximoPlantao.dia}</div>
                <div style={{ font: '500 14px/1.4 var(--font-body)', color: `var(--${cor}-ink)`, marginTop: 2 }}>{det.proximoPlantao.hora} · {det.proximoPlantao.setor}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button style={btnGhost2}>passar pra outro</button>
                <button style={btnGhost2}>abrir detalhe →</button>
              </div>
            </div>
          </Section>

          {/* Histórico — barra de mês */}
          <Section eyebrow="últimos 30 dias · hora real vs. paga">
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 18 }}>
                <div>
                  <Eyebrow style={{ display: 'block', marginBottom: 2 }}>horas pagas</Eyebrow>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{det.horasMes.paga}<span style={{ fontSize: 16, color: 'var(--ink-3)' }}>h</span></div>
                </div>
                <div>
                  <Eyebrow style={{ display: 'block', marginBottom: 2 }}>horas reais</Eyebrow>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 24, color: 'var(--ink-2)', letterSpacing: '-0.02em' }}>{det.horasMes.real + 0.5}h</div>
                </div>
                <div style={{ marginLeft: 'auto', font: '500 13px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>
                  {det.horasMes.delta === 0 ? <Hand color="var(--sage-ink)" size={14}>quase certo</Hand> : <Hand color="var(--coral-ink)" size={14}>{det.horasMes.delta}h a mais</Hand>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, height: 56, alignItems: 'flex-end' }}>
                {Array.from({ length: 30 }, (_, i) => {
                  const dia = i + 1;
                  const ent = det.historico.find(h => h.dia === dia);
                  return (
                    <div key={i} title={ent ? `dia ${dia} · ${ent.h}h` : ''} style={{
                      flex: 1, height: ent ? `${(ent.h / 12) * 100}%` : 4,
                      background: ent ? (ent.ok ? `var(--${cor})` : 'var(--coral)') : 'var(--bg-alt)',
                      borderRadius: 3,
                      opacity: ent ? 0.85 : 1,
                    }}/>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 11px/1 var(--font-body)', color: 'var(--ink-3)', marginTop: 8 }}>
                <span>1 abr</span><span>15 abr</span><span>30 abr</span>
              </div>
            </div>
          </Section>

          {/* Anotações — papelaria */}
          <Section eyebrow="anotações · só você vê">
            <div style={{
              background: `var(--bg)`,
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: '20px 24px',
              fontFamily: 'var(--font-handwritten)',
              fontSize: 17,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
              whiteSpace: 'pre-wrap',
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(58,46,42,0.06) 27px, rgba(58,46,42,0.06) 28px)',
              minHeight: 200,
            }}>
              {det.anotacoes}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, font: '400 11px/1 var(--font-body)', color: 'var(--ink-3)' }}>
              <span>editado há 2 dias</span>
              <button style={{ ...btnAux, padding: '6px 12px' }}>editar</button>
            </div>
          </Section>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 88 }}>
          <Card eyebrow="contrato" tone={cor}>
            <KV2 k="valor por plantão" v={`R$ ${det.valorPlantao.toLocaleString('pt-BR')}`}/>
            <KV2 k="forma de pagamento" v={det.formaPag}/>
            <KV2 k="cadeia máxima" v={det.cadeiaMaxima}/>
          </Card>
          <Card eyebrow="pessoas">
            {det.contatos.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--bg-alt)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 12px/1 var(--font-body)', color: 'var(--ink-2)' }}>{c.nome.split(' ').slice(0,2).map(p=>p[0]).join('')}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>{c.nome}</div>
                  <div style={{ font: '400 11px/1.3 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>{c.papel} · {c.tel}</div>
                </div>
              </div>
            ))}
          </Card>
        </aside>
      </div>
    </main>
  );
}

function Section({ eyebrow, children }) {
  return (
    <section>
      <Eyebrow style={{ display: 'block', marginBottom: 10 }}>{eyebrow}</Eyebrow>
      {children}
    </section>
  );
}

function Card({ eyebrow, tone, children }) {
  return (
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--line)',
      borderRadius: 14, padding: '18px 20px',
      borderTop: tone ? `3px solid var(--${tone})` : '1px solid var(--line)',
    }}>
      <Eyebrow style={{ display: 'block', marginBottom: 10 }}>{eyebrow}</Eyebrow>
      {children}
    </div>
  );
}

function KV2({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
      <span style={{ font: '500 12px/1.3 var(--font-body)', color: 'var(--ink-3)' }}>{k}</span>
      <span style={{ font: '600 13px/1.3 var(--font-body)', color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
    </div>
  );
}

const btnAux = {
  font: '600 13px/1 var(--font-body)', padding: '10px 16px',
  borderRadius: 999, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--ink-2)', cursor: 'pointer',
};
const btnGhost2 = {
  font: '500 12px/1 var(--font-body)', padding: '8px 14px',
  borderRadius: 999, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--ink-2)', cursor: 'pointer',
};

Object.assign(window, { HospitalDetalheScreen });
