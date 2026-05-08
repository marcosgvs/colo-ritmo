import type { CSSProperties, MouseEvent } from 'react';
import type { Bloco as BlocoT } from '@/types';
import { fmtRange, getHospital } from '@/lib/data';
import { Eyebrow } from './Eyebrow';
import { Hand } from './Hand';
import { Mono } from './Mono';

interface BlocoProps {
  b: BlocoT;
  density?: number;
  onClick?: () => void;
  compact?: boolean;
}

/**
 * Bloco · átomo central da agenda. 8 variantes com estética canônica:
 *   plantao  — wash da família + faixa lateral 4px
 *   sono     — sage-surface + Hand "sono protegido"
 *   bloqueio — listra cream sobre cream
 *   cedido   — sand-surface listrado, opacidade 0.7
 *   trocado  — lavender pattern denso + borda dashed
 *   deslocamento — pill horizontal pequena
 *   consulta · estudo · pessoal · outros — universais
 */
export function Bloco({ b, density = 48, onClick, compact = false }: BlocoProps) {
  const h = b.duracao * density;
  const hosp = b.tipo === 'plantao' || b.tipo === 'cedido' ? getHospital(b.hospitalId) : undefined;
  const cor = hosp?.cor;

  const base: CSSProperties = {
    position: 'relative',
    borderRadius: 12,
    padding: compact ? '8px 10px' : '10px 12px',
    height: h,
    minHeight: 36,
    boxSizing: 'border-box',
    cursor: 'pointer',
    transition: 'box-shadow 120ms cubic-bezier(.2,.7,.2,1), transform 120ms',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };

  const onMouseEnter = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
    e.currentTarget.style.transform = 'translateY(-1px)';
  };
  const onMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.boxShadow = '';
    e.currentTarget.style.transform = '';
  };

  if (b.tipo === 'plantao' && hosp && cor) {
    const conflitoStyle: CSSProperties = b.conflito
      ? { animation: 'colo-pulse-conflict 2.4s ease-in-out infinite' }
      : {};
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: `var(--${cor}-surface)`,
          borderLeft: `4px solid var(--${cor})`,
          color: 'var(--ink)',
          ...conflitoStyle,
        }}
      >
        {b.viaTroca && (
          <span
            title="recebido em troca"
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--lavender)',
              boxShadow: '0 0 0 2px var(--bg)',
            }}
          />
        )}
        {b.conflito && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              border: '2px solid var(--coral-ink)',
              pointerEvents: 'none',
            }}
          />
        )}
        <Eyebrow color={`var(--${cor}-ink)`}>
          {hosp.abrev} · {b.setor}
        </Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
        {h > 70 && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink-2)',
              marginTop: 'auto',
            }}
          >
            {b.duracao}h
          </div>
        )}
      </div>
    );
  }

  if (b.tipo === 'sono') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ ...base, background: 'var(--sage-surface)', color: 'var(--sage-ink)' }}
      >
        <Hand color="var(--sage-ink)" size={h > 80 ? 22 : 16}>
          sono protegido
        </Hand>
        {h > 60 && (
          <Mono style={{ color: 'var(--sage-ink)', opacity: 0.8 }}>{b.duracao}h livres</Mono>
        )}
      </div>
    );
  }

  if (b.tipo === 'bloqueio') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background:
            'repeating-linear-gradient(135deg, var(--bg-alt), var(--bg-alt) 6px, var(--bg) 6px, var(--bg) 12px)',
          border: '1px dashed rgba(58,46,42,0.18)',
          color: 'var(--ink-2)',
        }}
      >
        <Eyebrow>bloqueio</Eyebrow>
        {b.motivo && (
          <div style={{ font: '500 12px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>
            {b.motivo}
          </div>
        )}
      </div>
    );
  }

  if (b.tipo === 'cedido') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background:
            'repeating-linear-gradient(135deg, var(--sand-surface), var(--sand-surface) 5px, transparent 5px, transparent 10px)',
          opacity: 0.7,
        }}
      >
        <Eyebrow style={{ textDecoration: 'line-through' }}>
          cedido · {b.cedidoPara}
        </Eyebrow>
        <div style={{ font: '500 12px/1.3 var(--font-body)', color: 'var(--ink-3)' }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
        {b.motivo && h > 60 && (
          <Mono style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>{b.motivo}</Mono>
        )}
      </div>
    );
  }

  if (b.tipo === 'trocado') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background:
            'repeating-linear-gradient(135deg, var(--lavender-surface), var(--lavender-surface) 8px, color-mix(in oklab, var(--lavender-ink) 12%, transparent) 8px, color-mix(in oklab, var(--lavender-ink) 12%, transparent) 14px)',
          border: '1.5px dashed var(--lavender-ink)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ font: '700 14px/1 var(--font-body)', color: 'var(--lavender-ink)' }}>
            ↔
          </span>
          <Eyebrow color="var(--lavender-ink)" style={{ opacity: 0.95 }}>
            trocado
          </Eyebrow>
        </div>
        <div
          style={{
            font: '600 13px/1.3 var(--font-body)',
            color: 'var(--lavender-ink)',
            marginTop: 2,
          }}
        >
          {b.trocadoCom}
        </div>
      </div>
    );
  }

  if (b.tipo === 'consulta') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--bg)',
          border: '1px solid var(--coral)',
          borderLeft: '4px solid var(--coral-ink)',
          color: 'var(--ink)',
        }}
      >
        <Eyebrow color="var(--coral-ink)">consulta · {b.local || 'consultório'}</Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
        {h > 70 && b.detalhe && (
          <div
            style={{
              font: '400 11px/1.3 var(--font-body)',
              color: 'var(--ink-2)',
              marginTop: 'auto',
            }}
          >
            {b.detalhe}
          </div>
        )}
      </div>
    );
  }

  if (b.tipo === 'estudo') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--blue-surface)',
          borderLeft: '4px solid var(--blue-ink)',
          color: 'var(--ink)',
        }}
      >
        <Eyebrow color="var(--blue-ink)">
          {b.subtipo || 'estudo'} · {b.titulo || ''}
        </Eyebrow>
        <div style={{ font: '600 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>
          {fmtRange(b.horaInicio, b.duracao)}
        </div>
      </div>
    );
  }

  if (b.tipo === 'pessoal') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--sand-surface)',
          borderLeft: '4px solid var(--sand-ink)',
          color: 'var(--ink)',
        }}
      >
        <Eyebrow color="var(--sand-ink)">pessoal</Eyebrow>
        <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>
          {b.titulo || 'compromisso'}
        </div>
        {h > 60 && (
          <Mono style={{ color: 'var(--ink-3)' }}>{fmtRange(b.horaInicio, b.duracao)}</Mono>
        )}
      </div>
    );
  }

  if (b.tipo === 'outros') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          ...base,
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderLeft: '4px solid var(--ink-3)',
          color: 'var(--ink)',
        }}
      >
        <Eyebrow>{b.categoria || 'outros'}</Eyebrow>
        <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>
          {b.titulo || 'evento'}
        </div>
        {h > 60 && (
          <Mono style={{ color: 'var(--ink-3)' }}>{fmtRange(b.horaInicio, b.duracao)}</Mono>
        )}
      </div>
    );
  }

  if (b.tipo === 'deslocamento') {
    return (
      <div
        style={{
          height: 14,
          minHeight: 14,
          background: 'var(--blue-surface)',
          borderRadius: 6,
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          font: '500 10px/1 var(--font-body)',
          color: 'var(--blue-text)',
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        {b.de} → {b.para} · {Math.round(b.duracao * 60)}min
      </div>
    );
  }

  return null;
}
