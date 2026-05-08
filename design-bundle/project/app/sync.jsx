// =====================================================================
// sync.jsx — Sincronizar / Importar / Exportar
//   4 zonas:
//     a. Importar PDF/foto da escala (uso principal · Claude Vision)
//     b. Importar .ics (Google / iCloud · tratar como bloqueio)
//     c. Exportar feed .ics (URL única do calendário)
//     d. Backup completo JSON (download / upload)
// =====================================================================

const SYNC_STATES = ['idle', 'lendo', 'lido', 'erro'];

function SyncScreen({ mode, syncState = 'idle' }) {
  return (
    <main data-screen-label="Sincronizar · importar/exportar" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 96px' }}>
      <RoleBanner mode={mode}/>

      <header style={{ marginBottom: 28 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6 }}>sincronizar · trazer e levar</Eyebrow>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          fontSize: 'clamp(36px, 4vw, 44px)',
          color: 'var(--ink)', letterSpacing: '-0.02em',
          lineHeight: 1.05, margin: 0, textWrap: 'balance',
        }}>cole a escala em PDF que a IA arruma os blocos pra você</h1>
        <p style={{
          font: '400 16px/1.5 var(--font-body)',
          color: 'var(--ink-2)', margin: '10px 0 0', maxWidth: 640,
        }}>
          Quatro caminhos pra mover a sua agenda: importar a escala oficial,
          puxar do Google/iCloud, exportar pro seu calendário, ou fazer um backup do app.
        </p>
      </header>

      {/* Zona A — destaque (largura inteira) */}
      <ZonaImportPDF state={syncState}/>

      {/* B + C + D em duas colunas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 20,
        marginTop: 20,
      }}>
        <ZonaImportICS/>
        <ZonaExportICS/>
        <ZonaBackup/>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------
// Card base
// ---------------------------------------------------------------
function ZonaCard({ children, eyebrow, eyebrowColor, titulo, subtitulo, kind = 'normal' }) {
  const isHero = kind === 'hero';
  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      padding: isHero ? '28px 32px' : '22px 22px 24px',
      boxShadow: isHero ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    }}>
      <header style={{ marginBottom: isHero ? 18 : 14 }}>
        {eyebrow && (
          <Eyebrow color={eyebrowColor} style={{ display: 'block', marginBottom: 6 }}>{eyebrow}</Eyebrow>
        )}
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500,
          fontSize: isHero ? 26 : 20,
          letterSpacing: '-0.01em',
          lineHeight: 1.15, margin: 0, color: 'var(--ink)',
        }}>{titulo}</h2>
        {subtitulo && (
          <p style={{
            font: '400 14px/1.5 var(--font-body)',
            color: 'var(--ink-2)', margin: '6px 0 0',
          }}>{subtitulo}</p>
        )}
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------
// A) Importar PDF / foto · destaque
// ---------------------------------------------------------------
function ZonaImportPDF({ state }) {
  return (
    <ZonaCard kind="hero"
      eyebrow="a · uso principal · Claude Vision"
      eyebrowColor="var(--lavender-ink)"
      titulo="Importar PDF ou foto da escala"
      subtitulo="Arraste o arquivo que o hospital te mandou. A IA lê tudo, monta os blocos em uma mini-grade, e você confirma o que quer importar."
    >
      {state === 'idle' && <DropZone/>}
      {state === 'lendo' && <Lendo/>}
      {state === 'lido' && <Lido/>}
      {state === 'erro' && <Erro/>}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 16,
        font: '400 12px/1.5 var(--font-body)',
        color: 'var(--ink-3)',
        fontStyle: 'italic',
        fontFamily: 'var(--font-display)',
        fontVariationSettings: '"opsz" 14',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--lavender-ink)' }}>
          <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM5 16l.8 2.4L8 19l-2.2.6L5 22l-.8-2.4L2 19l2.2-.6L5 16zM19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>
        </svg>
        powered by Claude Vision · seus arquivos são processados sem ficar guardados
      </div>
    </ZonaCard>
  );
}

function DropZone() {
  return (
    <label style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: '56px 24px',
      borderRadius: 'var(--r-md)',
      border: '2px dashed color-mix(in oklab, var(--lavender-ink) 28%, var(--line))',
      background: 'color-mix(in oklab, var(--lavender-surface) 50%, var(--bg))',
      cursor: 'pointer',
      transition: 'background 160ms, border-color 160ms',
      textAlign: 'center',
    }}>
      <span style={{
        width: 56, height: 56, borderRadius: 999,
        background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--lavender-ink)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </span>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          Arraste o arquivo aqui
        </div>
        <div style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', marginTop: 4 }}>
          ou clique para escolher · PDF, PNG, JPG · até 10 MB
        </div>
      </div>
      <span style={{
        marginTop: 6,
        font: '600 13px/1 var(--font-body)',
        padding: '10px 18px',
        borderRadius: 999,
        background: 'var(--ink)',
        color: 'var(--bg)',
        boxShadow: 'var(--shadow-sm)',
      }}>Selecionar arquivo</span>
      <input type="file" accept=".pdf,image/png,image/jpeg" style={{ display: 'none' }}/>
    </label>
  );
}

function Lendo() {
  return (
    <div style={{
      padding: '40px 24px',
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--line)',
      background: 'var(--bg-alt)',
      display: 'grid', gridTemplateColumns: '120px 1fr', gap: 24, alignItems: 'center',
    }}>
      {/* preview */}
      <div style={{
        height: 140, width: 110,
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex', flexDirection: 'column', gap: 5,
        padding: 10,
      }}>
        <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 2 }}/>
        <div style={{ height: 4, background: 'var(--line-2)', borderRadius: 2, width: '70%' }}/>
        <div style={{ height: 4, background: 'var(--line-2)', borderRadius: 2, width: '60%' }}/>
        <div style={{ marginTop: 8, height: 1, background: 'var(--line)' }}/>
        {[0,1,2,3].map(i => <div key={i} style={{ height: 4, background: 'var(--line-2)', borderRadius: 2, opacity: 0.6 }}/>)}
        <span style={{ marginTop: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>escala-mai-2026.pdf</span>
      </div>
      <div>
        <Eyebrow color="var(--lavender-ink)">processando</Eyebrow>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)', margin: '6px 0 0', letterSpacing: '-0.01em' }}>
          Lendo a escala com IA…
        </h3>
        <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '6px 0 14px' }}>
          Detectando datas, horários, hospitais e setores. Costuma levar 8–15 segundos.
        </p>
        {/* barra de progresso */}
        <div style={{
          height: 6, borderRadius: 999, background: 'var(--line)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: '60%', background: 'var(--lavender-ink)',
            borderRadius: 999,
            animation: 'colo-fade-in 600ms ease-out',
          }}/>
        </div>
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          página 1 de 1 · 14 blocos detectados
        </div>
      </div>
    </div>
  );
}

function Lido() {
  // mini-grade visual com 5 blocos detectados
  const detectados = [
    { d: 'seg 4', h: '07–13', cor: 'sand',     hosp: 'HSL',  setor: 'enfermaria',     check: true  },
    { d: 'seg 4', h: '19–07', cor: 'aqua',     hosp: 'HCB',  setor: 'PA',             check: true  },
    { d: 'qua 6', h: '13–19', cor: 'blue',     hosp: 'HBDF', setor: 'UTI Ped.',       check: true  },
    { d: 'sex 8', h: '— —',   cor: 'coral',    hosp: 'HDS',  setor: 'PS',             check: false, alerta: 'sem hora · preencha' },
    { d: 'sáb 9', h: '07–19', cor: 'sand',     hosp: 'HSL',  setor: 'enfermaria',     check: true  },
  ];
  return (
    <div style={{
      borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
      background: 'var(--bg-alt)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        background: 'var(--sage-surface)',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid color-mix(in oklab, var(--sage-ink) 14%, transparent)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sage-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
        <span style={{ font: '600 14px/1.3 var(--font-body)', color: 'var(--sage-ink)' }}>14 blocos detectados ·</span>
        <span style={{ font: '400 14px/1.3 var(--font-body)', color: 'var(--sage-ink)' }}>marque os que quer importar</span>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {detectados.map((b, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '20px 60px 70px 1fr auto',
            gap: 12, alignItems: 'center',
            padding: '10px 12px',
            background: 'var(--bg)',
            borderRadius: 'var(--r-sm)',
            border: b.alerta ? '1px solid var(--coral)' : '1px solid var(--line)',
            borderLeft: `4px solid var(--${b.cor})`,
          }}>
            <input type="checkbox" defaultChecked={b.check} style={{ accentColor: 'var(--lavender-ink)', width: 16, height: 16 }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{b.d}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{b.h}</span>
            <div>
              <span style={{ font: '600 13px/1 var(--font-body)', color: 'var(--ink)' }}>{b.hosp}</span>
              <span style={{ font: '400 13px/1 var(--font-body)', color: 'var(--ink-3)', marginLeft: 8 }}>{b.setor}</span>
            </div>
            {b.alerta && (
              <span style={{
                font: '600 11px/1 var(--font-body)',
                color: 'var(--coral-ink)',
                background: 'var(--coral-surface)',
                padding: '4px 8px', borderRadius: 999,
              }}>{b.alerta}</span>
            )}
            {!b.alerta && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>ok</span>
            )}
          </div>
        ))}
      </div>

      <footer style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
          <strong style={{ color: 'var(--ink)' }}>13 blocos prontos</strong> · 1 com alerta
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ font: '500 13px/1 var(--font-body)', padding: '10px 16px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink-2)', cursor: 'pointer' }}>Descartar</button>
          <button style={{ font: '600 13px/1 var(--font-body)', padding: '12px 20px', borderRadius: 999, border: 'none', background: 'var(--ink)', color: 'var(--bg)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>Importar 13 blocos</button>
        </div>
      </footer>
    </div>
  );
}

function Erro() {
  return (
    <div style={{
      padding: '20px 24px',
      borderRadius: 'var(--r-md)',
      background: 'var(--coral-surface)',
      border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 999,
        background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--coral-ink)', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
      </span>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--coral-ink)', margin: 0, letterSpacing: '-0.005em' }}>
          Encontramos 2 plantões sem hora
        </h4>
        <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--coral-ink)', margin: '4px 0 0', opacity: 0.92 }}>
          Sex 8 mai · HDS · PS pediátrico — sem horário de início.<br/>
          Sáb 9 mai · HSL · enfermaria — duração ambígua (6h ou 12h).
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={{ font: '600 13px/1 var(--font-body)', padding: '10px 16px', borderRadius: 999, border: 'none', background: 'var(--coral-ink)', color: 'var(--bg)', cursor: 'pointer' }}>Preencher na mão</button>
          <button style={{ font: '500 13px/1 var(--font-body)', padding: '10px 16px', borderRadius: 999, border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)', background: 'transparent', color: 'var(--coral-ink)', cursor: 'pointer' }}>Tentar de novo</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// B) Importar .ics
// ---------------------------------------------------------------
function ZonaImportICS() {
  const eventos = [
    { titulo: 'Yoga · Studio Asa Norte', quando: 'qua 6 mai · 18h–19h', bloqueio: true },
    { titulo: 'Reunião escolar · Beto', quando: 'sex 8 mai · 17h–18h', bloqueio: true },
    { titulo: 'Aniversário Lara',       quando: 'sáb 9 mai · todo dia', bloqueio: true },
    { titulo: 'Café com Renata',         quando: 'dom 10 mai · 10h',     bloqueio: false },
  ];
  return (
    <ZonaCard
      eyebrow="b · agenda pessoal"
      titulo="Importar .ics"
      subtitulo="Google Calendar, iCloud ou Outlook. Eventos viram bloqueios — janelas em que você não pode plantonar."
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button style={{
          flex: 1, font: '600 13px/1 var(--font-body)',
          padding: '12px 14px', borderRadius: 999,
          border: '1px solid var(--line)', background: 'var(--bg-alt)',
          color: 'var(--ink)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Carregar .ics
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {eventos.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            borderRadius: 'var(--r-sm)',
            background: 'var(--bg-alt)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titulo}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{e.quando}</div>
            </div>
            <span style={{ font: '500 11px/1 var(--font-body)', color: 'var(--ink-3)' }}>tratar como</span>
            <Pill kind={e.bloqueio ? 'lavender' : 'neutral'} dot={false} style={{ fontSize: 10, padding: '5px 10px', textTransform: 'lowercase', letterSpacing: 0 }}>
              {e.bloqueio ? 'bloqueio' : 'ignorar'}
            </Pill>
          </div>
        ))}
      </div>

      <p style={{
        font: '400 12px/1.4 var(--font-body)',
        color: 'var(--ink-3)', margin: '12px 0 0',
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontVariationSettings: '"opsz" 14',
      }}>4 eventos · todos como bloqueio por padrão</p>
    </ZonaCard>
  );
}

// ---------------------------------------------------------------
// C) Exportar feed .ics
// ---------------------------------------------------------------
function ZonaExportICS() {
  const url = 'https://app.coloritmo.com.br/api/ics/m4r1n4-7f3a8b2c.ics';
  return (
    <ZonaCard
      eyebrow="c · feed pro seu calendário"
      titulo="Exportar pra Google Calendar"
      subtitulo="Uma URL única. Cole no Google Calendar → Adicionar calendário → De URL — atualiza sozinho."
    >
      <div style={{
        background: 'var(--bg-alt)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 12,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
        </svg>
        <code style={{
          flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{url}</code>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{
          flex: 1, font: '600 13px/1 var(--font-body)',
          padding: '12px 14px', borderRadius: 999,
          border: 'none', background: 'var(--ink)', color: 'var(--bg)',
          cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copiar URL
        </button>
        <button style={{
          font: '500 13px/1 var(--font-body)',
          padding: '12px 14px', borderRadius: 999,
          border: '1px solid var(--line)', background: 'var(--bg)',
          color: 'var(--ink-2)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>
          Abrir Google Calendar
        </button>
      </div>

      <div style={{
        marginTop: 14,
        padding: '10px 12px',
        background: 'var(--sand-surface)',
        borderRadius: 'var(--r-sm)',
        font: '400 12px/1.45 var(--font-body)',
        color: '#8B6B3A',
      }}>
        <strong style={{ fontWeight: 700 }}>Token único:</strong> qualquer pessoa com essa URL vê seus plantões.
        Você pode regerar a qualquer momento — a antiga deixa de funcionar.
      </div>
    </ZonaCard>
  );
}

// ---------------------------------------------------------------
// D) Backup completo JSON
// ---------------------------------------------------------------
function ZonaBackup() {
  return (
    <ZonaCard
      eyebrow="d · backup · raramente útil"
      titulo="Backup completo · JSON"
      subtitulo="Tudo: hospitais, plantões, regras, preferências. Bom pra mover de conta ou pra arquivar quando deixar de usar."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button style={{
          font: '600 13px/1 var(--font-body)',
          padding: '14px 16px', borderRadius: 'var(--r-sm)',
          border: '1px solid var(--line)', background: 'var(--bg-alt)',
          color: 'var(--ink)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'var(--bg)', color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>Baixar backup.json</div>
            <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>versão de hoje · ~38 KB</div>
          </div>
        </button>

        <button style={{
          font: '600 13px/1 var(--font-body)',
          padding: '14px 16px', borderRadius: 'var(--r-sm)',
          border: '1px dashed var(--line-2)', background: 'transparent',
          color: 'var(--ink-2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}>
          <span style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'var(--bg-alt)', color: 'var(--ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>Restaurar de backup</div>
            <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 2 }}>substitui tudo · pede confirmação</div>
          </div>
        </button>
      </div>
    </ZonaCard>
  );
}

Object.assign(window, { SyncScreen });
