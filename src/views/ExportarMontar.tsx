import { useState } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap, LenteProposta, PropostaSalva } from '@/types';
import {
  agruparPorHospital,
  copiarTexto,
  download,
  downloadString,
  fmtMesAnoExtenso,
  montarCSV,
  montarMensagem,
  nomeArquivo,
} from '@/lib/data';
import { gerarPdfMes } from '@/lib/pdfMes';
import { registrarChefe, salvarProposta } from '@/lib/propostas';
import { Eyebrow, Hand, Mono, Pill } from '@/components/atoms';

interface ExportarMontarProps {
  plantoesSugeridos: BlocoPlantao[];
  hospitais: HospitaisMap;
  /** Todos os blocos (pra puxar bloqueios do mês no PDF visual). */
  blocosTodos: Bloco[];
  mesISO: string;
  nomeMedico: string;
  /** Garante um id pra proposta antes de salvar · retorna o id (existente ou novo). */
  onPrimeiraExportacao: () => string;
  propostaAtivaId: string | null;
  dadosProposta: {
    mesISO: string;
    hospitaisIncluidos: string[];
    metaUsada: number;
    bloqueioIds: (string | number)[];
    lente: LenteProposta;
    blocos: BlocoPlantao[];
  };
  propostas: PropostaSalva[];
  onAtualizarPropostas: (lista: PropostaSalva[]) => void;
  onFechar: () => void;
}

interface EstadoChefe {
  [hospId: string]: string;
}

const STORAGE_KEY_CHEFES = 'colo:nomes-chefes';

function carregarNomesChefes(): EstadoChefe {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHEFES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function salvarNomesChefes(map: EstadoChefe) {
  try {
    localStorage.setItem(STORAGE_KEY_CHEFES, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Modal de exportação · uma seção por hospital. Cada hospital tem
 * input do nome do chefe (lembrado entre sessões) e 3 botões: copiar
 * mensagem, baixar PDF, baixar CSV. Cada chefe é um hospital diferente
 * — exportações são individuais.
 */
export function ExportarMontar({
  plantoesSugeridos,
  hospitais,
  blocosTodos,
  mesISO,
  nomeMedico,
  onPrimeiraExportacao,
  propostaAtivaId,
  dadosProposta,
  propostas,
  onAtualizarPropostas,
  onFechar,
}: ExportarMontarProps) {
  const [chefes, setChefes] = useState<EstadoChefe>(carregarNomesChefes());
  const [aviso, setAviso] = useState<string | null>(null);
  const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);
  const grupos = agruparPorHospital(plantoesSugeridos, hospitais);
  void blocosTodos; // mantido na prop pra retrocompat · PDF não usa bloqueios

  function atualizarChefe(hospId: string, nome: string) {
    const novo = { ...chefes, [hospId]: nome };
    setChefes(novo);
    salvarNomesChefes(novo);
  }

  /**
   * Persiste a proposta no histórico. Chamada na primeira exportação de
   * cada formato. Se já existe um id ativo, atualiza; se não, cria.
   * Em seguida registra o nome do chefe (se preenchido).
   */
  function persistirExportacao(hospitalId: string, nomeChefe: string) {
    const id = propostaAtivaId ?? onPrimeiraExportacao();
    const { lista } = salvarProposta(propostas, { ...dadosProposta, id });
    const final = nomeChefe.trim()
      ? registrarChefe(lista, id, hospitalId, nomeChefe.trim())
      : lista;
    onAtualizarPropostas(final);
  }

  function flash(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 2200);
  }

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(58,46,42,0.22)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 20px',
        animation: 'colo-fade-in 180ms ease',
        overflow: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          padding: '28px 32px',
          width: '100%',
          maxWidth: 720,
          boxShadow: 'var(--shadow-lg)',
          animation: 'colo-drawer-down 220ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <Eyebrow>exportar pra cada chefe</Eyebrow>
          <button
            type="button"
            onClick={onFechar}
            aria-label="fechar"
            style={{
              background: 'var(--bg-alt)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: 6,
              cursor: 'pointer',
              color: 'var(--ink-2)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 26,
            letterSpacing: '-0.015em',
            margin: 0,
          }}
        >
          {grupos.length === 1 ? '1 hospital pra mandar' : `${grupos.length} hospitais pra mandar`}
        </h2>
        <Hand color="var(--ink-2)" size={16} style={{ display: 'block', margin: '6px 0 18px' }}>
          {fmtMesAnoExtenso(mesISO)} · cada chefe recebe a sua
        </Hand>

        {grupos.length === 0 && (
          <Mono style={{ color: 'var(--ink-3)' }}>
            sem plantões pra exportar.
          </Mono>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grupos.map(({ hospital, plantoes }) => {
            const chefe = chefes[hospital.id] ?? '';
            return (
              <div
                key={hospital.id}
                style={{
                  background: `var(--${hospital.cor}-surface)`,
                  borderLeft: `4px solid var(--${hospital.cor})`,
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <Eyebrow color={`var(--${hospital.cor}-ink)`}>{hospital.abrev}</Eyebrow>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 500,
                        fontSize: 18,
                        margin: '4px 0 0',
                      }}
                    >
                      {hospital.nome}
                    </p>
                  </div>
                  <Pill kind="ok" dot={false}>
                    {plantoes.length === 1 ? '1 plantão' : `${plantoes.length} plantões`}
                  </Pill>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Eyebrow>nome do chefe (opcional)</Eyebrow>
                  <input
                    value={chefe}
                    onChange={(e) => atualizarChefe(hospital.id, e.target.value)}
                    placeholder="Dr. Roberto Almeida"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      font: '500 14px/1.4 var(--font-body)',
                      color: 'var(--ink)',
                      outline: 'none',
                      width: '100%',
                    }}
                  />
                </label>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const txt = montarMensagem({
                        hospital,
                        plantoes,
                        mesISO,
                        nomeMedico,
                        nomeChefe: chefe.trim() || undefined,
                      });
                      const ok = await copiarTexto(txt);
                      if (ok) persistirExportacao(hospital.id, chefe);
                      flash(ok ? `mensagem do ${hospital.abrev} copiada` : 'falha ao copiar · selecione e copie manual');
                      if (!ok) console.log(txt);
                    }}
                    style={btnPrimario}
                  >
                    copiar mensagem
                  </button>
                  <button
                    type="button"
                    disabled={gerandoPdfId === hospital.id}
                    onClick={async () => {
                      setGerandoPdfId(hospital.id);
                      try {
                        const blob = await gerarPdfMes({
                          hospital,
                          plantoes,
                          mesISO,
                          nomeMedico,
                          nomeChefe: chefe.trim() || undefined,
                        });
                        download(blob, nomeArquivo(hospital, mesISO, 'pdf'));
                        persistirExportacao(hospital.id, chefe);
                        flash(`PDF do ${hospital.abrev} baixado`);
                      } catch (err) {
                        console.error(err);
                        flash('falha ao gerar PDF');
                      } finally {
                        setGerandoPdfId(null);
                      }
                    }}
                    style={{
                      ...btnSecundario,
                      opacity: gerandoPdfId === hospital.id ? 0.6 : 1,
                      cursor: gerandoPdfId === hospital.id ? 'wait' : 'pointer',
                    }}
                  >
                    {gerandoPdfId === hospital.id ? 'gerando…' : 'baixar PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = montarCSV({
                        hospital,
                        plantoes,
                        mesISO,
                        nomeMedico,
                        nomeChefe: chefe.trim() || undefined,
                      });
                      downloadString(csv, nomeArquivo(hospital, mesISO, 'csv'), 'text/csv');
                      persistirExportacao(hospital.id, chefe);
                      flash(`CSV do ${hospital.abrev} baixado`);
                    }}
                    style={btnSecundario}
                  >
                    baixar CSV
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {aviso && (
          <div
            style={{
              marginTop: 18,
              padding: '10px 14px',
              background: 'var(--sage-surface)',
              borderRadius: 'var(--r-md)',
              color: 'var(--sage-ink)',
              font: '500 13px/1.4 var(--font-body)',
            }}
          >
            {aviso}
          </div>
        )}
      </div>
    </div>
  );
}

const btnPrimario: React.CSSProperties = {
  font: '600 13px/1 var(--font-body)',
  padding: '10px 18px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--ink)',
  color: 'var(--bg)',
  cursor: 'pointer',
};

const btnSecundario: React.CSSProperties = {
  font: '600 13px/1 var(--font-body)',
  padding: '10px 18px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};
