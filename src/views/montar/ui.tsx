// Peças visuais reutilizadas pelo fluxo Montar (StepBar, Modal, Card, Linha, Total, Field, estilos).

import { Eyebrow, Mono } from '@/components/atoms';
import { useIsMobile } from '@/hooks/useIsMobile';
import { ETAPAS, type Etapa } from './tipos';

// --- StepBar ----------------------------------------------------------------

export function StepBar({ etapa }: { etapa: Etapa }) {
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        marginBottom: 22,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {ETAPAS.map((e, i) => {
        const ativo = i === idx;
        const passou = i < idx;
        return (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: ativo ? 'var(--lavender-ink)' : passou ? 'var(--sage-ink)' : 'var(--line-2)',
                color: ativo || passou ? 'var(--bg)' : 'var(--ink-3)',
                font: '600 11px/22px var(--font-body)',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span
              style={{
                font: ativo ? '600 12px/1 var(--font-body)' : '500 12px/1 var(--font-body)',
                color: ativo ? 'var(--ink)' : passou ? 'var(--sage-ink)' : 'var(--ink-3)',
              }}
            >
              {e.label}
            </span>
            {i < ETAPAS.length - 1 && (
              <span
                style={{
                  width: 18,
                  height: 1,
                  background: 'var(--line-2)',
                  margin: '0 4px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Helpers visuais --------------------------------------------------------

export function Modal({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-lg)',
          padding: '22px 26px',
          width: 'min(440px, calc(100% - 32px))',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Card({ titulo, eyebrow, children }: { titulo: string; eyebrow?: string; children: React.ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'baseline',
          gap: isMobile ? 4 : 12,
          marginBottom: 10,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }}>
          {titulo}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}

export function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '160px 1fr',
        gap: isMobile ? 8 : 16,
        alignItems: isMobile ? 'stretch' : 'baseline',
      }}
    >
      <Eyebrow>{rotulo}</Eyebrow>
      {children}
    </div>
  );
}

export function Total({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <Mono style={{ color: 'var(--ink-3)', fontSize: 12 }}>{rotulo}</Mono>
      <span style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>{valor}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}

export const inputBase: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 13px/1.3 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
};

export const btnPrimario: React.CSSProperties = {
  font: '600 14px/1 var(--font-body)',
  padding: '12px 20px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--lavender-ink)',
  color: 'var(--bg)',
  cursor: 'pointer',
};

export const btnSecundario: React.CSSProperties = {
  font: '500 13px/1 var(--font-body)',
  padding: '11px 18px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};
