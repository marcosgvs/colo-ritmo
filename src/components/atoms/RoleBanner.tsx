import type { Mode } from '@/types';
import { Mono } from './Mono';

interface RoleBannerProps {
  mode: Mode;
}

export function RoleBanner({ mode }: RoleBannerProps) {
  if (mode === 'medica') return null;

  if (mode === 'parceiro') {
    return (
      <div
        style={{
          background: 'var(--lavender-surface)',
          borderRadius: 'var(--r-md)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 'var(--s-4)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: 'var(--lavender)',
          }}
        />
        <span
          style={{
            font: '500 14px/1.3 var(--font-body)',
            color: 'var(--lavender-ink)',
          }}
        >
          modo parceiro · você está vendo a agenda da Mariana
        </span>
        <span style={{ flex: 1 }} />
        <Mono style={{ color: 'var(--lavender-ink)', opacity: 0.8 }}>somente leitura</Mono>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--coral-surface)',
        borderRadius: 'var(--r-md)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 'var(--s-4)',
      }}
    >
      <span
        style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--coral-ink)' }}
      />
      <span style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--coral-ink)' }}>
        admin · editando agenda alheia · ações registradas em audit log
      </span>
      <span style={{ flex: 1 }} />
      <Mono style={{ color: 'var(--coral-ink)' }}>Marcos · sessão admin</Mono>
    </div>
  );
}
