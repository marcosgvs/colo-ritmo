// =====================================================================
// onboarding.jsx — Primeiros 60 segundos
// 4 passos curtos. Foco: a Mariana sai do passo 4 com a primeira semana
// preenchida e entendendo o radar de carga.
//   1. boas-vindas + escolha de papel
//   2. seleção dos hospitais onde plantona
//   3. importar agenda atual (3 fontes possíveis)
//   4. revisar a primeira semana + entender o radar
// =====================================================================

function OnboardingScreen({ onFinish }) {
  const [passo, setPasso] = React.useState(1);
  const [papel, setPapel] = React.useState('medica');
  const [hospitais, setHospitais] = React.useState(['HSL', 'HBDF']);
  const [importou, setImportou] = React.useState(null);

  const total = 4;

  return (
    <main data-screen-label="Onboarding" style={{
      minHeight: '100vh',
      background: 'var(--bg-alt)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* topo: marca + progresso */}
      <header style={{
        padding: '24px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <ColoMark size={22} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[1,2,3,4].map(n => (
            <span key={n} style={{
              width: n === passo ? 28 : 8,
              height: 8,
              borderRadius: 999,
              background: n <= passo ? 'var(--lavender-ink)' : 'var(--line-2)',
              transition: 'all 200ms',
            }}/>
          ))}
          <span style={{
            font: '500 12px/1 var(--font-body)',
            color: 'var(--ink-3)',
            marginLeft: 10,
            fontStyle: 'italic',
          }}>{passo} de {total}</span>
        </div>
      </header>

      {/* corpo */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 40px 40px',
      }}>
        <div style={{
          maxWidth: 720, width: '100%',
          background: 'var(--bg)',
          borderRadius: 24,
          padding: 'clamp(32px, 5vw, 56px)',
          boxShadow: 'var(--shadow-md)',
        }}>
          {passo === 1 && <PassoPapel papel={papel} setPapel={setPapel} />}
          {passo === 2 && <PassoHospitais hospitais={hospitais} setHospitais={setHospitais} />}
          {passo === 3 && <PassoImportar importou={importou} setImportou={setImportou} />}
          {passo === 4 && <PassoRevisar papel={papel} hospitais={hospitais} />}

          {/* navegação */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 36,
            paddingTop: 24,
            borderTop: '1px solid var(--line)',
          }}>
            {passo > 1 ? (
              <button onClick={() => setPasso(passo - 1)} style={{
                font: '500 13px/1 var(--font-body)',
                padding: '12px 18px',
                border: 'none',
                background: 'transparent',
                color: 'var(--ink-2)',
                cursor: 'pointer',
              }}>← voltar</button>
            ) : <span/>}

            <div style={{ display: 'flex', gap: 10 }}>
              {passo < total && passo > 1 && (
                <button onClick={() => setPasso(passo + 1)} style={{
                  font: '500 13px/1 var(--font-body)',
                  padding: '12px 18px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}>pular</button>
              )}
              <button onClick={() => passo === total ? onFinish && onFinish() : setPasso(passo + 1)} style={{
                font: '600 13px/1 var(--font-body)',
                padding: '14px 28px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--ink)',
                color: 'var(--bg)',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}>
                {passo === total ? 'entrar no Colo Ritmo →' : 'continuar →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* rodapé suave */}
      <footer style={{
        padding: '20px 40px',
        textAlign: 'center',
        font: '400 12px/1.4 var(--font-body)',
        color: 'var(--ink-3)',
        fontStyle: 'italic',
      }}>
        leva menos de 1 minuto · você pode mudar tudo depois
      </footer>
    </main>
  );
}

// ---- Passo 1: papel ----
function PassoPapel({ papel, setPapel }) {
  const opcoes = [
    {
      v: 'medica',
      titulo: 'sou médica plantonista',
      desc: 'organizo meus próprios plantões em vários hospitais',
      ico: '👩‍⚕️',
    },
    {
      v: 'coordenador',
      titulo: 'coordeno uma escala',
      desc: 'monto e ajusto plantões de uma equipe',
      ico: '🗓',
    },
    {
      v: 'parceiro',
      titulo: 'acompanho a agenda de alguém',
      desc: 'só quero saber quando minha pessoa está livre',
      ico: '💛',
    },
  ];

  return (
    <div>
      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>boas-vindas</Eyebrow>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 'clamp(32px, 4vw, 42px)',
        color: 'var(--ink)', letterSpacing: '-0.02em',
        lineHeight: 1.05, margin: 0,
      }}>como você usa o Colo?</h1>
      <p style={{
        font: '400 16px/1.5 var(--font-body)',
        color: 'var(--ink-2)',
        margin: '12px 0 28px',
      }}>
        a gente adapta o que você vê pelo seu papel. dá pra trocar depois.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {opcoes.map(o => (
          <button key={o.v} onClick={() => setPapel(o.v)} style={{
            display: 'grid',
            gridTemplateColumns: '48px 1fr 24px',
            gap: 18,
            alignItems: 'center',
            padding: '20px 22px',
            background: papel === o.v ? 'var(--lavender-surface)' : 'var(--bg)',
            border: papel === o.v ? '2px solid var(--lavender-ink)' : '1px solid var(--line)',
            borderRadius: 16,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 120ms',
          }}>
            <span style={{ fontSize: 32 }}>{o.ico}</span>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18,
                color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 4,
              }}>{o.titulo}</div>
              <div style={{ font: '400 13px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>{o.desc}</div>
            </div>
            {papel === o.v && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lavender-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Passo 2: hospitais ----
function PassoHospitais({ hospitais, setHospitais }) {
  const todos = ['HSL', 'HBDF', 'HCB', 'HMIB', 'HBT', 'HRT'];
  const toggle = (h) => {
    setHospitais(hospitais.includes(h)
      ? hospitais.filter(x => x !== h)
      : [...hospitais, h]
    );
  };

  return (
    <div>
      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>seus hospitais</Eyebrow>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 'clamp(32px, 4vw, 42px)',
        color: 'var(--ink)', letterSpacing: '-0.02em',
        lineHeight: 1.05, margin: 0,
      }}>onde você plantona?</h1>
      <p style={{
        font: '400 16px/1.5 var(--font-body)',
        color: 'var(--ink-2)',
        margin: '12px 0 28px',
      }}>
        cada um tem uma cor de família. a gente vai usar isso pra você reconhecer os turnos no piscar de olhos.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
      }}>
        {todos.map(h => {
          const hosp = HOSPITAIS[h] || { sigla: h, nome: h, cor: 'lavender' };
          const ativo = hospitais.includes(h);
          return (
            <button key={h} onClick={() => toggle(h)} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              background: ativo ? `var(--${hosp.cor}-surface)` : 'var(--bg)',
              border: ativo ? `2px solid var(--${hosp.cor})` : '1px solid var(--line)',
              borderRadius: 14,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 120ms',
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: 999,
                background: `var(--${hosp.cor})`,
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16,
                  color: 'var(--ink)', letterSpacing: '-0.01em',
                }}>{hosp.sigla}</div>
                <div style={{ font: '400 11px/1.2 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>{hosp.nome}</div>
              </div>
              {ativo && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={`var(--${hosp.cor}-ink)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <button style={{
        marginTop: 14,
        font: '500 13px/1 var(--font-body)',
        padding: '10px 0',
        background: 'transparent',
        border: 'none',
        color: 'var(--ink-2)',
        cursor: 'pointer',
        textAlign: 'left',
      }}>+ adicionar outro hospital</button>
    </div>
  );
}

// ---- Passo 3: importar agenda ----
function PassoImportar({ importou, setImportou }) {
  const fontes = [
    { v: 'cal', titulo: 'do meu Google Calendar', desc: 'a gente lê os eventos com "plantão" no título', ico: '📅' },
    { v: 'foto', titulo: 'tirar foto da escala em papel', desc: 'manda a foto que organizamos pra você', ico: '📷' },
    { v: 'manual', titulo: 'vou colocar à mão depois', desc: 'tudo bem · você pode adicionar quando quiser', ico: '✍️' },
  ];

  return (
    <div>
      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>sua agenda atual</Eyebrow>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 'clamp(32px, 4vw, 42px)',
        color: 'var(--ink)', letterSpacing: '-0.02em',
        lineHeight: 1.05, margin: 0,
      }}>vamos trazer o que já existe</h1>
      <p style={{
        font: '400 16px/1.5 var(--font-body)',
        color: 'var(--ink-2)',
        margin: '12px 0 28px',
      }}>
        digitar tudo de novo seria cansativo demais. escolha o que for mais fácil.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fontes.map(f => (
          <button key={f.v} onClick={() => setImportou(f.v)} style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr',
            gap: 18,
            alignItems: 'center',
            padding: '18px 22px',
            background: importou === f.v ? 'var(--sage-surface)' : 'var(--bg)',
            border: importou === f.v ? '2px solid var(--sage-ink)' : '1px solid var(--line)',
            borderRadius: 14,
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 120ms',
          }}>
            <span style={{ fontSize: 26 }}>{f.ico}</span>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 17,
                color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3,
              }}>{f.titulo}</div>
              <div style={{ font: '400 13px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>{f.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {importou === 'cal' && (
        <div style={{
          marginTop: 18,
          padding: '14px 18px',
          background: 'var(--blue-surface)',
          borderRadius: 12,
          font: '400 13px/1.4 var(--font-body)',
          color: 'var(--blue-text)',
          fontStyle: 'italic',
        }}>
          ✓ encontramos 8 plantões no seu calendário em maio. a gente vai te mostrar antes de salvar.
        </div>
      )}
    </div>
  );
}

// ---- Passo 4: revisar primeira semana ----
function PassoRevisar({ papel, hospitais }) {
  return (
    <div>
      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>tudo pronto</Eyebrow>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 'clamp(32px, 4vw, 42px)',
        color: 'var(--ink)', letterSpacing: '-0.02em',
        lineHeight: 1.05, margin: 0,
      }}>esta é a sua primeira semana</h1>
      <p style={{
        font: '400 16px/1.5 var(--font-body)',
        color: 'var(--ink-2)',
        margin: '12px 0 24px',
      }}>
        este é o <strong style={{ color: 'var(--lavender-ink)' }}>radar de carga</strong> — sua bússola. mostra se a semana está dentro do limite saudável (até 60h) ou não. é o jeito mais rápido de saber como você está.
      </p>

      {/* preview do radar */}
      <div style={{
        background: 'var(--bg-alt)',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36,
            color: 'var(--ink)', letterSpacing: '-0.02em',
          }}>48h</span>
          <span style={{
            font: '500 13px/1 var(--font-body)',
            color: '#B8884A',
            background: 'var(--sand-surface)',
            padding: '5px 12px',
            borderRadius: 999,
          }}>● caminhando bem</span>
        </div>
        <div style={{
          height: 10,
          background: 'var(--bg)',
          borderRadius: 999,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0, left: 0,
            width: '80%',
            background: 'linear-gradient(90deg, var(--sage) 0%, #D9A85A 100%)',
            borderRadius: 999,
          }}/>
          <div style={{
            position: 'absolute',
            top: -4, bottom: -4,
            left: '100%',
            width: 2,
            background: 'var(--coral)',
          }}/>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          font: '400 11px/1 var(--font-body)',
          color: 'var(--ink-3)',
          marginTop: 8,
        }}>
          <span>0h</span>
          <span style={{ color: 'var(--coral-ink)', fontWeight: 600 }}>limite saudável · 60h</span>
        </div>
      </div>

      {/* o que esperar */}
      <div style={{
        background: 'var(--lavender-surface)',
        borderRadius: 14,
        padding: '18px 22px',
      }}>
        <Hand color="var(--lavender-ink)" size={20} style={{ display: 'block', lineHeight: 1.3 }}>
          a gente nunca vai te empurrar plantão. você decide o ritmo — só te lembramos quando faz sentido proteger o sono.
        </Hand>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingScreen });
