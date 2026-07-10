import { useEffect, useState } from 'react';

function horaAgora(): number {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

interface NowLineProps {
  density: number;
  /** Hora atual em decimal (ex: 14.5 = 14h30). Sem a prop, usa o relógio
   * real e se atualiza a cada minuto. */
  agora?: number;
}

export function NowLine({ density, agora }: NowLineProps) {
  const [tick, setTick] = useState<number>(() => horaAgora());
  useEffect(() => {
    if (agora !== undefined) return;
    const timer = setInterval(() => setTick(horaAgora()), 60_000);
    return () => clearInterval(timer);
  }, [agora]);

  const hora = agora ?? tick;
  if (hora < 0 || hora > 24) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: hora * density,
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
