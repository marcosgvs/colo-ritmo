// =====================================================================
// app.jsx — monta tudo
// =====================================================================

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [drawerB, setDrawerB] = React.useState(null);
  const [tela, setTela] = React.useState(t.tela || 'agenda');
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState(NOTIFS_ME);

  // Sync tela <-> tweak (tweaks panel can drive nav, and nav writes back)
  React.useEffect(() => { if (t.tela && t.tela !== tela) setTela(t.tela); }, [t.tela]);
  const navega = (k) => { setTela(k); setTweak('tela', k); };

  const isVazio = t.estado === 'vazio';
  const blocos = isVazio ? [] : (ESTADOS[t.estado] || ESTADOS.cheia);
  const carga = cargaSemanal(blocos);
  const mode = t.mode;
  const handVariant = t.handVariant || 'italic';
  const syncState = t.syncState || 'idle';
  const dadosFin = t.dadosFin || 'cheio';
  const conflitosCount = t.estado === 'conflito' ? 3 : 0;

  const handleNotifAcao = (n) => {
    setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, lida: true } : x));
    setNotifOpen(false);
    if (n.tipo === 'sugestao') setTela('montar');
    if (n.tipo === 'troca-aceita') setTela('trocas');
    if (n.tipo === 'conflito' || n.tipo === 'limite') setTela('agenda');
  };

  return (
    <HandVariantContext.Provider value={handVariant}>
    <div style={{ background: 'var(--bg-alt)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--bg)' }}>
        <Header
          active={tela}
          mode={mode}
          carga={carga}
          onCmdK={() => {}}
          onNav={navega}
          notifs={mode === 'medica' ? notifs : null}
          notifOpen={notifOpen}
          onNotifToggle={() => setNotifOpen(o => !o)}
          conflitos={mode === 'medica' ? conflitosCount : 0}
        />
        <NotifDrawer
          open={notifOpen}
          notifs={notifs}
          onClose={() => setNotifOpen(false)}
          onAcao={handleNotifAcao}
        />

        {tela === 'agenda' && (<>
        {isVazio && (
          <div style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 32px 32px' }}>
            <RoleBanner mode={mode}/>
            <EmptyPrimeiraSemana
              onImportar={() => setTela('sync')}
              onAdicionar={() => navega('agendar')}
            />
          </div>
        )}
        {!isVazio && t.showDesktop && (
          <div style={{
            maxWidth: 1480,
            margin: '0 auto',
            padding: '24px 32px 32px',
          }}>
            <DesktopColumn
              blocos={blocos}
              mode={mode}
              carga={carga}
              density={t.density}
              onSelectBloco={setDrawerB}
            />
          </div>
        )}

        {!isVazio && t.showMobile && (
          <div style={{
            background: 'var(--bg-alt)',
            padding: '40px 24px 96px',
            display: 'flex',
            justifyContent: 'center',
            borderTop: t.showDesktop ? '1px solid var(--line)' : 'none',
          }}>
            <MobileColumn
              blocos={blocos}
              mode={mode}
              carga={carga}
              onSelectBloco={setDrawerB}
            />
          </div>
        )}
        </>)}

        {tela === 'time' && <TimeScreen mode={mode} onSelectMember={() => {}} onApprove={() => {}} />}
        {tela === 'trocas' && <TrocasScreen mode={mode} />}
        {tela === 'mes' && <MesScreen mode={mode} onSelectDia={() => {}} onSelectSemana={() => setTela('agenda')} />}
        {tela === 'montar' && <MontarEscalaScreen mode={mode} />}
        {tela === 'lista' && <ListaScreen mode={mode} onSelectBloco={setDrawerB} />}
        {tela === 'detalhe' && <DetalheScreen mode={mode} onBack={() => setTela('agenda')} />}
        {tela === 'onboarding' && <OnboardingScreen onFinish={() => setTela('agenda')} />}
        {tela === 'hospitais' && <HospitaisScreen mode={mode} vazio={t.estado === 'vazio'} />}
        {tela === 'sync' && <SyncScreen mode={mode} syncState={syncState} />}
        {tela === 'conflitos' && <ConflitosScreen mode={mode} vazio={conflitosCount === 0} onIrAgenda={() => navega('agenda')} />}
        {tela === 'financeiro' && <FinanceiroScreen mode={mode} dados={dadosFin} />}
        {tela === 'agendar' && <AgendarScreen mode={mode} tipoInicial={t.agendarTipo || 'plantao'} onClose={() => navega('agenda')} />}
        {tela === 'inbox' && <InboxScreen mode={mode} />}
        {tela === 'hospital-detalhe' && <HospitalDetalheScreen id="HBDF" mode={mode} onBack={() => navega('hospitais')} />}
        {tela === 'conflito-resolver' && <ConflitoResolverScreen mode={mode} onBack={() => navega('conflitos')} />}
        {tela === 'detalhe-full' && <DetalheFullScreen mode={mode} onBack={() => navega('agenda')} />}
        {tela === 'erro' && <ErrorScreen onTentar={() => navega('agenda')} />}
        {tela === 'skeleton' && <SkeletonGrade />}
        {tela === 'coordenadora' && <CoordenadoraScreen mode={mode} onBack={() => navega('agenda')} />}
        {tela === 'financeiro-full' && <FinanceiroFullScreen mode={mode} onBack={() => navega('agenda')} />}
        {tela === 'login' && (
          <div style={{ minHeight: 'calc(100vh - 60px)', background: 'var(--bg)' }}>
            <iframe src="login.html" title="Login" style={{ width: '100%', height: 'calc(100vh - 60px)', border: 'none', display: 'block' }}/>
          </div>
        )}
        {tela === 'conflitos-vazio' && (
          <div style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 32px' }}>
            <RoleBanner mode={mode}/>
            <EmptySemConflitos onIrAgenda={() => setTela('agenda')}/>
          </div>
        )}
        {tela !== 'agenda' && tela !== 'time' && tela !== 'trocas' && tela !== 'mes' && tela !== 'montar' && tela !== 'lista' && tela !== 'detalhe' && tela !== 'onboarding' && tela !== 'hospitais' && tela !== 'sync' && tela !== 'login' && tela !== 'conflitos-vazio' && tela !== 'conflitos' && tela !== 'financeiro' && tela !== 'agendar' && tela !== 'inbox' && tela !== 'hospital-detalhe' && tela !== 'conflito-resolver' && tela !== 'detalhe-full' && tela !== 'erro' && tela !== 'skeleton' && tela !== 'coordenadora' && tela !== 'financeiro-full' && (
          <div style={{
            maxWidth: 1480, margin: '0 auto', padding: '80px 32px',
            textAlign: 'center',
          }}>
            <Eyebrow style={{ display: 'block', marginBottom: 12 }}>em construção</Eyebrow>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 500,
              fontSize: 44, color: 'var(--ink)',
              margin: 0, letterSpacing: '-0.02em',
            }}>{tela}</h1>
            <p style={{ color: 'var(--ink-3)', marginTop: 12 }}>essa tela vem no próximo lote</p>
          </div>
        )}
      </div>

      <FAB mode={mode} onAdd={(t) => { setTweak('agendarTipo', t); navega('agendar'); }} />
      <Drawer bloco={drawerB} onClose={() => setDrawerB(null)} mode={mode} />
    </div>
    </HandVariantContext.Provider>
  );
}

// Coluna desktop (page-head + grid + rail)
function DesktopColumn({ blocos, mode, carga, density, onSelectBloco }) {
  const nivel = nivelCarga(carga);
  const subtitle = {
    ok:   'dentro do limite saudável · semana respirando',
    warn: 'caminhando bem · atenção pra não cruzar 60h',
    err:  '60h+ · acima do limite saudável CFM',
  }[nivel];

  return (
    <main data-screen-label="Agenda · semana · desktop">
      <RoleBanner mode={mode} />

      {/* Page head — reorganizado: título grande à esq, controles trilha à dir */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 28,
      }}>
        <div>
          <Eyebrow style={{ display: 'block', marginBottom: 6 }}>plantões · 4–10 mai 2026</Eyebrow>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500,
            fontSize: 'clamp(36px, 4vw, 44px)',
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            margin: 0,
            textWrap: 'balance',
          }}>
            sua semana
          </h1>
          <p style={{
            font: '400 16px/1.4 var(--font-body)',
            color: 'var(--ink-2)',
            margin: '8px 0 0',
            maxWidth: 560,
          }}>
            {subtitle}
          </p>
        </div>

        {/* Trilha de controles — sem 3 grupos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ViewSwitch />
          <WeekNav />
        </div>
      </div>

      {/* Layout grid + rail */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 28,
        alignItems: 'flex-start',
      }}>
        <WeekGrid
          blocos={blocos}
          density={density}
          onSelectBloco={onSelectBloco}
        />
        <Rail blocos={blocos} mode={mode} carga={carga} />
      </div>
    </main>
  );
}

function MobileColumn({ blocos, mode, carga, onSelectBloco }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      paddingTop: 8,
    }} data-screen-label="Agenda · mobile">
      <Eyebrow>mobile · 390 × 844</Eyebrow>
      <MobileFrame
        blocos={blocos}
        mode={mode}
        carga={carga}
        onSelectBloco={onSelectBloco}
      />
    </div>
  );
}

function ViewSwitch() {
  const tabs = [
    { k: 'sem', label: 'semana', active: true },
    { k: 'mes', label: 'mês' },
    { k: 'lis', label: 'lista' },
    { k: 'rad', label: 'radar' },
  ];
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-alt)',
      border: '1px solid var(--line)',
      borderRadius: 999,
      padding: 3,
      gap: 2,
    }}>
      {tabs.map(t => (
        <button key={t.k} style={{
          font: '600 12px/1 var(--font-body)',
          padding: '8px 14px',
          borderRadius: 999,
          border: 'none',
          background: t.active ? 'var(--bg)' : 'transparent',
          color: t.active ? 'var(--ink)' : 'var(--ink-2)',
          boxShadow: t.active ? 'var(--shadow-sm)' : 'none',
          cursor: 'pointer',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function WeekNav() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <NavBtn dir="prev" />
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: 16,
        color: 'var(--ink)',
        padding: '0 10px',
        letterSpacing: '-0.01em',
      }}>mai 2026</span>
      <NavBtn dir="next" />
      <button style={{
        font: '600 12px/1 var(--font-body)',
        padding: '8px 14px',
        borderRadius: 999,
        border: '1px solid var(--line)',
        background: 'var(--bg)',
        color: 'var(--ink-2)',
        cursor: 'pointer',
        marginLeft: 4,
      }}>hoje</button>
    </div>
  );
}

function NavBtn({ dir }) {
  return (
    <button style={{
      width: 32, height: 32,
      border: '1px solid var(--line)',
      background: 'var(--bg)',
      borderRadius: 999,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--ink-2)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'prev' ? <path d="M15 6l-6 6 6 6"/> : <path d="M9 6l6 6-6 6"/>}
      </svg>
    </button>
  );
}

Object.assign(window, { App });
