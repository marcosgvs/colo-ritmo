import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type {
  Bloco,
  BlocoPlantao,
  CelulaEscala,
  Hospital,
  Janela,
  Mode,
  Preferencias,
} from '@/types';
import { atualizarHoje, cargaSemanal, HOJE, semanaDe, setHospitaisRuntime } from '@/lib/data';
import { HandVariantContext } from '@/components/atoms';
import { useAuth } from '@/hooks/useAuth';
import { useUserState } from '@/hooks/useUserState';
import { usePreviewMode } from '@/hooks/usePreviewMode';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { useIsMobile } from '@/hooks/useIsMobile';
import { registrarServiceWorker } from '@/lib/push';
import { identificarUsuario } from '@/lib/monitoring';
import type { NavKey } from '@/components/shell';

/**
 * Mapeia `/ritmo/<chave>` ↔ NavKey. Path raiz `/ritmo/` (sem slug) cai em
 * agenda. Slugs inválidos também caem em agenda (fallback seguro).
 */
const NAV_KEYS_VALIDOS: NavKey[] = [
  'agenda',
  'mes',
  'lista',
  'montar',
  'equipe',
  'hospitais',
  'financeiro',
  'sync',
  'conflitos',
  'trocas',
  'usuario',
  'inbox',
  'auditoria',
  'time',
];

function parsePathToNav(pathname: string): NavKey {
  // pathname normalmente é "/ritmo/" ou "/ritmo/usuario" etc.
  const limpo = pathname.replace(/^\/ritmo\/?/, '').replace(/\/+$/, '');
  if (!limpo) return 'agenda';
  const candidato = limpo.split('/')[0] as NavKey;
  return NAV_KEYS_VALIDOS.includes(candidato) ? candidato : 'agenda';
}

function navToPath(key: NavKey): string {
  return key === 'agenda' ? '/ritmo/' : `/ritmo/${key}`;
}

// Telas críticas (Login + Semana = first paint) ficam eager — o resto
// é code-split via React.lazy. Vite gera chunks separados; o user só
// baixa o JS de cada view quando navega.
import { Login } from '@/views/Login';
import { Shell } from '@/views/Shell';
import { Semana } from '@/views/Semana';
import { AdicionarBloco, ehTipoEditavel } from '@/views/AdicionarBloco';
import { TrocaCederModal, type RegistroTroca } from '@/views/TrocaCederModal';
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
const EscalaEquipe = lazy(() => import('@/views/EscalaEquipe').then((m) => ({ default: m.EscalaEquipe })));
const Usuario = lazy(() => import('@/views/Usuario').then((m) => ({ default: m.Usuario })));
const Inbox = lazy(() => import('@/views/Inbox').then((m) => ({ default: m.Inbox })));
const Auditoria = lazy(() => import('@/views/Auditoria').then((m) => ({ default: m.Auditoria })));
const Time = lazy(() => import('@/views/Time').then((m) => ({ default: m.Time })));

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
  const [active, setActive] = useState<NavKey>(() =>
    typeof window !== 'undefined' ? parsePathToNav(window.location.pathname) : 'agenda',
  );
  const [selecionado, setSelecionado] = useState<Bloco | null>(null);
  const [pulouOnboarding, setPulouOnboarding] = useState(false);
  const [adicionando, setAdicionando] = useState<AddTipo | null>(null);
  const [editandoBloco, setEditandoBloco] = useState<Bloco | null>(null);
  const [trocaCeder, setTrocaCeder] = useState<{ modo: 'trocar' | 'ceder'; bloco: BlocoPlantao } | null>(null);

  // Cookie de preview força o mode (Marcos vendo como X sem login real).
  useEffect(() => {
    if (preview.mode) setMode(preview.mode);
  }, [preview.mode]);

  // Service worker silencioso no boot.
  useEffect(() => {
    void registrarServiceWorker();
  }, []);

  // Vincula sessão Supabase ao Sentry · todo erro reportado já vem com id+email.
  useEffect(() => {
    if (auth.status === 'logado' && auth.user) {
      identificarUsuario(auth.user.id, auth.user.email ?? undefined);
    } else if (auth.status === 'deslogado') {
      identificarUsuario(null);
    }
  }, [auth.status, auth.user]);

  // Roteamento real · URL e active state ficam em sincronia.
  // Quando active muda (click de nav, FAB, etc), atualiza a URL sem reload.
  // Quando o user usa voltar/avançar do browser, atualiza o active.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alvo = navToPath(active);
    if (window.location.pathname !== alvo) {
      // Mesma view com path fora do canônico (/ritmo sem barra, slug inválido):
      // corrige sem empilhar entrada — senão o primeiro "voltar" parece morto.
      if (parsePathToNav(window.location.pathname) === active) {
        window.history.replaceState({}, '', alvo);
      } else {
        window.history.pushState({}, '', alvo);
      }
    }
    // Trocar de view sempre aterrissa no topo (senão o scroll da view
    // anterior persiste e a nova abre no meio).
    window.scrollTo(0, 0);
  }, [active]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function aoVoltar(): void {
      setActive(parsePathToNav(window.location.pathname));
    }
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);

  // Virada do dia · PWA instalada não recarrega sozinha, então "hoje"
  // congelaria no dia em que a aba abriu. Checa ao voltar o foco e a cada
  // minuto; quando o dia muda, atualiza o módulo e remonta as views (key).
  const [hoje, setHoje] = useState<string>(HOJE);
  useEffect(() => {
    function checarDia(): void {
      const novo = atualizarHoje();
      setHoje((atual) => (atual === novo ? atual : novo));
    }
    const timer = setInterval(checarDia, 60_000);
    document.addEventListener('visibilitychange', checarDia);
    window.addEventListener('focus', checarDia);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', checarDia);
      window.removeEventListener('focus', checarDia);
    };
  }, []);

  // Atualiza o map runtime de hospitais · permite que getHospital() resolva
  // hospitais customizados (id "H-...") em qualquer view.
  //
  // Usa useMemo (não useEffect) porque getHospital é chamado *durante o
  // render* dos blocos (Bloco atom). Se isso fosse useEffect, o primeiro
  // render após o load do user_state encontraria runtime ainda vazio e
  // os plantões sumiriam visualmente até o user navegar (forçando outro
  // ciclo). Render-time setter resolve a race condition de side-effect
  // global vs ordem de mount.
  useMemo(() => {
    setHospitaisRuntime(userState.state.hospitais);
  }, [userState.state.hospitais]);

  // CargaBadge do header mostra a semana de HOJE · cargaSemanal só
  // soma o array que recebe (não filtra), então filtramos antes pra
  // não somar a vida toda.
  const carga = useMemo(() => {
    const dias = new Set(semanaDe(hoje));
    return cargaSemanal(userState.state.blocos.filter((b) => dias.has(b.data)));
  }, [userState.state.blocos, hoje]);

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

  const removerBloco = (id: number | string) => {
    userState.setState({ blocos: userState.state.blocos.filter((b) => b.id !== id) });
  };

  const salvarEdicaoBloco = (b: Bloco) => {
    userState.setState({
      blocos: userState.state.blocos.map((x) => (x.id === b.id ? b : x)),
    });
    setEditandoBloco(null);
  };

  /** Estica noitinha (5h) pra noite (12h) · caso comum quando UTI lota. */
  const esticarNoite = (b: Bloco) => {
    if (b.tipo !== 'plantao') return;
    userState.setState({
      blocos: userState.state.blocos.map((x) =>
        x.id === b.id && x.tipo === 'plantao' ? { ...x, duracao: 12 } : x,
      ),
    });
    setSelecionado(null);
  };

  const removerBlocoEditando = () => {
    if (!editandoBloco) return;
    removerBloco(editandoBloco.id);
    setEditandoBloco(null);
  };

  const aplicarTrocaCeder = (reg: RegistroTroca) => {
    if (reg.modo === 'ceder') {
      // Marca o plantão original como cedido (anota com quem) · mantém na agenda.
      const proximos = userState.state.blocos.map((b) => {
        if (b.id !== reg.plantaoId || b.tipo !== 'plantao') return b;
        return {
          id: b.id,
          tipo: 'cedido' as const,
          hospitalId: b.hospitalId,
          data: b.data,
          horaInicio: b.horaInicio,
          duracao: b.duracao,
          cedidoPara: reg.quem,
        };
      });
      userState.setState({ blocos: proximos });
    } else {
      // Trocou: o plantão original some, e entra o que ele recebeu em troca.
      const filtrados = userState.state.blocos.filter((b) => b.id !== reg.plantaoId);
      const novo: Bloco = {
        id: `troca-${Date.now()}`,
        tipo: 'plantao',
        hospitalId: reg.recebidoHospitalId ?? '',
        data: reg.recebidoEmISO ?? '',
        horaInicio: reg.recebidoHora ?? 0,
        duracao: reg.recebidoDuracao ?? 0,
        viaTroca: true,
        trocaInfo: `${reg.quem} · ${reg.recebidoEmISO ?? ''}`,
      };
      userState.setState({ blocos: [...filtrados, novo] });
    }
    setTrocaCeder(null);
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

  /**
   * Aplica uma escala oficial importada de PDF · substitui plantões
   * existentes do mês×hospital, preserva trocas/cedidos manuais, mescla
   * janelas no hospital, e arquiva a transcrição completa do PDF (todos
   * os médicos, não só a Mariana) pra alimentar futuramente o Montar AI.
   */
  const aplicarEscala = (data: {
    hospitalId: string;
    mesISO: string;
    blocos: BlocoPlantao[];
    janelas: Janela[];
    celulas?: CelulaEscala[];
    apelidoUsado?: string;
  }) => {
    const { hospitalId, mesISO, blocos, janelas, celulas, apelidoUsado } = data;
    // Remove plantões REGULARES existentes do mesmo mês×hospital (preserva cedidos/trocados/extras manuais)
    const semOficiaisAntigos = userState.state.blocos.filter((b) => {
      if (b.tipo !== 'plantao') return true; // sono, bloqueio, cedido, deslocamento, etc
      if (b.hospitalId !== hospitalId) return true;
      if (!b.data.startsWith(mesISO)) return true;
      if (b.viaTroca) return true; // preserva troca manual
      return false; // remove plantão regular antigo do mês×hospital
    });
    const novosBlocos = [...semOficiaisAntigos, ...blocos];

    // Mescla janelas no hospital (rótulo único · novo sobrescreve antigo)
    const hospital = userState.state.hospitais[hospitalId];
    const hospitaisAtualizados = hospital
      ? {
          ...userState.state.hospitais,
          [hospitalId]: { ...hospital, janelas: mesclarJanelas(hospital.janelas, janelas) },
        }
      : userState.state.hospitais;

    // Arquiva a transcrição completa · re-importar mesmo (hospital, ano, mes) substitui.
    let escalasImportadas = userState.state.escalasImportadas;
    if (celulas && celulas.length > 0) {
      const [anoStr, mesStr] = mesISO.split('-');
      const ano = parseInt(anoStr ?? '0', 10);
      const mes = parseInt(mesStr ?? '0', 10);
      escalasImportadas = [
        ...escalasImportadas.filter(
          (e) => !(e.hospitalId === hospitalId && e.ano === ano && e.mes === mes),
        ),
        {
          hospitalId,
          ano,
          mes,
          importadaEm: new Date().toISOString(),
          janelas,
          celulas,
          apelidoUsado,
        },
      ];
    }

    userState.setState({
      blocos: novosBlocos,
      hospitais: hospitaisAtualizados,
      escalasImportadas,
    });
  };

  function mesclarJanelas(atuais: Janela[] | undefined, novas: Janela[]): Janela[] {
    const map = new Map<string, Janela>();
    for (const j of atuais ?? []) map.set(j.rotulo.toLowerCase(), j);
    for (const j of novas) map.set(j.rotulo.toLowerCase(), j);
    return [...map.values()];
  }

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
            <Shell
              key={hoje}
              active={active}
              setActive={setActive}
              mode={mode}
              carga={carga}
              blocos={userState.state.blocos}
              hospitais={userState.state.hospitais}
              selecionado={selecionado}
              setSelecionado={setSelecionado}
              onTrocar={(b) => {
                if (b.tipo !== 'plantao') return;
                setSelecionado(null);
                setTrocaCeder({ modo: 'trocar', bloco: b });
              }}
              onCeder={(b) => {
                if (b.tipo !== 'plantao') return;
                setSelecionado(null);
                setTrocaCeder({ modo: 'ceder', bloco: b });
              }}
              onEditar={(b) => {
                setEditandoBloco(b);
                setSelecionado(null);
              }}
              onRemover={(id) => {
                removerBloco(id);
                setSelecionado(null);
              }}
              onEsticarNoite={esticarNoite}
              onAdd={(t) => setAdicionando(t)}
              notificacoes={notif.notificacoes}
              onMarcarLida={notif.marcarLida}
            >
              <Suspense fallback={<ViewLoading />}>
                <ViewSwitch
                  active={active}
                  userState={userState}
                  mode={mode}
                  userId={userId}
                  email={auth.user?.email ?? (preview.ativo ? `preview · ${preview.as}` : null)}
                  onSelectBloco={setSelecionado}
                  adicionarBlocos={adicionarBlocos}
                  salvarHospital={salvarHospital}
                  removerHospital={removerHospital}
                  salvarPreferencias={salvarPreferencias}
                  aplicarEscala={aplicarEscala}
                />
              </Suspense>
            </Shell>

          {adicionando && (
            <AdicionarBloco
              tipo={adicionando}
              hospitais={userState.state.hospitais}
              blocosAtuais={userState.state.blocos}
              onSalvar={adicionarBloco}
              onCancelar={() => setAdicionando(null)}
            />
          )}

          {editandoBloco && ehTipoEditavel(editandoBloco.tipo) && (
            <AdicionarBloco
              tipo={editandoBloco.tipo}
              hospitais={userState.state.hospitais}
              blocosAtuais={userState.state.blocos}
              blocoExistente={editandoBloco}
              onSalvar={salvarEdicaoBloco}
              onRemover={removerBlocoEditando}
              onCancelar={() => setEditandoBloco(null)}
            />
          )}

          {trocaCeder && (
            <TrocaCederModal
              modo={trocaCeder.modo}
              bloco={trocaCeder.bloco}
              outrosPlantoes={userState.state.blocos}
              hospitais={userState.state.hospitais}
              onCancelar={() => setTrocaCeder(null)}
              onConfirmar={(reg) => aplicarTrocaCeder(reg)}
            />
          )}
        </>
      )}

      {userState.espelhandoDe && <EspelhoBadge email={userState.espelhandoDe} />}
    </HandVariantContext.Provider>
  );
}

/**
 * Chip fixed bottom-right · aviso permanente de que o app está mostrando
 * a conta de outro user (modo dev/QA). `pointer-events: none` pra não
 * bloquear cliques no que está embaixo.
 */
function EspelhoBadge({ email }: { email: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        left: 10,
        background: 'var(--lavender-surface)',
        color: 'var(--lavender-ink)',
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid var(--lavender)',
        font: '400 11px/1.2 var(--font-body)',
        letterSpacing: '0.01em',
        zIndex: 9999,
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      espelho · {email}
    </div>
  );
}

interface ViewSwitchProps {
  active: NavKey;
  userState: ReturnType<typeof useUserState>;
  mode: Mode;
  userId: string | null;
  email: string | null;
  onSelectBloco: (b: Bloco) => void;
  adicionarBlocos: (novos: BlocoPlantao[]) => void;
  salvarHospital: (id: string, h: Hospital) => void;
  removerHospital: (id: string) => void;
  salvarPreferencias: (p: Preferencias) => void;
  aplicarEscala: (data: {
    hospitalId: string;
    mesISO: string;
    blocos: BlocoPlantao[];
    janelas: Janela[];
    celulas?: CelulaEscala[];
  }) => void;
}

function ViewSwitch({
  active,
  userState,
  mode,
  userId,
  email,
  onSelectBloco,
  adicionarBlocos,
  salvarHospital,
  removerHospital,
  salvarPreferencias,
  aplicarEscala,
}: ViewSwitchProps) {
  const { state, status, erro } = userState;
  const isMobile = useIsMobile();

  // Agenda vazia e agenda-ainda-carregando são coisas MUITO diferentes aqui:
  // "vazio" lê como "estou livre". A Semana desktop tem skeleton próprio;
  // todas as outras views recebem o gate genérico.
  const semanaDesktop = active === 'agenda' && !isMobile;
  if (!semanaDesktop && status === 'carregando') {
    return <EstadoCarregando />;
  }
  if (!semanaDesktop && status === 'erro') {
    return <EstadoErro erro={erro} />;
  }

  switch (active) {
    case 'agenda':
      // Em mobile a grade semanal é inviável (7 dias × 24h) · cai pra Lista.
      if (isMobile) {
        return (
          <ListaDoDia
            blocos={state.blocos}
            hospitais={state.hospitais}
            onSelectBloco={onSelectBloco}
          />
        );
      }
      return (
        <Semana
          blocos={state.blocos}
          hospitais={state.hospitais}
          mode={mode}
          loading={status === 'carregando'}
          erro={erro}
          onSelectBloco={onSelectBloco}
        />
      );

    case 'mes':
      return <Mes blocos={state.blocos} hospitais={state.hospitais} onSelectBloco={onSelectBloco} />;

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
        />
      );

    case 'sync':
      return (
        <Sync
          blocos={state.blocos}
          hospitais={state.hospitais}
          onAdicionarBlocos={adicionarBlocos}
          onAplicarEscala={aplicarEscala}
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
          hospitais={state.hospitais}
          preferencias={state.preferencias}
          blocos={state.blocos}
          escalasImportadas={state.escalasImportadas}
          propostasMontar={state.propostasMontar}
          onCriarBloco={(b) =>
            userState.setState({ blocos: [...userState.state.blocos, b] })
          }
          onSalvarProposta={(p) =>
            // Upsert por id · re-salvar uma proposta editada substitui a
            // versão antiga em vez de duplicar e comer slots do cap de 10.
            userState.setState({
              propostasMontar: [
                p,
                ...userState.state.propostasMontar.filter((x) => x.id !== p.id),
              ].slice(0, 10),
            })
          }
        />
      );

    case 'equipe':
      return (
        <EscalaEquipe
          hospitais={state.hospitais}
          escalasImportadas={state.escalasImportadas}
          escalasEquipe={state.escalasEquipe}
          onSalvar={(e) =>
            // upsert por hospital+mês · a mais recente vai pra frente
            userState.setState({
              escalasEquipe: [
                e,
                ...userState.state.escalasEquipe.filter(
                  (x) => !(x.hospitalId === e.hospitalId && x.mesISO === e.mesISO),
                ),
              ].slice(0, 6),
            })
          }
        />
      );

    case 'usuario':
      return (
        <Usuario
          email={email}
          userId={userId}
          preferencias={state.preferencias}
          onSalvarPreferencias={salvarPreferencias}
          blocos={state.blocos}
          hospitais={state.hospitais}
          gcalConfig={state.gcalConfig}
          onSalvarGcalConfig={(c) => userState.setState({ gcalConfig: c })}
        />
      );

    case 'inbox':
      return <Inbox />;

    case 'auditoria':
      return <Auditoria />;

    case 'time':
      return <Time />;

    default:
      return null;
  }
}

function EstadoCarregando() {
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        color: 'var(--ink-3)',
        font: '400 14px/1.6 var(--font-body)',
      }}
    >
      carregando sua agenda…
    </div>
  );
}

function EstadoErro({ erro }: { erro: string | null }) {
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        color: 'var(--ink-2)',
        font: '400 14px/1.6 var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span>não consegui carregar sua agenda · seus plantões continuam salvos</span>
      {erro && (
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{erro}</span>
      )}
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          marginTop: 4,
          padding: '10px 22px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--bg-alt)',
          color: 'var(--ink)',
          font: '500 13px/1 var(--font-body)',
          cursor: 'pointer',
        }}
      >
        tentar de novo
      </button>
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
