import { useEffect } from 'react';

/**
 * Trava o scroll do body enquanto um overlay (sheet, drawer, modal) está
 * aberto · sem isso o conteúdo de fundo rola junto no iOS (overscroll).
 */
export function useScrollLock(ativo: boolean = true): void {
  useEffect(() => {
    if (!ativo) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [ativo]);
}
