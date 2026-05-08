// =====================================================================
// agendar.jsx — Tela cheia para criar bloco (FAB → cria item)
//   Suporta TODOS os tipos: plantão, sono, bloqueio, consulta, estudo,
//   pessoal, outros. Forma respeita o tipo: campos aparecem/somem.
//   Sidebar mostra preview do Bloco em tempo real + checagem de conflito.
// =====================================================================

const TIPOS = [
  { k: 'plantao',   label: 'plantão',   sub: 'turno em hospital',          tone: 'lavender' },
  { k: 'sono',      label: 'sono',      sub: 'janela protegida',           tone: 'sage' },
  { k: 'bloqueio',  label: 'bloqueio',  sub: 'dia indisponível',           tone: 'ink-3' },
  { k: 'consulta',  label: 'consulta',  sub: 'consultório · ambulatório',  tone: 'coral' },
  { k: 'estudo',    label: 'estudo',    sub: 'curso · congresso · aula',   tone: 'blue' },
  { k: 'pessoal',   label: 'pessoal',   sub: 'fora da medicina',           tone: 'sand' },
  { k: 'outros',    label: 'outros',    sub: 'qualquer outra coisa',       tone: 'ink-2' },
];

const SUBTIPOS_ESTUDO = ['curso online', 'congresso', 'aula que dou', 'aula que recebo', 'pesquisa', 'reunião clínica'];

function AgendarScreen({ tipoInicial = 'plantao', mode, onClose }) {
  const [tipo, setTipo] = React.useState(tipoInicial);
  const [data, setData] = React.useState('2026-05-08');
  const [hi, setHi] = React.useState(7);
  const [dur, setDur] = React.useState(12);
  const [hosp, setHosp] = React.useState('HBDF');
  const [setor, setSetor] = React.useState('UTI Pediátrica');
  const [titulo, setTitulo] = React.useState('');
  const [local, setLocal] = React.useState('');
  const [subtipo, setSubtipo] = React.useState(SUBTIPOS_ESTUDO[0]);
  const [recorrente, setRecorrente] = React.useState(false);
  const [motivo, setMotivo] = React.useState('descanso');

  React.useEffect(() => {
    if (tipo === 'plantao') { setHi(7); setDur(12); }
    if (tipo === 'sono')    { setHi(8); setDur(8); }
    if (tipo === 'bloqueio'){ setHi(0); setDur(24); }
    if (tipo === 'consulta'){ setHi(14); setDur(4); }
    if (tipo === 'estudo')  { setHi(19); setDur(2); }
    if (tipo === 'pessoal') { setHi(18); setDur(2); }
    if (tipo === 'outros')  { setHi(12); setDur(1); }
  }, [tipo]);

  const bloco = {
    tipo,
    horaInicio: hi,
    duracao: dur,
    data,
    hospitalId: tipo === 'plantao' ? hosp : undefined,
    setor: tipo === 'plantao' ? setor : undefined,
    titulo: titulo,
    local: local,
    subtipo: tipo === 'estudo' ? subtipo : undefined,
    motivo: tipo === 'bloqueio' ? motivo : undefined,
    categoria: tipo === 'outros' ? 'outros' : undefined,
  };

  const tipoMeta = TIPOS.find(x => x.k === tipo);
  const conflitoFake = (tipo === 'plantao' && data === '2026-05-08' && hi === 7); // demo

  return (
    <main data-screen-label="Agendar · novo bloco" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 80px',
      animation: 'colo-page-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <RoleBanner mode={mode} />

      {/* Page head */}
      <header style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 6 }}>novo · {tipoMeta?.label}</Eyebrow>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(36px, 4vw, 44px)', color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
            o que vai pra agenda?
          </h1>
          <p style={{ font: '400 16px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 540 }}>
            agenda de médico não é só plantão · escolha o tipo e a gente adapta o formulário.
          </p>
        </div>
        <button onClick={onClose} style={{
          font: '600 13px/1 var(--font-body)', padding: '10px 18px',
          border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink-2)',
          borderRadius: 999, cursor: 'pointer',
        }}>fechar</button>
      </header>

      {/* Tipo chips */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TIPOS.map(t => (
            <button key={t.k} onClick={() => setTipo(t.k)} style={{
              border: '1px solid ' + (tipo === t.k ? `var(--${t.tone}-ink)` : 'var(--line)'),
              background: tipo === t.k ? `var(--${t.tone}-surface)` : 'var(--bg)',
              color: tipo === t.k ? `var(--${t.tone}-ink)` : 'var(--ink-2)',
              padding: '12px 18px',
              borderRadius: 14,
              cursor: 'pointer',
              font: '600 14px/1.1 var(--font-body)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 4,
              minWidth: 160,
              textAlign: 'left',
              transition: 'all 140ms',
            }}>
              <span>{t.label}</span>
              <span style={{ font: '400 11px/1.2 var(--font-body)', color: tipo === t.k ? `var(--${t.tone}-ink)` : 'var(--ink-3)', opacity: tipo === t.k ? 0.85 : 1 }}>{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 32, alignItems: 'flex-start' }}>
        {/* Form */}
        <section style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, padding: 28 }}>
          <FormRow label="quando">
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
          </FormRow>

          {tipo !== 'bloqueio' && (
            <FormRow label="horário">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <select value={hi} onChange={e => setHi(+e.target.value)} style={inp}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}h</option>)}
                </select>
                <span style={{ color: 'var(--ink-3)' }}>por</span>
                <select value={dur} onChange={e => setDur(+e.target.value)} style={inp}>
                  {[1,2,3,4,6,8,12,24].map(d => <option key={d} value={d}>{d}h</option>)}
                </select>
              </div>
            </FormRow>
          )}

          {tipo === 'plantao' && (<>
            <FormRow label="hospital">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.values(HOSPITAIS).map(h => (
                  <button key={h.id} onClick={() => setHosp(h.id)} style={{
                    border: '1px solid ' + (hosp === h.id ? `var(--${h.cor}-ink)` : 'var(--line)'),
                    background: hosp === h.id ? `var(--${h.cor}-surface)` : 'var(--bg)',
                    padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                    font: '600 13px/1 var(--font-body)',
                    color: hosp === h.id ? `var(--${h.cor}-ink)` : 'var(--ink-2)',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: `var(--${h.cor})` }}/>
                    {h.abrev}
                  </button>
                ))}
              </div>
            </FormRow>
            <FormRow label="setor">
              <input value={setor} onChange={e => setSetor(e.target.value)} placeholder="ex.: UTI Pediátrica" style={inp}/>
            </FormRow>
          </>)}

          {tipo === 'consulta' && (<>
            <FormRow label="local"><input value={local} onChange={e => setLocal(e.target.value)} placeholder="consultório próprio · clínica" style={inp}/></FormRow>
            <FormRow label="observações"><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="opcional · ex: 6 pacientes agendados" style={inp}/></FormRow>
          </>)}

          {tipo === 'estudo' && (<>
            <FormRow label="tipo">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SUBTIPOS_ESTUDO.map(s => (
                  <button key={s} onClick={() => setSubtipo(s)} style={{
                    border: '1px solid ' + (subtipo === s ? 'var(--blue-ink)' : 'var(--line)'),
                    background: subtipo === s ? 'var(--blue-surface)' : 'var(--bg)',
                    color: subtipo === s ? 'var(--blue-ink)' : 'var(--ink-2)',
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                    font: '500 12px/1 var(--font-body)',
                  }}>{s}</button>
                ))}
              </div>
            </FormRow>
            <FormRow label="título"><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="ex: Congresso SBP 2026" style={inp}/></FormRow>
          </>)}

          {tipo === 'pessoal' && (
            <FormRow label="o que é"><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="aniversário, terapia, mercado..." style={inp}/></FormRow>
          )}

          {tipo === 'outros' && (<>
            <FormRow label="título"><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="o nome desse compromisso" style={inp}/></FormRow>
            <FormRow label="categoria"><input value={local} onChange={e => setLocal(e.target.value)} placeholder="opcional · ex: voluntariado, advocacia" style={inp}/></FormRow>
          </>)}

          {tipo === 'bloqueio' && (
            <FormRow label="motivo">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['descanso', 'férias', 'consulta médica', 'compromisso pessoal'].map(m => (
                  <button key={m} onClick={() => setMotivo(m)} style={{
                    border: '1px solid ' + (motivo === m ? 'var(--ink)' : 'var(--line)'),
                    background: motivo === m ? 'var(--bg-alt)' : 'var(--bg)',
                    color: motivo === m ? 'var(--ink)' : 'var(--ink-2)',
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                    font: '500 12px/1 var(--font-body)',
                  }}>{m}</button>
                ))}
              </div>
            </FormRow>
          )}

          <FormRow label="recorrência">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', font: '500 14px/1 var(--font-body)', color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} />
              repetir toda semana
            </label>
          </FormRow>

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button onClick={onClose} style={{
              flex: 1, font: '600 14px/1 var(--font-body)', padding: '14px 22px',
              borderRadius: 999, border: 'none', background: 'var(--ink)', color: 'var(--bg)', cursor: 'pointer',
            }}>salvar na agenda</button>
            <button onClick={onClose} style={{
              font: '500 14px/1 var(--font-body)', padding: '14px 18px',
              borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink-2)', cursor: 'pointer',
            }}>cancelar</button>
          </div>
        </section>

        {/* Preview rail */}
        <aside style={{ position: 'sticky', top: 88, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Eyebrow style={{ display: 'block' }}>preview · como vai aparecer</Eyebrow>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
            <div style={{ width: 200 }}>
              <Bloco b={bloco} density={48}/>
            </div>
            <div style={{ marginTop: 14, font: '400 12px/1.5 var(--font-body)', color: 'var(--ink-3)' }}>
              {data} · {String(hi).padStart(2,'0')}h{tipo !== 'bloqueio' ? ` → ${String((hi+dur)%24).padStart(2,'0')}h` : ' · dia inteiro'}
            </div>
          </div>

          {conflitoFake && (
            <div style={{
              background: 'var(--coral-surface)', border: '1px solid var(--coral)',
              borderRadius: 14, padding: 16,
              animation: 'colo-pulse-conflict 2.4s ease-in-out infinite',
            }}>
              <Eyebrow color="var(--coral-ink)" style={{ display: 'block', marginBottom: 4 }}>atenção · conflito</Eyebrow>
              <p style={{ font: '500 13px/1.45 var(--font-body)', color: 'var(--coral-ink)', margin: 0 }}>
                você já tem <strong>HSL · 19h</strong> nesse dia. esse plantão sobrepõe parcialmente.
              </p>
              <button style={{
                marginTop: 10, font: '600 12px/1 var(--font-body)',
                padding: '8px 14px', borderRadius: 999, border: '1px solid var(--coral-ink)',
                background: 'var(--bg)', color: 'var(--coral-ink)', cursor: 'pointer',
              }}>resolver conflito →</button>
            </div>
          )}

          <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--ink-3)' }}>
            <Hand color="var(--ink-2)" size={14}>dica:</Hand> agenda do médico não é só plantão. cabem aqui consultório, aulas, congresso, terapia, aniversário. tudo soma na carga semanal? não — <strong>só plantão e consulta entram no cálculo de horas trabalhadas</strong>.
          </div>
        </aside>
      </div>
    </main>
  );
}

function FormRow({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <label style={{ font: '600 11px/1 var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

const inp = {
  font: '500 14px/1 var(--font-body)',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--bg-alt)',
  color: 'var(--ink)',
  outline: 'none',
  minWidth: 180,
};

Object.assign(window, { AgendarScreen });
