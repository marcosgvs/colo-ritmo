import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = import.meta.env.VERCEL_GIT_COMMIT_SHA as string | undefined;

let inicializado = false;

export function iniciarMonitoramento(): void {
  if (inicializado) return;
  if (!DSN) {
    if (import.meta.env.DEV) {
      console.info('[monitoramento] VITE_SENTRY_DSN ausente · sentry desligado');
    }
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: RELEASE,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      'Non-Error promise rejection captured',
    ],
  });

  inicializado = true;
}

export function capturarErro(erro: unknown, contexto?: Record<string, unknown>): void {
  if (!inicializado) {
    console.error('[monitoramento] erro fora do sentry:', erro, contexto);
    return;
  }
  if (contexto) {
    Sentry.withScope((scope) => {
      Object.entries(contexto).forEach(([chave, valor]) => scope.setExtra(chave, valor));
      Sentry.captureException(erro);
    });
    return;
  }
  Sentry.captureException(erro);
}

export function identificarUsuario(id: string | null, email?: string): void {
  if (!inicializado) return;
  if (!id) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id, email });
}
