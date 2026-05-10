import { useState } from 'react';
import type { Hospital, Preferencias } from '@/types';
import { ColoMark, Eyebrow, Hand, Mono } from '@/components/atoms';

interface OnboardingProps {
  onConcluir: (dados: { hospitais: Hospital[]; preferencias: Partial<Preferencias> }) => void;
  onPular?: () => void;
}

const PASSOS = ['boas-vindas', 'papel', 'hospital-rapido'] as const;
type Passo = (typeof PASSOS)[number];

export function Onboarding({ onConcluir, onPular }: OnboardingProps) {
  const [passo, setPasso] = useState<Passo>('boas-vindas');
  const [nome, setNome] = useState('');
  const [hospitalNome, setHospitalNome] = useState('');
  const [hospitalAbrev, setHospitalAbrev] = useState('');
  const [valorPlantao, setValorPlantao] = useState(1800);

  const idx = PASSOS.indexOf(passo);

  function avancar() {
    const proximo = PASSOS[idx + 1];
    if (proximo) setPasso(proximo);
    else concluir();
  }

  function concluir() {
    const hospitais: Hospital[] =
      hospitalNome && hospitalAbrev
        ? [
            {
              id: hospitalAbrev.toUpperCase(),
              nome: hospitalNome,
              abrev: hospitalAbrev.toUpperCase(),
              cor: 'lavender',
              tipo: 'publico',
              valorPlantao,
              adicionalNoite: 200,
              regras: {},
            },
          ]
        : [];
    onConcluir({
      hospitais,
      preferencias: {
        nome: nome || 'Médica',
      },
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        background: `radial-gradient(circle at 20% 0%, rgba(231,165,156,0.10), transparent 55%),
                     radial-gradient(circle at 80% 100%, rgba(162,153,203,0.10), transparent 55%),
                     var(--bg)`,
      }}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          padding: '40px clamp(24px, 4vw, 44px)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <ColoMark size={22} />
          <div style={{ display: 'flex', gap: 6 }}>
            {PASSOS.map((p, i) => (
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
        </div>

        {passo === 'boas-vindas' && (
          <>
            <Eyebrow>primeiro contato</Eyebrow>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(28px, 4vw, 40px)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              olá. eu sou o colo.
            </h1>
            <Hand color="var(--ink-2)" size={20}>
              vou te ajudar a olhar pra agenda sem que ela aperte. se algo aqui apertar, me avisa.
            </Hand>
            <Field label="como te chamo">
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Mariana"
                style={input}
                autoFocus
              />
            </Field>
          </>
        )}

        {passo === 'papel' && (
          <>
            <Eyebrow>seu papel</Eyebrow>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(24px, 3vw, 32px)',
                letterSpacing: '-0.015em',
                margin: 0,
              }}
            >
              {nome ? `${nome}, ` : ''}o app é seu.
            </h2>
            <p style={{ font: '400 16px/1.55 var(--font-body)', color: 'var(--ink-2)', margin: 0 }}>
              agenda da médica é o uso principal. parceiros e admins têm visões próprias, mas o
              centro é você.
            </p>
            <Mono style={{ color: 'var(--ink-3)' }}>
              tudo que você cadastra é privado · só compartilha quando você manda.
            </Mono>
          </>
        )}

        {passo === 'hospital-rapido' && (
          <>
            <Eyebrow>onde plantonia mais</Eyebrow>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: 'clamp(24px, 3vw, 32px)',
                letterSpacing: '-0.015em',
                margin: 0,
              }}
            >
              um hospital pra começar.
            </h2>
            <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: 0 }}>
              depois você adiciona os outros e detalha as regras. agora é só pra ter um chão.
            </p>
            <Field label="nome">
              <input
                value={hospitalNome}
                onChange={(e) => setHospitalNome(e.target.value)}
                placeholder="Hospital Santa Lúcia"
                style={input}
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="abreviação">
                <input
                  value={hospitalAbrev}
                  onChange={(e) => setHospitalAbrev(e.target.value.toUpperCase())}
                  placeholder="HSL"
                  style={input}
                />
              </Field>
              <Field label="valor / plantão">
                <input
                  type="number"
                  value={valorPlantao}
                  onChange={(e) => setValorPlantao(Number(e.target.value))}
                  style={input}
                />
              </Field>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {idx > 0 && (
            <button
              type="button"
              onClick={() => setPasso(PASSOS[idx - 1] ?? 'boas-vindas')}
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
          <span style={{ flex: 1 }} />
          {onPular && idx < PASSOS.length - 1 && (
            <button
              type="button"
              onClick={onPular}
              style={{
                font: '500 13px/1 var(--font-body)',
                padding: '12px 18px',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                color: 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              pular tudo
            </button>
          )}
          <button
            type="button"
            onClick={avancar}
            style={{
              font: '600 13px/1 var(--font-body)',
              padding: '12px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
              cursor: 'pointer',
            }}
          >
            {idx === PASSOS.length - 1 ? 'tô pronta' : 'seguir'}
          </button>
        </div>
      </div>
    </div>
  );
}

const input: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg-alt)',
  font: '500 14px/1.3 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
  width: '100%',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}
