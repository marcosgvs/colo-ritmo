// =====================================================================
// usuario.jsx — Tela do usuário (perfil + preferências + conta)
//   Layout: 2-col · cabeçalho + sidebar avatar + cards à direita
// =====================================================================

const USUARIO = {
  nome: 'Mariana Vasconcelos',
  apelido: 'Dra. Mariana',
  iniciais: 'MV',
  email: 'mariana@coloritmo.com.br',
  telefone: '(61) 9 8123-4567',
  crm: 'CRM/DF 23145',
  especialidade: 'Pediatria',
  subesp: 'UTI Pediátrica',
  cidade: 'Brasília · DF',
  desde: 'desde set 2024',
  cor: 'lavender',
};

function UsuarioScreen({ mode, onBack }) {
  const u = USUARIO;
  const p = PREFERENCIAS_ME;

  return (
    <main data-screen-label="Usuário · perfil" style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 32px 96px' }}>
      <RoleBanner mode={mode}/>

      {/* HEADER */}
      <header style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap', marginBottom: 28,
      }}>
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 6 }}>conta · você</Eyebrow>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 'clamp(36px, 4vw, 44px)', color: 'var(--ink)',
            letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0,
          }}>seu perfil</h1>
          <p style={{
            font: '400 16px/1.45 var(--font-body)', color: 'var(--ink-2)',
            margin: '8px 0 0', maxWidth: 580,
          }}>
            Como o Colo Ritmo te conhece. Mude foto, dados pessoais e preferências
            que orientam o Montar e os avisos.
          </p>
        </div>
        <button style={{
          font: '600 13px/1 var(--font-body)',
          padding: '12px 18px', borderRadius: 999,
          border: 'none', background: 'var(--ink)', color: 'var(--bg)',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
          Salvar alterações
        </button>
      </header>

      <div style={{
        display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 28,
        alignItems: 'flex-start',
      }} className="usu-grid">
        {/* === COLUNA ESQ: avatar + atalhos === */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 76 }}>
          <AvatarCard u={u}/>
          <ContaCard/>
        </aside>

        {/* === COLUNA DIR: cards === */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DadosPessoais u={u}/>
          <DadosProfissionais u={u}/>
          <PreferenciasMontar p={p}/>
          <Notificacoes/>
          <SegurancaCard/>
        </section>
      </div>

      <style>{`
        @media (max-width: 980px) {
          main[data-screen-label="Usuário · perfil"] .usu-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

// ----------------------------------------------------------
function AvatarCard({ u }) {
  return (
    <div style={{
      background: `var(--${u.cor}-surface)`,
      borderRadius: 'var(--r-lg)',
      padding: '22px',
      border: `1px solid color-mix(in oklab, var(--${u.cor}-ink) 16%, transparent)`,
      textAlign: 'center',
    }}>
      <div style={{
        width: 96, height: 96, margin: '0 auto',
        borderRadius: 999,
        background: 'var(--bg)',
        border: `2px solid var(--${u.cor})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36,
        color: `var(--${u.cor}-ink)`, letterSpacing: '-0.02em',
        position: 'relative',
      }}>
        {u.iniciais}
        <button title="trocar foto" style={{
          position: 'absolute', bottom: -4, right: -4,
          width: 30, height: 30, borderRadius: 999,
          background: 'var(--ink)', color: 'var(--bg)',
          border: '2px solid var(--bg)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.06 9l.94.94L5.92 19H5v-.92zm3.6-6c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83a.996.996 0 000-1.41l-2.34-2.34a.974.974 0 00-.71-.29zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>
        </button>
      </div>
      <h3 style={{
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22,
        color: `var(--${u.cor}-ink)`, margin: '14px 0 0',
        letterSpacing: '-0.01em',
        fontStyle: 'italic', fontVariationSettings: '"opsz" 24',
      }}>{u.apelido}</h3>
      <p style={{
        font: '400 13px/1.4 var(--font-body)',
        color: `var(--${u.cor}-ink)`,
        opacity: 0.78,
        margin: '4px 0 0',
      }}>{u.especialidade} · {u.subesp}</p>
      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: `var(--${u.cor}-ink)`, opacity: 0.6,
        margin: '8px 0 0',
      }}>{u.crm} · {u.desde}</p>
    </div>
  );
}

function ContaCard() {
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: '18px 20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>plano · ativo</Eyebrow>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20,
        color: 'var(--ink)', letterSpacing: '-0.01em',
      }}>Colo Ritmo · Pro</div>
      <p style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', margin: '4px 0 12px' }}>
        renovação em 12 dez 2026 · R$ 39/mês
      </p>
      <button style={{
        width: '100%',
        font: '600 12px/1 var(--font-body)',
        padding: '10px 14px', borderRadius: 999,
        border: '1px solid var(--line)', background: 'var(--bg-alt)',
        color: 'var(--ink-2)', cursor: 'pointer',
      }}>gerenciar plano</button>
    </div>
  );
}

// ----------------------------------------------------------
function DadosPessoais({ u }) {
  return (
    <CardSecao titulo="dados pessoais" sub="aparecem na sua conta e nos extratos">
      <FieldGrid>
        <Field label="nome completo" value={u.nome}/>
        <Field label="como prefere ser chamada" value={u.apelido}/>
        <Field label="e-mail" value={u.email} suffix={<TagVerificado/>}/>
        <Field label="telefone" value={u.telefone}/>
        <Field label="cidade" value={u.cidade}/>
        <Field label="data de nascimento" value="14 mar 1991" type="date"/>
      </FieldGrid>
    </CardSecao>
  );
}

function DadosProfissionais({ u }) {
  return (
    <CardSecao titulo="dados profissionais" sub="usados nos relatórios e nos hospitais que precisam validar">
      <FieldGrid>
        <Field label="CRM" value={u.crm}/>
        <Field label="RQE" value="RQE 12387" />
        <Field label="especialidade" value={u.especialidade}/>
        <Field label="subespecialidade" value={u.subesp}/>
      </FieldGrid>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line-2)' }}>
        <Eyebrow style={{ display: 'block', marginBottom: 10 }}>vínculos ativos</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.values(HOSPITAIS).map(h => (
            <span key={h.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: `var(--${h.cor}-surface)`,
              padding: '6px 12px', borderRadius: 999,
              border: `1px solid color-mix(in oklab, var(--${h.cor}-ink) 16%, transparent)`,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: `var(--${h.cor})` }}/>
              <span style={{ font: '600 12px/1 var(--font-body)', color: `var(--${h.cor}-ink)` }}>{h.abrev}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>· {h.tipo || 'privado'}</span>
            </span>
          ))}
        </div>
      </div>
    </CardSecao>
  );
}

function PreferenciasMontar({ p }) {
  const [maxSem, setMaxSem] = React.useState(p.maxPlantoesPorSemana);
  const [meta, setMeta] = React.useState(p.metaMensal);
  const [janela, setJanela] = React.useState(p.janelaPreferida);
  const [evitar24, setEvitar24] = React.useState(p.evitar24hCorrido);

  return (
    <CardSecao
      titulo="preferências do montar"
      sub="o que o Montar leva em conta antes de sugerir plantões"
      accent="lavender"
    >
      <FieldGrid>
        <Field label="meta mensal" value={`R$ ${meta.toLocaleString('pt-BR')}`} prefix=""/>
        <Field label="máx plantões / semana" value={String(maxSem)} type="number"/>
      </FieldGrid>

      <div style={{ marginTop: 14 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 8 }}>dias da semana</Eyebrow>
        <DiasGrid preferidos={p.diasPreferidos} evitar={p.diasEvitar}/>
      </div>

      <div style={{ marginTop: 14 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 8 }}>janela do dia</Eyebrow>
        <SegmentedRow
          opcoes={[
            { id: 'dia',    label: 'manhã / tarde' },
            { id: 'noite',  label: 'noite' },
            { id: 'ambos',  label: 'tanto faz' },
          ]}
          ativo={janela}
          onChange={setJanela}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 8 }}>hospitais favoritos</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.values(HOSPITAIS).map(h => {
            const fav = p.hospitaisPreferidos.includes(h.id);
            return (
              <button key={h.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 999,
                background: fav ? `var(--${h.cor}-surface)` : 'var(--bg)',
                border: fav ? `1px solid var(--${h.cor}-ink)` : '1px solid var(--line)',
                color: fav ? `var(--${h.cor}-ink)` : 'var(--ink-2)',
                font: '600 12px/1 var(--font-body)',
                cursor: 'pointer',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: `var(--${h.cor})` }}/>
                {h.abrev}
                {fav && <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--line-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ToggleLine
          on={evitar24}
          onChange={setEvitar24}
          titulo="nunca emendar 24h corrido"
          sub="o Montar evita encadear plantão de dia + plantão de noite"
        />
        <ToggleLine
          defaultOn
          titulo="reservar fim de semana por mês"
          sub="ao menos um sábado ou domingo livre garantido"
        />
        <ToggleLine
          defaultOn
          titulo="proteger sono pós-plantão noturno"
          sub="11h+ de descanso são bloqueadas automaticamente"
        />
      </div>
    </CardSecao>
  );
}

function Notificacoes() {
  return (
    <CardSecao titulo="notificações" sub="o que vem por push, e-mail e WhatsApp">
      <NotifRow label="trocas pedidas para você"   push  email/>
      <NotifRow label="confirmação de plantão"     push       wpp/>
      <NotifRow label="conflito ou sobreposição"   push  email wpp/>
      <NotifRow label="resumo financeiro mensal"        email     />
      <NotifRow label="dicas e novidades do app"        email     />
    </CardSecao>
  );
}

function SegurancaCard() {
  return (
    <CardSecao titulo="segurança e privacidade" sub="senha, sessões e exportação">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <ItemBtn titulo="trocar senha"        sub="última troca em 22 mar 2026"/>
        <ItemBtn titulo="autenticação em 2 etapas" sub="ativada · SMS"/>
        <ItemBtn titulo="dispositivos conectados"  sub="3 sessões ativas"/>
        <ItemBtn titulo="exportar meus dados"     sub="LGPD · em até 7 dias"/>
        <ItemBtn titulo="encerrar conta"          sub="ação irreversível"  perigo/>
      </div>
    </CardSecao>
  );
}

// ====== building blocks ======
function CardSecao({ titulo, sub, accent, children }) {
  return (
    <article style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: '20px 22px',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, height: 4, width: '100%',
          background: `var(--${accent})`,
        }}/>
      )}
      <header style={{ marginBottom: 16, paddingTop: accent ? 4 : 0 }}>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18,
          color: 'var(--ink)', margin: 0, letterSpacing: '-0.005em',
        }}>{titulo}</h3>
        {sub && <p style={{
          font: '400 13px/1.45 var(--font-body)', color: 'var(--ink-3)', margin: '4px 0 0',
        }}>{sub}</p>}
      </header>
      {children}
    </article>
  );
}

function FieldGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

function Field({ label, value, type = 'text', suffix }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ font: '700 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>{label}</span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-alt)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        padding: '0 12px',
      }}>
        <input type={type} defaultValue={value} style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          font: '500 14px/1 var(--font-body)', color: 'var(--ink)',
          padding: '12px 0',
        }}/>
        {suffix}
      </span>
    </label>
  );
}

function TagVerificado() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      font: '700 10px/1 var(--font-body)', textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--sage-ink)',
      background: 'var(--sage-surface)',
      padding: '4px 8px', borderRadius: 999,
      flexShrink: 0,
    }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 6"/></svg>
      ok
    </span>
  );
}

function DiasGrid({ preferidos, evitar }) {
  const [pref, setPref] = React.useState(new Set(preferidos));
  const [evi, setEvi] = React.useState(new Set(evitar));
  const setOf = (set, v) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n; };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {DOWS.map(d => {
        const isPref = pref.has(d);
        const isEv = evi.has(d);
        const state = isPref ? 'pref' : isEv ? 'evita' : 'neutro';
        const bg = state === 'pref' ? 'var(--sage-surface)' : state === 'evita' ? 'var(--coral-surface)' : 'var(--bg-alt)';
        const ink = state === 'pref' ? 'var(--sage-ink)' : state === 'evita' ? 'var(--coral-ink)' : 'var(--ink-2)';
        const next = () => {
          if (state === 'neutro') { setPref(setOf(pref, d)); }
          else if (state === 'pref') { setPref(setOf(pref, d)); setEvi(setOf(evi, d)); }
          else { setEvi(setOf(evi, d)); }
        };
        return (
          <button key={d} onClick={next} style={{
            padding: '12px 6px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--line)',
            background: bg, color: ink,
            font: '600 12px/1.2 var(--font-body)',
            textTransform: 'lowercase',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            {d}
            <span style={{ font: '500 10px/1 var(--font-body)', opacity: 0.7 }}>
              {state === 'pref' ? '✓ prefere' : state === 'evita' ? '✕ evita' : 'neutro'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SegmentedRow({ opcoes, ativo, onChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-alt)',
      border: '1px solid var(--line)',
      borderRadius: 999,
      padding: 3,
      gap: 2,
    }}>
      {opcoes.map(o => {
        const a = ativo === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            font: '600 12px/1 var(--font-body)',
            padding: '8px 14px', borderRadius: 999,
            border: 'none',
            background: a ? 'var(--bg)' : 'transparent',
            color: a ? 'var(--ink)' : 'var(--ink-2)',
            boxShadow: a ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function ToggleLine({ on, defaultOn, onChange, titulo, sub }) {
  const [v, setV] = React.useState(on ?? defaultOn ?? false);
  React.useEffect(() => { if (typeof on !== 'undefined') setV(on); }, [on]);
  const tog = () => { const nv = !v; setV(nv); onChange && onChange(nv); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>{titulo}</div>
        {sub && <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={tog} style={{
        width: 38, height: 22, borderRadius: 999, border: 'none',
        background: v ? 'var(--sage-ink)' : 'var(--line-2)',
        position: 'relative', cursor: 'pointer', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: v ? 18 : 2,
          width: 18, height: 18, borderRadius: 999, background: 'var(--bg)',
          boxShadow: '0 1px 2px rgba(58,46,42,0.18)',
          transition: 'left 160ms cubic-bezier(.2,.7,.2,1)',
        }}/>
      </button>
    </div>
  );
}

function NotifRow({ label, push, email, wpp }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16,
      padding: '12px 0', borderBottom: '1px dashed var(--line-2)', alignItems: 'center',
    }}>
      <span style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--ink)' }}>{label}</span>
      <CanalChip on={push}  label="push"/>
      <CanalChip on={email} label="e-mail"/>
      <CanalChip on={wpp}   label="whatsapp"/>
    </div>
  );
}

function CanalChip({ on, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 999,
      background: on ? 'var(--sage-surface)' : 'var(--bg-alt)',
      color: on ? 'var(--sage-ink)' : 'var(--ink-3)',
      font: '600 11px/1 var(--font-body)',
      border: on ? '1px solid color-mix(in oklab, var(--sage-ink) 18%, transparent)' : '1px solid var(--line)',
      cursor: 'pointer', minWidth: 80, justifyContent: 'center',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? 'var(--sage)' : 'var(--line-2)' }}/>
      {label}
    </span>
  );
}

function ItemBtn({ titulo, sub, perigo }) {
  return (
    <button style={{
      textAlign: 'left',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 0', borderTop: '1px dashed var(--line-2)',
      border: 'none', background: 'transparent', cursor: 'pointer',
      width: '100%',
    }}>
      <div>
        <div style={{ font: '600 14px/1.2 var(--font-body)', color: perigo ? 'var(--coral-ink)' : 'var(--ink)' }}>{titulo}</div>
        <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: perigo ? 'var(--coral-ink)' : 'var(--ink-3)' }}><path d="M9 6l6 6-6 6"/></svg>
    </button>
  );
}

Object.assign(window, { UsuarioScreen });
