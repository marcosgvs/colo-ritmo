/**
 * Círculo coral com "!" branco · marca plantão em conflito sem ocupar
 * espaço de pill. Cabe ao lado da duração mesmo em mobile estreito.
 */
export function IconConflito({ titulo = 'conflito · plantões se sobrepõem' }: { titulo?: string }) {
  return (
    <span
      role="img"
      aria-label="conflito"
      title={titulo}
      style={{
        width: 20,
        height: 20,
        borderRadius: 999,
        background: 'var(--coral-ink)',
        color: 'var(--bg)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: '700 13px/1 var(--font-body)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      !
    </span>
  );
}
