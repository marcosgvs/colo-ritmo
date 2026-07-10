import type { ReactNode } from 'react';
import type { Bloco, HospitaisMap, Mode } from '@/types';
import { adicionaDia, detectarConflitos, HOJE } from '@/lib/data';
import { useMemo } from 'react';
import { RoleBanner } from '@/components/atoms';
import { BlockDrawer } from '@/components/drawer';
import type { Notificacao } from '@/components/notif';
import { Header, FAB, type AddTipo, type NavKey } from '@/components/shell';

interface ShellProps {
  active: NavKey;
  setActive: (k: NavKey) => void;
  mode: Mode;
  carga: number;
  blocos: Bloco[];
  hospitais: HospitaisMap;
  selecionado: Bloco | null;
  setSelecionado: (b: Bloco | null) => void;
  onAdd?: (t: AddTipo) => void;
  onTrocar?: (b: Bloco) => void;
  onCeder?: (b: Bloco) => void;
  onEditar?: (b: Bloco) => void;
  onRemover?: (id: number | string) => void;
  onEsticarNoite?: (b: Bloco) => void;
  notificacoes?: Notificacao[];
  onMarcarLida?: (id: string) => void;
  children: ReactNode;
}

/**
 * Shell · chrome compartilhado entre as views internas. Mantém Header,
 * RoleBanner, FAB e o BlockDrawer global. As views só renderizam
 * conteúdo (sem header próprio).
 */
export function Shell({
  active,
  setActive,
  mode,
  carga,
  blocos,
  hospitais,
  selecionado,
  setSelecionado,
  onAdd,
  onTrocar,
  onCeder,
  onEditar,
  onRemover,
  onEsticarNoite,
  notificacoes,
  onMarcarLida,
  children,
}: ShellProps) {
  // Só conflitos acionáveis: de ontem (noturno que cruza a meia-noite)
  // pra frente. Sobreposição em plantão de anos atrás não tem o que
  // resolver — e mantê-los deixava o sino aceso pra sempre.
  const conflitos = useMemo(() => {
    const desde = adicionaDia(HOJE, -1);
    return detectarConflitos(
      blocos.filter((b) => b.data >= desde),
      hospitais,
    ).length;
  }, [blocos, hospitais]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        active={active}
        mode={mode}
        carga={carga}
        onNav={setActive}
        conflitos={conflitos}
        notificacoes={notificacoes}
        onMarcarLida={onMarcarLida}
      />

      <main
        style={{
          maxWidth: 1640,
          margin: '0 auto',
          padding: '32px 28px 24px',
        }}
      >
        <RoleBanner mode={mode} />
        {children}
      </main>

      <footer
        style={{
          maxWidth: 1640,
          margin: '0 auto',
          padding: '24px 28px 96px',
          display: 'flex',
          gap: 14,
          font: '400 11px/1 var(--font-body)',
          color: 'var(--ink-3)',
          letterSpacing: '0.02em',
        }}
      >
        <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>
          privacidade
        </a>
        <span>·</span>
        <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>
          termos
        </a>
      </footer>

      <FAB mode={mode} onAdd={onAdd ?? (() => {})} />

      <BlockDrawer
        bloco={selecionado}
        hospitais={hospitais}
        blocos={blocos}
        onClose={() => setSelecionado(null)}
        onTrocar={onTrocar}
        onCeder={onCeder}
        onEditar={onEditar}
        onRemover={onRemover}
        onEsticarNoite={onEsticarNoite}
      />
    </div>
  );
}
