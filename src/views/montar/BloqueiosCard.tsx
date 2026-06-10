// Etapa 2 do Montar · bloqueios do mês: calendário + modal de criar atividade.

import { useMemo, useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import { DOWS, capitalize, diaSemanaBRLong, fmtDate, fmtHora, fromISO } from '@/lib/data';
import { Eyebrow, Mono } from '@/components/atoms';
import { rotuloTurno } from '@/lib/turno';
import { useIsMobile } from '@/hooks/useIsMobile';
import { TIPOS_ATIVIDADE, type TipoAtividade } from './tipos';
import { Field, Modal, btnPrimario, btnSecundario, inputBase } from './ui';
import { listarDiasDoMes } from './PreviewBlock';

interface BloqueiosCardProps {
  mes: string;
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onCriarBloco: (b: Bloco) => void;
  onVoltar: () => void;
  onAvancar: () => void;
}

export function BloqueiosCard({ mes, blocos, hospitais, onCriarBloco, onVoltar, onAvancar }: BloqueiosCardProps) {
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  const dias = useMemo(() => listarDiasDoMes(mes), [mes]);
  const bloqueiosMes = useMemo(
    () => blocos.filter((b) => b.tipo !== 'plantao' && b.tipo !== 'cedido' && b.data.startsWith(mes)),
    [blocos, mes],
  );
  const plantoesMes = useMemo(
    () => blocos.filter((b): b is BlocoPlantao => b.tipo === 'plantao' && b.data.startsWith(mes)),
    [blocos, mes],
  );

  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: '24px 26px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 4px' }}>
        Quer bloquear algum dia ou parte do dia? Clique no calendário pra adicionar uma atividade
        (consulta, sono, bloqueio, etc) que não pode ser plantão.
      </p>
      <Mono style={{ color: 'var(--ink-3)', fontSize: 11, marginBottom: 16, display: 'block' }}>
        atividades criadas aqui vão pra sua agenda real e o Montar respeita
      </Mono>

      <CalendarioBloqueios
        dias={dias}
        mes={mes}
        bloqueios={bloqueiosMes}
        plantoes={plantoesMes}
        hospitais={hospitais}
        onClickDia={setDiaAberto}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={onVoltar}
          style={{
            font: '500 13px/1 var(--font-body)',
            padding: '11px 18px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: 'pointer',
          }}
        >
          voltar
        </button>
        <button
          type="button"
          onClick={onAvancar}
          style={{
            font: '600 14px/1 var(--font-body)',
            padding: '11px 22px',
            borderRadius: 999,
            border: 'none',
            background: 'var(--lavender-ink)',
            color: 'var(--bg)',
            cursor: 'pointer',
          }}
        >
          gerar proposta
        </button>
      </div>

      {diaAberto && (
        <BloqueioFormModal
          iso={diaAberto}
          onSalvar={(b) => onCriarBloco(b)}
          onFechar={() => setDiaAberto(null)}
        />
      )}
    </div>
  );
}

interface CalendarioBloqueiosProps {
  dias: string[];
  mes: string;
  bloqueios: Bloco[];
  plantoes: BlocoPlantao[];
  hospitais: HospitaisMap;
  onClickDia: (iso: string) => void;
}

function CalendarioBloqueios({ dias, mes, bloqueios, plantoes, hospitais, onClickDia }: CalendarioBloqueiosProps) {
  const isMobile = useIsMobile();
  const porDia = useMemo(() => {
    const m = new Map<string, { plantoes: BlocoPlantao[]; bloqueios: Bloco[] }>();
    for (const p of plantoes) {
      const e = m.get(p.data) ?? { plantoes: [], bloqueios: [] };
      e.plantoes.push(p);
      m.set(p.data, e);
    }
    for (const b of bloqueios) {
      const e = m.get(b.data) ?? { plantoes: [], bloqueios: [] };
      e.bloqueios.push(b);
      m.set(b.data, e);
    }
    return m;
  }, [plantoes, bloqueios]);

  const gap = isMobile ? 2 : 4;
  const padCell = isMobile ? 4 : 8;
  const minH = isMobile ? 60 : 76;
  const truncCell = isMobile ? 6 : 14;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap, marginBottom: 6 }}>
        {DOWS.map((d) => (
          <Mono key={d} style={{ color: 'var(--ink-3)', textAlign: 'center', fontSize: 11 }}>
            {d}
          </Mono>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap }}>
        {dias.map((iso) => {
          const dataMes = iso.startsWith(mes);
          const e = porDia.get(iso) ?? { plantoes: [], bloqueios: [] };
          return (
            <button
              key={iso}
              type="button"
              onClick={() => dataMes && onClickDia(iso)}
              disabled={!dataMes}
              style={{
                textAlign: 'left',
                padding: padCell,
                minHeight: minH,
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--line-2)',
                background: dataMes ? 'var(--bg)' : 'var(--bg-alt)',
                opacity: dataMes ? 1 : 0.4,
                cursor: dataMes ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? 2 : 4,
                overflow: 'hidden',
              }}
            >
              <span style={{ font: '600 12px/1 var(--font-body)', color: 'var(--ink-2)' }}>
                {fromISO(iso).getDate()}
              </span>
              {e.plantoes.map((p) => {
                const h = hospitais[p.hospitalId];
                const cor = h?.cor ?? 'sand';
                return (
                  <Mono
                    key={String(p.id)}
                    style={{
                      fontSize: isMobile ? 9 : 10,
                      padding: isMobile ? '1px 3px' : '2px 4px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: `var(--${cor}-surface)`,
                      color: `var(--${cor}-ink)`,
                    }}
                  >
                    {isMobile ? (h?.abrev ?? '?') : `${h?.abrev} · ${rotuloTurno(p.horaInicio, p.duracao, h) ?? fmtHora(p.horaInicio)}`}
                  </Mono>
                );
              })}
              {e.bloqueios.map((b) => {
                const motivo = (b as { motivo?: string; titulo?: string }).motivo
                  ?? (b as { titulo?: string }).titulo
                  ?? b.tipo;
                return (
                  <Mono
                    key={String(b.id)}
                    style={{
                      fontSize: isMobile ? 9 : 10,
                      padding: isMobile ? '1px 3px' : '2px 4px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: 'var(--bg-alt)',
                      color: 'var(--ink-3)',
                      borderLeft: '2px solid var(--ink-3)',
                    }}
                  >
                    {motivo.length > truncCell ? `${motivo.slice(0, truncCell)}…` : motivo}
                  </Mono>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Modal · criar atividade pra bloquear o dia ----------------------------

function BloqueioFormModal({
  iso,
  onSalvar,
  onFechar,
}: {
  iso: string;
  onSalvar: (b: Bloco) => void;
  onFechar: () => void;
}) {
  const isMobile = useIsMobile();
  const [tipo, setTipo] = useState<TipoAtividade>('bloqueio');
  const [motivo, setMotivo] = useState('');
  const [horaInicio, setHoraInicio] = useState(8);
  const [duracao, setDuracao] = useState(2);

  function salvar() {
    const id = `act-${Date.now()}`;
    const base = { id, data: iso, horaInicio, duracao };
    let bloco: Bloco;
    if (tipo === 'sono') bloco = { ...base, tipo: 'sono' };
    else if (tipo === 'bloqueio') bloco = { ...base, tipo: 'bloqueio', motivo: motivo || 'bloqueado' };
    else if (tipo === 'consulta') bloco = { ...base, tipo: 'consulta', detalhe: motivo || 'consulta' };
    else if (tipo === 'estudo') bloco = { ...base, tipo: 'estudo', subtipo: motivo || undefined };
    else if (tipo === 'pessoal') bloco = { ...base, tipo: 'pessoal', titulo: motivo || 'pessoal' };
    else bloco = { ...base, tipo: 'outros', titulo: motivo || 'compromisso' };
    onSalvar(bloco);
    onFechar();
  }

  return (
    <Modal onFechar={onFechar}>
      <Eyebrow>{capitalize(diaSemanaBRLong(iso))}</Eyebrow>
      <h3 style={{ font: '500 22px/1.2 var(--font-display)', margin: '4px 0 0', color: 'var(--ink)' }}>
        {fmtDate(iso)}
      </h3>

      <Field label="tipo">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAtividade)} style={inputBase}>
          {TIPOS_ATIVIDADE.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={tipo === 'sono' ? 'observação (opcional)' : 'motivo / título'}>
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="ex: aniversário do filho · consulta clínica · curso"
          style={inputBase}
        />
      </Field>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 10,
        }}
      >
        <Field label="início">
          <input
            type="number"
            min={0}
            max={23.5}
            step={0.5}
            value={horaInicio}
            onChange={(e) => setHoraInicio(parseFloat(e.target.value) || 0)}
            style={inputBase}
          />
        </Field>
        <Field label="duração (h)">
          <input
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            value={duracao}
            onChange={(e) => setDuracao(parseFloat(e.target.value) || 0.5)}
            style={inputBase}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
        <button type="button" onClick={onFechar} style={btnSecundario}>
          cancelar
        </button>
        <button type="button" onClick={salvar} style={btnPrimario}>
          salvar
        </button>
      </div>
    </Modal>
  );
}
