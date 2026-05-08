interface NowLineProps {
  density: number;
  /** Hora atual em decimal (ex: 14.5 = 14h30). */
  agora?: number;
}

export function NowLine({ density, agora = 14.5 }: NowLineProps) {
  if (agora < 0 || agora > 24) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: agora * density,
        height: 0,
        borderTop: '2px solid var(--lavender-ink)',
        zIndex: 5,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -5,
          top: -5,
          width: 10,
          height: 10,
          borderRadius: 999,
          background: 'var(--lavender-ink)',
        }}
      />
    </div>
  );
}
