import { useContext } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { HandVariantContext } from './HandVariantContext';

interface HandProps {
  children: ReactNode;
  color?: string;
  size?: number;
  style?: CSSProperties;
}

/**
 * Hand · destaque humano. A variante vem do contexto e respeita a
 * decisão da Sessão 1: italic (Fraunces italic) é o default. As outras
 * (handwritten, sans-italic, plain) ficam disponíveis para tweaks.
 */
export function Hand({ children, color, size = 22, style }: HandProps) {
  const variant = useContext(HandVariantContext);
  const common: CSSProperties = {
    color: color || 'var(--lavender-ink)',
    display: 'inline',
    ...style,
  };

  if (variant === 'handwritten') {
    return (
      <span
        style={{
          ...common,
          fontFamily: 'var(--font-handwritten)',
          fontWeight: 400,
          lineHeight: 1.05,
          fontSize: size + 2,
        }}
      >
        {children}
      </span>
    );
  }

  if (variant === 'sans-italic') {
    return (
      <span
        style={{
          ...common,
          fontFamily: 'var(--font-body)',
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: size - 4,
          lineHeight: 1.35,
          letterSpacing: '0.005em',
        }}
      >
        {children}
      </span>
    );
  }

  if (variant === 'plain') {
    return (
      <span
        style={{
          ...common,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: size - 4,
          lineHeight: 1.35,
          letterSpacing: '-0.005em',
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      style={{
        ...common,
        fontFamily: 'var(--font-display)',
        fontStyle: 'italic',
        fontWeight: 400,
        fontSize: size - 2,
        lineHeight: 1.2,
        letterSpacing: '-0.005em',
        fontVariationSettings: '"opsz" 14',
      }}
    >
      {children}
    </span>
  );
}
