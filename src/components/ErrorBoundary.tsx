import { Component, type ErrorInfo, type ReactNode } from 'react';
import { capturarErro } from '@/lib/monitoring';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  erro: Error | null;
}

/**
 * Captura erros React em qualquer view e mostra tela amigável em vez
 * de tela branca. Botão "recarregar" volta pro shell · o user nunca fica
 * preso. Erros vão pro console e pro Sentry (se VITE_SENTRY_DSN setado).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { erro: null };

  static getDerivedStateFromError(erro: Error): ErrorBoundaryState {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error('[colo-ritmo] erro não tratado:', erro);
    console.error('[colo-ritmo] componente:', info.componentStack);
    capturarErro(erro, { componentStack: info.componentStack });
  }

  resetar = (): void => {
    this.setState({ erro: null });
  };

  recarregar = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.erro) {
      return <TelaErro erro={this.state.erro} onTentarDeNovo={this.resetar} onRecarregar={this.recarregar} />;
    }
    return this.props.children;
  }
}

interface TelaErroProps {
  erro: Error;
  onTentarDeNovo: () => void;
  onRecarregar: () => void;
}

function TelaErro({ erro, onTentarDeNovo, onRecarregar }: TelaErroProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: 'var(--bg, #FFFAF3)',
        color: 'var(--ink, #3A2E2A)',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display, Georgia, serif)',
            fontWeight: 500,
            fontSize: 'clamp(28px, 5vw, 40px)',
            letterSpacing: '-0.015em',
            margin: '0 0 18px',
          }}
        >
          algo travou aqui.
        </h1>
        <p
          style={{
            font: '400 16px/1.5 var(--font-body, system-ui, sans-serif)',
            color: 'var(--ink-2, #5A4A44)',
            margin: '0 0 28px',
          }}
        >
          respira fundo. o app travou numa parte específica · seus dados estão salvos. tenta de novo
          ou recarrega.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onTentarDeNovo}
            style={{
              font: '600 13px/1 var(--font-body, system-ui, sans-serif)',
              padding: '12px 22px',
              borderRadius: 999,
              border: '1px solid var(--line, rgba(58,46,42,0.16))',
              background: 'transparent',
              color: 'var(--ink-2, #5A4A44)',
              cursor: 'pointer',
            }}
          >
            tentar de novo
          </button>
          <button
            type="button"
            onClick={onRecarregar}
            style={{
              font: '600 13px/1 var(--font-body, system-ui, sans-serif)',
              padding: '12px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--ink, #3A2E2A)',
              color: 'var(--bg, #FFFAF3)',
              cursor: 'pointer',
            }}
          >
            recarregar a página
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: 32,
              padding: 14,
              background: 'var(--bg-alt, rgba(58,46,42,0.04))',
              borderRadius: 8,
              fontSize: 11,
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: 200,
              color: 'var(--ink-3, #8A766F)',
            }}
          >
            {erro.message}
            {'\n\n'}
            {erro.stack}
          </pre>
        )}
      </div>
    </div>
  );
}
