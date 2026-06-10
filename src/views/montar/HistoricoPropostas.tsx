// Lista de propostas anteriores do Montar (clica pra recarregar no preview).

import { useState } from 'react';
import type { HospitaisMap, PropostaHistorico } from '@/types';
import { MESES } from '@/lib/data';
import { Eyebrow, Mono } from '@/components/atoms';
import { LABEL_LENTE } from './tipos';

export function HistoricoPropostas({
  propostas,
  hospitais,
  onCarregar,
}: {
  propostas: PropostaHistorico[];
  hospitais: HospitaisMap;
  onCarregar: (p: PropostaHistorico) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const visiveis = aberto ? propostas : propostas.slice(0, 3);

  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <Eyebrow>tentativas anteriores · {propostas.length}</Eyebrow>
        {propostas.length > 3 && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            style={{
              font: '600 11px/1 var(--font-body)',
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-2)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            {aberto ? 'mostrar só recentes' : `ver todas (${propostas.length})`}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visiveis.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onCarregar(p)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              textAlign: 'left',
              flexWrap: 'wrap',
            }}
          >
            <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
              {fmtTempoRelativo(p.geradoEm)}
            </Mono>
            <span
              style={{
                font: '600 13px/1.2 var(--font-display)',
                color: 'var(--ink)',
                flex: 1,
                minWidth: 0,
              }}
            >
              {labelMes(p.mes)} · {LABEL_LENTE[p.lente]}
              {p.lente === 'acelerar' && p.acelerarPercentual
                ? ` +${p.acelerarPercentual}%`
                : ''}
              {p.lente === 'acelerar' && p.acelerarValor
                ? ` R$${p.acelerarValor.toLocaleString('pt-BR')}`
                : ''}
            </span>
            <Mono style={{ color: 'var(--ink-2)', fontSize: 11 }}>
              {p.plantoes.length} {p.plantoes.length === 1 ? 'plantão' : 'plantões'} ·{' '}
              {p.hospitaisIds
                .map((id) => hospitais[id]?.abrev ?? '?')
                .join('+')}
            </Mono>
          </button>
        ))}
      </div>
    </div>
  );
}

function fmtTempoRelativo(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias}d atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function labelMes(mesISO: string): string {
  const [a, m] = mesISO.split('-');
  const idx = parseInt(m ?? '1', 10) - 1;
  return `${MESES[idx] ?? ''} ${a?.slice(-2) ?? ''}`;
}
