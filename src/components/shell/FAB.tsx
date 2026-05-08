import { useState } from 'react';
import type { Mode } from '@/types';

export type AddTipo =
  | 'plantao'
  | 'sono'
  | 'bloqueio'
  | 'consulta'
  | 'estudo'
  | 'pessoal'
  | 'outros';

interface FABProps {
  mode: Mode;
  onAdd: (tipo: AddTipo) => void;
}

interface FabActionProps {
  label: string;
  sub: string;
  color: string;
  primary?: boolean;
  onClick: () => void;
}

function FabAction({ label, sub, color, primary, onClick }: FabActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 999,
        padding: '10px 18px 10px 14px',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-md)',
        animation: 'colo-fab-in 200ms cubic-bezier(.2,.7,.2,1)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: primary ? 'var(--lavender)' : `var(--${color})`,
        }}
      />
      <span style={{ font: '600 13px/1 var(--font-body)', color: 'var(--ink)' }}>{label}</span>
      <span style={{ font: '400 12px/1 var(--font-body)', color: 'var(--ink-3)' }}>{sub}</span>
    </button>
  );
}

export function FAB({ mode, onAdd }: FABProps) {
  const [open, setOpen] = useState(false);
  if (mode !== 'medica' && mode !== 'admin') return null;

  const handle = (t: AddTipo) => {
    onAdd(t);
    setOpen(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        right: 32,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {open && (
        <>
          <FabAction label="outros"   sub="o que mais cabe no dia"   color="ink-2"        onClick={() => handle('outros')} />
          <FabAction label="pessoal"  sub="médico fora da medicina"   color="sand-ink"     onClick={() => handle('pessoal')} />
          <FabAction label="estudo"   sub="curso, congresso, aula"    color="blue-ink"     onClick={() => handle('estudo')} />
          <FabAction label="consulta" sub="consultório, ambulatório"  color="coral-ink"    onClick={() => handle('consulta')} />
          <FabAction label="bloqueio" sub="dia livre"                 color="ink-3"        onClick={() => handle('bloqueio')} />
          <FabAction label="sono"     sub="janela protegida"          color="sage-ink"     onClick={() => handle('sono')} />
          <FabAction label="plantão"  sub="novo turno"                color="lavender-ink" primary onClick={() => handle('plantao')} />
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'var(--ink)',
          color: 'var(--bg)',
          border: 'none',
          borderRadius: 999,
          padding: '14px 22px',
          font: '600 14px/1 var(--font-body)',
          boxShadow: 'var(--shadow-lg)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'transform 180ms cubic-bezier(.2,.7,.2,1)',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
        aria-label="adicionar"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {!open && <span style={{ marginLeft: 2 }}>adicionar</span>}
      </button>
    </div>
  );
}
