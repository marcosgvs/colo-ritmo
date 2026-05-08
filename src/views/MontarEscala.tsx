import type { Bloco, HospitaisMap, Preferencias } from '@/types';
import { calcRemuneracaoMes } from '@/lib/data';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface MontarEscalaProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  mesISO: string;
}

/**
 * Montar Escala · sandbox de planejamento mensal. Sessão 4 entrega só
 * o frame: cards de hospital, regra, meta de remuneração, preferências.
 * O solver real (sugerir blocos automaticamente) entra em iteração
 * futura — o frame já dá pra Mariana ler o estado dela atual.
 */
export function MontarEscala({ blocos, hospitais, preferencias, mesISO }: MontarEscalaProps) {
  const resumo = calcRemuneracaoMes(blocos, hospitais, mesISO);
  const pctMeta = preferencias.metaMensal
    ? Math.min(100, Math.round((resumo.total.liquido / preferencias.metaMensal) * 100))
    : null;

  return (
    <>
      <PageHead
        eyebrow="planejar mês"
        titulo="montar a escala do mês."
        hand="ainda em construção · iteração próxima abre o solver."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card titulo="por hospital" eyebrow="cards do mês">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {Object.values(hospitais).map((h) => {
                const r = resumo.porHospital[h.id];
                const qt = r?.plantoes ?? 0;
                return (
                  <div
                    key={h.id}
                    style={{
                      background: `var(--${h.cor}-surface)`,
                      borderLeft: `4px solid var(--${h.cor})`,
                      borderRadius: 14,
                      padding: '16px 18px',
                    }}
                  >
                    <Eyebrow color={`var(--${h.cor}-ink)`}>{h.abrev}</Eyebrow>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 500,
                        fontSize: 20,
                        letterSpacing: '-0.005em',
                        margin: '6px 0 0',
                      }}
                    >
                      {qt}/{h.regras.maxPorMes}
                    </p>
                    <Mono style={{ display: 'block', color: 'var(--ink-3)' }}>
                      máx · R$ {(h.valorPlantao ?? 0).toLocaleString('pt-BR')}/plantão
                    </Mono>
                    {qt > h.regras.maxPorMes && (
                      <Pill kind="err" style={{ marginTop: 10 }}>
                        passou do máx
                      </Pill>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card titulo="suas preferências" eyebrow="o solver vai usar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Linha rotulo="dias preferidos">{preferencias.diasPreferidos.join(', ')}</Linha>
              <Linha rotulo="dias a evitar">{preferencias.diasEvitar.join(', ')}</Linha>
              <Linha rotulo="hospitais favoritos">
                {preferencias.hospitaisPreferidos.join(', ')}
              </Linha>
              <Linha rotulo="máx/semana">{preferencias.maxPlantoesPorSemana} plantões</Linha>
              <Linha rotulo="janela">{preferencias.janelaPreferida}</Linha>
              <Linha rotulo="evitar 24h corrido">
                {preferencias.evitar24hCorrido ? 'sim' : 'não'}
              </Linha>
            </div>
            <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 14 }}>
              ajusta em "usuário" · isso vai virar form de preferências em iteração futura.
            </Hand>
          </Card>

          <EmptyState
            eyebrow="solver automático"
            titulo="essa peça vem na próxima."
            recado="por agora é leitura · você ainda monta cada plantão pelo + adicionar."
          />
        </section>

        <aside
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            padding: '18px 20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Eyebrow>meta do mês</Eyebrow>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 28,
              letterSpacing: '-0.015em',
              margin: '6px 0 4px',
            }}
          >
            R$ {(preferencias.metaMensal ?? 0).toLocaleString('pt-BR')}
          </p>
          {pctMeta !== null && (
            <Pill kind={pctMeta >= 100 ? 'ok' : pctMeta >= 70 ? 'warn' : 'err'}>
              {pctMeta}% atingido
            </Pill>
          )}
          <div style={{ marginTop: 16 }}>
            <Eyebrow>caminho hoje</Eyebrow>
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: '-0.005em',
                margin: '4px 0 0',
                color: 'var(--sage-ink)',
              }}
            >
              R$ {resumo.total.liquido.toLocaleString('pt-BR')}
            </p>
            <Mono style={{ color: 'var(--ink-3)' }}>líquido estimado</Mono>
          </div>
        </aside>
      </div>
    </>
  );
}

function Card({
  titulo,
  eyebrow,
  children,
}: {
  titulo: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '20px 22px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18 }}>
          {titulo}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px dashed var(--line-2)' }}>
      <Eyebrow style={{ width: 160, flexShrink: 0 }}>{rotulo}</Eyebrow>
      <span style={{ font: '500 14px/1.4 var(--font-body)', color: 'var(--ink)' }}>{children}</span>
    </div>
  );
}
