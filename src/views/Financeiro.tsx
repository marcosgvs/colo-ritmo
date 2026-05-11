import { useMemo, useState } from 'react';
import type { Bloco, HospitaisMap } from '@/types';
import { calcRemuneracaoMes, fromISO, HOJE } from '@/lib/data';
import { Eyebrow, Hand, MonthPicker, Mono } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface FinanceiroProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
}

const MESES_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function Financeiro({ blocos, hospitais }: FinanceiroProps) {
  const hojeMesISO = useMemo(() => {
    const d = fromISO(HOJE);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [mesISO, setMesISO] = useState<string>(hojeMesISO);
  const d = fromISO(`${mesISO}-01`);

  const resumo = useMemo(
    () => calcRemuneracaoMes(blocos, hospitais, mesISO),
    [blocos, hospitais, mesISO],
  );

  const total = resumo.total.bruto;
  const eFuturo = mesISO > hojeMesISO;
  const eAtual = mesISO === hojeMesISO;
  const ePassado = mesISO < hojeMesISO;
  const horizonteRotulo = eFuturo ? 'previsão' : ePassado ? 'realizado' : 'em andamento';

  const picker = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <Eyebrow>mês</Eyebrow>
      <MonthPicker value={mesISO} onChange={setMesISO} janela={18} />
      <Mono style={{ color: 'var(--ink-3)' }}>{horizonteRotulo}</Mono>
    </div>
  );

  if (Object.keys(resumo.porHospital).length === 0) {
    return (
      <>
        <PageHead
          eyebrow={`${MESES_LONG[d.getMonth()]} ${d.getFullYear()}`}
          titulo={eFuturo ? 'previsão em branco.' : 'ainda sem números.'}
        />
        {picker}
        <EmptyState
          titulo={eFuturo ? 'esse mês ainda não tem plantões agendados.' : 'esse mês está vazio.'}
          recado={
            eFuturo
              ? 'à medida que você adiciona plantões pra esse mês, os valores aparecem aqui.'
              : 'adiciona um plantão e os valores aparecem aqui automaticamente.'
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow={`${MESES_LONG[d.getMonth()]} ${d.getFullYear()} · ${horizonteRotulo}`}
        titulo={
          eFuturo
            ? 'o que o mês deve pagar.'
            : eAtual
              ? 'o que o mês vai pagar.'
              : 'o que o mês pagou.'
        }
        hand={`R$ ${total.toLocaleString('pt-BR')}`}
      />
      {picker}

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
                <Coluna label="valor" valor={`R$ ${r.bruto.toLocaleString('pt-BR')}`} destaque />
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
            <Eyebrow>total</Eyebrow>
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
            público é valor fixo mensal · privado é valor/hora × duração.
            adicional noturno soma quando o plantão cruza 22h–6h.
          </p>
          <Mono style={{ color: 'var(--ink-3)' }}>cedidos não contam · trocas recebidas sim</Mono>
          {eFuturo && (
            <Hand color="var(--ink-3)" size={14} style={{ display: 'block', marginTop: 4 }}>
              previsão · vai mudar conforme você adicionar/trocar plantões
            </Hand>
          )}
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
