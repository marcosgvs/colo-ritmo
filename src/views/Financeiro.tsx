import { useMemo, useState } from 'react';
import type { Bloco, HospitaisMap } from '@/types';
import { calcRemuneracaoMes, fromISO, HOJE } from '@/lib/data';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface FinanceiroProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  metaMensal?: number;
}

const MESES_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function Financeiro({ blocos, hospitais, metaMensal }: FinanceiroProps) {
  const [refIso] = useState<string>(HOJE);
  const d = fromISO(refIso);
  const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const resumo = useMemo(
    () => calcRemuneracaoMes(blocos, hospitais, mesISO),
    [blocos, hospitais, mesISO],
  );

  const total = resumo.total.liquido;
  const pct = metaMensal ? Math.min(100, Math.round((total / metaMensal) * 100)) : null;

  if (Object.keys(resumo.porHospital).length === 0) {
    return (
      <>
        <PageHead
          eyebrow={`${MESES_LONG[d.getMonth()]} ${d.getFullYear()}`}
          titulo="ainda sem números."
        />
        <EmptyState
          titulo="esse mês está vazio."
          recado="adiciona um plantão e os valores aparecem aqui automaticamente."
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow={`${MESES_LONG[d.getMonth()]} ${d.getFullYear()}`}
        titulo="o que o mês vai pagar."
        hand={
          metaMensal
            ? pct === 100
              ? 'meta batida · pode tirar o pé do acelerador'
              : `${pct}% da meta · faltam R$ ${(metaMensal - total).toLocaleString('pt-BR')}`
            : `R$ ${total.toLocaleString('pt-BR')} estimado · valores conferidos no fechamento`
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(resumo.porHospital).map(([id, r]) => {
            const hosp = hospitais[id];
            const cor = hosp?.cor ?? 'lavender';
            return (
              <div
                key={id}
                style={{
                  background: `var(--${cor}-surface)`,
                  borderLeft: `4px solid var(--${cor})`,
                  borderRadius: 14,
                  padding: '18px 20px',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 18,
                  alignItems: 'center',
                }}
              >
                <div>
                  <Eyebrow color={`var(--${cor}-ink)`}>{hosp?.tipo ?? 'hospital'}</Eyebrow>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 22,
                      letterSpacing: '-0.005em',
                      margin: '4px 0 0',
                      color: 'var(--ink)',
                    }}
                  >
                    {hosp?.nome ?? id}
                  </p>
                </div>
                <Coluna label="plantões" valor={String(r.plantoes)} />
                <Coluna label="valor" valor={`R$ ${r.liquido.toLocaleString('pt-BR')}`} destaque />
              </div>
            );
          })}

          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <Eyebrow>total estimado</Eyebrow>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 32,
                letterSpacing: '-0.015em',
                color: 'var(--sage-ink)',
              }}
            >
              R$ {total.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        <aside
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <Eyebrow>como calculo</Eyebrow>
          <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: 0 }}>
            público usa o valor fixo do plantão; privado é valor/hora × duração.
            adicional de noturno some quando o plantão cruza 22h–6h.
          </p>
          <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: 0 }}>
            o valor é estimativa: ~94% pra PJ, ~72,5% pra cooperativa/CLT. confere no fechamento real do mês.
          </p>
          {metaMensal && (
            <div style={{ marginTop: 4 }}>
              <Eyebrow>meta do mês</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500 }}>
                  R$ {metaMensal.toLocaleString('pt-BR')}
                </span>
                {pct !== null && (
                  <Pill kind={pct >= 100 ? 'ok' : 'warn'}>
                    {pct}%
                  </Pill>
                )}
              </div>
              <Hand color="var(--ink-2)" size={15} style={{ display: 'block', marginTop: 8 }}>
                meta privada · você ajusta em "usuário"
              </Hand>
            </div>
          )}
          <Mono style={{ color: 'var(--ink-3)' }}>cedidos não contam · trocas recebidas sim</Mono>
        </aside>
      </div>
    </>
  );
}

function Coluna({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <Eyebrow>{label}</Eyebrow>
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: destaque ? 22 : 18,
          letterSpacing: '-0.005em',
          margin: '4px 0 0',
          color: destaque ? 'var(--sage-ink)' : 'var(--ink)',
        }}
      >
        {valor}
      </p>
    </div>
  );
}
