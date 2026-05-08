// =====================================================================
// hospitais.jsx — CRUD de hospitais
//   Layout: page-head + grid de cards (3 col desktop, 2 col tablet, 1 col mobile)
//   Cada card: faixa cor + tipo (público/privado) + sigla + nome + endereço
//             + telefone + turnos padrão + calculadora (depende do tipo)
//             + regras de escala (semanais)
//   Form: drawer lateral à direita, com filtro público/privado + "me explica"
// =====================================================================

const HOSP_DETALHES = {
  HSL:  { endereco: 'SHLS 716 Cj C',   bairro: 'Asa Sul',         cep: '70390-902', tel: '(61) 3445-0000', distancia: '14 min de casa', turnos: ['M · 7h (6h)', 'T · 13h (6h)', 'N · 19h (12h)'] },
  HBDF: { endereco: 'SMHS Q 101',      bairro: 'Asa Sul',         cep: '70335-900', tel: '(61) 3315-1200', distancia: '22 min de casa', turnos: ['M · 7h (12h)', 'T · 13h (6h)', 'N · 19h (12h)'] },
  HDS:  { endereco: 'SGAS 914',        bairro: 'Asa Sul',         cep: '70390-145', tel: '(61) 3329-9000', distancia: '17 min de casa', turnos: ['M · 7h (12h)', 'N · 19h (12h)'] },
  HCB:  { endereco: 'AENW 03 Lt A',    bairro: 'Setor Noroeste',  cep: '70684-831', tel: '(61) 3025-8200', distancia: '11 min de casa', turnos: ['M · 7h (12h)', 'N · 19h (12h)'] },
};

const SWATCHES = ['sand', 'coral', 'sage', 'olive', 'lavender', 'pink', 'blue', 'aqua'];

// ----------------------------------------------------------
// HospitaisScreen — tela inteira
// ----------------------------------------------------------
function HospitaisScreen({ mode, vazio = false }) {
  const [editing, setEditing] = React.useState(null); // null | 'new' | hospId
  const [open, setOpen] = React.useState(false);

  const onAdd = () => { setEditing('new'); setOpen(true); };
  const onEdit = (id) => { setEditing(id); setOpen(true); };
  const onClose = () => { setOpen(false); setTimeout(() => setEditing(null), 180); };

  if (vazio) {
    return (
      <main data-screen-label="Hospitais · vazio" style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 32px 80px' }}>
        <RoleBanner mode={mode} />
        <HospitaisHead onAdd={onAdd} compact/>
        <EmptySemHospitais onAdicionar={onAdd}/>
        <HospitalDrawer open={open} editing={editing} onClose={onClose}/>
      </main>
    );
  }

  const ids = Object.keys(HOSPITAIS);

  return (
    <main data-screen-label="Hospitais · CRUD" style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 32px 96px' }}>
      <RoleBanner mode={mode}/>
      <HospitaisHead onAdd={onAdd}/>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 20,
        marginTop: 28,
      }}>
        {ids.map(id => (
          <HospitalCard key={id} hosp={HOSPITAIS[id]} det={HOSP_DETALHES[id]} onEdit={() => onEdit(id)} />
        ))}
      </div>

      <HospitalDrawer open={open} editing={editing} onClose={onClose}/>
    </main>
  );
}

function HospitaisHead({ onAdd, compact }) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 24,
      marginTop: compact ? 0 : 4,
    }}>
      <div>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>cadastro · base do app</Eyebrow>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          fontSize: 'clamp(36px, 4vw, 44px)',
          color: 'var(--ink)', letterSpacing: '-0.02em',
          lineHeight: 1.05, margin: 0, textWrap: 'balance',
        }}>seus hospitais</h1>
        <p style={{
          font: '400 16px/1.45 var(--font-body)',
          color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 580,
        }}>
          Os hospitais que aparecem nas suas escalas. Cada um vira uma cor própria
          na grade, na lista e nos relatórios.
        </p>
      </div>

      <button onClick={onAdd} style={{
        flexShrink: 0,
        font: '600 13px/1 var(--font-body)',
        padding: '14px 20px',
        borderRadius: 999,
        border: 'none',
        background: 'var(--ink)',
        color: 'var(--bg)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Adicionar hospital
      </button>
    </header>
  );
}

// ----------------------------------------------------------
// TipoChip — público / privado
// ----------------------------------------------------------
function TipoChip({ tipo, cor }) {
  const isPub = tipo === 'publico';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      background: isPub ? 'var(--bg-alt)' : `var(--${cor || 'sand'}-surface)`,
      border: `1px solid ${isPub ? 'var(--line)' : `color-mix(in oklab, var(--${cor || 'sand'}-ink) 18%, transparent)`}`,
      font: '600 10px/1 var(--font-body)',
      color: isPub ? 'var(--ink-2)' : `var(--${cor || 'sand'}-ink)`,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r={isPub ? "5" : "12"} fillOpacity={isPub ? 0.85 : 1}/>
      </svg>
      {isPub ? 'público' : 'privado'}
    </span>
  );
}

// ----------------------------------------------------------
// HospitalCard
// ----------------------------------------------------------
function HospitalCard({ hosp, det, onEdit }) {
  const c = hosp.cor;
  const tipo = hosp.tipo || 'privado';
  return (
    <article style={{
      position: 'relative',
      background: 'var(--bg)',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Faixa colorida da família */}
      <div style={{
        height: 8,
        background: `linear-gradient(90deg, var(--${c}) 0%, var(--${c}) 60%, var(--${c}-surface) 100%)`,
      }}/>

      <div style={{ padding: '18px 20px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Eyebrow color={`var(--${c}-ink)`}>{hosp.abrev}</Eyebrow>
            <TipoChip tipo={tipo} cor={c}/>
          </div>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 22, lineHeight: 1.15,
            letterSpacing: '-0.005em',
            margin: 0, color: 'var(--ink)',
          }}>{hosp.nome}</h3>
        </div>
        <span style={{
          width: 34, height: 34, borderRadius: 999,
          background: `var(--${c}-surface)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 13,
          color: `var(--${c}-ink)`,
          letterSpacing: '-0.01em',
          flexShrink: 0,
        }}>{hosp.abrev.slice(0,3)}</span>
      </div>

      {/* endereço + telefone */}
      <div style={{ padding: '0 20px 14px' }}>
        <p style={{
          font: '400 13px/1.45 var(--font-body)', color: 'var(--ink-2)',
          margin: '6px 0 0',
        }}>
          {det.endereco} · {det.bairro}
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--ink-3)', margin: '3px 0 0',
        }}>
          CEP {det.cep} · <span style={{ color: 'var(--ink-2)' }}>{det.distancia}</span>
        </p>
        <p style={{
          font: '500 13px/1.4 var(--font-body)', color: 'var(--ink-2)',
          margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
          </svg>
          {det.tel}
        </p>
      </div>

      {/* turnos padrão */}
      <div style={{ padding: '0 20px 14px', borderTop: '1px solid var(--line)' }}>
        <Eyebrow style={{ display: 'block', marginTop: 14, marginBottom: 8 }}>turnos padrão</Eyebrow>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {det.turnos.map(t => (
            <Pill key={t} kind="neutral" dot={false}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 11, textTransform: 'none', letterSpacing: 0, padding: '6px 10px' }}>
              {t}
            </Pill>
          ))}
        </div>
      </div>

      {/* calculadora — depende do tipo */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        <ToggleRow
          ativo
          titulo="calculadora de plantão"
          sub={tipo === 'publico' ? 'valor fixo · público' : 'valor por hora · privado'}
          ink={`var(--${c}-ink)`}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {tipo === 'publico' ? (
            <>
              <ValorMini label="valor fixo / plantão" valor={`R$ ${hosp.valorFixo || hosp.valorPlantao}`}/>
              <ValorMini label="adicional noturno" valor={`+ R$ ${hosp.adicionalNoite || 0}`}/>
            </>
          ) : (
            <>
              <ValorMini label="valor / hora" valor={`R$ ${hosp.valorHora || Math.round((hosp.valorPlantao||0)/12)}`}/>
              <ValorMini label="adicional noturno" valor={`+ R$ ${hosp.adicionalNoite || 0}`}/>
            </>
          )}
        </div>
      </div>

      {/* regras semanais */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
        <ToggleRow
          ativo
          titulo="regras de escala"
          sub="por semana · aplicadas ao montar"
          ink={`var(--${c}-ink)`}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <ValorMini label="máx / semana" valor={`${hosp.regras.maxPorSemana ?? 2}`}/>
          <ValorMini label="mín FDS / mês" valor={`${hosp.regras.minFimDeSemana}`}/>
          <ValorMini label="intervalo mín" valor={`${hosp.regras.intervaloMinHoras}h`}/>
          <ValorMini label="duração padrão" valor={`${hosp.regras.duracaoPlantao}h`}/>
        </div>
      </div>

      {/* footer ações */}
      <div style={{
        marginTop: 'auto',
        padding: '12px 16px 14px 20px',
        borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-alt)',
      }}>
        <button onClick={onEdit} style={{
          font: '600 13px/1 var(--font-body)',
          padding: '10px 16px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          color: 'var(--ink)',
          cursor: 'pointer',
        }}>Editar</button>
        <button title="excluir hospital" style={{
          width: 36, height: 36,
          borderRadius: 999,
          border: '1px solid transparent',
          background: 'transparent',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </article>
  );
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function ToggleRow({ ativo, titulo, sub, ink }) {
  const [on, setOn] = React.useState(ativo);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>{titulo}</div>
        {sub && <div style={{ font: '400 12px/1.3 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => setOn(!on)} style={{
        width: 38, height: 22,
        borderRadius: 999,
        border: 'none',
        background: on ? (ink || 'var(--sage-ink)') : 'var(--line-2)',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 160ms',
      }}>
        <span style={{
          position: 'absolute',
          top: 2, left: on ? 18 : 2,
          width: 18, height: 18,
          borderRadius: 999,
          background: 'var(--bg)',
          boxShadow: '0 1px 2px rgba(58,46,42,0.18)',
          transition: 'left 160ms cubic-bezier(.2,.7,.2,1)',
        }}/>
      </button>
    </div>
  );
}

function ValorMini({ label, valor }) {
  return (
    <div style={{
      background: 'var(--bg-alt)',
      borderRadius: 'var(--r-sm)',
      padding: '8px 10px',
    }}>
      <div style={{ font: '700 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)', marginTop: 4, letterSpacing: '-0.01em' }}>{valor}</div>
    </div>
  );
}

// ----------------------------------------------------------
// HospitalDrawer — form lateral
// ----------------------------------------------------------
function HospitalDrawer({ open, editing, onClose }) {
  if (!open) return null;
  const isNew = editing === 'new';
  const hosp = (!isNew && editing) ? HOSPITAIS[editing] : null;
  const det = (!isNew && editing) ? HOSP_DETALHES[editing] : null;

  const [cor, setCor] = React.useState(hosp ? hosp.cor : 'lavender');
  const [tipo, setTipo] = React.useState(hosp ? (hosp.tipo || 'privado') : 'privado');
  const [calcOn, setCalcOn] = React.useState(true);
  const [regrasOn, setRegrasOn] = React.useState(true);
  const [explica, setExplica] = React.useState(false);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(58,46,42,0.18)',
        zIndex: 50,
        animation: 'colo-fade-in 200ms ease-out',
      }}/>
      <aside role="dialog" aria-label={isNew ? 'Adicionar hospital' : 'Editar hospital'} style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 'min(560px, 100vw)',
        background: 'var(--bg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 51,
        display: 'flex', flexDirection: 'column',
        animation: 'colo-drawer-in 240ms cubic-bezier(.2,.7,.2,1)',
      }}>
        {/* faixa cor escolhida */}
        <div style={{ height: 6, background: `var(--${cor})`, transition: 'background 200ms' }}/>

        <header style={{ padding: '20px 28px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow style={{ display: 'block', marginBottom: 4 }}>{isNew ? 'novo' : 'editar'}</Eyebrow>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)' }}>
              {isNew ? 'Adicionar hospital' : hosp.nome}
            </h2>
          </div>
          <button onClick={onClose} aria-label="fechar" style={{
            width: 36, height: 36, borderRadius: 999, border: '1px solid var(--line)',
            background: 'var(--bg)', color: 'var(--ink-2)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 16px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* nome + abrev */}
          <FormSection titulo="identificação">
            <FormRow>
              <FormField label="nome completo" defaultValue={hosp ? hosp.nome : ''} placeholder="Ex.: Hospital Santa Lúcia" flex={2}/>
              <FormField label="sigla" defaultValue={hosp ? hosp.abrev : ''} placeholder="HSL"/>
            </FormRow>
          </FormSection>

          {/* tipo: público / privado */}
          <FormSection titulo="tipo de hospital" sub="muda a forma de calcular o plantão">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TipoCard
                ativo={tipo === 'publico'}
                onClick={() => setTipo('publico')}
                titulo="público"
                sub="valor fixo por plantão"
                exemplo="ex.: HBDF, HCB, SES"
              />
              <TipoCard
                ativo={tipo === 'privado'}
                onClick={() => setTipo('privado')}
                titulo="privado"
                sub="valor por hora trabalhada"
                exemplo="ex.: HSL, DF Star, Sírio"
              />
            </div>
          </FormSection>

          {/* família de cor */}
          <FormSection titulo="família de cor" sub="cor que esse hospital terá em toda a app">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              {SWATCHES.map(s => (
                <button key={s} onClick={() => setCor(s)} title={s} style={{
                  width: 44, height: 44,
                  borderRadius: 'var(--r-md)',
                  border: cor === s ? `2px solid var(--${s}-ink)` : '1px solid rgba(58,46,42,0.06)',
                  background: `var(--${s}-surface)`,
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: `var(--${s})`,
                  }}/>
                  {cor === s && (
                    <svg style={{ position: 'absolute', bottom: -8, right: -8, width: 18, height: 18, background: 'var(--bg)', borderRadius: 999, padding: 2 }} viewBox="0 0 24 24" fill="none" stroke={`var(--${s}-ink)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 6"/></svg>
                  )}
                </button>
              ))}
            </div>
          </FormSection>

          {/* endereço */}
          <FormSection titulo="endereço" sub="o CEP busca via ViaCEP · geocode automático">
            <FormRow>
              <FormField label="CEP" defaultValue={det ? det.cep : ''} placeholder="00000-000" flex={1}/>
              <FormField label="logradouro" defaultValue={det ? det.endereco : ''} placeholder="rua / quadra / lote" flex={3}/>
            </FormRow>
            <FormRow>
              <FormField label="bairro" defaultValue={det ? det.bairro : ''} flex={2}/>
              <FormField label="telefone do plantão" defaultValue={det ? det.tel : ''} placeholder="(00) 0000-0000" flex={2}/>
            </FormRow>
          </FormSection>

          {/* turnos padrão */}
          <FormSection titulo="turnos padrão" sub="modelos prontos para clicar ao adicionar plantão">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(det ? det.turnos : ['M · 7h (12h)', 'N · 19h (12h)']).map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px',
                  background: 'var(--bg-alt)',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', flex: 1 }}>{t}</span>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              <button style={{
                font: '500 13px/1 var(--font-body)',
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px dashed var(--line-2)',
                background: 'transparent',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                textAlign: 'left',
              }}>+ adicionar turno</button>
            </div>
          </FormSection>

          {/* calculadora — campos dependem do tipo */}
          <FormSection
            titulo="calculadora de plantão"
            sub={tipo === 'publico' ? 'público · valor fixo + adicional noturno em R$' : 'privado · valor por hora + adicional noturno em R$'}
            toggleOn={calcOn}
            onToggle={() => setCalcOn(v => !v)}
          >
            {calcOn && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {tipo === 'publico' ? (
                  <>
                    <FormField
                      label="valor fixo / plantão"
                      defaultValue={hosp ? (hosp.valorFixo || hosp.valorPlantao || '') : ''}
                      prefix="R$"
                    />
                    <FormField
                      label="adicional noturno"
                      defaultValue={hosp ? (hosp.adicionalNoite || '') : ''}
                      prefix="R$"
                    />
                  </>
                ) : (
                  <>
                    <FormField
                      label="valor / hora"
                      defaultValue={hosp ? (hosp.valorHora || (hosp.valorPlantao ? Math.round(hosp.valorPlantao/12) : '')) : ''}
                      prefix="R$"
                    />
                    <FormField
                      label="adicional noturno"
                      defaultValue={hosp ? (hosp.adicionalNoite || '') : ''}
                      prefix="R$"
                    />
                  </>
                )}
              </div>
            )}
          </FormSection>

          {/* regras de escala — semanais + me explica */}
          <FormSection
            titulo="regras de escala"
            sub="aplicadas pelo Montar pra propor a escala da semana"
            toggleOn={regrasOn}
            onToggle={() => setRegrasOn(v => !v)}
            extra={
              <button
                onClick={() => setExplica(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  font: '600 11px/1 var(--font-body)',
                  padding: '6px 10px', borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: explica ? 'var(--lavender-surface)' : 'var(--bg)',
                  color: explica ? 'var(--lavender-ink)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 4M12 17h.01"/>
                </svg>
                me explica
              </button>
            }
          >
            {regrasOn && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <FormField label="máx plantões / semana" defaultValue={hosp ? (hosp.regras.maxPorSemana ?? 2) : 2} type="number"/>
                  <FormField label="mín FDS / mês" defaultValue={hosp ? hosp.regras.minFimDeSemana : 1} type="number"/>
                  <FormField label="intervalo mín entre plantões" defaultValue={hosp ? hosp.regras.intervaloMinHoras : 11} suffix="h"/>
                  <FormField label="duração padrão" defaultValue={hosp ? hosp.regras.duracaoPlantao : 12} suffix="h"/>
                </div>
                {explica && <ExplicaRegras tipo={tipo}/>}
              </>
            )}
          </FormSection>
        </div>

        {/* footer ações */}
        <footer style={{
          padding: '14px 28px',
          borderTop: '1px solid var(--line)',
          background: 'var(--bg-alt)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          {!isNew ? (
            <button style={{
              font: '500 13px/1 var(--font-body)',
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              color: 'var(--coral-ink)',
              cursor: 'pointer',
            }}>Excluir hospital</button>
          ) : <span/>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              font: '500 13px/1 var(--font-body)',
              padding: '12px 18px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink-2)',
              cursor: 'pointer',
            }}>Cancelar</button>
            <button style={{
              font: '600 13px/1 var(--font-body)',
              padding: '12px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}>{isNew ? 'Criar hospital' : 'Salvar alterações'}</button>
          </div>
        </footer>
      </aside>
    </>
  );
}

function TipoCard({ ativo, onClick, titulo, sub, exemplo }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left',
      padding: '14px 16px',
      borderRadius: 'var(--r-md)',
      border: ativo ? '2px solid var(--ink)' : '1px solid var(--line)',
      background: ativo ? 'var(--bg)' : 'var(--bg-alt)',
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 4,
      boxShadow: ativo ? 'var(--shadow-sm)' : 'none',
      transition: 'all 140ms',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 14, height: 14, borderRadius: 999,
          border: ativo ? '4px solid var(--ink)' : '2px solid var(--line-2)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}/>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{titulo}</span>
      </span>
      <span style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-2)', marginLeft: 22 }}>{sub}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginLeft: 22, marginTop: 2 }}>{exemplo}</span>
    </button>
  );
}

function ExplicaRegras({ tipo }) {
  return (
    <div style={{
      marginTop: 12,
      padding: '14px 16px',
      background: 'var(--lavender-surface)',
      borderRadius: 'var(--r-md)',
      border: '1px solid color-mix(in oklab, var(--lavender-ink) 16%, transparent)',
      animation: 'colo-drawer-down 200ms ease-out',
    }}>
      <Eyebrow color="var(--lavender-ink)" style={{ display: 'block', marginBottom: 8 }}>como o Montar usa essas regras</Eyebrow>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ExplicaItem
          titulo="máx plantões / semana"
          texto="Limite que o Montar respeita ao distribuir plantões. Se você colocar 2, ele nunca vai sugerir 3 plantões deste hospital na mesma semana — mesmo que sobre dia."
        />
        <ExplicaItem
          titulo="mín FDS / mês"
          texto="Compromisso mínimo de fim de semana com o hospital no mês. Se for 2, o Montar garante 2 plantões em sábado/domingo antes de fechar a escala."
        />
        <ExplicaItem
          titulo="intervalo mín entre plantões"
          texto="Descanso obrigatório entre o fim de um plantão e o início do próximo. Recomendação CFM: 11h. Se você emendar, o Montar avisa."
        />
        <ExplicaItem
          titulo="duração padrão"
          texto={tipo === 'publico'
            ? 'Duração que vem pré-marcada ao adicionar plantão. Como esse é público, o valor é fixo independente da hora — então isso muda só a janela na grade.'
            : 'Duração que vem pré-marcada ao adicionar plantão. Como esse é privado, o cálculo é valor/hora × duração — mexer aqui muda quanto cada plantão rende.'
          }
        />
      </ul>
    </div>
  );
}

function ExplicaItem({ titulo, texto }) {
  return (
    <li style={{ display: 'flex', gap: 10 }}>
      <span style={{
        width: 18, height: 18, borderRadius: 999,
        background: 'var(--bg)',
        color: 'var(--lavender-ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 6"/></svg>
      </span>
      <div>
        <div style={{ font: '600 12px/1.2 var(--font-body)', color: 'var(--lavender-ink)' }}>{titulo}</div>
        <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--ink-2)', marginTop: 2 }}>{texto}</div>
      </div>
    </li>
  );
}

function FormSection({ titulo, sub, toggleOn, onToggle, extra, children }) {
  return (
    <section>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)', margin: 0 }}>{titulo}</h4>
          {sub && <p style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', margin: '3px 0 0' }}>{sub}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {extra}
          {typeof toggleOn !== 'undefined' && (
            <button onClick={onToggle} style={{
              width: 38, height: 22, borderRadius: 999, border: 'none',
              background: toggleOn ? 'var(--sage-ink)' : 'var(--line-2)',
              position: 'relative', cursor: 'pointer', flexShrink: 0,
            }}>
              <span style={{ position: 'absolute', top: 2, left: toggleOn ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: 'var(--bg)', boxShadow: '0 1px 2px rgba(58,46,42,0.18)', transition: 'left 160ms' }}/>
            </button>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

function FormRow({ children }) {
  return <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>{children}</div>;
}

function FormField({ label, defaultValue, placeholder, prefix, suffix, type = 'text', flex = 1 }) {
  return (
    <label style={{ flex, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ font: '700 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>{label}</span>
      <span style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        padding: '0 10px',
      }}>
        {prefix && <span style={{ font: '500 13px/1 var(--font-body)', color: 'var(--ink-3)', marginRight: 6 }}>{prefix}</span>}
        <input type={type} defaultValue={defaultValue} placeholder={placeholder} style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          font: '500 14px/1 var(--font-body)', color: 'var(--ink)',
          padding: '11px 0',
        }}/>
        {suffix && <span style={{ font: '500 13px/1 var(--font-body)', color: 'var(--ink-3)', marginLeft: 6 }}>{suffix}</span>}
      </span>
    </label>
  );
}

Object.assign(window, { HospitaisScreen, HospitalCard, HospitalDrawer });
