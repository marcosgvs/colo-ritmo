import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 720;

/**
 * useIsMobile · true quando viewport <= 720px (mobile/tablet portrait).
 *
 * Usa matchMedia + listener pra rotação e resize. SSR-safe (default false
 * quando window undefined). Threshold único pro app inteiro: header,
 * grids 2-col, e a troca de Semana→Lista em mobile dependem disso.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
