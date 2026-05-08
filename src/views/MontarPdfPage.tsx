import type { Bloco, BlocoPlantao, Hospital } from '@/types';
import {
  DOWS_LONG,
  diaSemanaBR,
  fmtHora,
  fmtMesAnoExtenso,
  fromISO,
} from '@/lib/data';
import { ColoMark } from '@/components/atoms';
import { CalendarioMes } from '@/components/calendario';

interface MontarPdfPageProps {
  hospital: Hospital;
  /** Plantões propostos pra esse hospital naquele mês. */
  plantoes: BlocoPlantao[];
  /** Bloqueios da médica nesse mês (aparecem em cinza no calendário). */
  bloqueios: Bloco[];
  mesISO: string;
  nomeMedico: string;
  nomeChefe?: string;
}

const CREAM = '#FFFAF3';
const INK = '#3A2E2A';
const INK_2 = '#65564F';
const INK_3 = '#94847E';

function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDataExtenso(iso: string): string {
  const d = fromISO(iso);
  const dow = capitalizar(DOWS_LONG[diaSemanaBR(iso)] ?? '');
  return `${dow}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtRangeFormal(ini: number, dur: number): string {
  return `${fmtHora(ini)} às ${fmtHora((ini + dur) % 24)}`;
}

function pluralPlantao(n: number): string {
  return n === 1 ? '1 plantão' : `${n} plantões`;
}

function tratamento(nome: string): string {
  const t = nome.trim();
  if (/^dr[a]?\.?\s/i.test(t)) return t;
  return `Dr(a). ${t}`;
}

/**
 * Página A4 estilizada com a identidade Colo Ritmo · usada pra gerar PDF
 * via html2canvas + jspdf. Largura fixa 794px (A4 portrait @96dpi).
 *
 * Layout: logo + título → saudação → calendário visual do mês → tabela
 * detalhada → assinatura → footer. Tudo em Português padrão (saída
 * externa, não usa o sentence-case minúsculo do app).
 */
export function MontarPdfPage({
  hospital,
  plantoes,
  bloqueios,
  mesISO,
  nomeMedico,
  nomeChefe,
}: MontarPdfPageProps) {
  const ordenados = [...plantoes].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
  );
  const cor = hospital.cor;

  return (
    <div
      style={{
        width: 794,
        minHeight: 1123,
        background: CREAM,
        padding: '50px 60px',
        boxSizing: 'border-box',
        color: INK,
        fontFamily: 'var(--font-body)',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `var(--${cor})`,
        }}
      />

      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 28 }}>
        <ColoMark size={56} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              font: '700 10px/1 var(--font-body)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: INK_3,
            }}
          >
            Colo Ritmo · Sugestão de Escala
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 32,
              letterSpacing: '-0.02em',
              margin: '6px 0 4px',
              color: `var(--${cor}-ink)`,
            }}
          >
            {hospital.nome}
          </h1>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: INK_2,
              letterSpacing: '0.02em',
            }}
          >
            {capitalizar(fmtMesAnoExtenso(mesISO))} · {pluralPlantao(ordenados.length)}
          </div>
        </div>
      </header>

      <div
        style={{
          height: 1,
          background: `var(--${cor})`,
          opacity: 0.4,
          marginBottom: 22,
        }}
      />

      <section style={{ marginBottom: 24, fontSize: 13, lineHeight: 1.55 }}>
        <p style={{ margin: '0 0 10px' }}>
          {nomeChefe ? `Prezado(a) ${tratamento(nomeChefe)},` : 'Prezado(a),'}
        </p>
        <p style={{ margin: 0 }}>
          Apresento abaixo a proposta de plantões para{' '}
          <strong>{fmtMesAnoExtenso(mesISO)}</strong> no {hospital.nome}, organizada com base na
          minha disponibilidade e nas regras da instituição. Fico à disposição para ajustes
          conforme a necessidade da escala.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <CalendarioMes
          refIso={`${mesISO}-15`}
          blocos={bloqueios}
          hospitais={{ [hospital.id]: hospital }}
          marcadores={ordenados}
          semSoma
        />
      </section>

      {ordenados.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <div
            style={{
              font: '700 9px/1 var(--font-body)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: INK_3,
              marginBottom: 8,
            }}
          >
            Detalhamento
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
              color: INK_2,
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${INK_3}` }}>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>Data</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>Horário</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>Duração</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>Setor</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((p) => (
                <tr key={String(p.id)} style={{ borderBottom: '1px dashed rgba(58,46,42,0.12)' }}>
                  <td style={{ padding: '6px 4px', color: INK }}>{fmtDataExtenso(p.data)}</td>
                  <td style={{ padding: '6px 4px', fontFamily: 'var(--font-mono)' }}>
                    {fmtRangeFormal(p.horaInicio, p.duracao)}
                  </td>
                  <td style={{ padding: '6px 4px', fontFamily: 'var(--font-mono)' }}>
                    {p.duracao}h
                  </td>
                  <td style={{ padding: '6px 4px' }}>{p.setor || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <p style={{ margin: 0, fontSize: 13 }}>Atenciosamente,</p>
        <p
          style={{
            fontFamily: 'var(--font-handwritten)',
            fontSize: 28,
            color: `var(--${cor}-ink)`,
            margin: '4px 0 0',
            fontWeight: 500,
          }}
        >
          {nomeMedico}
        </p>
      </section>

      <footer
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          bottom: 28,
          font: '400 10px/1.4 var(--font-mono)',
          color: INK_3,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Documento gerado pelo Colo Ritmo</span>
        <span>{new Date().toLocaleDateString('pt-BR')}</span>
      </footer>
    </div>
  );
}
