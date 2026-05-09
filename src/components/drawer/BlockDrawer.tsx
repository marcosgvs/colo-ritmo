import { useEffect } from 'react';
import type { Bloco, HospitaisMap } from '@/types';
import { calcRemuneracaoBloco, fmtDate, fmtRange, getHospital } from '@/lib/data';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';

interface BlockDrawerProps {
  bloco: Bloco | null;
  hospitais: HospitaisMap;
  onClose: () => void;
  onTrocar?: (b: Bloco) => void;
  onCeder?: (b: Bloco) => void;
  /** Editar abre o form com todos os campos preenchidos. */
  onEditar?: (b: Bloco) => void;
  /** Remover tira da agenda. */
  onRemover?: (id: number | string) => void;
}

const TIPOS_EDITAVEIS = new Set([
  'plantao',
  'sono',
  'bloqueio',
  'consulta',
  'estudo',
  'pessoal',
  'outros',
]);

/**
 * BlockDrawer · overlay lateral à direita (480px desktop · bottom sheet
 * mobile). Mostra os dados essenciais do bloco e ações primárias.
 *   plantão  → trocar, ceder, abrir detalhe
 *   sono     → editar janela
 *   bloqueio → editar motivo
 *   cedido/trocado/deslocamento → só read
 */
export function BlockDrawer({
  bloco,
  hospitais,
  onClose,
  onTrocar,
  onCeder,
  onEditar,
  onRemover,
}: BlockDrawerProps) {
  // ESC fecha
  useEffect(() => {
    if (!bloco) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bloco, onClose]);

  if (!bloco) return null;

  const hosp =
    bloco.tipo === 'plantao' || bloco.tipo === 'cedido'
      ? getHospital(bloco.hospitalId)
      : undefined;

  const titulo = (() => {
    if (bloco.tipo === 'plantao' && hosp) return hosp.abrev;
    if (bloco.tipo === 'sono') return 'sono protegido';
    if (bloco.tipo === 'bloqueio') return `bloqueio · ${bloco.motivo ?? 'dia livre'}`;
    if (bloco.tipo === 'cedido' && hosp) return `cedido · ${bloco.cedidoPara}`;
    if (bloco.tipo === 'trocado') return `trocado com ${bloco.trocadoCom}`;
    if (bloco.tipo === 'deslocamento') return `deslocamento · ${bloco.de} → ${bloco.para}`;
    if (bloco.tipo === 'consulta') return 'consulta';
    if (bloco.tipo === 'estudo') return bloco.titulo ?? 'estudo';
    if (bloco.tipo === 'pessoal') return bloco.titulo ?? 'pessoal';
    if (bloco.tipo === 'outros') return bloco.titulo ?? bloco.categoria ?? 'evento';
    return bloco.tipo;
  })();

  const remuneracao =
    bloco.tipo === 'plantao' && hosp ? calcRemuneracaoBloco(bloco, hosp) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.18)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'colo-fade-in 180ms ease',
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          maxHeight: 'calc(100vh - 40px)',
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 51,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          overflowY: 'auto',
          animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Eyebrow color={hosp ? `var(--${hosp.cor}-ink)` : 'var(--ink-3)'}>
            {fmtDate(bloco.data)}
          </Eyebrow>
          {bloco.tipo === 'plantao' && bloco.viaTroca && (
            <Pill kind="lavender">via troca</Pill>
          )}
          {bloco.tipo === 'plantao' && bloco.conflito && (
            <Pill kind="err">conflito</Pill>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar"
            style={{
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: 8,
              cursor: 'pointer',
              color: 'var(--ink-2)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 32,
              letterSpacing: '-0.015em',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {titulo}
          </h2>
          <Mono style={{ display: 'block', marginTop: 8 }}>
            {fmtRange(bloco.horaInicio, bloco.duracao)} · {bloco.duracao}h
          </Mono>
        </div>

        {bloco.tipo === 'plantao' && hosp && (
          <Section eyebrow="onde">
            <p style={{ font: '400 14px/1.55 var(--font-body)', color: 'var(--ink-2)', margin: 0 }}>
              {hosp.nome}
            </p>
            {bloco.trocaInfo && (
              <Hand color="var(--lavender-ink)" size={16} style={{ display: 'block', marginTop: 8 }}>
                veio de {bloco.trocaInfo}
              </Hand>
            )}
          </Section>
        )}

        {remuneracao && (
          <Section eyebrow="remuneração estimada">
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <Mono style={{ display: 'block', color: 'var(--ink-3)' }}>bruto</Mono>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 22,
                    letterSpacing: '-0.01em',
                  }}
                >
                  R$ {remuneracao.bruto.toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <Mono style={{ display: 'block', color: 'var(--ink-3)' }}>líquido (estimado)</Mono>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 22,
                    letterSpacing: '-0.01em',
                    color: 'var(--sage-ink)',
                  }}
                >
                  R$ {remuneracao.liquido.toLocaleString('pt-BR')}
                </span>
              </div>
              {remuneracao.noturno && (
                <div style={{ alignSelf: 'center' }}>
                  <Pill kind="info">noturno</Pill>
                </div>
              )}
            </div>
          </Section>
        )}

        {bloco.tipo === 'cedido' && (
          <Section eyebrow="cedido pra">
            <p style={{ font: '500 16px/1.4 var(--font-body)', margin: 0 }}>{bloco.cedidoPara}</p>
            {bloco.motivo && (
              <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 6 }}>
                {bloco.motivo}
              </Hand>
            )}
          </Section>
        )}

        {bloco.tipo === 'bloqueio' && bloco.motivo && (
          <Section eyebrow="motivo">
            <Hand color="var(--ink-2)" size={18}>
              {bloco.motivo}
            </Hand>
          </Section>
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {onEditar && TIPOS_EDITAVEIS.has(bloco.tipo) && (
            <Btn primary onClick={() => onEditar(bloco)}>
              editar
            </Btn>
          )}
          {bloco.tipo === 'plantao' && onTrocar && (
            <Btn onClick={() => onTrocar(bloco)}>trocar</Btn>
          )}
          {bloco.tipo === 'plantao' && onCeder && (
            <Btn onClick={() => onCeder(bloco)}>ceder</Btn>
          )}
          <span style={{ flex: 1 }} />
          {onRemover && (
            <button
              type="button"
              onClick={() => onRemover(bloco.id)}
              style={{
                font: '600 13px/1 var(--font-body)',
                padding: '11px 18px',
                borderRadius: 999,
                border: '1px solid var(--coral-ink)',
                background: 'transparent',
                color: 'var(--coral-ink)',
                cursor: 'pointer',
              }}
            >
              remover
            </button>
          )}
        </div>

        {hospitais && Object.keys(hospitais).length === 0 && (
          <Mono style={{ color: 'var(--ink-3)', display: 'block' }}>
            sem hospitais cadastrados ainda
          </Mono>
        )}
      </aside>
    </div>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
      }}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function Btn({
  children,
  primary = false,
  onClick,
}: {
  children: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        font: '600 13px/1 var(--font-body)',
        padding: '11px 18px',
        borderRadius: 999,
        border: primary ? 'none' : '1px solid var(--line)',
        background: primary ? 'var(--ink)' : 'transparent',
        color: primary ? 'var(--bg)' : 'var(--ink)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
