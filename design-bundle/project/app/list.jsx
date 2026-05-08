// =====================================================================
// list.jsx — Visão Lista
// Foco: o que precisa de DECISÃO, não apenas o que está agendado.
// Estrutura:
//   1. precisa de você agora (urgente, com prazo)
//   2. propostas em aberto (chamadas de hospital)
//   3. próximos plantões (cronológico, simples)
//   4. histórico recente (collapsed)
// =====================================================================

function ListaScreen({ mode, onSelectBloco }) {
  const pendentes = [
    {
      id: 'p1', tipo: 'troca_recebida',
      eyebrow: 'troca recebida',
      titulo: 'dr. paulo quer trocar com você',
      corpo: 'plantão de quarta 14/mai (HBDF, 12h) ↔ sexta 16/mai (HSL, 12h)',
      prazo: 'responder até hoje 18h',
      urgente: true,
      cor: 'lavender',
    },
    {
      id: 'p2', tipo: 'conflito',
      eyebrow: 'conflito',
      titulo: 'dois plantões simultâneos · sex 8 mai',
      corpo: 'HBDF 19h e HSL 19h foram aceitos no mesmo horário. um deles precisa ser ajustado.',
      prazo: 'resolver antes do início',
      urgente: true,
      cor: 'coral',
    },
    {
      id: 'p3', tipo: 'limite',
      eyebrow: 'alerta CFM',
      titulo: 'semana 18–24 com 64h previstas',
      corpo: '4h acima do limite saudável recomendado. dá pra ceder o turno de qua sem perder o pagamento.',
      prazo: 'até segunda 11/mai',
      urgente: false,
      cor: 'coral',
    },
  ];

  const propostas = [
    {
      id: 'pr1', hosp: 'HBDF', data: '25 mai', diaSem: 'segunda',
      hora: '07–19h', valor: 'R$ 2.400', motivo: 'cobrir férias da equipe',
    },
    {
      id: 'pr2', hosp: 'HBDF', data: '26 mai', diaSem: 'terça',
      hora: '19–07h', valor: 'R$ 2.800', motivo: 'noturno · escala em aberto',
    },
    {
      id: 'pr3', hosp: 'HSL', data: '30 mai', diaSem: 'sábado',
      hora: '07–19h', valor: 'R$ 2.200', motivo: 'reforço de fim de semana',
    },
  ];

  const proximos = [
    { id: 'n1', hosp: 'HSL', data: '6 mai', diaSem: 'quarta', hora: '07–19h', daqui: 'em 2 dias' },
    { id: 'n2', hosp: 'HCB', data: '8 mai', diaSem: 'sexta', hora: '07–19h', daqui: 'em 4 dias' },
    { id: 'n3', hosp: 'HBDF', data: '8 mai', diaSem: 'sexta', hora: '19–07h', daqui: 'em 4 dias', conflito: true },
    { id: 'n4', hosp: 'HSL', data: '10 mai', diaSem: 'domingo', hora: '07–19h', daqui: 'em 6 dias' },
  ];

  const historico = [
    { id: 'h1', hosp: 'HCB', data: '2 mai', hora: '07–19h', status: 'concluído' },
    { id: 'h2', hosp: 'HSL', data: '1 mai', hora: '19–07h', status: 'concluído' },
    { id: 'h3', hosp: 'HBDF', data: '28 abr', hora: '07–19h', status: 'concluído', nota: 'pagamento confirmado' },
  ];

  return (
    <main data-screen-label="Lista" style={{
      maxWidth: 980, margin: '0 auto', padding: '24px 32px 32px',
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
          }}>o que precisa de você</h1>
          <p style={{
            font: '400 16px/1.4 var(--font-body)',
            color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 600,
          }}>
            {pendentes.filter(p => p.urgente).length} decisões pendentes · {propostas.length} propostas em aberto · {proximos.length} próximos plantões
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ViewSwitchMini active="lis" />
        </div>
      </div>

      {/* SEÇÃO 1: precisa de decisão */}
      <Secao
        eyebrow="decida hoje"
        titulo="precisa de você"
        subtitulo="ações com prazo"
      >
        {pendentes.map(p => (
          <PendenteCard key={p.id} item={p} />
        ))}
      </Secao>

      {/* SEÇÃO 2: propostas */}
      <Secao
        eyebrow="propostas"
        titulo="hospitais querendo te chamar"
        subtitulo="você não precisa decidir agora"
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {propostas.map(p => (
            <PropostaCard key={p.id} item={p} />
          ))}
        </div>
      </Secao>

      {/* SEÇÃO 3: próximos */}
      <Secao
        eyebrow="próximos"
        titulo="agendados"
        subtitulo="ordem cronológica"
      >
        <div style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {proximos.map((p, i) => (
            <ProximoLine
              key={p.id} item={p}
              last={i === proximos.length - 1}
              onClick={() => onSelectBloco && onSelectBloco(p)}
            />
          ))}
        </div>
      </Secao>

      {/* SEÇÃO 4: histórico (recolhido visualmente) */}
      <Secao
        eyebrow="histórico"
        titulo="últimos 30 dias"
        subtitulo="só pra consulta"
        muted
      >
        <details style={{
          background: 'var(--bg-alt)',
          borderRadius: 12,
          padding: '14px 18px',
        }}>
          <summary style={{
            font: '600 13px/1 var(--font-body)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
            listStyle: 'none',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>{historico.length} plantões concluídos · R$ 7.200 confirmado</span>
            <span style={{ color: 'var(--ink-3)' }}>↓ ver detalhes</span>
          </summary>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historico.map(h => (
              <div key={h.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                font: '400 13px/1.3 var(--font-body)', color: 'var(--ink-2)',
                paddingBottom: 8, borderBottom: '1px solid var(--line)',
              }}>
                <span>{h.data} · {HOSPITAIS[h.hosp].nome} · {h.hora}</span>
                <span style={{ color: 'var(--sage-ink)', font: '600 12px/1 var(--font-body)' }}>{h.status}</span>
              </div>
            ))}
          </div>
        </details>
      </Secao>
    </main>
  );
}

// ---- Section ----
function Secao({ eyebrow, titulo, subtitulo, children, muted }) {
  return (
    <section style={{ marginBottom: 36, opacity: muted ? 0.85 : 1 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <Eyebrow style={{ width: 90, flexShrink: 0 }}>{eyebrow}</Eyebrow>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22,
            color: 'var(--ink)', letterSpacing: '-0.015em',
            margin: 0, lineHeight: 1.1,
          }}>{titulo}</h2>
          {subtitulo && (
            <p style={{
              font: '400 13px/1.3 var(--font-body)',
              color: 'var(--ink-3)',
              margin: '4px 0 0', fontStyle: 'italic',
            }}>{subtitulo}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

// ---- Pendente card (urgente) ----
function PendenteCard({ item }) {
  return (
    <div style={{
      background: 'var(--bg)',
      borderLeft: `4px solid var(--${item.cor})`,
      border: '1px solid var(--line)',
      borderLeftWidth: 4,
      borderRadius: 14,
      padding: '18px 22px',
      marginBottom: 12,
      boxShadow: item.urgente ? `0 0 0 0 var(--${item.cor}-surface)` : 'var(--shadow-sm)',
      animation: item.urgente ? 'colo-pulse-conflict 2.4s ease-in-out infinite' : 'none',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 18,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Eyebrow color={`var(--${item.cor}-ink)`}>{item.eyebrow}</Eyebrow>
          <span style={{
            font: '500 11px/1 var(--font-body)',
            color: item.urgente ? 'var(--coral-ink)' : 'var(--ink-3)',
            fontStyle: 'italic',
          }}>· {item.prazo}</span>
        </div>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18,
          color: 'var(--ink)', letterSpacing: '-0.01em',
          margin: '0 0 6px',
        }}>{item.titulo}</h3>
        <p style={{
          font: '400 14px/1.4 var(--font-body)',
          color: 'var(--ink-2)', margin: 0,
        }}>{item.corpo}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <button style={{
          font: '600 13px/1 var(--font-body)',
          padding: '10px 18px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--ink)',
          color: 'var(--bg)',
          cursor: 'pointer',
        }}>resolver →</button>
        <button style={{
          font: '500 12px/1 var(--font-body)',
          padding: '8px 18px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}>depois</button>
      </div>
    </div>
  );
}

// ---- Proposta ----
function PropostaCard({ item }) {
  const hosp = HOSPITAIS[item.hosp];
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderTop: `4px solid var(--${hosp.cor})`,
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Eyebrow color={`var(--${hosp.cor}-ink)`}>{hosp.sigla}</Eyebrow>
          <span style={{ font: '600 13px/1 var(--font-body)', color: 'var(--sage-ink)' }}>{item.valor}</span>
        </div>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20,
          color: 'var(--ink)', letterSpacing: '-0.01em',
          margin: '6px 0 4px',
        }}>{item.data} · {item.diaSem}</h3>
        <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>{item.hora}</div>
      </div>

      <p style={{
        font: '400 12px/1.4 var(--font-body)',
        color: 'var(--ink-3)',
        fontStyle: 'italic',
        margin: 0,
        paddingTop: 10,
        borderTop: '1px dashed var(--line-2)',
      }}>{item.motivo}</p>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button style={{
          flex: 1,
          font: '600 12px/1 var(--font-body)',
          padding: '10px 14px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--ink)',
          color: 'var(--bg)',
          cursor: 'pointer',
        }}>aceitar</button>
        <button style={{
          font: '500 12px/1 var(--font-body)',
          padding: '10px 14px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}>recusar</button>
      </div>
    </div>
  );
}

// ---- Proximo (linha simples) ----
function ProximoLine({ item, last, onClick }) {
  const hosp = HOSPITAIS[item.hosp];
  return (
    <div onClick={onClick} style={{
      display: 'grid',
      gridTemplateColumns: '60px 80px 1fr 100px 120px 24px',
      alignItems: 'center',
      gap: 14,
      padding: '14px 20px',
      borderBottom: last ? 'none' : '1px solid var(--line)',
      cursor: 'pointer',
      transition: 'background 120ms',
      background: item.conflito ? 'var(--coral-surface)' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: `var(--${hosp.cor})`,
        }}/>
        <Eyebrow>{hosp.sigla}</Eyebrow>
      </div>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 500, fontSize: 18,
        color: 'var(--ink)',
        letterSpacing: '-0.01em',
      }}>{item.data}</span>
      <div>
        <div style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>{hosp.nome}</div>
        <div style={{ font: '400 12px/1.2 var(--font-body)', color: 'var(--ink-3)' }}>{item.diaSem}</div>
      </div>
      <span style={{ font: '500 13px/1 var(--font-body)', color: 'var(--ink-2)' }}>{item.hora}</span>
      <span style={{
        font: '500 12px/1 var(--font-body)',
        color: item.conflito ? 'var(--coral-ink)' : 'var(--ink-3)',
        fontStyle: 'italic',
      }}>
        {item.conflito ? '⚠ conflito' : item.daqui}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
    </div>
  );
}

Object.assign(window, { ListaScreen });
