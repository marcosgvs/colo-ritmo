// =====================================================================
// trocas.jsx — Fluxo de Solicitar Troca
// 4 passos visíveis simultaneamente como uma "trilha":
//   1. qual plantão  →  2. motivo  →  3. quem topa  →  4. confirmação
// O step ativo é maior; os outros ficam compactos mas legíveis (não escondidos).
// Isso resolve a fricção do "não sei o que vem a seguir".
// =====================================================================

function TrocasScreen({ mode, onClose }) {
  const [step, setStep] = React.useState(1);
  const [bloco, setBloco] = React.useState(null);
  const [motivo, setMotivo] = React.useState('');
  const [motivoTipo, setMotivoTipo] = React.useState(null);
  const [colega, setColega] = React.useState(null);

  const blocosPlantao = ESTADOS.cheia.filter(b => b.tipo === 'plantao' && !b.viaTroca);

  return (
    <main data-screen-label="Solicitar troca" style={{
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
          <Eyebrow style={{ display: 'block', marginBottom: 6 }}>fluxo · troca de plantão</Eyebrow>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 'clamp(36px, 4vw, 44px)',
            color: 'var(--ink)', letterSpacing: '-0.02em',
            lineHeight: 1.05, margin: 0,
          }}>
            pedir uma troca
          </h1>
          <p style={{
            font: '400 16px/1.4 var(--font-body)',
            color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 600,
          }}>
            quatro passos. nada vai pro coordenador sem você confirmar no fim.
          </p>
        </div>

        <StepDots step={step} total={4} />
      </div>

      {/* Trilha de passos — todos visíveis, ativo expandido */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 16,
        maxWidth: 880,
        margin: '0 auto',
      }}>
        <Step n={1} active={step === 1} done={step > 1} onClick={() => setStep(1)}
          title="qual plantão você quer trocar?"
          summary={bloco ? `${HOSPITAIS[bloco.hospitalId].abrev} · ${fmtDate(bloco.data)} · ${fmtRange(bloco.horaInicio, bloco.duracao)}` : null}>
          <BlocoPicker blocos={blocosPlantao} value={bloco} onChange={(b) => { setBloco(b); setStep(2); }} />
        </Step>

        <Step n={2} active={step === 2} done={step > 2 && motivoTipo} onClick={() => bloco && setStep(2)} disabled={!bloco}
          title="o que está acontecendo?"
          summary={motivoTipo ? motivoLabel(motivoTipo) : null}>
          <MotivoPicker
            tipo={motivoTipo}
            texto={motivo}
            onTipo={setMotivoTipo}
            onTexto={setMotivo}
            onContinue={() => motivoTipo && setStep(3)}
          />
        </Step>

        <Step n={3} active={step === 3} done={step > 3 && colega} onClick={() => motivoTipo && setStep(3)} disabled={!motivoTipo}
          title="quem topa esse plantão?"
          summary={colega ? colega.nome.split(' ').slice(0,2).join(' ') : null}>
          <ColegaPicker bloco={bloco} value={colega} onChange={(c) => { setColega(c); setStep(4); }} />
        </Step>

        <Step n={4} active={step === 4} onClick={() => colega && setStep(4)} disabled={!colega}
          title="confirmar"
          summary={null}>
          <Confirmacao bloco={bloco} motivo={motivo} motivoTipo={motivoTipo} colega={colega} onSend={() => {
            // Em produção, dispatch...
          }} />
        </Step>
      </div>
    </main>
  );
}

// =========================
// Indicador de passo
// =========================
function StepDots({ step, total }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'var(--bg)',
    }}>
      {[...Array(total)].map((_, i) => {
        const n = i + 1;
        const isActive = n === step;
        const isDone = n < step;
        return (
          <React.Fragment key={n}>
            <span style={{
              width: isActive ? 22 : 8, height: 8,
              borderRadius: 999,
              background: isDone ? 'var(--sage)' : isActive ? 'var(--ink)' : 'var(--line-2)',
              transition: 'all 200ms cubic-bezier(.2,.7,.2,1)',
            }}/>
            {n < total && <span style={{
              width: 16, height: 1,
              background: 'var(--line)',
            }}/>}
          </React.Fragment>
        );
      })}
      <span style={{
        font: '600 12px/1 var(--font-body)',
        color: 'var(--ink-2)',
        marginLeft: 6,
      }}>passo {step} de {total}</span>
    </div>
  );
}

// =========================
// Step container — colapsado vs expandido
// =========================
function Step({ n, active, done, disabled, title, summary, children, onClick }) {
  const ringColor = active ? 'var(--lavender-ink)' : done ? 'var(--sage-ink)' : 'var(--line-2)';
  return (
    <section style={{
      background: 'var(--bg)',
      border: active ? `2px solid var(--lavender-ink)` : '1px solid var(--line)',
      borderRadius: 18,
      padding: active ? '24px 28px 28px' : '16px 22px',
      transition: 'all 220ms cubic-bezier(.2,.7,.2,1)',
      opacity: disabled ? 0.5 : 1,
      cursor: !active && !disabled ? 'pointer' : 'default',
      boxShadow: active ? 'var(--shadow-md)' : 'none',
    }} onClick={!active && !disabled ? onClick : undefined}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 999,
          border: `2px solid ${ringColor}`,
          background: done ? 'var(--sage-ink)' : active ? 'var(--lavender-ink)' : 'var(--bg)',
          color: (done || active) ? 'var(--bg)' : 'var(--ink-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '700 13px/1 var(--font-body)',
          flexShrink: 0,
        }}>
          {done ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
          ) : n}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow color="var(--ink-3)">passo {n}</Eyebrow>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: active ? 26 : 18,
            color: 'var(--ink)',
            letterSpacing: '-0.015em',
            margin: '4px 0 0',
            lineHeight: 1.15,
          }}>{title}</h2>
        </div>

        {summary && !active && (
          <div style={{
            font: '500 13px/1.3 var(--font-body)',
            color: 'var(--ink-2)',
            textAlign: 'right',
            maxWidth: 280,
          }}>{summary}</div>
        )}
      </div>

      {active && (
        <div style={{ marginTop: 22, animation: 'colo-fade-in 240ms ease-out' }}>
          {children}
        </div>
      )}
    </section>
  );
}

// =========================
// 1. Picker de bloco
// =========================
function BlocoPicker({ blocos, value, onChange }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 10,
    }}>
      {blocos.map(b => {
        const hosp = HOSPITAIS[b.hospitalId];
        const sel = value && value.id === b.id;
        return (
          <button key={b.id} onClick={() => onChange(b)} style={{
            textAlign: 'left',
            background: sel ? `var(--${hosp.cor}-surface)` : 'var(--bg)',
            border: sel ? `2px solid var(--${hosp.cor}-ink)` : '1px solid var(--line)',
            borderLeft: `4px solid var(--${hosp.cor})`,
            borderRadius: 12,
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 120ms',
          }}>
            <div style={{
              font: '600 14px/1.2 var(--font-body)',
              color: 'var(--ink)',
            }}>{hosp.abrev} · {b.setor}</div>
            <div style={{
              font: '500 12px/1.3 var(--font-body)',
              color: 'var(--ink-2)',
              marginTop: 4,
            }}>{fmtDate(b.data)}</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500, fontSize: 16,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
              marginTop: 6,
            }}>{fmtRange(b.horaInicio, b.duracao)}</div>
          </button>
        );
      })}
    </div>
  );
}

// =========================
// 2. Motivo
// =========================
const MOTIVOS = [
  { k: 'familia',    icon: '👨‍👧', label: 'família', sub: 'aniversário, escola, evento'  },
  { k: 'saude',      icon: '🩺',  label: 'saúde', sub: 'consulta, exame, mal-estar'      },
  { k: 'cansaco',    icon: '😴',  label: 'cansaço', sub: 'sono protegido em risco'        },
  { k: 'imprevisto', icon: '⚡',  label: 'imprevisto', sub: 'algo que não dá pra prever'  },
];

function motivoLabel(k) {
  return MOTIVOS.find(m => m.k === k)?.label || '';
}

function MotivoPicker({ tipo, texto, onTipo, onTexto, onContinue }) {
  return (
    <div>
      <p style={{
        font: '400 14px/1.5 var(--font-body)',
        color: 'var(--ink-2)',
        margin: '0 0 16px',
      }}>
        seu coordenador vê o motivo. seja honesta — quanto mais contexto, mais chance de aprovar rápido.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 8,
        marginBottom: 18,
      }}>
        {MOTIVOS.map(m => {
          const sel = tipo === m.k;
          return (
            <button key={m.k} onClick={() => onTipo(m.k)} style={{
              textAlign: 'left',
              background: sel ? 'var(--lavender-surface)' : 'var(--bg)',
              border: sel ? '2px solid var(--lavender-ink)' : '1px solid var(--line)',
              borderRadius: 12,
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              <span style={{ fontSize: 20 }}>{m.icon}</span>
              <span style={{
                font: '600 13px/1 var(--font-body)',
                color: 'var(--ink)',
              }}>{m.label}</span>
              <span style={{
                font: '400 11px/1.3 var(--font-body)',
                color: 'var(--ink-3)',
              }}>{m.sub}</span>
            </button>
          );
        })}
      </div>

      <label style={{ display: 'block' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 8 }}>uma frase só (opcional)</Eyebrow>
        <textarea value={texto} onChange={e => onTexto(e.target.value)} placeholder="ex: aniversário do meu filho, prometi que ia"
          style={{
            width: '100%',
            minHeight: 60,
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 12,
            font: '400 14px/1.4 var(--font-body)',
            color: 'var(--ink)',
            resize: 'vertical',
            background: 'var(--bg)',
            fontFamily: 'var(--font-body)',
          }}/>
      </label>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onContinue} disabled={!tipo} style={{
          font: '600 14px/1 var(--font-body)',
          padding: '12px 22px',
          borderRadius: 999,
          border: 'none',
          background: tipo ? 'var(--ink)' : 'var(--line-2)',
          color: 'var(--bg)',
          cursor: tipo ? 'pointer' : 'not-allowed',
        }}>continuar →</button>
      </div>
    </div>
  );
}

// =========================
// 3. Quem topa
// =========================
function ColegaPicker({ bloco, value, onChange }) {
  // Sugestões inteligentes — em produção isso vem do backend
  const candidatos = TIME.filter(p => !p.isMe && !p.ferias)
    .map(p => {
      // score: hospitais em comum + carga baixa
      const compat = bloco && p.hospitais.includes(bloco.hospitalId);
      const score = (compat ? 100 : 0) + (60 - p.cargaSemana);
      return { ...p, score, compat };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <p style={{
        font: '400 14px/1.5 var(--font-body)',
        color: 'var(--ink-2)',
        margin: '0 0 16px',
      }}>
        ordenamos por: já trabalha no hospital, carga atual baixa. você pode sugerir um nome ou enviar pra todos disponíveis.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {candidatos.slice(0, 5).map(p => {
          const sel = value && value.id === p.id;
          const tooLoaded = p.cargaSemana >= 60;
          return (
            <button key={p.id} onClick={() => !tooLoaded && onChange(p)} disabled={tooLoaded} style={{
              textAlign: 'left',
              background: sel ? 'var(--lavender-surface)' : 'var(--bg)',
              border: sel ? '2px solid var(--lavender-ink)' : '1px solid var(--line)',
              borderRadius: 12,
              padding: '12px 14px',
              cursor: tooLoaded ? 'not-allowed' : 'pointer',
              opacity: tooLoaded ? 0.5 : 1,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}>
              <Avatar iniciais={p.iniciais} role={p.role} size={36}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>{p.nome}</div>
                <div style={{
                  display: 'flex', gap: 8, marginTop: 4, alignItems: 'center',
                }}>
                  {p.compat && (
                    <span style={{
                      font: '600 10px/1 var(--font-body)',
                      color: 'var(--sage-ink)',
                      background: 'var(--sage-surface)',
                      padding: '3px 7px',
                      borderRadius: 6,
                    }}>já trabalha aqui</span>
                  )}
                  <span style={{
                    font: '500 11px/1 var(--font-body)',
                    color: 'var(--ink-3)',
                  }}>{p.cargaSemana}h esta semana</span>
                  {tooLoaded && (
                    <span style={{
                      font: '600 10px/1 var(--font-body)',
                      color: 'var(--coral-ink)',
                    }}>· no limite</span>
                  )}
                </div>
              </div>
              <CargaBar h={p.cargaSemana} nivel={p.nivel} />
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        paddingTop: 14,
        borderTop: '1px dashed var(--line)',
      }}>
        <button style={{
          flex: 1,
          font: '500 13px/1 var(--font-body)',
          padding: '12px',
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}>+ sugerir outro nome</button>
        <button style={{
          flex: 1,
          font: '500 13px/1 var(--font-body)',
          padding: '12px',
          borderRadius: 10,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}>enviar pra todos disponíveis</button>
      </div>
    </div>
  );
}

// =========================
// 4. Confirmação
// =========================
function Confirmacao({ bloco, motivo, motivoTipo, colega, onSend }) {
  const hosp = bloco && HOSPITAIS[bloco.hospitalId];
  const [enviado, setEnviado] = React.useState(false);

  if (enviado) {
    return (
      <div style={{
        textAlign: 'center', padding: '20px 0',
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 999,
          background: 'var(--sage-surface)',
          color: 'var(--sage-ink)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </div>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          fontSize: 26, color: 'var(--ink)',
          margin: 0, letterSpacing: '-0.015em',
        }}>pedido enviado</h3>
        <p style={{
          font: '400 14px/1.5 var(--font-body)',
          color: 'var(--ink-2)',
          margin: '10px 0 0',
        }}>
          {colega.nome.split(' ').slice(0,2).join(' ')} recebe agora. você é avisada quando responder.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        background: 'var(--bg-alt)',
        borderRadius: 14,
        padding: '18px 20px',
        marginBottom: 18,
      }}>
        <Eyebrow style={{ display: 'block', marginBottom: 14 }}>resumo</Eyebrow>

        <ResumoLinha label="trocando" value={`${hosp.abrev} · ${bloco.setor}`} valueColor={`var(--${hosp.cor}-ink)`} />
        <ResumoLinha label="quando" value={`${fmtDate(bloco.data)} · ${fmtRange(bloco.horaInicio, bloco.duracao)}`} />
        <ResumoLinha label="motivo" value={motivoLabel(motivoTipo) + (motivo ? ` — "${motivo}"` : '')} />
        <ResumoLinha label="colega" value={colega.nome} avatar={colega.iniciais} />
      </div>

      <div style={{
        background: 'var(--lavender-surface)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 18,
        display: 'flex',
        gap: 12,
      }}>
        <span style={{ fontSize: 18 }}>👁</span>
        <div style={{ flex: 1 }}>
          <div style={{ font: '600 13px/1.3 var(--font-body)', color: 'var(--lavender-ink)' }}>quem vê isso</div>
          <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--lavender-ink)', marginTop: 4, opacity: 0.85 }}>
            {colega.nome.split(' ').slice(0,2).join(' ')} agora · seu coordenador (Dra. Sílvia) se ela aceitar
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button style={{
          font: '600 14px/1 var(--font-body)',
          padding: '12px 18px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}>salvar rascunho</button>
        <button onClick={() => { onSend(); setEnviado(true); }} style={{
          font: '600 14px/1 var(--font-body)',
          padding: '12px 22px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--ink)',
          color: 'var(--bg)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}>
          enviar pedido
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </div>
    </div>
  );
}

function ResumoLinha({ label, value, valueColor, avatar }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: 16,
      padding: '8px 0',
      borderBottom: '1px dashed var(--line)',
    }}>
      <Eyebrow color="var(--ink-3)" style={{ minWidth: 80 }}>{label}</Eyebrow>
      {avatar && <Avatar iniciais={avatar} size={24} />}
      <span style={{
        font: '500 14px/1.3 var(--font-body)',
        color: valueColor || 'var(--ink)',
        flex: 1,
      }}>{value}</span>
    </div>
  );
}

Object.assign(window, { TrocasScreen });
