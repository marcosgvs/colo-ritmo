// =====================================================================
// coordenadora.jsx — Modo coordenadora · 3 ferramentas:
//   1. Painel de aprovações (fila completa, com contexto)
//   2. Override — forçar mudança em escala já publicada
//   3. Comunicado — enviar recado pra equipe
// =====================================================================

const APROVACOES = [
  { id: 1, tipo: 'troca', urgencia: 'alta',  pessoa: 'Ana Beatriz', alvo: 'Mariana T.', plantao: 'HBDF · UTI · sex 8 mai · 19h–07h', motivo: 'aniversário do filho', criada: 'há 4h', impacto: 'sem conflito · ambas dentro do limite' },
  { id: 2, tipo: 'troca', urgencia: 'media', pessoa: 'Pedro M.',     alvo: 'Caio S.',     plantao: 'HSL · enfermaria · ter 12 mai · 07h–19h', motivo: 'consulta médica', criada: 'há 1d', impacto: 'Caio fica em 56h · acima do limite (48h CFM)' },
  { id: 3, tipo: 'plus',  urgencia: 'baixa', pessoa: 'Júlia R.',     alvo: null,           plantao: 'extra · sáb 9 mai · 12h dia',         motivo: 'pedido de plantão extra · pagamento PJ', criada: 'há 2d', impacto: 'soma 60h essa semana · alerta amarelo' },
  { id: 4, tipo: 'cessao',urgencia: 'media', pessoa: 'Carla L.',     alvo: null,           plantao: 'HRAN · qua 13 mai · 07h–19h',          motivo: 'sem motivo informado', criada: 'há 6h', impacto: 'sem voluntário · cobre cooperativa?' },
  { id: 5, tipo: 'ferias',urgencia: 'baixa', pessoa: 'Isabela G.',   alvo: null,           plantao: '15 a 28 mai · 14 dias',                motivo: 'planejado em jan', criada: 'há 5d', impacto: '4 plantões precisam ser realocados' },
];

function CoordenadoraScreen({ mode, onBack }) {
  const [aba, setAba] = React.useState('aprovar'); // aprovar|override|comunicado
  return (
    <main data-screen-label="Coordenadora · painel" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 96px',
      animation: 'colo-page-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <RoleBanner mode={mode}/>

      <header style={{ marginBottom: 28 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6, color: 'var(--lavender-ink)' }}>painel da coordenadora · UTI Pediátrica HBDF</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(34px, 4vw, 44px)', color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
          decisões que precisam de você.
        </h1>
        <p style={{ font: '400 16px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 560 }}>
          <Hand color="var(--lavender-ink)" size={18}>5 esperando aprovação</Hand> · 0 conflitos publicados · 1 comunicado em rascunho.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
        {[
          { k: 'aprovar',    label: 'aprovações', count: 5 },
          { k: 'override',   label: 'override',   count: null },
          { k: 'comunicado', label: 'comunicado', count: 1 },
        ].map(o => (
          <button key={o.k} onClick={() => setAba(o.k)} style={{
            font: '600 13px/1 var(--font-body)',
            padding: '12px 18px',
            background: 'transparent', border: 'none',
            borderBottom: aba === o.k ? '2px solid var(--ink)' : '2px solid transparent',
            color: aba === o.k ? 'var(--ink)' : 'var(--ink-3)',
            cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center',
            marginBottom: -1,
          }}>
            {o.label}
            {o.count != null && <span style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 999,
              background: aba === o.k ? 'var(--ink)' : 'var(--bg-2)',
              color: aba === o.k ? 'var(--bg)' : 'var(--ink-3)',
            }}>{o.count}</span>}
          </button>
        ))}
      </nav>

      {aba === 'aprovar'    && <AbaAprovacoes/>}
      {aba === 'override'   && <AbaOverride/>}
      {aba === 'comunicado' && <AbaComunicado/>}
    </main>
  );
}

// ---- Aprovações ------------------------------------------------------
function AbaAprovacoes() {
  const [sel, setSel] = React.useState(APROVACOES[0].id);
  const item = APROVACOES.find(x => x.id === sel);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {APROVACOES.map(a => {
          const isSel = sel === a.id;
          const tone = a.urgencia === 'alta' ? 'coral' : a.urgencia === 'media' ? 'sand' : 'sage';
          return (
            <li key={a.id}>
              <button onClick={() => setSel(a.id)} style={{
                width: '100%', textAlign: 'left',
                background: isSel ? 'var(--bg)' : 'transparent',
                border: '1px solid ' + (isSel ? 'var(--ink)' : 'var(--line)'),
                borderRadius: 12, padding: 14,
                cursor: 'pointer', position: 'relative',
                transition: 'all 140ms',
              }}>
                <span style={{
                  position: 'absolute', left: -1, top: 12, bottom: 12, width: 3,
                  background: `var(--${tone}-ink)`, borderRadius: 2,
                }}/>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <Eyebrow color={`var(--${tone}-ink)`}>{a.tipo} · {a.urgencia}</Eyebrow>
                  <span style={{ font: '400 11px/1 var(--font-body)', color: 'var(--ink-3)' }}>{a.criada}</span>
                </div>
                <div style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--ink)' }}>{a.pessoa}</div>
                <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>{a.plantao}</div>
              </button>
            </li>
          );
        })}
      </ul>

      {item && (
        <article style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, padding: 28 }}>
          <Eyebrow style={{ display: 'block', marginBottom: 6, color: 'var(--lavender-ink)' }}>{item.tipo} · pedido de {item.pessoa}</Eyebrow>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.015em', margin: '0 0 16px' }}>
            {item.plantao}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <Linha label="quem pede"   v={item.pessoa}/>
            <Linha label={item.tipo === 'troca' ? 'pra quem' : 'cobertura'} v={item.alvo || '— em aberto —'}/>
            <Linha label="motivo"      v={item.motivo}/>
            <Linha label="abriu"       v={item.criada}/>
          </div>

          <div style={{
            background: 'var(--coral-surface)', borderLeft: '3px solid var(--coral-ink)',
            padding: '14px 18px', borderRadius: 8, marginBottom: 24,
            font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)',
          }}>
            <strong style={{ color: 'var(--coral-ink)', font: '600 11px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>impacto</strong>
            {item.impacto}
          </div>

          <Eyebrow style={{ display: 'block', marginBottom: 12 }}>contexto da pessoa</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <Mini label="horas/sem" v="44h" tone="sage"/>
            <Mini label="trocas/mês" v="2" tone="lavender"/>
            <Mini label="atrasos" v="0" tone="sage"/>
            <Mini label="ferias últimas" v="ago/25"/>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btnAprovar}>aprovar</button>
            <button style={btnGhost4}>aprovar com obs</button>
            <button style={btnGhost4}>devolver pra ajustar</button>
            <button style={{ ...btnGhost4, color: 'var(--coral-ink)', borderColor: 'var(--coral)', marginLeft: 'auto' }}>recusar</button>
          </div>
        </article>
      )}
    </div>
  );
}

// ---- Override --------------------------------------------------------
function AbaOverride() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
      <section style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, padding: 28 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6, color: 'var(--coral-ink)' }}>⚠ uso restrito</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.015em', margin: '0 0 12px' }}>
          forçar mudança em escala publicada
        </h2>
        <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 24px', maxWidth: 540 }}>
          A escala de mai/26 foi publicada em 22 abr · todas viram. Mudar agora notifica todo mundo afetado e fica registrado no histórico.
        </p>

        <Eyebrow style={{ display: 'block', marginBottom: 10 }}>plantão alvo</Eyebrow>
        <div style={{ background: 'var(--blue-surface)', borderLeft: '3px solid var(--blue-ink)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--ink)' }}>HBDF · UTI · sex 15 mai · 19h–07h</div>
          <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 4 }}>atualmente: <strong>Caio S.</strong> · publicado em 22 abr</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="ação">
            <Radio name="acao" v="trocar" defaultChecked label="trocar pessoa"/>
            <Radio name="acao" v="cancelar" label="cancelar plantão"/>
            <Radio name="acao" v="dividir" label="dividir 6h+6h"/>
          </Field>

          <Field label="nova pessoa">
            <select style={inputStyle}>
              <option>— escolher —</option>
              <option>Júlia R. (livre · 28h essa sem)</option>
              <option>Mariana T. (livre · 32h essa sem)</option>
              <option>Pedro M. (já 48h · ⚠ acima do limite)</option>
              <option>Cooperativa externa</option>
            </select>
          </Field>

          <Field label="justificativa (registrada no histórico)">
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'var(--font-body)' }} placeholder="ex: Caio entrou de licença médica · cobertura emergencial"/>
          </Field>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked style={{ marginTop: 3 }}/>
            <span style={{ font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>notificar Caio S., Júlia R. e a equipe da UTI por push</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button style={btnGhost4}>cancelar</button>
          <button style={{ ...btnAprovar, background: 'var(--coral-ink)', marginLeft: 'auto' }}>forçar mudança</button>
        </div>
      </section>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'var(--lavender-surface)', borderRadius: 14, padding: 20, borderLeft: '3px solid var(--lavender-ink)' }}>
          <Eyebrow color="var(--lavender-ink)">por que existe</Eyebrow>
          <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0' }}>
            Override é a saída pra emergências reais — atestado, falta sem aviso, demanda inesperada. Não é pra resolver pedido educado · isso vai pelo fluxo de troca normal.
          </p>
        </div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
          <Eyebrow style={{ display: 'block', marginBottom: 10 }}>últimos overrides</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
            <div>· 12 abr · Pedro M. → Carla L. <span style={{ color: 'var(--ink-3)' }}>"licença médica"</span></div>
            <div>· 02 abr · cancelado HRAN sáb <span style={{ color: 'var(--ink-3)' }}>"baixa demanda"</span></div>
            <div>· 18 mar · cooperativa → Júlia R. <span style={{ color: 'var(--ink-3)' }}>"falta"</span></div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ---- Comunicado ------------------------------------------------------
function AbaComunicado() {
  const [tom, setTom] = React.useState('aviso');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      <section style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, padding: 28 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>rascunho · não enviado</Eyebrow>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28, color: 'var(--ink)', letterSpacing: '-0.015em', margin: '0 0 20px' }}>
          comunicado pra equipe
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="quem recebe">
            <Radio name="quem" v="todos" defaultChecked label="todo o time UTI HBDF · 12 pessoas"/>
            <Radio name="quem" v="ativas" label="só quem está em plantão essa semana · 8"/>
            <Radio name="quem" v="custom" label="escolher manualmente"/>
          </Field>

          <Field label="tom">
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { k: 'aviso',    label: 'aviso',    tone: 'sand' },
                { k: 'urgente',  label: 'urgente',  tone: 'coral' },
                { k: 'celebrar', label: 'celebrar', tone: 'sage' },
                { k: 'info',     label: 'info',     tone: 'blue' },
              ].map(t => (
                <button key={t.k} onClick={() => setTom(t.k)} style={{
                  font: '600 12px/1 var(--font-body)', padding: '8px 14px',
                  borderRadius: 999,
                  background: tom === t.k ? `var(--${t.tone}-ink)` : 'transparent',
                  color: tom === t.k ? 'var(--bg)' : `var(--${t.tone}-ink)`,
                  border: `1px solid var(--${t.tone}-ink)`,
                  cursor: 'pointer',
                }}>{t.label}</button>
              ))}
            </div>
          </Field>

          <Field label="título curto">
            <input style={inputStyle} defaultValue="reunião extra dia 12 · alinhamento mensal"/>
          </Field>

          <Field label="mensagem">
            <textarea style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}
              defaultValue="Pessoal, vamos fazer uma reunião extra dia 12 às 10h pra alinhar a escala de junho e ouvir como vocês tão na carga. Quem não conseguir presencial, tem link pelo Meet. Trazer o que tá pesando."/>
          </Field>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked style={{ marginTop: 3 }}/>
            <span style={{ font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>fixar no app por 7 dias</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" style={{ marginTop: 3 }}/>
            <span style={{ font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>pedir confirmação de leitura</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button style={btnGhost4}>salvar rascunho</button>
          <button style={{ ...btnAprovar, marginLeft: 'auto' }}>enviar agora</button>
        </div>
      </section>

      <aside>
        <Eyebrow style={{ display: 'block', marginBottom: 10 }}>preview no app das médicas</Eyebrow>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 18, padding: 20 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(58,46,42,0.06)', borderLeft: `3px solid var(--${tom === 'urgente' ? 'coral' : tom === 'celebrar' ? 'sage' : tom === 'info' ? 'blue' : 'sand'}-ink)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ font: '700 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: `var(--${tom === 'urgente' ? 'coral' : tom === 'celebrar' ? 'sage' : tom === 'info' ? 'blue' : 'sand'}-ink)` }}>{tom}</span>
              <span style={{ font: '400 11px/1 var(--font-body)', color: 'var(--ink-3)' }}>agora</span>
            </div>
            <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>reunião extra dia 12 · alinhamento mensal</div>
            <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--ink-2)', marginTop: 6 }}>
              Pessoal, vamos fazer uma reunião extra dia 12 às 10h pra alinhar a escala de junho…
            </div>
            <div style={{ font: '500 11px/1 var(--font-body)', color: 'var(--ink-3)', marginTop: 10 }}>— Dra. Elisa, coord. UTI</div>
          </div>
          <p style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', textAlign: 'center', marginTop: 12 }}>vai aparecer no topo da agenda das 12 pessoas</p>
        </div>
      </aside>
    </div>
  );
}

// ---- atoms ------------------------------------------------------------
function Linha({ label, v }) {
  return (
    <div>
      <div style={{ font: '600 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--ink)' }}>{v}</div>
    </div>
  );
}
function Mini({ label, v, tone = 'sand' }) {
  return (
    <div style={{ background: `var(--${tone}-surface)`, borderRadius: 10, padding: 12 }}>
      <div style={{ font: '600 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: `var(--${tone}-ink)`, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{v}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <div style={{ font: '600 11px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}
function Radio({ name, v, label, defaultChecked }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
      <input type="radio" name={name} value={v} defaultChecked={defaultChecked}/>
      {label}
    </label>
  );
}
const inputStyle = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-2)', border: '1px solid var(--line)',
  borderRadius: 10, font: '500 14px/1.4 var(--font-body)', color: 'var(--ink)',
};
const btnAprovar = {
  font: '600 13px/1 var(--font-body)', padding: '11px 22px',
  borderRadius: 999, border: 'none',
  background: 'var(--ink)', color: 'var(--bg)', cursor: 'pointer',
};
const btnGhost4 = {
  font: '600 13px/1 var(--font-body)', padding: '11px 18px',
  borderRadius: 999, border: '1px solid var(--line)',
  background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer',
};

Object.assign(window, { CoordenadoraScreen });
