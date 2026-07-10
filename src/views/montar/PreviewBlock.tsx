// Etapa 4 do Montar · preview editável: calendário da proposta, detalhe do dia e totais.

import { useMemo, useState } from 'react';
import type { Bloco, HospitaisMap, Janela, PlantaoSugerido } from '@/types';
import {
  DOWS,
  adicionaDia,
  capitalize,
  diaSemanaBR,
  diaSemanaBRLong,
  fimDoMes,
  fmtDate,
  fmtHora,
  fromISO,
  inicioDaSemana,
  inicioDoMes,
} from '@/lib/data';
import { Eyebrow, Mono } from '@/components/atoms';
import { rotuloTurno } from '@/lib/turno';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { PropostaResultado } from './tipos';
import { Card, Modal, Total, btnPrimario, btnSecundario, inputBase } from './ui';

interface PreviewBlockProps {
  mes: string;
  /** Meta já formatada pra exibição (ex: "R$ 25.000", "~14 plantões (+15%)", "+15%"). */
  metaEfetiva: string | null;
  resultado: PropostaResultado;
  hospitais: HospitaisMap;
  blocos: Bloco[];
  onRemoverPlantao: (id: string) => void;
  onAdicionarPlantao: (data: string, hospitalId: string, janela: Janela) => void;
  onVoltar: () => void;
  onAvancar: () => void;
  onRegerar: () => void;
}

export function PreviewBlock({
  mes,
  metaEfetiva,
  resultado,
  hospitais,
  blocos,
  onRemoverPlantao,
  onAdicionarPlantao,
  onVoltar,
  onAvancar,
  onRegerar,
}: PreviewBlockProps) {
  const isMobile = useIsMobile();
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const totalDuracao = resultado.plantoes.reduce((s, p) => s + p.duracao, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {resultado.justificativa && (
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--lavender-surface)',
            border: '1px solid var(--lavender-ink)',
            borderRadius: 'var(--r-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Eyebrow color="var(--lavender-ink)">por que assim · raciocínio</Eyebrow>
          <p style={{ font: '400 14px/1.6 var(--font-body)', color: 'var(--ink)', margin: 0 }}>
            {resultado.justificativa}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px', gap: isMobile ? 18 : 24, alignItems: 'flex-start' }}>
      <CalendarioProposta
        mes={mes}
        plantoes={resultado.plantoes}
        hospitais={hospitais}
        blocos={blocos}
        diaAberto={diaAberto}
        setDiaAberto={setDiaAberto}
        onRemoverPlantao={onRemoverPlantao}
        onAdicionarPlantao={onAdicionarPlantao}
      />

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card titulo="totais" eyebrow="estimativa">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Total rotulo="plantões" valor={String(resultado.plantoes.length)} />
            <Total rotulo="horas" valor={`${totalDuracao}h`} />
            <Total rotulo="valor estimado" valor={`R$ ${resultado.valorEstimado.toLocaleString('pt-BR')}`} />
            {metaEfetiva !== null && <Total rotulo="meta" valor={metaEfetiva} />}
          </div>
        </Card>

        {resultado.avisos.length > 0 && (
          <Card titulo={`${resultado.avisos.length} aviso(s)`} eyebrow="cuidado">
            <ul style={{ margin: 0, padding: '0 0 0 16px', font: '400 13px/1.45 var(--font-body)', color: 'var(--ink-2)' }}>
              {resultado.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
            {resultado.respostaCrua && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', font: '500 12px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>
                  ver o que recebi
                </summary>
                <pre
                  style={{
                    marginTop: 6,
                    padding: 10,
                    background: 'var(--bg-alt)',
                    border: '1px solid var(--line-2)',
                    borderRadius: 'var(--r-sm)',
                    font: '400 11px/1.5 var(--font-mono)',
                    color: 'var(--ink-2)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {resultado.respostaCrua}
                </pre>
              </details>
            )}
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onAvancar} style={btnPrimario}>
            avançar pra exportar
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onVoltar} style={{ ...btnSecundario, flex: 1 }}>
              voltar
            </button>
            <button type="button" onClick={onRegerar} style={{ ...btnSecundario, flex: 1 }}>
              regerar
            </button>
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}

// --- Calendário do preview --------------------------------------------------

interface CalendarioPropostaProps {
  mes: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  blocos: Bloco[];
  diaAberto: string | null;
  setDiaAberto: (d: string | null) => void;
  onRemoverPlantao: (id: string) => void;
  onAdicionarPlantao: (data: string, hospitalId: string, janela: Janela) => void;
}

function CalendarioProposta({
  mes,
  plantoes,
  hospitais,
  blocos,
  diaAberto,
  setDiaAberto,
  onRemoverPlantao,
  onAdicionarPlantao,
}: CalendarioPropostaProps) {
  const isMobile = useIsMobile();
  const dias = useMemo(() => listarDiasDoMes(mes), [mes]);

  const porDia = useMemo(() => {
    const m = new Map<string, PlantaoSugerido[]>();
    for (const p of plantoes) {
      const arr = m.get(p.data) ?? [];
      arr.push(p);
      m.set(p.data, arr);
    }
    return m;
  }, [plantoes]);

  const bloqueiosPorDia = useMemo(() => {
    const m = new Map<string, Bloco[]>();
    for (const b of blocos) {
      if (b.tipo === 'plantao' || b.tipo === 'cedido') continue;
      if (!b.data.startsWith(mes)) continue;
      const arr = m.get(b.data) ?? [];
      arr.push(b);
      m.set(b.data, arr);
    }
    return m;
  }, [blocos, mes]);

  const gap = isMobile ? 2 : 4;
  const padCell = isMobile ? 4 : 8;
  const minH = isMobile ? 64 : 88;
  const padPad = isMobile ? '14px 12px' : '20px 22px';
  const truncCell = isMobile ? 6 : 12;
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: padPad,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap, marginBottom: 8 }}>
        {DOWS.map((d) => (
          <Mono key={d} style={{ color: 'var(--ink-3)', textAlign: 'center', fontSize: 11 }}>
            {d}
          </Mono>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap }}>
        {dias.map((iso) => {
          const dataMes = iso.startsWith(mes);
          const lista = porDia.get(iso) ?? [];
          return (
            <button
              key={iso}
              type="button"
              onClick={() => dataMes && setDiaAberto(iso)}
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
              <span style={{ font: '600 12px/1 var(--font-body)', color: dataMes ? 'var(--ink-2)' : 'var(--ink-3)' }}>
                {fromISO(iso).getDate()}
              </span>
              {(bloqueiosPorDia.get(iso) ?? []).map((b) => {
                const motivo = (b as { motivo?: string; titulo?: string; detalhe?: string }).motivo
                  ?? (b as { titulo?: string }).titulo
                  ?? (b as { detalhe?: string }).detalhe
                  ?? b.tipo;
                return (
                  <div
                    key={String(b.id)}
                    style={{
                      padding: isMobile ? '1px 4px' : '3px 6px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: 'var(--bg-alt)',
                      borderLeft: '2px solid var(--ink-3)',
                      font: `500 ${isMobile ? 9 : 10}px/1.2 var(--font-mono)`,
                      color: 'var(--ink-3)',
                    }}
                    title={`${b.tipo} · ${fmtHora(b.horaInicio)}-${fmtHora((b.horaInicio + b.duracao) % 24)}`}
                  >
                    {motivo.length > truncCell ? `${motivo.slice(0, truncCell)}…` : motivo}
                  </div>
                );
              })}
              {lista.map((p) => {
                const h = hospitais[p.hospitalId];
                const cor = h?.cor ?? 'sand';
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: isMobile ? '1px 4px' : '3px 6px',
                      borderRadius: 'var(--r-xs, 4px)',
                      background: `var(--${cor}-surface)`,
                      borderLeft: `2px solid var(--${cor}-ink)`,
                      font: `500 ${isMobile ? 10 : 11}px/1.2 var(--font-mono)`,
                      color: `var(--${cor}-ink)`,
                    }}
                  >
                    {isMobile ? (h?.abrev ?? '?') : `${h?.abrev ?? '?'} · ${rotuloTurno(p.horaInicio, p.duracao, h) ?? fmtHora(p.horaInicio)}`}
                  </div>
                );
              })}
            </button>
          );
        })}
      </div>

      {diaAberto && (
        <DetalheDia
          iso={diaAberto}
          plantoes={porDia.get(diaAberto) ?? []}
          hospitais={hospitais}
          onFechar={() => setDiaAberto(null)}
          onRemover={onRemoverPlantao}
          onAdicionar={(hospitalId, janela) => onAdicionarPlantao(diaAberto, hospitalId, janela)}
        />
      )}
    </div>
  );
}

// --- Detalhe do dia (preview · adicionar/remover plantão) -------------------

function DetalheDia({
  iso,
  plantoes,
  hospitais,
  onFechar,
  onRemover,
  onAdicionar,
}: {
  iso: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  onFechar: () => void;
  onRemover: (id: string) => void;
  onAdicionar: (hospitalId: string, janela: Janela) => void;
}) {
  const isMobile = useIsMobile();
  const [adicionando, setAdicionando] = useState(false);
  const lista = Object.values(hospitais);
  const [hospitalEsc, setHospitalEsc] = useState<string>(lista[0]?.id ?? '');
  const hospital = hospitais[hospitalEsc];
  const janelas: Janela[] = hospital?.janelas ?? [
    { rotulo: 'manhã', inicio: 7, duracao: 6 },
    { rotulo: 'tarde', inicio: 13, duracao: 6 },
    { rotulo: 'noite', inicio: 19, duracao: 12 },
  ];

  return (
    <Modal onFechar={onFechar}>
      <Eyebrow>{capitalize(diaSemanaBRLong(iso))}</Eyebrow>
      <h3 style={{ font: '500 22px/1.2 var(--font-display)', margin: '4px 0 0', color: 'var(--ink)' }}>
        {fmtDate(iso)}
      </h3>

      {plantoes.length === 0 ? (
        <Mono style={{ color: 'var(--ink-3)' }}>nenhum plantão · adicionar?</Mono>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plantoes.map((p) => {
            const h = hospitais[p.hospitalId];
            const cor = h?.cor ?? 'sand';
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: `var(--${cor}-surface)`,
                  borderLeft: `3px solid var(--${cor}-ink)`,
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ font: '500 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>
                    {h?.abrev ?? '?'} · {rotuloTurno(p.horaInicio, p.duracao, h) ?? `${fmtHora(p.horaInicio)} → ${fmtHora((p.horaInicio + p.duracao) % 24)}`}
                  </span>
                  <Mono style={{ color: 'var(--ink-2)', fontSize: 11 }}>
                    {p.duracao}h
                  </Mono>
                  {p.razao && (
                    <Mono style={{ color: 'var(--ink-3)', fontSize: 11, marginTop: 2 }}>{p.razao}</Mono>
                  )}
                </div>
                <button type="button" onClick={() => onRemover(p.id)} style={btnXStyle(isMobile)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!adicionando ? (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px dashed var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: 'pointer',
            font: '500 13px/1 var(--font-body)',
          }}
        >
          + adicionar plantão
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '12px 14px',
            border: '1px solid var(--line-2)',
            borderRadius: 'var(--r-md)',
            background: 'var(--bg-alt)',
          }}
        >
          <Eyebrow>novo plantão</Eyebrow>
          <select value={hospitalEsc} onChange={(e) => setHospitalEsc(e.target.value)} style={inputBase}>
            {lista.map((h) => (
              <option key={h.id} value={h.id}>
                {h.abrev} · {h.nome}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {janelas.map((j) => (
              <button
                key={j.rotulo}
                type="button"
                onClick={() => {
                  onAdicionar(hospitalEsc, j);
                  setAdicionando(false);
                }}
                style={{
                  font: '500 12px/1 var(--font-body)',
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: 'var(--bg)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {j.rotulo} · {fmtHora(j.inicio)} ({j.duracao}h)
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={onFechar} style={{ ...btnSecundario, alignSelf: 'flex-end' }}>
        fechar
      </button>
    </Modal>
  );
}

// exportado porque BloqueiosCard usa o mesmo grid de dias
export function listarDiasDoMes(mes: string): string[] {
  const ini = inicioDaSemana(inicioDoMes(`${mes}-01`));
  const fim = fimDoMes(`${mes}-01`);
  const out: string[] = [];
  let cursor = ini;
  while (cursor <= fim || diaSemanaBR(cursor) !== 0) {
    out.push(cursor);
    cursor = adicionaDia(cursor, 1);
    if (out.length > 42) break;
  }
  return out;
}

function btnXStyle(isMobile: boolean): React.CSSProperties {
  const size = isMobile ? 44 : 28;
  return {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 999,
    border: '1px solid var(--coral-ink)',
    background: 'transparent',
    color: 'var(--coral-ink)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
