// Etapa 1 do Montar · configurar mês, hospitais, lente e motivo do acelerar.

import type { HospitaisMap } from '@/types';
import { MonthPicker, Mono } from '@/components/atoms';
import { useIsMobile } from '@/hooks/useIsMobile';
import { LENTES, type Lente } from './tipos';
import { Linha, inputBase } from './ui';

interface SetupCardProps {
  mes: string;
  setMes: (m: string) => void;
  hospitais: ReturnType<typeof Object.values<HospitaisMap[string]>>;
  hospitaisSel: Set<string>;
  toggleHospital: (id: string) => void;
  lente: Lente;
  setLente: (l: Lente) => void;
  acelerarPercentual: string;
  setAcelerarPercentual: (s: string) => void;
  acelerarValor: string;
  setAcelerarValor: (s: string) => void;
  erro: string | null;
  onAvancar: () => void;
}

export function SetupCard({
  mes,
  setMes,
  hospitais,
  hospitaisSel,
  toggleHospital,
  lente,
  setLente,
  acelerarPercentual,
  setAcelerarPercentual,
  acelerarValor,
  setAcelerarValor,
  erro,
  onAvancar,
}: SetupCardProps) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: '24px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        boxShadow: 'var(--shadow-sm)',
        maxWidth: 720,
      }}
    >
      <Linha rotulo="mês">
        <MonthPicker value={mes} onChange={setMes} janela={12} />
      </Linha>

      <Linha rotulo="hospitais">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {hospitais.map((h) => {
            const ativo = hospitaisSel.has(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => toggleHospital(h.id)}
                style={{
                  font: '500 13px/1 var(--font-body)',
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: ativo ? '1px solid var(--ink)' : '1px solid var(--line)',
                  background: ativo ? 'var(--ink)' : 'transparent',
                  color: ativo ? 'var(--bg)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {h.abrev}
              </button>
            );
          })}
        </div>
      </Linha>

      <Linha rotulo="jeito de pensar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LENTES.map((l) => {
            const ativo = lente === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLente(l.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: 'var(--r-md)',
                  border: ativo ? '1px solid var(--lavender-ink)' : '1px solid var(--line)',
                  background: ativo ? 'var(--lavender-surface)' : 'var(--bg-alt)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <span style={{ font: '600 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>
                  {l.titulo}
                </span>
                <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>{l.recado}</Mono>
              </button>
            );
          })}
        </div>
      </Linha>

      {lente === 'acelerar' && (
        <Linha rotulo="motivo">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '14px 16px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--lavender-ink)',
              background: 'var(--lavender-surface)',
            }}
          >
            <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
              preencha pelo menos um · pode preencher os dois e a gente honra o mais demandante
            </Mono>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: '500 13px/1.3 var(--font-body)' }}>
              <span>+</span>
              <input
                inputMode="numeric"
                value={acelerarPercentual}
                onChange={(e) => setAcelerarPercentual(e.target.value.replace(/\D/g, ''))}
                placeholder="15"
                style={{
                  ...inputBase,
                  width: isMobile ? 64 : 70,
                  textAlign: 'right',
                }}
              />
              <span>% de plantões a mais que seu normal histórico</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', font: '500 13px/1.3 var(--font-body)' }}>
              <span>chegar até R$</span>
              <input
                inputMode="numeric"
                value={acelerarValor}
                onChange={(e) => setAcelerarValor(e.target.value.replace(/\D/g, ''))}
                placeholder="25000"
                style={{
                  ...inputBase,
                  width: isMobile ? 90 : 110,
                  textAlign: 'right',
                }}
              />
              <span>estimado no mês</span>
            </label>
          </div>
        </Linha>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <button
          type="button"
          onClick={onAvancar}
          disabled={hospitaisSel.size === 0}
          style={{
            font: '600 14px/1 var(--font-body)',
            padding: '13px 22px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--lavender-ink)',
            color: 'var(--bg)',
            cursor: hospitaisSel.size === 0 ? 'not-allowed' : 'pointer',
            opacity: hospitaisSel.size === 0 ? 0.5 : 1,
          }}
        >
          avançar
        </button>
        {erro && (
          <span style={{ font: '500 13px/1.4 var(--font-body)', color: 'var(--coral-ink)' }}>
            {erro}
          </span>
        )}
      </div>
    </div>
  );
}
