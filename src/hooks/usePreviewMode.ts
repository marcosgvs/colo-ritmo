import { useEffect, useState } from 'react';
import type { Mode } from '@/types';

export type PreviewAs = 'medica' | 'parceiro' | 'admin-medica';

interface PreviewState {
  ativo: boolean;
  as: PreviewAs | null;
  /** Mode pra UI · admin-medica vira 'admin'. */
  mode: Mode | null;
}

const INICIAL: PreviewState = { ativo: false, as: null, mode: null };

/**
 * usePreviewMode · consulta /api/preview?action=status uma vez no boot
 * pra descobrir se há cookie de preview ativo. O cookie é httpOnly
 * (setado pelo HMAC link) então o JS só sabe via fetch.
 */
export function usePreviewMode(): PreviewState {
  const [state, setState] = useState<PreviewState>(INICIAL);

  useEffect(() => {
    let mounted = true;
    fetch('/api/preview?action=status', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ativo?: boolean; as?: string } | null) => {
        if (!mounted || !json?.ativo) {
          if (mounted) setState(INICIAL);
          return;
        }
        const as = (json.as ?? '') as PreviewAs;
        const mode: Mode | null =
          as === 'parceiro' ? 'parceiro' : as === 'admin-medica' ? 'admin' : as === 'medica' ? 'medica' : null;
        setState({ ativo: true, as, mode });
      })
      .catch(() => {
        if (mounted) setState(INICIAL);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
