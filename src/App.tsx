import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, Hospital, Mode, Preferencias } from '@/types';
import { cargaSemanal } from '@/lib/data';
import { HandVariantContext } from '@/components/atoms';
import { useAuth } from '@/hooks/useAuth';
import { useUserState } from '@/hooks/useUserState';
import { usePreviewMode } from '@/hooks/usePreviewMode';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { registrarServiceWorker } from '@/lib/push';

// Telas críticas (Login + Semana = first paint) ficam eager — o resto
// é code-split via React.lazy. Vite gera chunks separados; o user só
// baixa o JS de cada view quando navega.
import { Login } from '@/views/Login';
import { Shell } from '@/views/Shell';
import { Semana } from '@/views/Semana';
import { AdicionarBloco } from '@/views/AdicionarBloco';
import type { AddTipo } from '@/components/shell';

const Onboarding = lazy(() => import('@/views/Onboarding').then((m) => ({ default: m.Onboarding })));
const Mes = lazy(() => import('@/views/Mes').then((m) => ({ default: m.Mes })));
const ListaDoDia = lazy(() => import('@/views/ListaDoDia').then((m) => ({ default: m.ListaDoDia })));
const Conflitos = lazy(() => import('@/views/Conflitos').then((m) => ({ default: m.Conflitos })));
const Financeiro = lazy(() => import('@/views/Financeiro').then((m) => ({ default: m.Financeiro })));
const Sync = lazy(() => import('@/views/Sync').then((m) => ({ default: m.Sync })));
const Hospitais = lazy(() => import('@/views/Hospitais').then((m) => ({ default: m.Hospitais })));
const Trocas = lazy(() => import('@/views/Trocas').then((m) => ({ default: m.Trocas })));
const MontarEscala = lazy(() => import('@/views/MontarEscala').then((m) => ({ default: m.MontarEscala })));
const Detalhe = lazy(() => import('@/views/Detalhe').then((m) => ({ default: m.Detalhe })));
const Usuario = lazy(() => import('@/views/Usuario').then((m) => ({ default: m.Usuario })));
const Inbox = lazy(() => import('@/views/Inbox').then((m) => ({ default: m.Inbox })));
const Auditoria = lazy(() => import('@/views/Auditoria').then((m) => ({ default: m.Auditoria })));

import type { NavKey } from '@/components/shell';

function ViewLoading() {
  return (
    <div
      style={{
        padding: '40px 0',
        textAlign: 'center',
        color: 'var(--ink-3)',
        font: '400 13px/1 var(--font-body)',
      }}
    >
      …
    </div>
  );
}

export function App() {
  const auth = useAuth();
  const userId = auth.status === 'logado' ? auth.user?.id ?? null : null;
  const userState = useUserState(userId);
  const preview = usePreviewMode();
  const notif = useNotificacoes(userId);

  const [mode, setMode] = useState<Mode>('medica');
  const [active, setActive] = useState<NavKey>('agenda');
  const [selecionado, setSelecionado] = useState<Bloco | null>(null);
  const [detalheBloco, setDetalheBloco] = useState<Bloco | null>(null);
  const [pulouOnboarding, setPulouOnboarding] = useState(false);
  const [adicionando, setAdicionando] = useState<AddTipo | null>(null);

  // Cookie de preview força o mode (Marcos vendo como X sem login real).
  useEffect(() => {
    if (preview.mode) setMode(preview.mode);
  }, [preview.mode]);

  // Service worker silencioso no boot.
  useEffect(() => {
    void registrarServiceWorker();
  }, []);

  const carga = useMemo(() => cargaSemanal(userState.state.blocos), [userState.state.blocos]);

  const precisaOnboarding =
    auth.status === 'logado' &&
    userState.status === 'pronto' &&
    Object.keys(userState.state.hospitais).length === 0 &&
    !pulouOnboarding;

  // ---- Helpers de mutação --------------------------------------------------
  const adicionarBlocos = (novos: BlocoPlantao[]) => {
    userState.setState({ blocos: [...userState.state.blocos, ...novos] });
  };

  const adicionarBloco = (b: Bloco) => {
    userState.setState({ blocos: [...userState.state.blocos, b] });
    setAdicionando(null);
  };

  const salvarHospital = (id: string, h: Hospital) => {
    userState.setState({ hospitais: { ...userState.state.hospitais, [id]: h } });
  };

  const removerHospital = (id: string) => {
    const proximo = { ...userState.state.hospitais };
    delete proximo[id];
    userState.setState({ hospitais: proximo });
  };

  const salvarPreferencias = (p: Preferencias) => {
    userState.setState({ preferencias: p });
  };

  const concluirOnboarding = (dados: {
    hospitais: Hospital[];
    preferencias: Partial<Preferencias>;
  }) => {
    const map: Record<string, Hospital> = {};
    for (const h of dados.hospitais) map[h.id] = h;
    userState.setState({
      hospitais: { ...userState.state.hospitais, ...map },
      preferencias: { ...userState.state.preferencias, ...dados.preferencias },
    });
    setPulouOnboarding(true);
  };

  // ---- Roteamento de tela --------------------------------------------------

  return (
    <HandVariantContext.Provider value="italic">
      {auth.status === 'verificando' && !preview.ativo && <Boot />}

      {auth.status === 'deslogado' && !preview.ativo && <Login />}

      {precisaOnboarding && (
        <Suspense fallback={<Boot />}>
          <Onboarding onConcluir={concluirOnboarding} onPular={() => setPulouOnboarding(true)} />
        </Suspense>
      )}

      {(auth.status === 'logado' || preview.ativo) && !precisaOnboarding && (
        <>
          {detalheBloco ? (
            <Shell
              active="agenda"
              setActive={(k) => {
                setActive(k);
                setDetalheBloco(null);
              }}
              mode={mode}
              carga={carga}
              blocos={userState.state.blocos}
              hospitais={userState.state.hospitais}
              selecionado={null}
              setSelecionado={() => {}}
              notificacoes={notif.notificacoes}
              onMarcarLida={notif.marcarLida}
            >
              <Suspense fallback={<ViewLoading />}>
                <Detalhe
                  bloco={detalheBloco}
                  hospitais={userState.state.hospitais}
                  voltar={() => setDetalheBloco(null)}
                  onTrocar={() => {
                    setDetalheBloco(null);
                    setActive('trocas');
                  }}
                  onCeder={() => {
                    setDetalheBloco(null);
                    setActive('trocas');
                  }}
                />
              </Suspense>
            </Shell>
          ) : (
            <Shell
              active={active}
              setActive={setActive}
              mode={mode}
              carga={carga}
              blocos={userState.state.blocos}
              hospitais={userState.state.hospitais}
              selecionado={selecionado}
              setSelecionado={setSelecionado}
              abrirDetalhe={(b) => {
                setDetalheBloco(b);
                setSelecionado(null);
              }}
              onTrocar={() => {
                setSelecionado(null);
                setActive('trocas');
              }}
              onCeder={() => {
                setSelecionado(null);
                setActive('trocas');
              }}
              onAdd={(t) => setAdicionando(t)}
              notificacoes={notif.notificacoes}
              onMarcarLida={notif.marcarLida}
            >
              <Suspense fallback={<ViewLoading />}>
                <ViewSwitch
                  active={active}
                  userState={userState}
                  mode={mode}
                  setMode={setMode}
                  userId={userId}
                  email={auth.user?.email ?? (preview.ativo ? `preview · ${preview.as}` : null)}
                  onSelectBloco={setSelecionado}
                  adicionarBlocos={adicionarBlocos}
                  salvarHospital={salvarHospital}
                  removerHospital={removerHospital}
                  salvarPreferencias={salvarPreferencias}
                />
              </Suspense>
            </Shell>
          )}

          {adicionando && (
            <AdicionarBloco
              tipo={adicionando}
              hospitais={userState.state.hospitais}
              blocosAtuais={userState.state.blocos}
              onSalvar={adicionarBloco}
              onCancelar={() => setAdicionando(null)}
            />
          )}
        </>
      )}
    </HandVariantContext.Provider>
  );
}

interface ViewSwitchProps {
  active: NavKey;
  userState: ReturnType<typeof useUserState>;
  mode: Mode;
  setMode: (m: Mode) => void;
  userId: string | null;
  email: string | null;
  onSelectBloco: (b: Bloco) => void;
  adicionarBlocos: (novos: BlocoPlantao[]) => void;
  salvarHospital: (id: string, h: Hospital) => void;
  removerHospital: (id: string) => void;
  salvarPreferencias: (p: Preferencias) => void;
}

function ViewSwitch({
  active,
  userState,
  mode,
  setMode,
  userId,
  email,
  onSelectBloco,
  adicionarBlocos,
  salvarHospital,
  removerHospital,
  salvarPreferencias,
}: ViewSwitchProps) {
  const { state, status, erro } = userState;
  const mesISO = new Date().toISOString().slice(0, 7);

  switch (active) {
    case 'agenda':
      return (
        <>
          <ModeBar mode={mode} setMode={setMode} email={email} />
          <Semana
            blocos={state.blocos}
            hospitais={state.hospitais}
            mode={mode}
            loading={status === 'carregando'}
            erro={erro}
            onSelectBloco={onSelectBloco}
          />
        </>
      );

    case 'mes':
      return (
        <>
          <ModeBar mode={mode} setMode={setMode} email={email} />
          <Mes blocos={state.blocos} hospitais={state.hospitais} onSelectBloco={onSelectBloco} />
        </>
      );

    case 'lista':
      return (
        <ListaDoDia
          blocos={state.blocos}
          hospitais={state.hospitais}
          onSelectBloco={onSelectBloco}
        />
      );

    case 'conflitos':
      return (
        <Conflitos
          blocos={state.blocos}
          hospitais={state.hospitais}
          onSelectBloco={onSelectBloco}
        />
      );

    case 'financeiro':
      return (
        <Financeiro
          blocos={state.blocos}
          hospitais={state.hospitais}
          metaMensal={state.preferencias.metaMensal}
        />
      );

    case 'sync':
      return (
        <Sync
          blocos={state.blocos}
          hospitais={state.hospitais}
          onAdicionarBlocos={adicionarBlocos}
          nomeUser={state.preferencias.nome}
        />
      );

    case 'hospitais':
      return (
        <Hospitais
          hospitais={state.hospitais}
          onSalvar={salvarHospital}
          onRemover={removerHospital}
        />
      );

    case 'trocas':
      return (
        <Trocas
          blocos={state.blocos}
          hospitais={state.hospitais}
          onCriarPedido={(b, motivo, candidatos) =>
            console.info('troca:', b.id, motivo, candidatos)
          }
        />
      );

    case 'montar':
      return (
        <MontarEscala
          blocos={state.blocos}
          hospitais={state.hospitais}
          preferencias={state.preferencias}
          mesISO={mesISO}
          onAdicionarSugestoes={adicionarBlocos}
        />
      );

    case 'usuario':
      return (
        <Usuario
          email={email}
          userId={userId}
          preferencias={state.preferencias}
          onSalvarPreferencias={salvarPreferencias}
        />
      );

    case 'inbox':
      return <Inbox />;

    case 'auditoria':
      return <Auditoria />;

    case 'time':
      return <em style={{ color: 'var(--ink-3)' }}>tela `time` chega na próxima iteração.</em>;

    default:
      return null;
  }
}

interface ModeBarProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  email: string | null;
}

function ModeBar({ mode, setMode, email }: ModeBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--bg-alt)',
          borderRadius: 999,
          padding: 4,
          border: '1px solid var(--line)',
        }}
      >
        {(['medica', 'parceiro', 'admin'] as Mode[]).map((m) => {
          const ativa = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                font: '600 11px/1 var(--font-body)',
                padding: '7px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: ativa ? 'var(--bg)' : 'transparent',
                color: ativa ? 'var(--ink)' : 'var(--ink-2)',
                boxShadow: ativa ? 'var(--shadow-sm)' : 'none',
                textTransform: 'lowercase',
              }}
            >
              {m === 'medica' ? 'médica' : m}
            </button>
          );
        })}
      </div>
      {email && (
        <span style={{ font: '500 12px/1 var(--font-body)', color: 'var(--ink-3)' }}>
          {email}
        </span>
      )}
    </div>
  );
}

function Boot() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--ink-3)',
        font: '400 14px/1 var(--font-body)',
      }}
    >
      …
    </div>
  );
}
