// =====================================================================
// time.jsx — Tela Equipe / Time
// Foco: visão do admin/coordenador sobre quem está sobrecarregado,
// quem tem pendências e o que precisa de aprovação.
// Para médica: visão mais leve, "quem está comigo essa semana".
// =====================================================================

function TimeScreen({ mode, onSelectMember, onApprove }) {
  const [filtro, setFiltro] = React.useState('todos'); // todos|sobrecarga|pendencias|ferias

  const filtrados = TIME.filter(p => {
    if (mode === 'medica' && filtro === 'todos') return true;
    if (filtro === 'todos') return true;
    if (filtro === 'sobrecarga') return p.nivel !== 'ok';
    if (filtro === 'pendencias') return p.pendencias > 0;
    if (filtro === 'ferias') return !!p.ferias;
    return true;
  });

  const isAdmin = mode === 'admin';
  const isPart  = mode === 'parceiro';

  return (
    <main data-screen-label="Time" style={{
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
          <Eyebrow style={{ display: 'block', marginBottom: 6 }}>
            {isAdmin ? 'coordenação · pediatria' : isPart ? 'pessoas próximas' : 'colegas desta semana'}
          </Eyebrow>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 'clamp(36px, 4vw, 44px)',
            color: 'var(--ink)', letterSpacing: '-0.02em',
            lineHeight: 1.05, margin: 0,
          }}>
            {isAdmin ? 'seu time' : isPart ? 'time da Carla' : 'quem está com você'}
          </h1>
          <p style={{
            font: '400 16px/1.4 var(--font-body)',
            color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 600,
          }}>
            {isAdmin
              ? '8 pediatras · 4 hospitais · 3 pendências para revisar'
              : isPart
              ? 'as pessoas que dividem a semana com a Carla'
              : 'colegas escalados nos mesmos hospitais e dias'}
          </p>
        </div>

        {isAdmin && (
          <FilterPills value={filtro} onChange={setFiltro} />
        )}
      </div>

      {/* Layout: lista de pessoas + (admin) coluna de pendências */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isAdmin ? 'minmax(0, 1fr) 360px' : '1fr',
        gap: 28,
        alignItems: 'flex-start',
      }}>
        <PeopleList people={filtrados} mode={mode} onSelect={onSelectMember} />
        {isAdmin && <PendingPanel onApprove={onApprove} />}
      </div>
    </main>
  );
}

// =========================
// Filtros (admin)
// =========================
function FilterPills({ value, onChange }) {
  const opts = [
    { k: 'todos',       label: 'todos · 8' },
    { k: 'sobrecarga',  label: 'sobrecarga · 3', color: 'coral' },
    { k: 'pendencias',  label: 'com pendência · 3', color: 'lavender' },
    { k: 'ferias',      label: 'férias · 1', color: 'sage' },
  ];
  return (
    <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      {opts.map(o => {
        const active = value === o.k;
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{
            font: '600 12px/1 var(--font-body)',
            padding: '8px 14px',
            borderRadius: 999,
            border: active ? '1px solid var(--ink)' : '1px solid var(--line)',
            background: active ? 'var(--ink)' : 'var(--bg)',
            color: active ? 'var(--bg)' : 'var(--ink-2)',
            cursor: 'pointer',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// =========================
// Lista de pessoas — cards densos
// =========================
function PeopleList({ people, mode, onSelect }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
      gap: 14,
    }}>
      {people.map(p => (
        <PersonCard key={p.id} person={p} mode={mode} onClick={() => onSelect && onSelect(p)} />
      ))}
    </div>
  );
}

function PersonCard({ person, mode, onClick }) {
  const tokens = {
    ok:   { dot: 'var(--sage)',  ink: 'var(--sage-ink)',    surf: 'var(--sage-surface)' },
    warn: { dot: '#D9A85A',       ink: '#B8884A',            surf: 'var(--sand-surface)' },
    err:  { dot: 'var(--coral)', ink: 'var(--coral-ink)',   surf: 'var(--coral-surface)' },
  }[person.nivel];

  return (
    <div onClick={onClick} style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 18,
      padding: '18px 20px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transition: 'border-color 120ms, box-shadow 120ms',
      boxShadow: person.isMe ? '0 0 0 2px var(--lavender-ink)' : 'var(--shadow-sm)',
      position: 'relative',
    }}>
      {person.isMe && (
        <div style={{
          position: 'absolute', top: -8, right: 16,
          background: 'var(--lavender-ink)', color: 'var(--bg)',
          font: '700 9px/1 var(--font-body)',
          padding: '4px 8px', borderRadius: 999,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>você</div>
      )}

      {/* Linha 1: avatar + nome + título */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar iniciais={person.iniciais} role={person.role} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            font: '600 15px/1.2 var(--font-body)',
            color: 'var(--ink)',
            letterSpacing: '-0.005em',
          }}>{person.nome}</div>
          <div style={{
            font: '400 12px/1.3 var(--font-body)',
            color: 'var(--ink-3)',
            marginTop: 2,
          }}>{person.titulo}</div>
        </div>
        {person.pendencias > 0 && (
          <div style={{
            background: 'var(--lavender-surface)',
            color: 'var(--lavender-ink)',
            font: '700 11px/1 var(--font-body)',
            width: 22, height: 22, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{person.pendencias}</div>
        )}
      </div>

      {/* Linha 2: hospitais (chips coloridos) */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {person.hospitais.map(hid => {
          const hosp = HOSPITAIS[hid];
          return (
            <span key={hid} style={{
              font: '600 10px/1 var(--font-body)',
              color: `var(--${hosp.cor}-ink)`,
              background: `var(--${hosp.cor}-surface)`,
              padding: '4px 8px',
              borderRadius: 6,
              letterSpacing: '0.02em',
            }}>{hosp.abrev}</span>
          );
        })}
      </div>

      {/* Linha 3: carga semanal — barra + número */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}>
          <span style={{
            font: '500 11px/1 var(--font-body)',
            color: 'var(--ink-3)',
            textTransform: 'lowercase',
            letterSpacing: '0.02em',
          }}>carga · semana</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 4,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 18,
              color: tokens.ink,
              letterSpacing: '-0.01em',
            }}>{person.cargaSemana}h</span>
            <TrendIcon t={person.tendencia} />
          </span>
        </div>
        <CargaBar h={person.cargaSemana} nivel={person.nivel} />
      </div>

      {/* Linha 4: próximo plantão / férias */}
      {person.ferias ? (
        <div style={{
          background: 'var(--sage-surface)',
          padding: '10px 12px',
          borderRadius: 10,
          font: '500 12px/1.3 var(--font-body)',
          color: 'var(--sage-ink)',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--sage)' }}/>
          férias · {person.ferias}
        </div>
      ) : person.proximo ? (
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          paddingTop: 10,
          borderTop: '1px dashed var(--line)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: `var(--${HOSPITAIS[person.proximo.hospital].cor})`,
          }}/>
          <Eyebrow color="var(--ink-3)">próximo</Eyebrow>
          <span style={{
            font: '600 12px/1.2 var(--font-body)',
            color: 'var(--ink)',
          }}>
            {fmtDate(person.proximo.data)} · {person.proximo.hora}
          </span>
          <span style={{
            font: '400 12px/1.2 var(--font-body)',
            color: 'var(--ink-3)',
            marginLeft: 'auto',
          }}>{person.proximo.setor}</span>
        </div>
      ) : null}
    </div>
  );
}

// =========================
// Avatar com inicial
// =========================
function Avatar({ iniciais, role, size = 40 }) {
  const isAdmin = role === 'admin';
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: isAdmin ? 'var(--coral-surface)' : 'var(--lavender-surface)',
      color: isAdmin ? 'var(--coral-ink)' : 'var(--lavender-ink)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '600 13px/1 var(--font-body)',
      letterSpacing: '0.02em',
      flexShrink: 0,
      border: isAdmin ? '1.5px solid var(--coral)' : '1px solid var(--line)',
    }}>{iniciais}</div>
  );
}

function TrendIcon({ t }) {
  if (t === 'subindo') return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--coral)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 19l7-7 4 4 4-4M14 8h5v5"/></svg>;
  if (t === 'descendo') return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 5l7 7 4-4 4 4M14 16h5v-5"/></svg>;
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>;
}

// =========================
// Barra de carga (compacta, 4 segmentos)
// =========================
function CargaBar({ h, nivel }) {
  const pct = Math.min(100, (h / 80) * 100);
  const tokens = {
    ok:   'var(--sage)',
    warn: '#D9A85A',
    err:  'var(--coral)',
  };
  return (
    <div style={{
      height: 6,
      background: 'var(--bg-alt)',
      borderRadius: 999,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Marca de 60h (limite CFM) */}
      <div style={{
        position: 'absolute',
        left: '75%',
        top: -2, bottom: -2,
        width: 1,
        background: 'var(--ink-3)',
        opacity: 0.3,
      }}/>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: tokens[nivel],
        borderRadius: 999,
        transition: 'width 240ms ease-out',
      }}/>
    </div>
  );
}

// =========================
// Painel de pendências (admin)
// =========================
function PendingPanel({ onApprove }) {
  const tipoLabel = {
    troca: 'pedido de troca',
    cessao: 'cessão de plantão',
    conflito: 'conflito detectado',
    limite: 'alerta de limite',
  };
  const tipoCor = {
    troca: 'lavender',
    cessao: 'sand',
    conflito: 'coral',
    limite: 'coral',
  };

  return (
    <aside style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 18,
      padding: '20px 22px',
      position: 'sticky',
      top: 80,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          fontSize: 22, color: 'var(--ink)',
          letterSpacing: '-0.015em', margin: 0,
        }}>pendências</h2>
        <Eyebrow color="var(--ink-3)">{PENDENCIAS.length} · sua decisão</Eyebrow>
      </div>
      <p style={{
        font: '400 13px/1.4 var(--font-body)',
        color: 'var(--ink-3)',
        margin: '6px 0 16px',
      }}>
        revisar antes do fim do dia para fechar a escala da semana.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PENDENCIAS.map(p => {
          const cor = tipoCor[p.tipo];
          const dePerson = TIME.find(x => x.id === p.de);
          const paraPerson = p.para && TIME.find(x => x.id === p.para);
          return (
            <div key={p.id} style={{
              border: `1px solid var(--${cor}-surface)`,
              borderLeft: `4px solid var(--${cor})`,
              borderRadius: 12,
              padding: '12px 14px',
              background: 'var(--bg)',
            }}>
              <Eyebrow color={`var(--${cor}-ink)`}>{tipoLabel[p.tipo]}</Eyebrow>
              <div style={{
                font: '600 13px/1.3 var(--font-body)',
                color: 'var(--ink)',
                marginTop: 4,
              }}>
                {dePerson?.nome.split(' ').slice(0, 2).join(' ')}
                {paraPerson && (
                  <>
                    <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> → </span>
                    {paraPerson.nome.split(' ').slice(0, 2).join(' ')}
                  </>
                )}
              </div>
              <div style={{
                font: '500 12px/1.3 var(--font-body)',
                color: 'var(--ink-2)',
                marginTop: 2,
              }}>{p.bloco}</div>
              <div style={{
                font: '400 12px/1.3 var(--font-body)',
                color: 'var(--ink-3)',
                fontStyle: 'italic',
                marginTop: 4,
              }}>{p.motivo}</div>

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={() => onApprove && onApprove(p, 'approve')} style={{
                  flex: 1,
                  font: '600 12px/1 var(--font-body)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  cursor: 'pointer',
                }}>aprovar</button>
                <button onClick={() => onApprove && onApprove(p, 'reject')} style={{
                  flex: 1,
                  font: '600 12px/1 var(--font-body)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}>recusar</button>
                <button style={{
                  font: '600 12px/1 var(--font-body)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                }}>···</button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

Object.assign(window, { TimeScreen });
