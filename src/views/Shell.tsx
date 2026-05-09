import type { ReactNode } from 'react';
import type { Bloco, HospitaisMap, Mode } from '@/types';
import { detectarConflitos } from '@/lib/data';
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
  abrirDetalhe?: (b: Bloco) => void;
  onAdd?: (t: AddTipo) => void;
  onTrocar?: (b: Bloco) => void;
  onCeder?: (b: Bloco) => void;
  onEditar?: (b: Bloco) => void;
  onRemover?: (id: number | string) => void;
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
  abrirDetalhe,
  onAdd,
  onTrocar,
  onCeder,
  onEditar,
  onRemover,
  notificacoes,
  onMarcarLida,
  children,
}: ShellProps) {
  const conflitos = useMemo(
    () => detectarConflitos(blocos, hospitais).length,
    [blocos, hospitais],
  );

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
          padding: '32px 28px 120px',
        }}
      >
        <RoleBanner mode={mode} />
        {children}
      </main>

      <FAB mode={mode} onAdd={onAdd ?? (() => {})} />

      <BlockDrawer
        bloco={selecionado}
        hospitais={hospitais}
        onClose={() => setSelecionado(null)}
        onTrocar={onTrocar}
        onCeder={onCeder}
        onAbrirDetalhe={abrirDetalhe}
        onEditar={onEditar}
        onRemover={onRemover}
      />
    </div>
  );
}
