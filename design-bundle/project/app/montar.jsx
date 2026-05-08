// =====================================================================
// montar.jsx — "Montar escala do mês"
// O médico planeja seus plantões considerando regras dos hospitais,
// preferências pessoais e meta de remuneração mensal.
// =====================================================================

const MONTH_DAYS = (() => {
  // Maio 2026 começa numa sexta. 31 dias.
  const arr = [];
  for (let d = 1; d <= 31; d++) {
    const data = `2026-05-${String(d).padStart(2,'0')}`;
    arr.push({ d, data, dow: diaSemanaBR(data) });
  }
  return arr;
})();

// Plantões "rascunho" iniciais do mês — todos sugeridos pelo Montar,
// usando regras dos hospitais + preferências da médica.
// (Plantões já confirmados viriam da Agenda; aqui partimos de uma escala
//  ainda não preenchida pra demonstrar a sugestão automática.)
const RASCUNHO_INICIAL = [
  { id: 'r1', hospitalId: 'HBDF', data: '2026-05-04', janela: '07:00–19:00', status: 'sugestao' },
  { id: 'r2', hospitalId: 'HCB',  data: '2026-05-06', janela: '19:00–07:00', status: 'sugestao' },
  { id: 'r3', hospitalId: 'HSL',  data: '2026-05-08', janela: '19:00–07:00', status: 'sugestao' },
  { id: 'r4', hospitalId: 'HBDF', data: '2026-05-12', janela: '07:00–19:00', status: 'sugestao' },
  { id: 'r5', hospitalId: 'HCB',  data: '2026-05-14', janela: '19:00–07:00', status: 'sugestao' },
  { id: 'r6', hospitalId: 'HBDF', data: '2026-05-19', janela: '07:00–19:00', status: 'sugestao' },
  { id: 'r7', hospitalId: 'HSL',  data: '2026-05-22', janela: '19:00–07:00', status: 'sugestao' },
  { id: 'r8', hospitalId: 'HBDF', data: '2026-05-26', janela: '07:00–19:00', status: 'sugestao' },
];

function valorPlantaoEm(p) {
  return HOSPITAIS[p.hospitalId]?.valorPlantao ?? 0;
}

function MontarEscalaScreen({ mode }) {
  const [rascunho, setRascunho] = React.useState(RASCUNHO_INICIAL);
  const [hover, setHover] = React.useState(null);
  const [focoHosp, setFocoHosp] = React.useState(null); // filtro por hospital
  const [reconstruindo, setReconstruindo] = React.useState(false);

  const total = rascunho.reduce((s, p) => s + valorPlantaoEm(p), 0);
  const meta = PREFERENCIAS_ME.metaMensal;
  const progresso = Math.min(1, total / meta);

  const porHospital = Object.values(HOSPITAIS).map(h => {
    const ps = rascunho.filter(p => p.hospitalId === h.id);
    return {
      ...h,
      qtd: ps.length,
      valor: ps.reduce((s, p) => s + h.valorPlantao, 0),
      restante: h.regras.maxPorMes - ps.length,
      finsDeSemana: ps.filter(p => {
        const dow = diaSemanaBR(p.data);
        return dow === 5 || dow === 6;
      }).length,
    };
  });

  const totalPlantoes = rascunho.length;
  const horasTotal = totalPlantoes * 12;

  const removerPlantao = (id) => setRascunho(rs => rs.filter(p => p.id !== id));
  const aceitarSugestao = (id) => setRascunho(rs => rs.map(p => p.id === id ? { ...p, status: 'confirmado' } : p));

  const limparTudo = () => setRascunho([]);
  const refazerEscala = () => {
    setReconstruindo(true);
    setRascunho([]);
    setTimeout(() => {
      setRascunho(RASCUNHO_INICIAL);
      setReconstruindo(false);
    }, 700);
  };

  return (
    <main data-screen-label="Montar escala do mês" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 96px',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 6 }}>planejamento · mai 2026</Eyebrow>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 'clamp(36px, 4vw, 44px)', color: 'var(--ink)',
            letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0,
          }}>montar a escala do mês</h1>
          <p style={{
            font: '400 16px/1.4 var(--font-body)', color: 'var(--ink-2)',
            margin: '8px 0 0', maxWidth: 600,
          }}>
            partimos de uma escala já montada pra você — baseada nas regras de cada hospital, no máx por semana e nas suas preferências. é só ajustar e confirmar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={limparTudo} style={{
            font: '600 13px/1 var(--font-body)',
            padding: '10px 16px', borderRadius: 999,
            border: '1px solid var(--line)', background: 'var(--bg)',
            color: 'var(--ink-2)', cursor: 'pointer',
          }}>limpar</button>
          <button onClick={refazerEscala} style={{
            font: '600 13px/1 var(--font-body)',
            padding: '10px 16px', borderRadius: 999,
            border: '1px solid var(--lavender-ink)',
            background: 'var(--lavender-surface)',
            color: 'var(--lavender-ink)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5"/></svg>
            montar de novo
          </button>
          <button style={{
            font: '600 13px/1 var(--font-body)',
            padding: '10px 18px', borderRadius: 999,
            border: 'none', background: 'var(--ink)',
            color: 'var(--bg)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            enviar pros hospitais
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>

      {/* Layout: meta+regras à esq, calendário à dir, hospitais embaixo */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px minmax(0, 1fr)',
        gap: 28,
        alignItems: 'flex-start',
      }}>
        {/* === COLUNA ESQUERDA: meta + preferências === */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 76 }}>
          <MetaCard total={total} meta={meta} progresso={progresso} totalPlantoes={totalPlantoes} horasTotal={horasTotal} />
          <PreferenciasCard />
          <RegrasGlobais total={total} meta={meta} totalPlantoes={totalPlantoes} />
        </aside>

        {/* === COLUNA DIREITA: calendário + hospitais === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Calendario
            rascunho={rascunho}
            focoHosp={focoHosp}
            onHover={setHover}
            onRemover={removerPlantao}
            onAceitar={aceitarSugestao}
          />
          <HospitaisRow porHospital={porHospital} focoHosp={focoHosp} onFoco={setFocoHosp} />
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------- meta
function MetaCard({ total, meta, progresso, totalPlantoes, horasTotal }) {
  const fmtR = (v) => 'R$ ' + v.toLocaleString('pt-BR');
  const restante = meta - total;
  const nivel = progresso >= 1 ? 'ok' : progresso >= 0.7 ? 'warn' : 'low';
  const cor = nivel === 'ok' ? 'var(--sage-ink)' : nivel === 'warn' ? '#B8884A' : 'var(--lavender-ink)';
  const corBg = nivel === 'ok' ? 'var(--sage-surface)' : nivel === 'warn' ? 'var(--sand-surface)' : 'var(--lavender-surface)';

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      padding: 22,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <Eyebrow color={cor}>meta do mês</Eyebrow>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.02em',
        marginTop: 8, lineHeight: 1,
      }}>{fmtR(total)}</div>
      <div style={{
        font: '400 13px/1.3 var(--font-body)', color: 'var(--ink-3)', marginTop: 4,
      }}>de {fmtR(meta)} planejados</div>

      {/* Barra de progresso */}
      <div style={{
        marginTop: 16,
        height: 10,
        background: 'var(--bg-alt)',
        borderRadius: 999,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          width: `${Math.min(100, progresso * 100)}%`,
          height: '100%',
          background: cor,
          borderRadius: 999,
          transition: 'width 240ms cubic-bezier(.2,.7,.2,1)',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <Mono style={{ color: 'var(--ink-3)' }}>{Math.round(progresso * 100)}%</Mono>
        <Mono style={{ color: cor }}>
          {restante > 0 ? `falta ${fmtR(restante)}` : `+${fmtR(-restante)} acima`}
        </Mono>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Mono style={{ color: 'var(--ink-3)' }}>plantões</Mono>
          <div style={{ font: '600 18px/1 var(--font-display)', color: 'var(--ink)', marginTop: 4 }}>{totalPlantoes}</div>
        </div>
        <div>
          <Mono style={{ color: 'var(--ink-3)' }}>horas</Mono>
          <div style={{ font: '600 18px/1 var(--font-display)', color: 'var(--ink)', marginTop: 4 }}>{horasTotal}h</div>
        </div>
        <div>
          <Mono style={{ color: 'var(--ink-3)' }}>R$ / hora</Mono>
          <div style={{ font: '600 18px/1 var(--font-display)', color: 'var(--ink)', marginTop: 4 }}>
            {horasTotal > 0 ? Math.round(total / horasTotal) : 0}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferenciasCard() {
  const p = PREFERENCIAS_ME;
  return (
    <div style={{
      background: 'var(--lavender-surface)',
      borderRadius: 20,
      padding: '18px 20px',
      position: 'relative',
    }}>
      <Eyebrow color="var(--lavender-ink)">suas preferências</Eyebrow>
      <ul style={{
        listStyle: 'none', padding: 0, margin: '12px 0 0',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <PrefRow icon="✓" label={`prefere ${p.diasPreferidos.join(', ')}`} />
        <PrefRow icon="✕" label={`evita ${p.diasEvitar.join(', ')}`} />
        <PrefRow icon="✓" label={`hospitais favoritos: ${p.hospitaisPreferidos.join(', ')}`} />
        <PrefRow icon="✓" label={`máx ${p.maxPlantoesPorSemana} plantões/semana`} />
        {p.evitar24hCorrido && <PrefRow icon="✕" label="sem 24h corrido" />}
      </ul>
      <button style={{
        marginTop: 14,
        font: '600 12px/1 var(--font-body)',
        color: 'var(--lavender-ink)',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
      }}>ajustar preferências</button>
    </div>
  );
}

function PrefRow({ icon, label }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 16, height: 16, borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--lavender-ink)',
        font: '700 10px/1 var(--font-body)',
      }}>{icon}</span>
      <span style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--lavender-ink)' }}>{label}</span>
    </li>
  );
}

function RegrasGlobais({ total, meta, totalPlantoes }) {
  const horasMes = totalPlantoes * 12;
  const cfmOk = horasMes <= 240;
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      padding: 18,
    }}>
      <Eyebrow>checagens</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <CheckRow ok={cfmOk} label={`${horasMes}h no mês`} sub={cfmOk ? 'dentro do CFM' : 'acima do CFM'} />
        <CheckRow ok={total >= meta * 0.9} label="meta financeira" sub={total >= meta ? 'atingida' : `${Math.round((total/meta)*100)}% planejado`} />
        <CheckRow ok={true} label="intervalos" sub="11h+ entre plantões" />
        <CheckRow ok={true} label="finais de semana" sub="2 cobertos" />
      </div>
    </div>
  );
}

function CheckRow({ ok, label, sub }) {
  const cor = ok ? 'var(--sage-ink)' : 'var(--coral-ink)';
  const corBg = ok ? 'var(--sage-surface)' : 'var(--coral-surface)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999,
        background: corBg, color: cor,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: '700 12px/1 var(--font-body)',
      }}>{ok ? '✓' : '!'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ font: '600 13px/1 var(--font-body)', color: 'var(--ink)' }}>{label}</div>
        <div style={{ font: '400 11px/1.2 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ calendário
function Calendario({ rascunho, focoHosp, onHover, onRemover, onAceitar }) {
  // 5 semanas x 7 dias. Maio 2026 começa numa sexta (dow=4) — então primeiras 4 células do row 0 ficam vazias.
  const primeiroDow = diaSemanaBR('2026-05-01'); // 4 = sexta
  const cells = [];
  for (let i = 0; i < primeiroDow; i++) cells.push(null);
  for (const day of MONTH_DAYS) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const plantPorDia = (data) => rascunho.filter(p => p.data === data);

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 20,
      overflow: 'hidden',
    }}>
      {/* Cabeçalho dos dias da semana */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        background: 'var(--bg-alt)', borderBottom: '1px solid var(--line)',
      }}>
        {DOWS.map((d, i) => (
          <div key={d} style={{
            padding: '12px 14px', font: '700 10px/1 var(--font-body)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: i >= 5 ? 'var(--lavender-ink)' : 'var(--ink-3)',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gridAutoRows: '120px',
      }}>
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={i} style={{
              borderRight: i % 7 < 6 ? '1px solid var(--line)' : 'none',
              borderBottom: '1px solid var(--line)',
              background: 'var(--bg-alt)',
              opacity: 0.4,
            }} />;
          }
          const ps = plantPorDia(cell.data);
          const isFimSem = cell.dow === 5 || cell.dow === 6;
          const isHoje = cell.data === '2026-05-08';
          return (
            <DiaCell key={i}
              dia={cell}
              plantoes={ps}
              isFimSem={isFimSem}
              isHoje={isHoje}
              borderRight={i % 7 < 6}
              focoHosp={focoHosp}
              onHover={onHover}
              onRemover={onRemover}
              onAceitar={onAceitar}
            />
          );
        })}
      </div>
    </div>
  );
}

function DiaCell({ dia, plantoes, isFimSem, isHoje, borderRight, focoHosp, onHover, onRemover, onAceitar }) {
  const visiveis = focoHosp ? plantoes.filter(p => p.hospitalId === focoHosp) : plantoes;
  return (
    <div style={{
      borderRight: borderRight ? '1px solid var(--line)' : 'none',
      borderBottom: '1px solid var(--line)',
      padding: 8,
      position: 'relative',
      background: isHoje ? 'var(--lavender-surface)' : isFimSem ? 'rgba(45,42,50,0.02)' : 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16,
          color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
          letterSpacing: '-0.01em',
        }}>{dia.d}</span>
        {isHoje && <Hand color="var(--lavender-ink)" size={13}>hoje</Hand>}
      </div>

      {visiveis.map(p => (
        <PlantaoChip key={p.id} p={p}
          onRemove={() => onRemover(p.id)}
          onAccept={() => onAceitar(p.id)}
        />
      ))}

      {visiveis.length === 0 && (
        <button style={{
          marginTop: 'auto',
          alignSelf: 'flex-start',
          font: '400 11px/1 var(--font-body)',
          color: 'var(--ink-3)',
          background: 'transparent',
          border: '1px dashed var(--line-2)',
          borderRadius: 6,
          padding: '4px 8px',
          cursor: 'pointer',
          opacity: 0.6,
        }}>+ plantão</button>
      )}
    </div>
  );
}

function PlantaoChip({ p, onRemove, onAccept }) {
  const hosp = HOSPITAIS[p.hospitalId];
  const isSugestao = p.status === 'sugestao';
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isSugestao
          ? `repeating-linear-gradient(135deg, var(--${hosp.cor}-surface), var(--${hosp.cor}-surface) 6px, color-mix(in oklab, var(--${hosp.cor}) 18%, transparent) 6px, color-mix(in oklab, var(--${hosp.cor}) 18%, transparent) 12px)`
          : `var(--${hosp.cor}-surface)`,
        borderLeft: `3px solid var(--${hosp.cor})`,
        borderRadius: 6,
        padding: '5px 7px',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div style={{
        font: '600 10px/1 var(--font-body)', color: `var(--${hosp.cor}-ink)`,
        letterSpacing: '0.02em',
      }}>{hosp.abrev}</div>
      <div style={{
        font: '500 9px/1.2 var(--font-body)', color: `var(--${hosp.cor}-ink)`,
        opacity: 0.8, marginTop: 2,
      }}>{p.janela.replace('–', '→')}</div>

      {hover && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          display: 'flex', gap: 2,
        }}>
          {isSugestao && (
            <button onClick={(e) => { e.stopPropagation(); onAccept(); }} style={{
              width: 18, height: 18, borderRadius: 4,
              background: `var(--${hosp.cor}-ink)`, color: 'var(--bg)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} title="confirmar">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-9"/></svg>
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(45,42,50,0.6)', color: 'var(--bg)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} title="remover">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
          </button>
        </div>
      )}

      {isSugestao && !hover && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          font: '600 8px/1 var(--font-body)',
          color: `var(--${hosp.cor}-ink)`, opacity: 0.7,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>•sug</span>
      )}
    </div>
  );
}

// ------------------------------------------------------------ hospitais row
function HospitaisRow({ porHospital, focoHosp, onFoco }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
    }}>
      {porHospital.map(h => {
        const isAtivo = focoHosp === h.id;
        const usado = h.qtd / h.regras.maxPorMes;
        return (
          <button key={h.id}
            onClick={() => onFoco(isAtivo ? null : h.id)}
            style={{
              background: isAtivo ? `var(--${h.cor}-surface)` : 'var(--bg)',
              border: `1px solid ${isAtivo ? `var(--${h.cor}-ink)` : 'var(--line)'}`,
              borderRadius: 18,
              padding: 18,
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 160ms cubic-bezier(.2,.7,.2,1)',
              boxShadow: isAtivo ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999,
                background: `var(--${h.cor})`,
              }} />
              <span style={{
                font: '700 11px/1 var(--font-body)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: `var(--${h.cor}-ink)`,
              }}>{h.abrev}</span>
              <span style={{ flex: 1 }} />
              <Mono style={{ color: 'var(--ink-3)' }}>R$ {h.valorPlantao}/p</Mono>
            </div>

            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 500,
              fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.01em',
              lineHeight: 1,
            }}>
              {h.qtd}<span style={{ color: 'var(--ink-3)', fontSize: 16 }}> / {h.regras.maxPorMes}</span>
            </div>
            <div style={{
              font: '400 12px/1.2 var(--font-body)', color: 'var(--ink-3)', marginTop: 2,
            }}>plantões neste mês</div>

            {/* Mini barra de uso */}
            <div style={{
              marginTop: 10,
              height: 4, background: 'var(--bg-alt)', borderRadius: 999, overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, usado*100)}%`, height: '100%',
                background: `var(--${h.cor})`,
              }} />
            </div>

            <div style={{
              marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4,
              borderTop: '1px solid var(--line)', paddingTop: 10,
            }}>
              <RegraRow label="finais de sem." valor={`${h.finsDeSemana}/${h.regras.minFimDeSemana} mín`} ok={h.finsDeSemana >= h.regras.minFimDeSemana} />
              <RegraRow label="intervalo" valor={`${h.regras.intervaloMinHoras}h`} />
              <RegraRow label="ganho" valor={`R$ ${h.valor.toLocaleString('pt-BR')}`} forte />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RegraRow({ label, valor, ok, forte }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ font: '400 11px/1 var(--font-body)', color: 'var(--ink-3)' }}>{label}</span>
      <span style={{
        font: forte ? '600 12px/1 var(--font-body)' : '500 11px/1 var(--font-mono)',
        color: ok === false ? 'var(--coral-ink)' : forte ? 'var(--ink)' : 'var(--ink-2)',
      }}>{valor}</span>
    </div>
  );
}

Object.assign(window, { MontarEscalaScreen });
