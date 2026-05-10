import { useEffect, useState } from 'react';

interface LoadingFrasesProps {
  /** Lista de frases que vão ciclar enquanto o loading está ativo. */
  frases: readonly string[];
  /** Tamanho da fonte da frase. Default 16. */
  fontSize?: number;
  /** Duração de cada frase em ms. Default 2800. */
  duracao?: number;
}

/**
 * Loading com frase que troca + 3 dots pulsando · pra dar sinal de vida
 * em operações que demoram alguns segundos (importação de PDF, geração
 * de proposta de Montar, etc).
 */
export function LoadingFrases({ frases, fontSize = 16, duracao = 2800 }: LoadingFrasesProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (frases.length <= 1) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % frases.length);
    }, duracao);
    return () => clearInterval(t);
  }, [frases.length, duracao]);

  const frase = frases[idx] ?? frases[0] ?? '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minHeight: 28,
      }}
    >
      <span
        key={idx}
        style={{
          font: `600 ${fontSize}px/1.3 var(--font-body)`,
          color: 'var(--ink)',
          animation: `colo-frase-fade ${duracao}ms ease-in-out infinite`,
        }}
      >
        {frase}
      </span>
      <span style={{ display: 'inline-flex', gap: 4, marginTop: 2 }} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--ink-3)',
              animation: 'colo-dot-pulse 1200ms ease-in-out infinite',
              animationDelay: `${i * 160}ms`,
            }}
          />
        ))}
      </span>
    </div>
  );
}
