// =====================================================================
// extras.jsx — pacote de telas e estados secundários:
//   · ConflitoResolver — fullscreen para resolver 1 conflito específico
//   · DetalhePlantaoFull — tela cheia (alternativa ao drawer)
//   · ErrorState · OfflineBanner · SkeletonGrade
// =====================================================================

// ---------------------------------------------------------------------
// Conflito Resolver — fullscreen com 3 caminhos: ceder, trocar, manter
// ---------------------------------------------------------------------
function ConflitoResolverScreen({ mode, onBack }) {
  const [escolha, setEscolha] = React.useState(null);
  return (
    <main data-screen-label="Conflito · resolver" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 80px',
      animation: 'colo-page-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <RoleBanner mode={mode}/>
      <button onClick={onBack} style={btnBack}>← voltar pra conflitos</button>

      <header style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 6, color: 'var(--coral-ink)' }}>conflito · sex 8 mai · 19h–07h</Eyebrow>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(34px, 4vw, 44px)', color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
            dois plantões na mesma noite.
          </h1>
          <p style={{ font: '400 16px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 520 }}>
            <Hand color="var(--coral-ink)" size={18}>respira</Hand> · escolha um caminho. dá pra desfazer depois.
          </p>
        </div>
      </header>

      {/* As duas peças em conflito */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <ConflitoCard hosp="HBDF" cor="blue"  setor="UTI Pediátrica" hora="19h → 07h" valor="R$ 2.200" badge="já tinha"/>
        <ConflitoCard hosp="HSL"  cor="sand"  setor="enfermaria"      hora="19h → 07h" valor="R$ 1.800" badge="entrou depois"/>
      </section>

      {/* 3 caminhos */}
      <section>
        <Eyebrow style={{ display: 'block', marginBottom: 14 }}>como resolver</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <CaminhoCard
            k="ceder" k2={escolha} setK={setEscolha}
            tone="sage"
            titulo="ceder o do HSL"
            sub="passa pra outra médica · você fica só com HBDF"
            implicacao="–12h da semana · HSL fica pendente até alguém aceitar · -R$ 1.800"
            cta="quero ceder esse"
          />
          <CaminhoCard
            k="trocar" k2={escolha} setK={setEscolha}
            tone="lavender"
            titulo="trocar com colega"
            sub="HSL vira plantão de outro dia que ela tem"
            implicacao="abre fluxo de troca · HSL agora é dela · você pega o dela em outro dia"
            cta="abrir troca"
          />
          <CaminhoCard
            k="manter" k2={escolha} setK={setEscolha}
            tone="coral"
            titulo="manter os dois"
            sub="conflito aceito · risco assumido"
            implicacao="ainda fica tracejado coral · regras CFM ficam em alerta · admin é avisado"
            cta="aceitar conflito"
            warning
          />
        </div>
      </section>

      {escolha && (
        <div style={{
          marginTop: 32, padding: 24, borderRadius: 18,
          background: 'var(--bg)', border: '1px solid var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          animation: 'colo-page-in 220ms',
        }}>
          <div style={{ font: '500 14px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
            você escolheu: <strong style={{ color: 'var(--ink)' }}>{escolha}</strong> · pode confirmar agora ou desfazer.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEscolha(null)} style={btnGhost3}>desfazer</button>
            <button style={btnConfirm}>confirmar</button>
          </div>
        </div>
      )}
    </main>
  );
}

function ConflitoCard({ hosp, cor, setor, hora, valor, badge }) {
  return (
    <article style={{
      background: `var(--${cor}-surface)`,
      borderLeft: `4px solid var(--${cor})`,
      borderRadius: 14, padding: 20,
      position: 'relative',
    }}>
      <span style={{
        position: 'absolute', top: 12, right: 12,
        font: '600 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em',
        background: 'var(--bg)', color: `var(--${cor}-ink)`,
        padding: '4px 8px', borderRadius: 999, border: `1px solid var(--${cor})`,
      }}>{badge}</span>
      <Eyebrow color={`var(--${cor}-ink)`}>{hosp} · {setor}</Eyebrow>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)', marginTop: 4 }}>{hora}</div>
      <div style={{ font: '500 13px/1 var(--font-body)', color: 'var(--ink-3)', marginTop: 8 }}>{valor} · 12h</div>
    </article>
  );
}

function CaminhoCard({ k, k2, setK, tone, titulo, sub, implicacao, cta, warning }) {
  const sel = k2 === k;
  return (
    <button onClick={() => setK(k)} style={{
      textAlign: 'left',
      background: sel ? `var(--${tone}-surface)` : 'var(--bg)',
      border: '1px solid ' + (sel ? `var(--${tone}-ink)` : 'var(--line)'),
      borderRadius: 18, padding: 20,
      cursor: 'pointer',
      transition: 'all 160ms',
      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 220,
    }}>
      <Eyebrow color={`var(--${tone}-ink)`}>{warning ? '⚠ ' : ''}{titulo}</Eyebrow>
      <div style={{ font: '500 15px/1.35 var(--font-body)', color: 'var(--ink)' }}>{sub}</div>
      <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--ink-3)', marginTop: 'auto' }}>{implicacao}</div>
      <div style={{
        font: '600 12px/1 var(--font-body)', color: `var(--${tone}-ink)`,
        marginTop: 6,
      }}>{cta} →</div>
    </button>
  );
}

const btnBack = {
  font: '500 13px/1 var(--font-body)', color: 'var(--ink-2)',
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: 0, marginBottom: 18,
};
const btnGhost3 = {
  font: '600 13px/1 var(--font-body)', padding: '10px 16px',
  borderRadius: 999, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--ink-2)', cursor: 'pointer',
};
const btnConfirm = {
  font: '600 13px/1 var(--font-body)', padding: '10px 22px',
  borderRadius: 999, border: 'none',
  background: 'var(--ink)', color: 'var(--bg)', cursor: 'pointer',
};

// ---------------------------------------------------------------------
// Detalhe Plantão FULL — tela cheia, alternativa ao drawer
// ---------------------------------------------------------------------
function DetalheFullScreen({ mode, onBack }) {
  return (
    <main data-screen-label="Plantão · detalhe full" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 80px',
      animation: 'colo-page-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <RoleBanner mode={mode}/>
      <button onClick={onBack} style={btnBack}>← voltar pra agenda</button>

      <header style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24, alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 6, color: 'var(--blue-ink)' }}>HBDF · UTI Pediátrica · sex 8 mai 2026</Eyebrow>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(34px, 4vw, 44px)', color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
            plantão noturno · 19h → 07h
          </h1>
          <p style={{ font: '400 16px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0' }}>
            <Hand color="var(--blue-ink)" size={18}>12 horas · começa em 4 dias</Hand>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnGhost3}>editar</button>
          <button style={btnGhost3}>passar</button>
          <button style={btnGhost3}>trocar</button>
          <button style={{ ...btnGhost3, color: 'var(--coral-ink)', borderColor: 'var(--coral)' }}>excluir</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 28 }}>
        {/* Timeline central */}
        <section style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, padding: 28 }}>
          <Eyebrow style={{ display: 'block', marginBottom: 18 }}>timeline · entrada → saída</Eyebrow>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { hora: '18:30', tipo: 'desloc',   txt: 'sair de casa · 25 min até HBDF' },
              { hora: '18:55', tipo: 'entrada',  txt: 'crachá · vestiário (P3 estac.)' },
              { hora: '19:00', tipo: 'plantao',  txt: 'passagem com plantão diurno (Dr. André)' },
              { hora: '19:30', tipo: 'plantao',  txt: 'rondas UTI · 12 leitos abertos' },
              { hora: '23:00', tipo: 'pausa',    txt: 'jantar previsto · refeitório 22h–00h' },
              { hora: '03:00', tipo: 'plantao',  txt: 'turno mais calmo · vigília' },
              { hora: '07:00', tipo: 'saida',    txt: 'passagem com plantão diurno' },
              { hora: '07:30', tipo: 'desloc',   txt: 'volta pra casa · 35 min (rush)' },
            ].map((p, i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '60px 24px 1fr', gap: 14, alignItems: 'flex-start', padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <Mono style={{ color: 'var(--ink-3)' }}>{p.hora}</Mono>
                <div style={{ position: 'relative', height: '100%' }}>
                  <span style={{
                    position: 'absolute', top: 4, left: 8, width: 8, height: 8, borderRadius: 999,
                    background: p.tipo === 'plantao' ? 'var(--blue-ink)' : p.tipo === 'pausa' ? 'var(--sage-ink)' : p.tipo === 'desloc' ? 'var(--ink-3)' : 'var(--lavender-ink)',
                  }}/>
                </div>
                <div style={{ font: '500 13px/1.4 var(--font-body)', color: 'var(--ink)' }}>{p.txt}</div>
              </li>
            ))}
          </ol>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
            <Eyebrow style={{ display: 'block', marginBottom: 10 }}>briefing</Eyebrow>
            <div style={{ font: '500 14px/1.5 var(--font-body)', color: 'var(--ink)' }}>UTI · 12 leitos · 9 ocupados</div>
            <div style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', marginTop: 6 }}>2 pré-op · 1 pós-cardio · 6 estáveis. enfermeira chefe Carla · noturno.</div>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
            <Eyebrow style={{ display: 'block', marginBottom: 10 }}>financeiro</Eyebrow>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.01em' }}>R$ 2.200</div>
            <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 4 }}>cooperativa · paga 5 dias após mês fechado</div>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, fontFamily: 'var(--font-handwritten)', fontSize: 16, lineHeight: 1.5, color: 'var(--ink-2)', backgroundImage: 'repeating-linear-gradient(transparent, transparent 25px, rgba(58,46,42,0.06) 25px, rgba(58,46,42,0.06) 26px)' }}>
            anotação · "fica frio depois das 3h, leva moletom"
          </div>
        </aside>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------
// Estados de erro · Offline · Skeleton
// ---------------------------------------------------------------------
function ErrorScreen({ onTentar }) {
  return (
    <main data-screen-label="Erro · sem conexão" style={{
      maxWidth: 760, margin: '0 auto', padding: '120px 32px',
      textAlign: 'center', animation: 'colo-page-in 220ms',
    }}>
      <div style={{
        width: 72, height: 72, margin: '0 auto 20px',
        borderRadius: 999, background: 'var(--coral-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--coral-ink)',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 18 0M3 12l3-3M3 12l3 3"/></svg>
      </div>
      <Eyebrow style={{ display: 'block', marginBottom: 8 }}>algo travou aqui</Eyebrow>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>
        não consegui falar com o servidor.
      </h1>
      <p style={{ font: '400 16px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '12px auto 28px', maxWidth: 480 }}>
        sua agenda está salva offline · pode continuar usando · a gente sincroniza assim que voltar.
      </p>
      <button onClick={onTentar} style={btnConfirm}>tentar de novo</button>
    </main>
  );
}

function OfflineBanner() {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--ink)', color: 'var(--bg)',
      padding: '8px 16px', textAlign: 'center',
      font: '600 12px/1 var(--font-body)',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--coral)' }}/>
        sem conexão · você está vendo a versão offline · vai sincronizar quando voltar
      </span>
    </div>
  );
}

function SkeletonGrade() {
  return (
    <main data-screen-label="Loading · skeleton" style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 32px' }}>
      <div className="colo-skel" style={{ height: 22, width: 160, marginBottom: 12 }}/>
      <div className="colo-skel" style={{ height: 44, width: 320, marginBottom: 28 }}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {Array.from({ length: 7 }).map((_, c) => (
          <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="colo-skel" style={{ height: 24, width: '60%' }}/>
            <div className="colo-skel" style={{ height: 80 }}/>
            <div className="colo-skel" style={{ height: 56 }}/>
          </div>
        ))}
      </div>
    </main>
  );
}

Object.assign(window, { ConflitoResolverScreen, DetalheFullScreen, ErrorScreen, OfflineBanner, SkeletonGrade });
