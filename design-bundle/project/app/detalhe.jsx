// =====================================================================
// detalhe.jsx — Tela de Detalhe do Plantão (full-page, não drawer)
// O Drawer é pra ações rápidas. Aqui é a tela cheia de contexto:
//   - cabeçalho com hospital + data/hora grandes
//   - timeline do plantão (entrada, procedimentos, saída)
//   - dados financeiros
//   - histórico de mudanças
//   - ações no rodapé (sticky)
// =====================================================================

function DetalheScreen({ blocoId, mode, onBack, onSelectBloco }) {
  // Dados sintéticos para um plantão específico
  const b = {
    id: blocoId || 'b-detalhe',
    hospitalId: 'HSL',
    diaSemana: 'sexta',
    diaIso: '2026-05-08',
    diaLabel: '8 de maio',
    horaInicio: 19,
    horaFim: 7,
    duracao: 12,
    tipo: 'plantao',
    setor: 'pronto-socorro pediátrico',
    valor: 2400,
    status: 'confirmado',
    daqui: 'em 3 dias',
    coplantonista: { nome: 'Dr. Paulo Mendes', avatar: 'PM' },
    procedimentos: [
      { hora: '19:00', tipo: 'entrada', label: 'check-in · troca de turno' },
      { hora: '19:30', tipo: 'reuniao', label: 'passagem de plantão · 4 pacientes em obs' },
      { hora: '23:00', tipo: 'pausa', label: 'janela de descanso prevista (1h)' },
      { hora: '07:00', tipo: 'saida', label: 'check-out · entrega à equipe da manhã' },
    ],
    deslocamento: { de: 'casa', para: 'HSL', tempo: 35, antes: true },
    historico: [
      { data: '15 abr', evento: 'plantão criado pelo HSL', autor: 'sistema' },
      { data: '17 abr', evento: 'aceite confirmado', autor: 'você' },
      { data: '02 mai', evento: 'co-plantonista atribuído (Dr. Paulo)', autor: 'HSL' },
    ],
  };

  const hosp = HOSPITAIS[b.hospitalId];
  const valorBR = b.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <main data-screen-label="Detalhe · plantão" style={{
      maxWidth: 1280, margin: '0 auto', padding: '24px 32px 120px',
    }}>
      {/* Voltar */}
      <button onClick={onBack} style={{
        font: '500 13px/1 var(--font-body)',
        color: 'var(--ink-2)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 0',
        marginBottom: 18,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        voltar para a semana
      </button>

      {/* CABEÇALHO grande */}
      <header style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'flex-end',
        gap: 32,
        paddingBottom: 24,
        borderBottom: `4px solid var(--${hosp.cor})`,
        marginBottom: 32,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 999,
              background: `var(--${hosp.cor})`,
            }}/>
            <Eyebrow color={`var(--${hosp.cor}-ink)`}>{hosp.sigla} · {hosp.nome}</Eyebrow>
            <span style={{
              font: '500 11px/1 var(--font-body)',
              color: 'var(--sage-ink)',
              background: 'var(--sage-surface)',
              padding: '4px 10px',
              borderRadius: 999,
            }}>● {b.status}</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 'clamp(44px, 5vw, 60px)',
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1, margin: 0,
          }}>{b.diaSemana}, {b.diaLabel}</h1>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 18,
            marginTop: 14,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500, fontSize: 28,
              color: 'var(--ink-2)',
              letterSpacing: '-0.01em',
            }}>{fmtRange(b.horaInicio, b.duracao)}</span>
            <span style={{
              font: '400 16px/1.4 var(--font-body)',
              color: 'var(--ink-3)',
              fontStyle: 'italic',
            }}>· {b.duracao}h · {b.setor}</span>
          </div>
        </div>

        <div style={{
          textAlign: 'right',
        }}>
          <Eyebrow color="var(--ink-3)">remuneração</Eyebrow>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500, fontSize: 36,
            color: 'var(--sage-ink)',
            letterSpacing: '-0.02em',
            marginTop: 4,
          }}>{valorBR}</div>
          <div style={{
            font: '400 12px/1.3 var(--font-body)',
            color: 'var(--ink-3)',
            fontStyle: 'italic',
          }}>R$ {Math.round(b.valor / b.duracao)}/hora</div>
        </div>
      </header>

      {/* CORPO em 2 colunas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        gap: 36,
        alignItems: 'flex-start',
      }}>
        {/* coluna esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* TIMELINE do plantão */}
          <DetalheBloco titulo="ritmo do plantão" eyebrow="o que acontece">
            <PlantaoTimeline b={b} />
          </DetalheBloco>

          {/* DESLOCAMENTO */}
          <DetalheBloco titulo="deslocamento" eyebrow="antes do plantão">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 18,
              padding: '16px 20px',
              background: 'var(--blue-surface)',
              borderRadius: 14,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 15px/1.2 var(--font-body)', color: 'var(--blue-text)' }}>
                  {b.deslocamento.de} → {b.deslocamento.para}
                </div>
                <div style={{ font: '400 13px/1.3 var(--font-body)', color: 'var(--blue-text)', opacity: 0.85, marginTop: 2 }}>
                  {b.deslocamento.tempo}min · sair às {pad(b.horaInicio - 1)}:25 para chegar com folga
                </div>
              </div>
            </div>
          </DetalheBloco>

          {/* HISTÓRICO */}
          <DetalheBloco titulo="histórico" eyebrow="mudanças neste plantão" muted>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {b.historico.map((h, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 100px',
                  gap: 14,
                  alignItems: 'baseline',
                  padding: '10px 0',
                  borderBottom: i < b.historico.length - 1 ? '1px dashed var(--line)' : 'none',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500, fontSize: 14,
                    color: 'var(--ink-2)',
                    letterSpacing: '-0.01em',
                  }}>{h.data}</span>
                  <span style={{ font: '400 14px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>{h.evento}</span>
                  <span style={{
                    font: '500 11px/1 var(--font-body)',
                    color: 'var(--ink-3)',
                    textAlign: 'right',
                    fontStyle: 'italic',
                  }}>{h.autor}</span>
                </div>
              ))}
            </div>
          </DetalheBloco>
        </div>

        {/* coluna direita */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* CO-PLANTONISTA */}
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Eyebrow color="var(--ink-3)">com você no plantão</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 999,
                background: `var(--${hosp.cor}-surface)`,
                color: `var(--${hosp.cor}-ink)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 500, fontSize: 16,
                letterSpacing: '-0.01em',
              }}>{b.coplantonista.avatar}</div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500, fontSize: 18,
                  color: 'var(--ink)', letterSpacing: '-0.01em',
                }}>{b.coplantonista.nome}</div>
                <div style={{ font: '400 13px/1.3 var(--font-body)', color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  pediatra · 8 plantões juntos
                </div>
              </div>
            </div>
            <button style={{
              marginTop: 14,
              width: '100%',
              font: '600 13px/1 var(--font-body)',
              padding: '10px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}>enviar mensagem</button>
          </div>

          {/* INFO HOSPITAL */}
          <div style={{
            background: 'var(--bg-alt)',
            borderRadius: 14,
            padding: '18px 20px',
          }}>
            <Eyebrow color="var(--ink-3)">o hospital</Eyebrow>
            <Hand color={`var(--${hosp.cor}-ink)`} size={22} style={{ display: 'block', marginTop: 6 }}>
              {hosp.nome}
            </Hand>
            <div style={{
              marginTop: 12,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              font: '400 12px/1.3 var(--font-body)',
              color: 'var(--ink-2)',
            }}>
              <KV k="endereço" v="SHIS QI 5, Brasília" />
              <KV k="setor" v="PS pediátrico" />
              <KV k="seu CRM" v="ativo" />
              <KV k="auto-faturamento" v="sim" />
            </div>
          </div>

          {/* AÇÕES SECUNDÁRIAS */}
          <div style={{
            background: 'var(--bg)',
            border: '1px dashed var(--line-2)',
            borderRadius: 14,
            padding: '16px 20px',
          }}>
            <Eyebrow color="var(--ink-3)">se precisar</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {[
                { ico: '↔', label: 'propor troca' },
                { ico: '→', label: 'ceder a alguém' },
                { ico: '!', label: 'reportar problema' },
                { ico: '×', label: 'cancelar (até 48h antes)' },
              ].map(a => (
                <button key={a.label} style={{
                  font: '500 13px/1 var(--font-body)',
                  padding: '10px 0',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                }}>
                  <span style={{ width: 18, color: 'var(--ink-3)' }}>{a.ico}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* RODAPÉ STICKY com ação principal */}
      <footer style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'var(--bg)',
        borderTop: '1px solid var(--line)',
        padding: '14px 32px',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
        }}>
          <div>
            <div style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>
              tudo confirmado para {b.diaSemana}
            </div>
            <div style={{ font: '400 12px/1.2 var(--font-body)', color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 2 }}>
              {b.daqui} · você receberá lembrete 4h antes
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{
              font: '500 13px/1 var(--font-body)',
              padding: '12px 22px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}>adicionar ao calendário</button>
            <button style={{
              font: '600 13px/1 var(--font-body)',
              padding: '12px 24px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}>ver no mapa →</button>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ---- DetalheBloco (section wrapper) ----
function DetalheBloco({ titulo, eyebrow, children, muted }) {
  return (
    <section style={{ opacity: muted ? 0.85 : 1 }}>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 4 }}>{eyebrow}</Eyebrow>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22,
          color: 'var(--ink)', letterSpacing: '-0.015em',
          margin: 0, lineHeight: 1.1,
        }}>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

// ---- Timeline do plantão ----
function PlantaoTimeline({ b }) {
  const tipoTokens = {
    entrada:    { dot: 'var(--sage)', ink: 'var(--sage-ink)', label: 'entrada' },
    saida:      { dot: 'var(--sage)', ink: 'var(--sage-ink)', label: 'saída' },
    reuniao:    { dot: 'var(--lavender)', ink: 'var(--lavender-ink)', label: 'reunião' },
    pausa:      { dot: 'var(--sand)', ink: '#B8884A', label: 'pausa' },
    procedimento: { dot: 'var(--coral)', ink: 'var(--coral-ink)', label: 'procedimento' },
  };

  return (
    <div style={{ position: 'relative', paddingLeft: 30 }}>
      {/* linha vertical */}
      <div style={{
        position: 'absolute',
        top: 8, bottom: 8,
        left: 11,
        width: 2,
        background: 'var(--line)',
      }}/>

      {b.procedimentos.map((p, i) => {
        const t = tipoTokens[p.tipo] || tipoTokens.procedimento;
        return (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr',
            gap: 18,
            alignItems: 'flex-start',
            paddingBottom: 18,
            position: 'relative',
          }}>
            {/* dot */}
            <span style={{
              position: 'absolute',
              left: -25,
              top: 4,
              width: 12, height: 12,
              borderRadius: 999,
              background: 'var(--bg)',
              border: `3px solid ${t.dot}`,
            }}/>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500, fontSize: 18,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}>{p.hora}</span>
            <div>
              <Eyebrow color={t.ink}>{t.label}</Eyebrow>
              <div style={{
                font: '400 14px/1.4 var(--font-body)',
                color: 'var(--ink-2)',
                marginTop: 4,
              }}>{p.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div>
      <div style={{ font: '600 10px/1 var(--font-body)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{k}</div>
      <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>{v}</div>
    </div>
  );
}

function pad(n) { return String(((n % 24) + 24) % 24).padStart(2, '0'); }

Object.assign(window, { DetalheScreen });
