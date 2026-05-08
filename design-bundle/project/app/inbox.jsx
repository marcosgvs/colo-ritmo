// =====================================================================
// inbox.jsx — Centro de chegadas:
//   1. Propostas de troca recebidas (preciso responder)
//   2. Escala publicada nova (preciso comparar e aceitar)
//   3. Pedidos de aprovação (admin)
// =====================================================================

const PROPOSTAS = [
  {
    id: 'p1',
    tipo: 'troca',
    de: { nome: 'Dra. Carla Mendes', iniciais: 'CM', cor: 'sand' },
    quando: '2h atrás',
    pedido: { hosp: 'HBDF', cor: 'blue', dia: 'sex 8 mai · 19h → 07h', setor: 'UTI Pediátrica' },
    oferece: { hosp: 'HSL', cor: 'sand', dia: 'qua 13 mai · 13h → 19h', setor: 'enfermaria' },
    porQue: 'casamento da irmã em SP. Já avisei a coordenadora.',
    matchScore: 92,
    cargaApos: 52,
  },
  {
    id: 'p2',
    tipo: 'troca',
    de: { nome: 'Dr. João Pereira', iniciais: 'JP', cor: 'lavender' },
    quando: 'ontem',
    pedido: { hosp: 'HCB', cor: 'aqua', dia: 'dom 17 mai · 07h → 19h', setor: 'pronto-atend.' },
    oferece: { hosp: 'HCB', cor: 'aqua', dia: 'sáb 23 mai · 07h → 19h', setor: 'pronto-atend.' },
    porQue: 'aniversário do filho.',
    matchScore: 78,
    cargaApos: 44,
  },
];

const ESCALAS = [
  {
    id: 'e1',
    hosp: 'HBDF',
    cor: 'blue',
    mes: 'junho 2026',
    publicadaPor: 'Dra. Sílvia Tavares · coord.',
    quando: 'há 4h',
    plantoesNovos: 6,
    diff: { iguais: 4, mudados: 1, novos: 1, removidos: 0 },
    prazo: 'até qua 13 mai',
  },
];

function InboxScreen({ mode, onIrEscala, onIrTroca }) {
  const [aba, setAba] = React.useState('chegando');
  const total = PROPOSTAS.length + ESCALAS.length;

  return (
    <main data-screen-label="Inbox · chegadas" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 80px',
      animation: 'colo-page-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <RoleBanner mode={mode}/>

      <header style={{ marginBottom: 28 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>chegando · esperando você</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(36px, 4vw, 44px)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.05 }}>
          {total > 0 ? <>tem {total} {total === 1 ? 'coisa' : 'coisas'} pra você olhar</> : 'caixa vazia'}
        </h1>
        <p style={{ font: '400 16px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 580 }}>
          tudo que precisa de uma resposta sua — propostas de troca, escalas novas, pedidos.
        </p>
      </header>

      <nav style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-alt)', border: '1px solid var(--line)', borderRadius: 999, padding: 4, marginBottom: 24 }}>
        {[{ k: 'chegando', l: `chegando · ${total}` }, { k: 'enviadas', l: 'que enviei · 1' }, { k: 'historico', l: 'histórico' }].map(x => (
          <button key={x.k} onClick={() => setAba(x.k)} style={{
            font: '600 13px/1 var(--font-body)', padding: '10px 18px',
            borderRadius: 999, border: 'none',
            background: aba === x.k ? 'var(--bg)' : 'transparent',
            color: aba === x.k ? 'var(--ink)' : 'var(--ink-2)',
            boxShadow: aba === x.k ? 'var(--shadow-sm)' : 'none', cursor: 'pointer',
          }}>{x.l}</button>
        ))}
      </nav>

      {aba === 'chegando' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ESCALAS.map(e => <EscalaCard key={e.id} e={e}/>)}
          {PROPOSTAS.map(p => <PropostaCard key={p.id} p={p}/>)}
        </div>
      )}
      {aba === 'enviadas' && <EnviadasVazio/>}
      {aba === 'historico' && <HistoricoVazio/>}
    </main>
  );
}

// =========================
// Card de Proposta de Troca
// =========================
function PropostaCard({ p }) {
  const [resposta, setResposta] = React.useState(null); // null | 'aceito' | 'recuso' | 'contra'
  return (
    <article style={{
      background: 'var(--bg)', border: '1px solid var(--line)',
      borderRadius: 18, overflow: 'hidden',
      opacity: resposta ? 0.6 : 1, transition: 'opacity 180ms',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 24px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--lavender-surface)',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 999,
          background: `var(--${p.de.cor}-surface)`,
          color: `var(--${p.de.cor}-ink)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '700 13px/1 var(--font-body)',
          border: '1px solid var(--line)',
        }}>{p.de.iniciais}</div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>
            <strong>{p.de.nome}</strong> propõe uma troca
          </div>
          <div style={{ font: '400 12px/1.3 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>
            {p.quando} · match {p.matchScore}% com seu calendário
          </div>
        </div>
        <span style={{
          font: '600 11px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '6px 12px', borderRadius: 999,
          background: 'var(--bg)', color: 'var(--lavender-ink)',
          border: '1px solid var(--lavender)',
        }}>↔ troca direta</span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24, padding: '24px' }}>
        <PropostaLado titulo="ela quer pegar" sub="seu plantão"     dia={p.pedido.dia}   hosp={p.pedido.hosp}   cor={p.pedido.cor}   setor={p.pedido.setor}/>
        <div style={{
          width: 40, height: 40, borderRadius: 999,
          background: 'var(--lavender-surface)', color: 'var(--lavender-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '700 18px/1 var(--font-body)',
        }}>↔</div>
        <PropostaLado titulo="em troca, te dá" sub="o plantão dela" dia={p.oferece.dia} hosp={p.oferece.hosp} cor={p.oferece.cor} setor={p.oferece.setor}/>
      </div>

      <div style={{ padding: '0 24px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ font: '600 11px/1 var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4, flexShrink: 0 }}>por que:</span>
        <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', fontStyle: 'italic', margin: 0 }}>
          "{p.porQue}"
        </p>
      </div>

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ font: '500 12px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>
          se aceitar, sua semana vai pra <strong style={{ color: 'var(--ink-2)' }}>{p.cargaApos}h</strong> (de 48h) ·  <Hand color="var(--ink-2)" size={13}>ainda dentro do limite</Hand>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setResposta('contra')} style={btnGhost}>contraproposta</button>
          <button onClick={() => setResposta('recuso')} style={btnGhost}>recuso</button>
          <button onClick={() => setResposta('aceito')} style={{ ...btnPrimary, background: 'var(--lavender-ink)' }}>aceitar troca</button>
        </div>
      </div>
    </article>
  );
}

function PropostaLado({ titulo, sub, dia, hosp, cor, setor }) {
  return (
    <div>
      <Eyebrow style={{ display: 'block', marginBottom: 6 }}>{titulo}</Eyebrow>
      <div style={{
        background: `var(--${cor}-surface)`,
        borderLeft: `4px solid var(--${cor})`,
        borderRadius: 12,
        padding: '14px 16px',
      }}>
        <div style={{ font: '600 12px/1 var(--font-body)', color: `var(--${cor}-ink)`, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{hosp} · {setor}</div>
        <div style={{ font: '500 15px/1.3 var(--font-body)', color: 'var(--ink)' }}>{dia}</div>
      </div>
      <div style={{ font: '400 11px/1 var(--font-body)', color: 'var(--ink-3)', marginTop: 6 }}>{sub}</div>
    </div>
  );
}

// =========================
// Card de Escala Publicada
// =========================
function EscalaCard({ e }) {
  return (
    <article style={{
      background: 'var(--bg)', border: '1px solid var(--line)',
      borderRadius: 18, overflow: 'hidden',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', borderBottom: '1px solid var(--line)', background: `var(--${e.cor}-surface)` }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'var(--bg)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: '700 13px/1 var(--font-body)', color: `var(--${e.cor}-ink)`,
        }}>{e.hosp}</div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '600 15px/1.2 var(--font-body)', color: 'var(--ink)' }}>
            escala de <strong>{e.mes}</strong> publicada
          </div>
          <div style={{ font: '400 12px/1.3 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>
            {e.publicadaPor} · {e.quando}
          </div>
        </div>
        <span style={{
          font: '600 11px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '6px 12px', borderRadius: 999,
          background: 'var(--coral-surface)', color: 'var(--coral-ink)',
        }}>responde {e.prazo}</span>
      </header>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <DiffPill v={e.diff.novos}     l="novos"     tone="lavender"/>
          <DiffPill v={e.diff.iguais}    l="iguais"    tone="ink-3"/>
          <DiffPill v={e.diff.mudados}   l="mudados"   tone="coral"/>
          <DiffPill v={e.diff.removidos} l="removidos" tone="ink-3"/>
        </div>

        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          <DiffLinha tone="lavender" txt="dom 7 jun · 07h → 19h · UTI" sub="novo plantão"/>
          <DiffLinha tone="lavender" txt="qua 10 jun · 19h → 07h · noite" sub="novo plantão"/>
          <DiffLinha tone="coral"    txt="sex 19 jun · 13h → 19h" sub="mudou de 07h para 13h"/>
        </div>
      </div>

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ font: '500 12px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>
          ver na grade antes de responder · <a href="#" style={{ color: 'var(--ink-2)' }}>preview lado a lado →</a>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnGhost}>contestar 1 plantão</button>
          <button style={{ ...btnPrimary, background: 'var(--ink)' }}>aceitar tudo</button>
        </div>
      </div>
    </article>
  );
}

function DiffPill({ v, l, tone }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 999,
      background: `var(--${tone}-surface, var(--bg-alt))`,
      border: '1px solid var(--line)',
      font: '600 12px/1 var(--font-body)', color: `var(--${tone}-ink, var(--ink-2))`,
    }}>
      <strong style={{ font: '700 14px/1 var(--font-body)' }}>{v}</strong> {l}
    </span>
  );
}

function DiffLinha({ tone, txt, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-alt)', borderRadius: 10, border: '1px solid var(--line)' }}>
      <span style={{ width: 4, height: 22, borderRadius: 2, background: `var(--${tone}-ink)` }}/>
      <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)', flex: 1 }}>{txt}</div>
      <div style={{ font: '400 12px/1 var(--font-body)', color: 'var(--ink-3)' }}>{sub}</div>
    </div>
  );
}

function EnviadasVazio() {
  return <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>uma proposta sua aguardando — Dr. João, troca de domingo.</div>;
}
function HistoricoVazio() {
  return <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-3)' }}>aqui mora tudo que já resolveu nos últimos 90 dias.</div>;
}

const btnGhost = {
  font: '600 13px/1 var(--font-body)', padding: '10px 16px',
  borderRadius: 999, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--ink-2)', cursor: 'pointer',
};
const btnPrimary = {
  font: '600 13px/1 var(--font-body)', padding: '10px 18px',
  borderRadius: 999, border: 'none',
  background: 'var(--ink)', color: 'var(--bg)', cursor: 'pointer',
};

Object.assign(window, { InboxScreen });
