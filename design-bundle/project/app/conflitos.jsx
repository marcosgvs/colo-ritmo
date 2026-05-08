// =====================================================================
// conflitos.jsx — view dedicada de conflitos (sobreposições de plantão)
//   Acessada quando conflitos > 0 (banner coral pulsante no header).
//   Cada grupo = um card com mini-grade horizontal dos blocos
//   sobrepostos, ações: Ceder · Trocar · Editar · Aceitar (sutil).
//   Aceito = card opacity 0.5 + outline tracejado + label.
// =====================================================================

const CONFLITOS = [
  {
    id: 'g1',
    dia: 'Sex 8 mai',
    janela: '19h → 07h',
    titulo: '2 plantões cruzados',
    severidade: 'duro',  // duro | moderado
    blocos: [
      { hosp: 'HBDF', cor: 'blue',  setor: 'UTI Pediátrica', inicio: 19, dur: 12 },
      { hosp: 'HSL',  cor: 'sand',  setor: 'enfermaria',     inicio: 19, dur: 12 },
    ],
    overlap: { de: 19, ate: 31 }, // 31 = 7 do dia seguinte
  },
  {
    id: 'g2',
    dia: 'Qua 6 mai',
    janela: '13h → 19h',
    titulo: 'sobreposição parcial',
    severidade: 'moderado',
    blocos: [
      { hosp: 'HBDF', cor: 'blue',   setor: 'UTI Pediátrica', inicio: 13, dur: 6 },
      { hosp: 'HDS',  cor: 'coral',  setor: 'PS pediátrico',  inicio: 17, dur: 6 },
    ],
    overlap: { de: 17, ate: 19 },
  },
  {
    id: 'g3',
    dia: 'Sáb 9 mai',
    janela: '19h → 07h',
    titulo: 'duplo agendamento',
    severidade: 'duro',
    blocos: [
      { hosp: 'HDS',  cor: 'coral', setor: 'PS pediátrico', inicio: 19, dur: 12 },
      { hosp: 'HCB',  cor: 'aqua',  setor: 'pronto-atend.', inicio: 19, dur: 12 },
    ],
    overlap: { de: 19, ate: 31 },
  },
];

function ConflitosScreen({ mode, onIrAgenda, vazio = false }) {
  const [aceitos, setAceitos] = React.useState({});
  const aceitar = (id) => setAceitos(a => ({ ...a, [id]: !a[id] }));
  const totalAceitos = Object.values(aceitos).filter(Boolean).length;
  const totalPendentes = CONFLITOS.length - totalAceitos;

  if (vazio) {
    return (
      <main data-screen-label="Conflitos · vazio" style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 32px' }}>
        <RoleBanner mode={mode}/>
        <EmptySemConflitos onIrAgenda={onIrAgenda}/>
      </main>
    );
  }

  return (
    <main data-screen-label="Conflitos · resolver" style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 32px 96px' }}>
      <RoleBanner mode={mode}/>

      <header style={{ marginBottom: 28 }}>
        <Eyebrow color="var(--coral-ink)" style={{ display: 'block', marginBottom: 6 }}>
          conflitos · {CONFLITOS.length} grupos pendentes
        </Eyebrow>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          fontSize: 'clamp(36px, 4vw, 44px)',
          color: 'var(--ink)', letterSpacing: '-0.02em',
          lineHeight: 1.05, margin: 0, textWrap: 'balance',
        }}>resolver as sobreposições</h1>
        <p style={{ font: '400 16px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '10px 0 0', maxWidth: 600 }}>
          Encontramos plantões em horários cruzados. Não trava nada —
          só vale revisar antes de virar a semana.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {CONFLITOS.map(g => (
          <ConflitoCard key={g.id} g={g} aceito={!!aceitos[g.id]} onAceitar={() => aceitar(g.id)}/>
        ))}
      </div>

      <footer style={{
        marginTop: 28, padding: '16px 20px',
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <span style={{ font: '400 14px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
          <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{totalAceitos}</strong> aceitos ·{' '}
          <strong style={{ color: 'var(--coral-ink)', fontWeight: 700 }}>{totalPendentes}</strong> pendentes
        </span>
        <button onClick={onIrAgenda} style={{
          font: '600 13px/1 var(--font-body)',
          padding: '12px 20px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--ink)', color: 'var(--bg)',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
        }}>Ir pra Agenda →</button>
      </footer>
    </main>
  );
}

function ConflitoCard({ g, aceito, onAceitar }) {
  return (
    <article style={{
      background: 'var(--bg)',
      border: aceito ? '1.5px dashed var(--coral)' : '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: '20px 22px',
      boxShadow: aceito ? 'none' : 'var(--shadow-sm)',
      opacity: aceito ? 0.55 : 1,
      transition: 'opacity 200ms, border 200ms, box-shadow 200ms',
      position: 'relative',
    }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 500,
              fontSize: 22, letterSpacing: '-0.01em',
              color: 'var(--ink)', margin: 0,
            }}>{g.dia} · {g.janela}</h3>
            <span style={{ font: '400 13px/1 var(--font-body)', color: 'var(--ink-3)' }}>
              {g.blocos.length} plantões · {g.titulo}
            </span>
          </div>
        </div>
        {aceito && (
          <Pill kind="err" dot={false} style={{ textTransform: 'lowercase', letterSpacing: 0, fontSize: 11 }}>
            aceito · não é conflito real
          </Pill>
        )}
      </header>

      <ConflitoMiniGrade g={g} aceito={aceito}/>

      {/* Linhas: hospital · setor · duração */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
        {g.blocos.map((b, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--bg-alt)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${b.cor})`, flexShrink: 0 }}/>
            <span style={{ font: '600 13px/1 var(--font-body)', color: 'var(--ink)', minWidth: 56 }}>{b.hosp}</span>
            <span style={{ font: '400 13px/1 var(--font-body)', color: 'var(--ink-2)', flex: 1 }}>{b.setor}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>
              {String(b.inicio).padStart(2,'0')}:00 → {String((b.inicio + b.dur) % 24).padStart(2,'0')}:00 · {b.dur}h
            </span>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, flexWrap: 'wrap', marginTop: 16,
        paddingTop: 14, borderTop: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <BtnAcao label="Ceder um"      icon="hand"/>
          <BtnAcao label="Trocar com colega" icon="swap"/>
          <BtnAcao label="Editar este"   icon="edit"/>
        </div>
        <button onClick={onAceitar} style={{
          font: '500 12px/1 var(--font-body)',
          padding: '10px 14px',
          borderRadius: 999,
          border: 'none', background: 'transparent',
          color: aceito ? 'var(--coral-ink)' : 'var(--ink-3)',
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}>
          {aceito ? 'desfazer' : 'aceitar (não é conflito real)'}
        </button>
      </div>
    </article>
  );
}

function BtnAcao({ label, icon }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      font: '600 13px/1 var(--font-body)',
      padding: '10px 14px', borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'var(--bg)', color: 'var(--ink)',
      cursor: 'pointer',
    }}>
      <Ico name={icon}/>
      {label}
    </button>
  );
}

function Ico({ name }) {
  const props = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'hand') return <svg {...props}><path d="M18 11V6a2 2 0 10-4 0v5M14 10V4a2 2 0 10-4 0v6M10 10V5a2 2 0 10-4 0v9"/><path d="M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/></svg>;
  if (name === 'swap') return <svg {...props}><path d="M7 7h13l-3-3M17 17H4l3 3"/></svg>;
  if (name === 'edit') return <svg {...props}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  return null;
}

// ----------------------------------------------------------
// Mini-grade horizontal — visualiza os 2-3 blocos sobrepostos
// Cada bloco em uma linha, área de overlap em coral pulsante.
// Eixo: 24h, mas focamos a janela do conflito (de min(inicio) a max(inicio+dur)).
// ----------------------------------------------------------
function ConflitoMiniGrade({ g, aceito }) {
  const ini = Math.min(...g.blocos.map(b => b.inicio));
  const fim = Math.max(...g.blocos.map(b => b.inicio + b.dur));
  const span = fim - ini;
  const pad = 0.5;
  const pctIni = pad;
  const pctFim = 100 - pad;
  const px = (h) => pctIni + ((h - ini) / span) * (pctFim - pctIni);

  // Marcações de hora a cada 2h
  const ticks = [];
  for (let h = Math.ceil(ini / 2) * 2; h <= fim; h += 2) ticks.push(h);

  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-alt)',
      borderRadius: 'var(--r-md)',
      padding: '14px 14px 18px',
      border: '1px solid var(--line)',
    }}>
      {/* eixo de horas */}
      <div style={{ position: 'relative', height: 16, marginBottom: 6 }}>
        {ticks.map(h => (
          <span key={h} style={{
            position: 'absolute',
            left: `${px(h)}%`,
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-3)',
          }}>{String(h % 24).padStart(2, '0')}h</span>
        ))}
      </div>

      {/* área de overlap (atrás dos blocos) */}
      <div style={{
        position: 'absolute',
        left: `${px(g.overlap.de)}%`,
        width: `${px(g.overlap.ate) - px(g.overlap.de)}%`,
        top: 28,
        bottom: 14,
        background: 'color-mix(in oklab, var(--coral) 18%, transparent)',
        border: '1px solid var(--coral)',
        borderRadius: 6,
        animation: aceito ? 'none' : 'colo-pulse-conflict 2.4s ease-in-out infinite',
        pointerEvents: 'none',
      }}>
        <span style={{
          position: 'absolute',
          top: -10, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--coral-ink)',
          color: 'var(--bg)',
          font: '700 9px/1 var(--font-body)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 999,
          whiteSpace: 'nowrap',
        }}>{g.overlap.ate - g.overlap.de}h sobrepostas</span>
      </div>

      {/* blocos empilhados */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {g.blocos.map((b, i) => (
          <div key={i} style={{ position: 'relative', height: 30 }}>
            <div style={{
              position: 'absolute',
              left: `${px(b.inicio)}%`,
              width: `${px(b.inicio + b.dur) - px(b.inicio)}%`,
              top: 0, bottom: 0,
              background: `var(--${b.cor}-surface)`,
              borderLeft: `4px solid var(--${b.cor})`,
              borderRadius: 6,
              padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              overflow: 'hidden',
            }}>
              <span style={{
                font: '700 11px/1 var(--font-body)',
                color: `var(--${b.cor}-ink)`,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>{b.hosp}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: `var(--${b.cor}-ink)`, opacity: 0.85,
                whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>· {b.setor}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { ConflitosScreen, CONFLITOS });
