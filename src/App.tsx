import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type {
  Bloco,
  BlocoPlantao,
  CelulaEscala,
  Hospital,
  Janela,
  Mode,
  Preferencias,
  PropostaSalva,
} from '@/types';
import { cargaSemanal, setHospitaisRuntime } from '@/lib/data';
import { calcularPadroes } from '@/lib/padroes';
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
const Detalhe = lazy(() => import('@/views/Detalhe').then((m) => ({ default: m.Detalhe })));
const Usuario = lazy(() => import('@/views/Usuario').then((m) => ({ default: m.Usuario })));
const Inbox = lazy(() => import('@/views/Inbox').then((m) => ({ default: m.Inbox })));
const Auditoria = lazy(() => import('@/views/Auditoria').then((m) => ({ default: m.Auditoria })));
const Time = lazy(() => import('@/views/Time').then((m) => ({ default: m.Time })));

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

  // Atualiza o map runtime de hospitais · permite que getHospital() resolva
  // hospitais customizados (id "H-...") em qualquer view.
  useEffect(() => {
    setHospitaisRuntime(userState.state.hospitais);
  }, [userState.state.hospitais]);

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

  const adicionarBlocoPersistente = (b: Bloco) => {
    userState.setState({ blocos: [...userState.state.blocos, b] });
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

  const atualizarPropostas = (propostas: PropostaSalva[]) => {
    userState.setState({ propostas });
  };

  /**
   * Aplica uma escala oficial importada de PDF · substitui plantões
   * existentes do mês×hospital, preserva trocas/cedidos manuais, mescla
   * janelas no hospital, recalcula padrões observados, e arquiva a
   * transcrição completa do PDF (todos os médicos, não só a Mariana)
   * pra alimentar futuramente o "padrão do chefe".
   */
  const aplicarEscala = (data: {
    hospitalId: string;
    mesISO: string;
    blocos: BlocoPlantao[];
    janelas: Janela[];
    celulas?: CelulaEscala[];
  }) => {
    const { hospitalId, mesISO, blocos, janelas, celulas } = data;
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

    // Recalcula padrões observados com a base de blocos atualizada
    const padroes = calcularPadroes(novosBlocos);

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
        },
      ];
    }

    userState.setState({
      blocos: novosBlocos,
      hospitais: hospitaisAtualizados,
      padroes,
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
                  criarBloco={adicionarBlocoPersistente}
                  removerBloco={removerBloco}
                  salvarHospital={salvarHospital}
                  removerHospital={removerHospital}
                  salvarPreferencias={salvarPreferencias}
                  atualizarPropostas={atualizarPropostas}
                  aplicarEscala={aplicarEscala}
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
    </HandVariantContext.Provider>
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
  criarBloco: (b: Bloco) => void;
  removerBloco: (id: number | string) => void;
  salvarHospital: (id: string, h: Hospital) => void;
  removerHospital: (id: string) => void;
  salvarPreferencias: (p: Preferencias) => void;
  atualizarPropostas: (propostas: PropostaSalva[]) => void;
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
  criarBloco,
  removerBloco,
  salvarHospital,
  removerHospital,
  salvarPreferencias,
  atualizarPropostas,
  aplicarEscala,
}: ViewSwitchProps) {
  const { state, status, erro } = userState;
  const mesISO = new Date().toISOString().slice(0, 7);

  switch (active) {
    case 'agenda':
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
          metaMensal={state.preferencias.metaMensal}
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
          blocos={state.blocos}
          hospitais={state.hospitais}
          preferencias={state.preferencias}
          mesISO={mesISO}
          onAdicionarBloco={criarBloco}
          onRemoverBloco={removerBloco}
          propostas={state.propostas}
          onAtualizarPropostas={atualizarPropostas}
          padroes={state.padroes}
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
      return <Time />;

    default:
      return null;
  }
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
