// =====================================================================
// week.jsx — Grid Semana (desktop)
// 24h por dia. Plantões noturnos (overnight) são desenhados em DOIS
// pedaços visuais — cauda no dia anterior + cabeça no dia seguinte —
// com indicação de continuidade (seta + borda chanfrada).
// =====================================================================

const HORA_INICIO = 0;
const HORA_FIM = 24;

// Janela visível: 24h completas
const VIEW_INICIO = 0;
const VIEW_FIM = 24;
const VIEW_HORAS = VIEW_FIM - VIEW_INICIO;

// Expande blocos noturnos em dois segmentos virtuais.
// Um bloco que começa às 19h e dura 12h (vai até 7h do dia seguinte)
// vira: { dia A: 19→24 com continua-pra-frente } + { dia B: 0→7 com continua-pra-tras }
function expandirBlocos(blocos) {
  const out = [];
  for (const b of blocos) {
    const fim = b.horaInicio + b.duracao;
    if (fim <= 24) {
      out.push({ ...b, _seg: 'unico' });
    } else {
      // segmento 1: dia atual, do início até 24h
      out.push({
        ...b,
        duracao: 24 - b.horaInicio,
        _seg: 'inicio', // continua amanhã
      });
      // segmento 2: dia seguinte, das 0h até o fim
      const proxData = adicionaDia(b.data, 1);
      out.push({
        ...b,
        data: proxData,
        horaInicio: 0,
        duracao: fim - 24,
        _seg: 'fim', // veio de ontem
      });
    }
  }
  return out;
}

function adicionaDia(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function blocosDoDia(blocos, data) {
  return blocos.filter(b => b.data === data).sort((a,b) => a.horaInicio - b.horaInicio);
}

function WeekGrid({ blocos, density = 32, onSelectBloco, semanaLabel = '4–10 mai 2026' }) {
  const HOJE = '2026-05-08';
  const totalH = VIEW_HORAS * density;
  const expandidos = expandirBlocos(blocos);

  return (
    <div style={{
      background: 'var(--bg)',
      borderRadius: 20,
      border: '1px solid var(--line)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Cabeçalho dos dias */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '64px repeat(7, 1fr)',
        background: 'var(--bg-alt)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{
          padding: '14px 6px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-3)',
          textAlign: 'right',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>{semanaLabel.split(' ')[0]}</div>
        {SEMANA.map((d, i) => {
          const isHoje = d === HOJE;
          const dt = new Date(d + 'T12:00:00');
          return (
            <div key={d} style={{
              padding: '12px 8px',
              textAlign: 'left',
              borderLeft: '1px solid var(--line)',
              background: isHoje ? 'var(--lavender-surface)' : 'transparent',
            }}>
              <div style={{
                font: '700 10px/1 var(--font-body)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isHoje ? 'var(--lavender-ink)' : 'var(--ink-3)',
                marginBottom: 6,
              }}>{DOWS[i]}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 500, fontSize: 22, lineHeight: 1,
                  color: isHoje ? 'var(--lavender-ink)' : 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}>{dt.getDate()}</span>
                {isHoje && <Hand color="var(--lavender-ink)" size={14} style={{ marginBottom: 2 }}>hoje</Hand>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grade */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '64px repeat(7, 1fr)',
        position: 'relative',
      }}>
        {/* Coluna de horas (24 marcas, mas labels a cada 3h pra não poluir) */}
        <div style={{ position: 'relative', height: totalH, borderRight: '1px solid var(--line)' }}>
          {Array.from({ length: VIEW_HORAS }).map((_, i) => {
            const h = VIEW_INICIO + i;
            const major = h % 3 === 0;
            return (
              <div key={i} style={{
                position: 'absolute',
                top: i * density,
                right: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: major ? 10 : 9,
                color: major ? 'var(--ink-3)' : 'var(--ink-3)',
                opacity: major ? 1 : 0.4,
                lineHeight: 1,
                paddingTop: 4,
              }}>{String(h).padStart(2,'0')}h</div>
            );
          })}
        </div>

        {/* 7 colunas */}
        {SEMANA.map((d, dayIdx) => (
          <DayColumn key={d}
            data={d}
            blocos={blocosDoDia(expandidos, d)}
            density={density}
            isHoje={d === HOJE}
            onSelectBloco={onSelectBloco}
            isLast={dayIdx === 6}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({ data, blocos, density, isHoje, onSelectBloco, isLast }) {
  const totalH = VIEW_HORAS * density;
  return (
    <div style={{
      position: 'relative',
      height: totalH,
      borderRight: isLast ? 'none' : '1px solid var(--line)',
      background: isHoje ? 'rgba(162,153,203,0.04)' : 'transparent',
    }}>
      {/* Linhas horizontais — destaque a cada 6h, demais sutis */}
      {Array.from({ length: VIEW_HORAS + 1 }).map((_, i) => {
        const h = VIEW_INICIO + i;
        const major = h % 6 === 0;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: 0, right: 0,
            top: i * density,
            height: 1,
            background: major ? 'var(--line-2)' : 'var(--line)',
            opacity: major ? 1 : 0.4,
          }} />
        );
      })}

      {/* Faixa de madrugada (0–6h) sutilmente sombreada */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        top: 0, height: 6 * density,
        background: 'rgba(45,42,50,0.025)',
        pointerEvents: 'none',
      }}/>
      {/* Faixa de noite (22–24h) idem */}
      <div style={{
        position: 'absolute',
        left: 0, right: 0,
        top: 22 * density, height: 2 * density,
        background: 'rgba(45,42,50,0.025)',
        pointerEvents: 'none',
      }}/>

      {/* Blocos */}
      {blocos.map((b, i) => {
        const start = Math.max(VIEW_INICIO, b.horaInicio);
        const end = Math.min(VIEW_FIM, b.horaInicio + b.duracao);
        const top = (start - VIEW_INICIO) * density;
        const h = (end - start) * density;
        if (h <= 0) return null;
        const adjustedB = { ...b, duracao: (end - start) };
        return (
          <div key={b.id + '-' + b._seg + '-' + i} style={{
            position: 'absolute',
            top,
            left: 4, right: 4,
          }}>
            <BlocoComContinuidade
              b={adjustedB}
              density={density}
              onClick={() => onSelectBloco(b)}
            />
          </div>
        );
      })}

      {isHoje && <NowLine density={density} />}
    </div>
  );
}

// Wrapper que adiciona indicação visual de continuidade (vai-pra-amanhã / veio-de-ontem)
function BlocoComContinuidade({ b, density, onClick }) {
  const seg = b._seg;
  const hosp = HOSPITAIS[b.hospitalId];
  const cor = hosp ? hosp.cor : null;
  const corInk = hosp ? `var(--${cor}-ink)` : 'var(--ink-2)';
  const corSurface = hosp ? `var(--${cor}-surface)` : 'var(--bg-alt)';

  // Estilos de "corte": faixa serrilhada com gradiente para indicar que continua
  const cortePattern = `linear-gradient(90deg, ${corInk} 0 6px, transparent 6px 12px)`;

  return (
    <div style={{ position: 'relative' }}>
      <Bloco b={b} density={density} onClick={onClick} />

      {/* Continua amanhã — faixa diagonal no fim do bloco */}
      {seg === 'inicio' && (
        <>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0, right: 0,
            height: 8,
            background: cortePattern,
            backgroundSize: '12px 8px',
            opacity: 0.7,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            bottom: 4,
            right: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: corInk,
            color: 'var(--bg)',
            font: '600 9px/1 var(--font-body)',
            padding: '4px 7px 4px 6px',
            borderRadius: 6,
            letterSpacing: '0.04em',
            textTransform: 'lowercase',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(45,42,50,0.15)',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
            entra na madrugada
          </div>
        </>
      )}

      {/* De ontem — faixa diagonal no topo do bloco */}
      {seg === 'fim' && (
        <>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0, right: 0,
            height: 8,
            background: cortePattern,
            backgroundSize: '12px 8px',
            opacity: 0.7,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            top: 4,
            right: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: corInk,
            color: 'var(--bg)',
            font: '600 9px/1 var(--font-body)',
            padding: '4px 7px 4px 6px',
            borderRadius: 6,
            letterSpacing: '0.04em',
            textTransform: 'lowercase',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(45,42,50,0.15)',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6"/>
            </svg>
            vem de ontem
          </div>
        </>
      )}
    </div>
  );
}

function NowLine({ density }) {
  const agora = 14.5;
  if (agora < VIEW_INICIO || agora > VIEW_FIM) return null;
  const top = (agora - VIEW_INICIO) * density;
  return (
    <div style={{
      position: 'absolute',
      left: 0, right: 0,
      top,
      height: 0,
      borderTop: '2px solid var(--lavender-ink)',
      zIndex: 5,
    }}>
      <div style={{
        position: 'absolute',
        left: -5, top: -5,
        width: 10, height: 10,
        borderRadius: 999,
        background: 'var(--lavender-ink)',
      }} />
    </div>
  );
}

Object.assign(window, { WeekGrid });
