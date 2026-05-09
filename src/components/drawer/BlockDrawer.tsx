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
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';

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
}

const ROTULO_CONFLITO: Record<string, string> = {
  sobreposicao: 'plantões sobrepostos',
  sem_descanso: 'descanso curto entre plantões',
  limite_cfm: 'mais de 60h na semana (CFM)',
  max_semana: 'limite de plantões por semana batido',
};

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

        {bloco.tipo === 'plantao' && ehNoturno(bloco) && (
          <Pill kind="info">noturno</Pill>
        )}

        {conflitosRelacionados.length > 0 && (
          <div
            style={{
              background: 'var(--coral-surface)',
              border: '1px solid var(--coral-ink)',
              borderRadius: 'var(--r-md)',
              padding: '14px 16px',
            }}
          >
            <Eyebrow color="var(--coral-ink)">
              {conflitosRelacionados.length === 1
                ? 'em conflito com'
                : `em conflito com ${conflitosRelacionados.length} plantões`}
            </Eyebrow>
            <Hand
              color="var(--coral-ink)"
              size={14}
              style={{ display: 'block', marginTop: 4, marginBottom: 12 }}
            >
              um dos dois precisa sair · escolhe qual
            </Hand>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conflitosRelacionados.map(({ outro, conflito }) => {
                const hospOutro = getHospital(outro.hospitalId);
                const cor = hospOutro?.cor ?? 'sand';
                return (
                  <div
                    key={String(outro.id)}
                    style={{
                      background: 'var(--bg)',
                      borderLeft: `4px solid var(--${cor})`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Eyebrow color={`var(--${cor}-ink)`}>
                        {hospOutro?.abrev ?? outro.hospitalId}
                      </Eyebrow>
                      <p
                        style={{
                          font: '500 14px/1.3 var(--font-body)',
                          margin: '4px 0 2px',
                          color: 'var(--ink)',
                        }}
                      >
                        {fmtDate(outro.data)} · {fmtRange(outro.horaInicio, outro.duracao)}
                      </p>
                      <Mono style={{ color: 'var(--coral-ink)', fontSize: 11 }}>
                        {ROTULO_CONFLITO[conflito.tipo] ?? conflito.tipo} · {conflito.detalhe}
                      </Mono>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {onEditar && TIPOS_EDITAVEIS.has(outro.tipo) && (
                        <ConflitoAcao
                          label="editar"
                          variant="ghost"
                          onClick={() => onEditar(outro)}
                        />
                      )}
                      {onTrocar && (
                        <ConflitoAcao
                          label="trocar"
                          variant="ghost"
                          onClick={() => onTrocar(outro)}
                        />
                      )}
                      {onCeder && (
                        <ConflitoAcao
                          label="ceder"
                          variant="ghost"
                          onClick={() => onCeder(outro)}
                        />
                      )}
                      {onRemover && (
                        <ConflitoAcao
                          label="remover"
                          variant="coral"
                          onClick={() => onRemover(outro.id)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
