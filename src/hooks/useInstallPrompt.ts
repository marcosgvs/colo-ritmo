import { useEffect, useState } from 'react';

/**
 * Captura o evento `beforeinstallprompt` do Chrome/Edge (Android e
 * desktop) pra permitir trigger custom em vez do prompt automático
 * do browser. iOS Safari não dispara esse evento · pra iOS o user
 * precisa usar "compartilhar → adicionar à tela inicial" manualmente
 * (mostramos uma dica nesse caso).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallStatus =
  | { tipo: 'indisponivel' }
  | { tipo: 'instalado' }
  | { tipo: 'pode-instalar'; instalar: () => Promise<'aceitou' | 'recusou'> }
  | { tipo: 'ios-manual' };

function ehIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function jaInstalado(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS standalone flag · Chrome/Edge usa display-mode media query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function useInstallPrompt(): InstallStatus {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(() => jaInstalado());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalado(true);
      setEvento(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (instalado) return { tipo: 'instalado' };
  if (evento) {
    return {
      tipo: 'pode-instalar',
      instalar: async () => {
        await evento.prompt();
        const { outcome } = await evento.userChoice;
        if (outcome === 'accepted') setEvento(null);
        return outcome === 'accepted' ? 'aceitou' : 'recusou';
      },
    };
  }
  if (ehIOS()) return { tipo: 'ios-manual' };
  return { tipo: 'indisponivel' };
}
