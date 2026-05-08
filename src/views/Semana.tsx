import type { Bloco, HospitaisMap, Mode } from '@/types';
import { cargaSemanal } from '@/lib/data';
import { WeekGrid } from '@/components/week';
import { Rail } from '@/components/rail';
import { PageHead } from './_PageHead';

interface SemanaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  mode: Mode;
  loading: boolean;
  erro: string | null;
  onSelectBloco: (b: Bloco) => void;
}

export function Semana({ blocos, hospitais: _h, mode, loading, erro, onSelectBloco }: SemanaProps) {
  const carga = cargaSemanal(blocos);

  return (
    <>
      {erro && (
        <div
          role="alert"
          style={{
            background: 'var(--coral-surface)',
            border: '1px solid color-mix(in oklab, var(--coral-ink) 24%, transparent)',
            borderRadius: 'var(--r-md)',
            padding: '12px 16px',
            color: 'var(--coral-ink)',
            font: '500 13px/1.4 var(--font-body)',
            marginBottom: 18,
          }}
        >
          algo travou ao carregar sua agenda · {erro}
        </div>
      )}

      <PageHead
        eyebrow="semana · 4–10 mai 2026"
        titulo="a semana da Mariana."
        hand={loading ? 'carregando seus plantões…' : `${carga}h previstas — respira, dá pra acomodar`}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        <WeekGrid blocos={blocos} density={32} onSelectBloco={onSelectBloco} />
        <Rail blocos={blocos} mode={mode} />
      </div>
    </>
  );
}
