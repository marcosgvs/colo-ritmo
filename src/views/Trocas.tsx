import { useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import { fmtDate, fmtRange, getHospital } from '@/lib/data';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHead } from './_PageHead';

interface TrocasProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onCriarPedido: (b: BlocoPlantao, motivo: string, candidatos: string[]) => void;
}

type Passo = 'qual' | 'porque' | 'quem' | 'confirmar';

const COLEGAS_MOCK = [
  { id: 'ana', nome: 'Dra. Ana Soares' },
  { id: 'rafa', nome: 'Dr. Rafael Lima' },
  { id: 'helena', nome: 'Dra. Helena Vargas' },
  { id: 'pedro', nome: 'Dr. Pedro Almeida' },
];

export function Trocas({ blocos, hospitais: _h, onCriarPedido }: TrocasProps) {
  const isMobile = useIsMobile();
  const plantoes = blocos
    .filter((b): b is BlocoPlantao => b.tipo === 'plantao')
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio);

  const [passo, setPasso] = useState<Passo>('qual');
  const [escolhido, setEscolhido] = useState<BlocoPlantao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [candidatos, setCandidatos] = useState<string[]>([]);

  function reset() {
    setPasso('qual');
    setEscolhido(null);
    setMotivo('');
    setCandidatos([]);
  }

  function confirmar() {
    if (!escolhido) return;
    onCriarPedido(escolhido, motivo, candidatos);
    reset();
  }

  if (plantoes.length === 0) {
    return (
      <>
        <PageHead eyebrow="trocas" titulo="sem plantão pra trocar." />
        <EmptyState
          titulo="agenda vazia."
          recado="adiciona um plantão pra começar a usar o fluxo de troca."
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="trocas"
        titulo={passo === 'confirmar' ? 'tudo pronto pra mandar.' : 'qual plantão?'}
        hand={
          passo === 'qual'
            ? 'escolhe o turno · depois conta o motivo'
            : passo === 'porque'
              ? 'em uma frase · isso vai junto na proposta'
              : passo === 'quem'
                ? 'quem você acha que pode toparir? · pode marcar mais de um'
                : 'a proposta vai pra galera escolhida · você é avisada da resposta'
        }
        direita={<Stepper passo={passo} />}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px',
          gap: isMobile ? 18 : 32,
          alignItems: 'flex-start',
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {passo === 'qual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plantoes.map((p) => {
                const hosp = getHospital(p.hospitalId);
                if (!hosp) return null;
                const ativo = escolhido?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setEscolhido(p);
                      setPasso('porque');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      background: ativo ? `var(--${hosp.cor}-surface)` : 'var(--bg)',
                      borderLeft: `4px solid var(--${hosp.cor})`,
                      border: '1px solid var(--line)',
                      borderRadius: 14,
                      padding: '14px 18px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Eyebrow color={`var(--${hosp.cor}-ink)`}>
                        {hosp.abrev}
                      </Eyebrow>
                      <p
                        style={{
                          margin: '6px 0 0',
                          fontFamily: 'var(--font-display)',
                          fontWeight: 500,
                          fontSize: 18,
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {fmtDate(p.data)}
                      </p>
                      <Mono style={{ display: 'block', color: 'var(--ink-3)' }}>
                        {fmtRange(p.horaInicio, p.duracao)} · {p.duracao}h
                      </Mono>
                    </div>
                    {p.viaTroca && <Pill kind="lavender">via troca</Pill>}
                  </button>
                );
              })}
            </div>
          )}

          {passo === 'porque' && escolhido && (
            <Card titulo="por que está pedindo?" eyebrow="motivo aparece pra quem topar">
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="aniversário do filho · viagem de família · etc"
                rows={4}
                style={{
                  width: '100%',
                  ...input,
                  resize: 'vertical',
                }}
              />
              <Botoes
                principal="seguir pra escolher quem"
                onPrincipal={() => setPasso('quem')}
                desabilitado={motivo.trim().length === 0}
                onVoltar={() => setPasso('qual')}
              />
            </Card>
          )}

          {passo === 'quem' && (
            <Card titulo="manda pra quem?" eyebrow="múltipla escolha">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {COLEGAS_MOCK.map((c) => {
                  const marcado = candidatos.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setCandidatos((arr) =>
                          marcado ? arr.filter((x) => x !== c.id) : [...arr, c.id],
                        )
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: marcado ? 'var(--lavender-surface)' : 'var(--bg)',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          background: marcado ? 'var(--lavender-ink)' : 'transparent',
                          border: marcado ? 'none' : '1.5px solid var(--line-2)',
                        }}
                      />
                      <span style={{ font: '500 14px/1.3 var(--font-body)' }}>{c.nome}</span>
                    </button>
                  );
                })}
              </div>
              <Botoes
                principal="ver proposta"
                onPrincipal={() => setPasso('confirmar')}
                desabilitado={candidatos.length === 0}
                onVoltar={() => setPasso('porque')}
              />
            </Card>
          )}

          {passo === 'confirmar' && escolhido && (
            <Card titulo="proposta pronta" eyebrow="é isso que vai sair">
              <Resumo
                escolhido={escolhido}
                motivo={motivo}
                candidatos={candidatos.map(
                  (id) => COLEGAS_MOCK.find((c) => c.id === id)?.nome ?? id,
                )}
              />
              <Botoes
                principal="enviar pedido"
                onPrincipal={confirmar}
                onVoltar={() => setPasso('quem')}
              />
            </Card>
          )}
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
          <Eyebrow>regra principal</Eyebrow>
          <Hand color="var(--ink-2)" size={18} style={{ display: 'block', marginTop: 8 }}>
            quem aceita assume o plantão · você fica com o que ela tinha (se for troca) ou
            simplesmente passa (se for cessão).
          </Hand>
          <Mono style={{ display: 'block', marginTop: 16, color: 'var(--ink-3)' }}>
            o coordenador é avisado · audit log registra tudo.
          </Mono>
        </aside>
      </div>
    </>
  );
}

function Stepper({ passo }: { passo: Passo }) {
  const passos: Passo[] = ['qual', 'porque', 'quem', 'confirmar'];
  const idx = passos.indexOf(passo);
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {passos.map((p, i) => (
        <span
          key={p}
          style={{
            width: 24,
            height: 4,
            borderRadius: 999,
            background: i <= idx ? 'var(--lavender-ink)' : 'var(--line-2)',
          }}
        />
      ))}
    </div>
  );
}

function Botoes({
  principal,
  onPrincipal,
  onVoltar,
  desabilitado = false,
}: {
  principal: string;
  onPrincipal: () => void;
  onVoltar?: () => void;
  desabilitado?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
      <button
        type="button"
        onClick={onPrincipal}
        disabled={desabilitado}
        style={{
          font: '600 13px/1 var(--font-body)',
          padding: '12px 22px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--ink)',
          color: 'var(--bg)',
          cursor: 'pointer',
          opacity: desabilitado ? 0.5 : 1,
        }}
      >
        {principal}
      </button>
      {onVoltar && (
        <button
          type="button"
          onClick={onVoltar}
          style={{
            font: '600 13px/1 var(--font-body)',
            padding: '12px 22px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          voltar
        </button>
      )}
    </div>
  );
}

function Resumo({
  escolhido,
  motivo,
  candidatos,
}: {
  escolhido: BlocoPlantao;
  motivo: string;
  candidatos: string[];
}) {
  const hosp = getHospital(escolhido.hospitalId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Linha rotulo="plantão">
        {hosp?.abrev} · {fmtDate(escolhido.data)} ·{' '}
        {fmtRange(escolhido.horaInicio, escolhido.duracao)}
      </Linha>
      <Linha rotulo="motivo">{motivo}</Linha>
      <Linha rotulo="convidados">{candidatos.join(', ')}</Linha>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Eyebrow style={{ width: 100, flexShrink: 0 }}>{rotulo}</Eyebrow>
      <span style={{ font: '500 14px/1.4 var(--font-body)', color: 'var(--ink)' }}>{children}</span>
    </div>
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

const input: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 14px/1.4 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
  fontFamily: 'var(--font-body)',
};
