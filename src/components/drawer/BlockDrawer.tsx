import { useEffect, useMemo } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import {
  detectarConflitos,
  ehNoturno,
  fmtDate,
  fmtRange,
  getHospital,
  type Conflito,
} from '@/lib/data';
import { Eyebrow, Hand, IconConflito, Mono, Pill } from '@/components/atoms';

interface BlockDrawerProps {
  bloco: Bloco | null;
  hospitais: HospitaisMap;
  /** Lista completa de blocos · pra resolver conflitos com a contraparte */
  blocos?: Bloco[];
  onClose: () => void;
  onTrocar?: (b: Bloco) => void;
  onCeder?: (b: Bloco) => void;
  /** Editar abre o form com todos os campos preenchidos. */
  onEditar?: (b: Bloco) => void;
  /** Remover tira da agenda. */
  onRemover?: (id: number | string) => void;
  /** Estica noitinha (5h) pra noite (12h) — comum quando UTI lota. */
  onEsticarNoite?: (b: Bloco) => void;
}

const ROTULO_CONFLITO: Record<string, string> = {
  sobreposicao: 'plantões sobrepostos',
};

/** Noitinha · plantão começando 19h e durando 5h (vai até 00h). */
function ehNoitinha(b: Bloco): boolean {
  return b.tipo === 'plantao' && b.horaInicio === 19 && b.duracao === 5;
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
  blocos,
  onClose,
  onTrocar,
  onCeder,
  onEditar,
  onRemover,
  onEsticarNoite,
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

  // Quando o bloco está em conflito, busca contrapartes pra mostrar lado a lado
  const conflitosRelacionados = useMemo<Array<{ outro: BlocoPlantao; conflito: Conflito }>>(() => {
    if (!bloco || bloco.tipo !== 'plantao' || !bloco.conflito || !blocos) return [];
    const todos = detectarConflitos(blocos, hospitais);
    const meus = todos.filter(
      (c) => c.a.id === bloco.id || (c.b && c.b.id === bloco.id),
    );
    return meus
      .map((c) => {
        const outro = c.a.id === bloco.id ? c.b : c.a;
        if (!outro) return null;
        return { outro, conflito: c };
      })
      .filter((x): x is { outro: BlocoPlantao; conflito: Conflito } => x !== null);
  }, [bloco, blocos, hospitais]);

  if (!bloco) return null;

  const emConflito = conflitosRelacionados.length > 0;

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
          <Eyebrow color={emConflito ? 'var(--coral-ink)' : hosp ? `var(--${hosp.cor}-ink)` : 'var(--ink-3)'}>
            {fmtDate(bloco.data)}
          </Eyebrow>
          {bloco.tipo === 'plantao' && bloco.viaTroca && (
            <Pill kind="lavender">via troca</Pill>
          )}
          {emConflito && <IconConflito />}
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

        {emConflito && (
          <BlocoConflito
            bloco={bloco}
            outros={conflitosRelacionados}
            hospitais={hospitais}
            onEditar={onEditar}
            onTrocar={onTrocar}
            onCeder={onCeder}
            onRemover={onRemover}
          />
        )}

        {!emConflito && (
        <>
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

        {bloco.tipo === 'plantao' && ehNoturno(bloco) && (
          <Pill kind="info">noturno</Pill>
        )}
        </>
        )}

        {!emConflito && bloco.tipo === 'cedido' && (
          <Section eyebrow="cedido pra">
            <p style={{ font: '500 16px/1.4 var(--font-body)', margin: 0 }}>{bloco.cedidoPara}</p>
            {bloco.motivo && (
              <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginTop: 6 }}>
                {bloco.motivo}
              </Hand>
            )}
          </Section>
        )}

        {!emConflito && bloco.tipo === 'bloqueio' && bloco.motivo && (
          <Section eyebrow="motivo">
            <Hand color="var(--ink-2)" size={18}>
              {bloco.motivo}
            </Hand>
          </Section>
        )}

        <div style={{ flex: 1 }} />

        {!emConflito && (
          <>
            {ehNoitinha(bloco) && onEsticarNoite && (
              <button
                type="button"
                onClick={() => onEsticarNoite(bloco)}
                style={{
                  font: '600 13px/1 var(--font-body)',
                  padding: '12px 18px',
                  borderRadius: 999,
                  border: '1px dashed var(--lavender-ink)',
                  background: 'var(--lavender-surface)',
                  color: 'var(--lavender-ink)',
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                virar noite (12h) — plantão lotou
              </button>
            )}
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
          </>
        )}

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

interface BlocoConflitoProps {
  bloco: Bloco;
  outros: Array<{ outro: BlocoPlantao; conflito: Conflito }>;
  hospitais: HospitaisMap;
  onEditar?: (b: Bloco) => void;
  onTrocar?: (b: Bloco) => void;
  onCeder?: (b: Bloco) => void;
  onRemover?: (id: number | string) => void;
}

/**
 * Layout de conflito · todos os blocos envolvidos aparecem com o mesmo
 * peso visual. Sem hierarquia "principal vs contraparte" — médico decide
 * qual sai sem influência da ordem do click.
 */
function BlocoConflito({
  bloco,
  outros,
  onEditar,
  onTrocar,
  onCeder,
  onRemover,
}: BlocoConflitoProps) {
  const blocoPlantao = bloco.tipo === 'plantao' ? (bloco as BlocoPlantao) : null;
  // Tipo de conflito do primeiro pra resumir no header
  const tipoResumo = outros[0]?.conflito.tipo;
  const detalheResumo = outros[0]?.conflito.detalhe;

  const todos: BlocoPlantao[] = blocoPlantao
    ? [blocoPlantao, ...outros.map((o) => o.outro)]
    : outros.map((o) => o.outro);

  return (
    <div>
      <Hand
        color="var(--coral-ink)"
        size={16}
        style={{ display: 'block', marginBottom: 4 }}
      >
        {ROTULO_CONFLITO[tipoResumo ?? ''] ?? 'plantões em conflito'}
      </Hand>
      {detalheResumo && (
        <Mono style={{ color: 'var(--ink-3)', display: 'block', marginBottom: 14 }}>
          {detalheResumo} · escolhe o que sai
        </Mono>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {todos.map((p) => {
          const h = getHospital(p.hospitalId);
          const cor = h?.cor ?? 'sand';
          return (
            <div
              key={String(p.id)}
              style={{
                background: `var(--${cor}-surface)`,
                borderLeft: `4px solid var(--${cor})`,
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div>
                <Eyebrow color={`var(--${cor}-ink)`}>{h?.abrev ?? p.hospitalId}</Eyebrow>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 18,
                    margin: '4px 0 2px',
                    color: 'var(--ink)',
                  }}
                >
                  {h?.nome ?? p.hospitalId}
                </p>
                <Mono style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                  {fmtRange(p.horaInicio, p.duracao)} · {p.duracao}h
                </Mono>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {onEditar && TIPOS_EDITAVEIS.has(p.tipo) && (
                  <ConflitoAcao label="editar" variant="ghost" onClick={() => onEditar(p)} />
                )}
                {onTrocar && (
                  <ConflitoAcao label="trocar" variant="ghost" onClick={() => onTrocar(p)} />
                )}
                {onCeder && (
                  <ConflitoAcao label="ceder" variant="ghost" onClick={() => onCeder(p)} />
                )}
                {onRemover && (
                  <ConflitoAcao label="remover" variant="coral" onClick={() => onRemover(p.id)} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConflitoAcao({
  label,
  variant,
  onClick,
}: {
  label: string;
  variant: 'ghost' | 'coral';
  onClick: () => void;
}) {
  const isCoral = variant === 'coral';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        font: '600 11px/1 var(--font-body)',
        padding: '7px 12px',
        borderRadius: 999,
        border: `1px solid ${isCoral ? 'var(--coral-ink)' : 'var(--line)'}`,
        background: 'var(--bg)',
        color: isCoral ? 'var(--coral-ink)' : 'var(--ink-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
