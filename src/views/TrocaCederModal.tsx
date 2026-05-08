import { useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import { fmtDate, fmtRange, getHospital } from '@/lib/data';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';
import { JanelaPreview } from '@/components/preview';

export type ModoTrocaCeder = 'trocar' | 'ceder';

interface TrocaCederModalProps {
  modo: ModoTrocaCeder;
  bloco: BlocoPlantao;
  outrosPlantoes: Bloco[];
  hospitais: HospitaisMap;
  onConfirmar: (registro: RegistroTroca) => void;
  onCancelar: () => void;
}

export interface RegistroTroca {
  modo: ModoTrocaCeder;
  /** Plantão original (do médico). */
  plantaoId: number | string;
  /** Quem recebe (em ambos os modos). */
  quem: string;
  /** Plantão recebido em troca · só pra modo `trocar`. */
  recebidoEmISO?: string;
  recebidoHospitalId?: string;
  recebidoHora?: number;
  recebidoDuracao?: number;
}

/**
 * Modal compacto pra trocar ou ceder um plantão. Foco do médico
 * isolado: registro simples sem fluxo de aprovação · ele anota com
 * quem trocou/cedeu, e (se troca) qual plantão recebeu em troca.
 */
export function TrocaCederModal({
  modo,
  bloco,
  outrosPlantoes,
  hospitais,
  onConfirmar,
  onCancelar,
}: TrocaCederModalProps) {
  const hosp = getHospital(bloco.hospitalId);

  const [quem, setQuem] = useState('');
  const [recebidoData, setRecebidoData] = useState<string>(bloco.data);
  const [recebidoHospital, setRecebidoHospital] = useState(bloco.hospitalId);
  const [recebidoHora, setRecebidoHora] = useState(bloco.horaInicio);
  const [recebidoDur, setRecebidoDur] = useState(bloco.duracao);

  const valido =
    quem.trim().length > 0 &&
    (modo === 'ceder' ||
      (recebidoData && recebidoHospital && recebidoDur > 0));

  const blocoRecebido: BlocoPlantao | null = useMemo(() => {
    if (modo !== 'trocar' || !recebidoData || !recebidoHospital || recebidoDur <= 0) return null;
    return {
      id: `troca-preview-${bloco.id}`,
      tipo: 'plantao',
      hospitalId: recebidoHospital,
      data: recebidoData,
      horaInicio: recebidoHora,
      duracao: recebidoDur,
      setor: hospitais[recebidoHospital]?.setores[0] ?? '',
    };
  }, [modo, recebidoData, recebidoHospital, recebidoHora, recebidoDur, hospitais, bloco.id]);

  const blocosSemOriginal = useMemo(
    () => outrosPlantoes.filter((b) => b.id !== bloco.id),
    [outrosPlantoes, bloco.id],
  );

  function confirmar() {
    if (!valido) return;
    onConfirmar({
      modo,
      plantaoId: bloco.id,
      quem: quem.trim(),
      ...(modo === 'trocar' && {
        recebidoEmISO: recebidoData,
        recebidoHospitalId: recebidoHospital,
        recebidoHora: recebidoHora,
        recebidoDuracao: recebidoDur,
      }),
    });
  }

  return (
    <div
      onClick={onCancelar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.18)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'colo-fade-in 180ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(480px, 100%)',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          padding: '28px 32px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Eyebrow>{modo === 'trocar' ? 'pedir troca' : 'ceder plantão'}</Eyebrow>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="fechar"
            style={{
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: 6,
              cursor: 'pointer',
              color: 'var(--ink-2)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 24,
              letterSpacing: '-0.01em',
              margin: 0,
            }}
          >
            {modo === 'trocar' ? 'trocar com quem?' : 'ceder pra quem?'}
          </h2>
          <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 6 }}>
            {modo === 'trocar'
              ? 'só pra registrar · sem fluxo de aprovação'
              : 'só pra registrar · não tira da agenda da pessoa'}
          </Hand>
        </div>

        <div
          style={{
            background: hosp ? `var(--${hosp.cor}-surface)` : 'var(--bg-alt)',
            borderLeft: hosp ? `3px solid var(--${hosp.cor})` : 'none',
            borderRadius: 'var(--r-md)',
            padding: '12px 14px',
          }}
        >
          <Eyebrow color={hosp ? `var(--${hosp.cor}-ink)` : 'var(--ink-3)'}>
            {hosp?.abrev ?? bloco.hospitalId}
          </Eyebrow>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 18,
              margin: '4px 0 0',
            }}
          >
            {fmtDate(bloco.data)}
          </p>
          <Mono style={{ display: 'block', color: 'var(--ink-3)' }}>
            {fmtRange(bloco.horaInicio, bloco.duracao)} · {bloco.duracao}h
          </Mono>
        </div>

        <Field label={modo === 'trocar' ? 'colega que assume' : 'colega que recebe'}>
          <input
            value={quem}
            onChange={(e) => setQuem(e.target.value)}
            placeholder="Dra. Ana Soares"
            style={input}
            autoFocus
          />
        </Field>

        {modo === 'trocar' && (
          <>
            <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }} />
            <Eyebrow>plantão que você recebe em troca</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="data">
                <input
                  type="date"
                  value={recebidoData}
                  onChange={(e) => setRecebidoData(e.target.value)}
                  style={input}
                />
              </Field>
              <Field label="hospital">
                <select
                  value={recebidoHospital}
                  onChange={(e) => setRecebidoHospital(e.target.value)}
                  style={input}
                >
                  {Object.values(hospitais).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.abrev}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="início">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={23.5}
                  value={recebidoHora}
                  onChange={(e) => setRecebidoHora(Number(e.target.value))}
                  style={input}
                />
              </Field>
              <Field label="duração (h)">
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={24}
                  value={recebidoDur}
                  onChange={(e) => setRecebidoDur(Number(e.target.value))}
                  style={input}
                />
              </Field>
            </div>

            {blocoRecebido && (
              <JanelaPreview
                blocos={blocosSemOriginal}
                hospitais={hospitais}
                novoBloco={blocoRecebido}
              />
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={confirmar}
            disabled={!valido}
            style={{
              font: '600 13px/1 var(--font-body)',
              padding: '12px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--ink)',
              color: 'var(--bg)',
              cursor: valido ? 'pointer' : 'not-allowed',
              opacity: valido ? 1 : 0.5,
            }}
          >
            {modo === 'trocar' ? 'registrar troca' : 'registrar cessão'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
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
            cancelar
          </button>
          <span style={{ flex: 1 }} />
          {modo === 'ceder' && (
            <Pill kind="warn" dot={false}>
              só registro
            </Pill>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 14px/1.4 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--font-body)',
};
