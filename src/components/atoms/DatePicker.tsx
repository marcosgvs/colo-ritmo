import { useEffect, useRef, useState } from 'react';
import { DOWS, fromISO, toISO } from '@/lib/data';

interface DatePickerProps {
  /** Valor ISO YYYY-MM-DD · '' = vazio. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}

const MESES_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

/**
 * DatePicker custom · português brasileiro, semana começa na segunda
 * (consistente com o resto do app). Evita o popover nativo do iOS
 * que vinha em inglês e era visualmente desalinhado.
 */
export function DatePicker({ value, onChange, placeholder = 'data' }: DatePickerProps) {
  const [aberto, setAberto] = useState(false);

  const refDate = value ? fromISO(value) : new Date();
  const [ano, setAno] = useState(refDate.getFullYear());
  const [mes, setMes] = useState(refDate.getMonth());

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', onClickFora);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickFora);
      document.removeEventListener('keydown', onEsc);
    };
  }, [aberto]);

  function abrir() {
    if (value) {
      const d = fromISO(value);
      setAno(d.getFullYear());
      setMes(d.getMonth());
    }
    setAberto(true);
  }

  function navMes(delta: number) {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 11) { novoMes = 0; novoAno += 1; }
    if (novoMes < 0) { novoMes = 11; novoAno -= 1; }
    setMes(novoMes);
    setAno(novoAno);
  }

  function selecionar(iso: string) {
    onChange(iso);
    setAberto(false);
  }

  // Display BR
  const display = value
    ? (() => {
        const d = fromISO(value);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
      })()
    : '';

  // Grade de células
  const primeiroDia = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  // offset semana começando na segunda (JS: Sun=0 → queremos Mon=0)
  const dowOffset = (primeiroDia.getDay() + 6) % 7;
  const totalCelulas = Math.ceil((dowOffset + diasNoMes) / 7) * 7;

  const celulas: Array<{ iso: string; dia: number; foraMes: boolean }> = [];
  for (let i = 0; i < totalCelulas; i++) {
    const diaDoMes = i - dowOffset + 1;
    const d = new Date(ano, mes, diaDoMes);
    celulas.push({
      iso: toISO(d),
      dia: d.getDate(),
      foraMes: diaDoMes < 1 || diaDoMes > diasNoMes,
    });
  }

  const hoje = toISO(new Date());

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={abrir}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          background: 'var(--bg)',
          font: '500 14px/1.3 var(--font-body)',
          color: value ? 'var(--ink)' : 'var(--ink-3)',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span>{display || placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </svg>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="selecione uma data"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 70,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 14,
            width: 280,
            animation: 'colo-drawer-down 180ms ease',
          }}
        >
          {/* header · mês + ano + navegação */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              onClick={() => navMes(-1)}
              aria-label="mês anterior"
              style={navBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <span
              style={{
                font: '600 14px/1 var(--font-display)',
                color: 'var(--ink)',
                letterSpacing: '-0.005em',
                textTransform: 'lowercase',
              }}
            >
              {MESES_LONG[mes]} {ano}
            </span>
            <button
              type="button"
              onClick={() => navMes(1)}
              aria-label="próximo mês"
              style={navBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* cabeçalho dos dias da semana */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              marginBottom: 4,
            }}
          >
            {DOWS.map((d) => (
              <span
                key={d}
                style={{
                  font: '600 10px/1 var(--font-body)',
                  color: 'var(--ink-3)',
                  textAlign: 'center',
                  padding: '6px 0',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
              >
                {d.charAt(0)}
              </span>
            ))}
          </div>

          {/* grade de dias */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 2,
            }}
          >
            {celulas.map((c, i) => {
              const selecionado = c.iso === value;
              const ehHoje = c.iso === hoje;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selecionar(c.iso)}
                  style={{
                    aspectRatio: '1',
                    border: 'none',
                    borderRadius: 999,
                    background: selecionado ? 'var(--lavender)' : 'transparent',
                    color: selecionado
                      ? 'var(--bg)'
                      : c.foraMes
                      ? 'var(--ink-3)'
                      : 'var(--ink)',
                    opacity: c.foraMes ? 0.5 : 1,
                    font: '500 13px/1 var(--font-body)',
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseOver={(e) => {
                    if (!selecionado) e.currentTarget.style.background = 'var(--bg-alt)';
                  }}
                  onMouseOut={(e) => {
                    if (!selecionado) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {c.dia}
                  {ehHoje && !selecionado && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        width: 4,
                        height: 4,
                        borderRadius: 999,
                        background: 'var(--lavender-ink)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* botão hoje */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px dashed var(--line-2)',
            }}
          >
            <button
              type="button"
              onClick={() => selecionar(hoje)}
              style={{
                font: '600 12px/1 var(--font-body)',
                padding: '8px 16px',
                borderRadius: 999,
                border: '1px solid var(--line)',
                background: 'transparent',
                color: 'var(--lavender-ink)',
                cursor: 'pointer',
              }}
            >
              hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--ink-2)',
  borderRadius: 999,
  cursor: 'pointer',
};
