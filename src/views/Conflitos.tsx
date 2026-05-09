import { useMemo } from 'react';
import type { Bloco, HospitaisMap } from '@/types';
import { detectarConflitos, fmtDate, fmtRange, getHospital } from '@/lib/data';
import type { TipoConflito } from '@/lib/conflitos';
import { Eyebrow, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface ConflitosProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onSelectBloco: (b: Bloco) => void;
}

const LABEL_TIPO: Record<TipoConflito, string> = {
  sobreposicao: 'sobreposição',
  sem_descanso: 'sem descanso',
  max_semana: 'máx. semana',
};

function labelTipo(t: TipoConflito): string {
  return LABEL_TIPO[t];
}

const COPY_TIPO: Record<TipoConflito, { titulo: string; recado: string }> = {
  sobreposicao: {
    titulo: 'dois plantões sobrepostos',
    recado: 'um vai precisar virar troca · ou ceder',
  },
  sem_descanso: {
    titulo: 'descanso curto entre plantões',
    recado: 'menos que o intervalo mínimo configurado pra esse hospital',
  },
  max_semana: {
    titulo: 'passou do limite do hospital',
    recado: 'cada hospital tem máx por semana · esse passou',
  },
};

export function Conflitos({ blocos, hospitais, onSelectBloco }: ConflitosProps) {
  const conflitos = useMemo(() => detectarConflitos(blocos, hospitais), [blocos, hospitais]);

  return (
    <>
      <PageHead
        eyebrow="o que precisa de você"
        titulo={
          conflitos.length === 0
            ? 'sem conflitos.'
            : `${conflitos.length} conflito${conflitos.length > 1 ? 's' : ''} pra resolver.`
        }
        hand={
          conflitos.length === 0
            ? 'a agenda tá redonda · pode respirar'
            : 'cada um tem 2-3 caminhos · clica pra abrir'
        }
      />

      {conflitos.length === 0 ? (
        <EmptyState
          eyebrow="status"
          titulo="tudo no lugar."
          recado="se aparecer algo, eu te aviso aqui antes de virar problema."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {conflitos.map((c, i) => {
            const hospA = c.a.hospitalId ? getHospital(c.a.hospitalId) : undefined;
            const copy = COPY_TIPO[c.tipo];
            return (
              <article
                key={`${c.tipo}-${i}`}
                style={{
                  background: 'var(--coral-surface)',
                  borderLeft: '4px solid var(--coral-ink)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 14,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <Pill kind="err" dot={false}>
                      {labelTipo(c.tipo)}
                    </Pill>
                    {hospA && (
                      <Eyebrow color={`var(--${hospA.cor}-ink)`}>{hospA.abrev}</Eyebrow>
                    )}
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 22,
                      letterSpacing: '-0.005em',
                      margin: 0,
                      color: 'var(--ink)',
                    }}
                  >
                    {copy.titulo}
                  </h3>
                  <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '6px 0 0' }}>
                    {copy.recado}
                  </p>
                  <Mono style={{ display: 'block', marginTop: 8, color: 'var(--coral-ink)' }}>
                    {c.detalhe}
                  </Mono>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
                  <button
                    type="button"
                    onClick={() => onSelectBloco(c.a)}
                    style={{
                      font: '600 12px/1 var(--font-body)',
                      padding: '10px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--coral-ink)',
                      background: 'transparent',
                      color: 'var(--coral-ink)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    abrir {fmtDate(c.a.data)} · {fmtRange(c.a.horaInicio, c.a.duracao)}
                  </button>
                  {c.b && (
                    <button
                      type="button"
                      onClick={() => onSelectBloco(c.b!)}
                      style={{
                        font: '600 12px/1 var(--font-body)',
                        padding: '10px 14px',
                        borderRadius: 999,
                        border: '1px solid var(--coral-ink)',
                        background: 'transparent',
                        color: 'var(--coral-ink)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      abrir {fmtDate(c.b.data)} · {fmtRange(c.b.horaInicio, c.b.duracao)}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
