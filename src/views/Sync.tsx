import { useState, type ChangeEvent } from 'react';
import type { Bloco, BlocoPlantao, CelulaEscala, HospitaisMap, Janela } from '@/types';
import {
  eventoParaBloco,
  fmtDate,
  fmtRange,
  gerarICS,
  parsearICS,
  toISO,
} from '@/lib/data';
import { Eyebrow, Hand, LoadingFrases, MonthPicker, Mono, Pill } from '@/components/atoms';

const FRASES_PDF = [
  'lendo a tabela do chefe',
  'encontrando seu nome',
  'checando os dias um por um',
  'separando os turnos',
  'olhando se virou de mês',
  'validando os plantões encontrados',
  'quase lá',
] as const;
import { EmptyState } from '@/components/empty';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PageHead } from './_PageHead';

interface SyncProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onAdicionarBlocos: (b: BlocoPlantao[]) => void;
  /** Aplicar uma escala importada de PDF · substitui mês×hospital + atualiza janelas + arquiva celulas. */
  onAplicarEscala?: (data: {
    hospitalId: string;
    mesISO: string;
    blocos: BlocoPlantao[];
    janelas: Janela[];
    celulas?: CelulaEscala[];
    apelidoUsado?: string;
  }) => void;
  /** ICS token público do user · gerado server-side. */
  icsToken?: string | null;
  nomeUser?: string;
}

type Estado = 'parado' | 'lendo' | 'enviando' | 'pronto' | 'erro';

interface Variante {
  nome: string;
  count: number;
  blocoIds: Array<string | number>;
}

interface Resultado {
  blocos: BlocoPlantao[];
  janelas: Janela[];
  avisos: string[];
  /** Diferenciamos: ICS = só blocos, PDF = blocos + janelas + celulas */
  origem: 'ics' | 'pdf';
  /** Variantes de nome que bateram no fuzzy · vazio ou 1 = sem ambiguidade. */
  variantes: Variante[];
  /** Transcrição completa do PDF · só vem em import de PDF. */
  celulas?: CelulaEscala[];
  /** Texto bruto que o modelo devolveu quando não conseguimos organizar a resposta. */
  respostaCrua?: string;
}

export function Sync({ blocos, hospitais, onAdicionarBlocos, onAplicarEscala, icsToken, nomeUser }: SyncProps) {
  const isMobile = useIsMobile();
  const [hospitalId, setHospitalId] = useState<string>(() => Object.keys(hospitais)[0] ?? '');
  const [apelidoNaEscala, setApelidoNaEscala] = useState('');
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [estado, setEstado] = useState<Estado>('parado');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [variantesSelecionadas, setVariantesSelecionadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [icsTexto, setIcsTexto] = useState('');

  // Quando há ambiguidade (>1 variante), filtra os blocos pelas variantes
  // selecionadas pela usuária. Quando só tem 1 variante (ou ICS), mostra
  // todos os blocos diretamente.
  const blocosVisiveis: BlocoPlantao[] = (() => {
    if (!resultado) return [];
    if (resultado.variantes.length <= 1) return resultado.blocos;
    const idsOk = new Set<string | number>();
    for (const v of resultado.variantes) {
      if (variantesSelecionadas.has(v.nome)) {
        v.blocoIds.forEach((id) => idsOk.add(id));
      }
    }
    return resultado.blocos.filter((b) => idsOk.has(b.id));
  })();

  const precisaConfirmarVariante = !!resultado && resultado.variantes.length > 1;
  const podeConfirmar = blocosVisiveis.length > 0;

  function toggleVariante(nome: string) {
    setVariantesSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }

  const linkICS = icsToken ? `${origin()}/api/ics/${icsToken}.ics` : null;

  async function onPdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !hospitalId) return;
    if (file.size > 20 * 1024 * 1024) {
      setErro('arquivo > 20mb · pode ser uma escala muito grande?');
      setEstado('erro');
      return;
    }
    if (!nomeUser) {
      setErro('cadastre seu nome em "usuário" antes · preciso pra achar você na escala');
      setEstado('erro');
      return;
    }
    setEstado('lendo');
    setErro(null);
    try {
      const base64 = await fileToBase64(file);
      setEstado('enviando');
      const [ano, mesNum] = mes.split('-').map((v) => parseInt(v, 10));
      const hospital = hospitais[hospitalId];
      const resp = await fetch('/api/extrair-escala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64,
          hospitalId,
          hospitalAbrev: hospital?.abrev ?? hospitalId,
          ano,
          mes: mesNum,
          nome: nomeUser,
          apelidoNaEscala: apelidoNaEscala.trim() || undefined,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        setErro(`servidor não respondeu bem · ${resp.status}`);
        setEstado('erro');
        console.error('extrair-escala:', txt);
        return;
      }
      const json = (await resp.json()) as {
        blocos: BlocoPlantao[];
        variantes?: Variante[];
        janelas?: Janela[];
        celulas?: CelulaEscala[];
        avisos?: string[];
        respostaCrua?: string;
      };
      const variantes = json.variantes ?? [];
      setResultado({
        blocos: json.blocos,
        variantes,
        janelas: json.janelas ?? [],
        avisos: json.avisos ?? [],
        origem: 'pdf',
        celulas: json.celulas,
        respostaCrua: json.respostaCrua,
      });
      // Múltiplas variantes · força escolha consciente · começa nenhuma marcada.
      // 1 variante · marca automático pra simplificar.
      setVariantesSelecionadas(
        variantes.length === 1 ? new Set([variantes[0]!.nome]) : new Set(),
      );
      setEstado('pronto');
    } catch (err) {
      setErro((err as Error).message);
      setEstado('erro');
    } finally {
      e.target.value = '';
    }
  }

  function importarICSColado() {
    if (!hospitalId || !icsTexto.trim()) return;
    try {
      const eventos = parsearICS(icsTexto);
      const blocos: BlocoPlantao[] = [];
      const avisos: string[] = [];
      eventos.forEach((evt, i) => {
        const b = eventoParaBloco(evt, {
          id: `ics-${Date.now()}-${i}`,
          hospitalId,
        });
        if (b) blocos.push(b);
        else avisos.push(`evento sem início/fim · pulei (${evt.summary ?? evt.uid})`);
      });
      setResultado({ blocos, variantes: [], janelas: [], avisos, origem: 'ics' });
      setVariantesSelecionadas(new Set());
      setEstado('pronto');
    } catch (err) {
      setErro((err as Error).message);
      setEstado('erro');
    }
  }

  function confirmarImport() {
    if (!resultado || !podeConfirmar) return;
    if (resultado.origem === 'pdf' && onAplicarEscala) {
      // Apelido confirmado · se houver ambiguidade, salva a primeira variante
      // selecionada como apelidoUsado (próximos imports do mesmo hospital
      // podem reusar).
      const apelidoSalvo =
        resultado.variantes.length > 1
          ? Array.from(variantesSelecionadas)[0] ?? apelidoNaEscala.trim()
          : apelidoNaEscala.trim();

      // PDF · substitui mês×hospital + atualiza janelas + arquiva transcrição
      onAplicarEscala({
        hospitalId,
        mesISO: mes,
        blocos: blocosVisiveis,
        janelas: resultado.janelas,
        celulas: resultado.celulas,
        apelidoUsado: apelidoSalvo || undefined,
      });
    } else {
      // ICS · só adiciona blocos
      onAdicionarBlocos(blocosVisiveis);
    }
    setResultado(null);
    setVariantesSelecionadas(new Set());
    setIcsTexto('');
    setEstado('parado');
  }

  function exportarICS() {
    const ics = gerarICS(blocos, hospitais, { nome: nomeUser ?? 'Colo Ritmo' });
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colo-ritmo-${toISO(new Date())}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHead
        eyebrow="sincronizar agenda"
        titulo="trazer e levar plantões."
        hand="solta o pdf da escala ou cola de outro calendário — eu organizo."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px',
          gap: isMobile ? 18 : 32,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card titulo="importar pdf da escala">
            <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 14px' }}>
              passo linha por linha pra encontrar seus plantões · se algo ficar duvidoso,
              marco como aviso pra você revisar antes de salvar.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <Field label="hospital">
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  style={inputStyle}
                >
                  {Object.values(hospitais).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.abrev} · {h.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="seu nome na escala">
                <input
                  type="text"
                  value={apelidoNaEscala}
                  onChange={(e) => setApelidoNaEscala(e.target.value)}
                  placeholder="ex: Mpinheiro"
                  style={{ ...inputStyle, minWidth: 200 }}
                />
              </Field>
              <Field label="mês">
                <MonthPicker value={mes} onChange={setMes} />
              </Field>
            </div>

            <label
              style={{
                display: 'block',
                border: '2px dashed var(--line-2)',
                borderRadius: 'var(--r-md)',
                padding: '32px 24px',
                background: 'var(--bg-alt)',
                textAlign: 'center',
                cursor: estado === 'lendo' || estado === 'enviando' ? 'wait' : 'pointer',
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={onPdf}
                disabled={estado === 'lendo' || estado === 'enviando' || !hospitalId}
                style={{ display: 'none' }}
              />
              {estado === 'enviando' ? (
                <LoadingFrases frases={FRASES_PDF} fontSize={16} />
              ) : (
                <p style={{ font: '600 16px/1.3 var(--font-body)', color: 'var(--ink)', margin: 0 }}>
                  {estado === 'lendo' ? 'lendo arquivo…' : 'arrasta ou clica pra escolher'}
                </p>
              )}
              <Mono style={{ display: 'block', marginTop: 6, color: 'var(--ink-3)' }}>
                {estado === 'enviando' ? 'isso pode levar alguns segundos' : 'pdf · até 20mb'}
              </Mono>
            </label>
            {erro && (
              <p style={{ font: '500 13px/1.4 var(--font-body)', color: 'var(--coral-ink)', marginTop: 10 }}>
                {erro}
              </p>
            )}
          </Card>

          <Card titulo="ou colar de outro calendário" eyebrow="útil pra google · apple">
            <textarea
              value={icsTexto}
              onChange={(e) => setIcsTexto(e.target.value)}
              placeholder="cole aqui o conteúdo que veio de outro calendário"
              rows={5}
              style={{
                ...inputStyle,
                width: '100%',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                resize: 'vertical',
              }}
            />
            <button
              type="button"
              onClick={importarICSColado}
              disabled={!icsTexto.trim() || !hospitalId}
              style={{
                marginTop: 12,
                font: '600 13px/1 var(--font-body)',
                padding: '11px 18px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--ink)',
                color: 'var(--bg)',
                cursor: 'pointer',
                opacity: !icsTexto.trim() || !hospitalId ? 0.5 : 1,
              }}
            >
              importar
            </button>
          </Card>

          {resultado && (
            <Card
              titulo={
                blocosVisiveis.length === 1
                  ? '1 plantão pronto pra somar'
                  : `${blocosVisiveis.length} plantões prontos pra somar`
              }
              eyebrow="revisa antes de salvar"
            >
              {precisaConfirmarVariante && (
                <div
                  style={{
                    background: 'var(--lavender-surface)',
                    border: '1px solid var(--lavender-ink)',
                    borderRadius: 'var(--r-md)',
                    padding: '14px 16px',
                    marginBottom: 14,
                  }}
                >
                  <Eyebrow color="var(--lavender-ink)">
                    achei {resultado.variantes.length} nomes parecidos · qual(is) é você?
                  </Eyebrow>
                  <Mono style={{ display: 'block', marginTop: 6, color: 'var(--ink-3)' }}>
                    o chefe pode usar mais de uma grafia no mesmo mês · marque uma ou mais
                  </Mono>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                    {resultado.variantes.map((v) => {
                      const ativo = variantesSelecionadas.has(v.nome);
                      return (
                        <label
                          key={v.nome}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: isMobile ? '14px 14px' : '10px 12px',
                            minHeight: isMobile ? 48 : undefined,
                            borderRadius: 'var(--r-sm)',
                            border: ativo ? '1px solid var(--lavender-ink)' : '1px solid var(--line)',
                            background: ativo ? 'var(--bg)' : 'transparent',
                            cursor: 'pointer',
                            font: '500 13px/1.2 var(--font-body)',
                            color: 'var(--ink)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={ativo}
                            onChange={() => toggleVariante(v.nome)}
                            style={isMobile ? { width: 20, height: 20 } : undefined}
                          />
                          <span style={{ flex: 1 }}>{v.nome}</span>
                          <Mono style={{ color: 'var(--ink-3)' }}>
                            {v.count} {v.count === 1 ? 'plantão' : 'plantões'}
                          </Mono>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {resultado.avisos.length > 0 && (
                <div
                  style={{
                    background: 'var(--sand-surface)',
                    borderLeft: '3px solid var(--sand-ink)',
                    padding: '10px 14px',
                    borderRadius: 'var(--r-sm)',
                    marginBottom: 14,
                  }}
                >
                  <Eyebrow color="#B8884A">{resultado.avisos.length} aviso(s)</Eyebrow>
                  <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
                    {resultado.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  {resultado.respostaCrua && (
                    <details style={{ marginTop: 10 }}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          font: '500 12px/1.4 var(--font-body)',
                          color: 'var(--ink-3)',
                        }}
                      >
                        ver o que recebi
                      </summary>
                      <pre
                        style={{
                          marginTop: 6,
                          padding: 10,
                          background: 'var(--bg)',
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
                </div>
              )}

              {resultado.blocos.length === 0 ? (
                <EmptyState
                  titulo="nada extraído."
                  recado="às vezes o pdf é uma imagem escaneada ruim · vale tentar outro mês."
                />
              ) : (
                <>
                  {blocosVisiveis.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        marginBottom: 14,
                        maxHeight: 380,
                        overflowY: 'auto',
                      }}
                    >
                      {blocosVisiveis
                        .slice()
                        .sort(
                          (a, b) =>
                            a.data.localeCompare(b.data) || a.horaInicio - b.horaInicio,
                        )
                        .map((b) => (
                          <div
                            key={String(b.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 12px',
                              background: 'var(--bg-alt)',
                              borderRadius: 'var(--r-sm)',
                            }}
                          >
                            <Mono style={{ width: 130 }}>{fmtDate(b.data)}</Mono>
                            <Mono>{fmtRange(b.horaInicio, b.duracao)}</Mono>
                            <span style={{ flex: 1 }} />
                            <Pill kind="info">{b.duracao}h</Pill>
                            <button
                              type="button"
                              onClick={() =>
                                setResultado((r) =>
                                  r
                                    ? { ...r, blocos: r.blocos.filter((x) => x.id !== b.id) }
                                    : r,
                                )
                              }
                              aria-label="remover deste import"
                              title="remover deste import"
                              style={{
                                width: isMobile ? 44 : 28,
                                height: isMobile ? 44 : 28,
                                flexShrink: 0,
                                borderRadius: 999,
                                border: '1px solid var(--coral-ink)',
                                background: 'transparent',
                                color: 'var(--coral-ink)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              >
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : precisaConfirmarVariante ? (
                    <p
                      style={{
                        font: '400 13px/1.5 var(--font-body)',
                        color: 'var(--ink-3)',
                        margin: '0 0 14px',
                      }}
                    >
                      marque pelo menos um nome acima pra ver os plantões correspondentes.
                    </p>
                  ) : null}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={confirmarImport}
                      disabled={!podeConfirmar}
                      style={{
                        font: '600 13px/1 var(--font-body)',
                        padding: '12px 20px',
                        borderRadius: 999,
                        border: 'none',
                        background: 'var(--sage-ink)',
                        color: 'var(--bg)',
                        cursor: !podeConfirmar ? 'not-allowed' : 'pointer',
                        opacity: !podeConfirmar ? 0.5 : 1,
                      }}
                    >
                      adicionar {blocosVisiveis.length}{' '}
                      {blocosVisiveis.length === 1 ? 'plantão' : 'plantões'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResultado(null);
                        setVariantesSelecionadas(new Set());
                        setEstado('parado');
                      }}
                      style={{
                        font: '600 13px/1 var(--font-body)',
                        padding: '12px 20px',
                        borderRadius: 999,
                        border: '1px solid var(--line)',
                        background: 'transparent',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                      }}
                    >
                      descartar
                    </button>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card titulo="exportar" eyebrow="google · apple">
            <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 12px' }}>
              baixa um arquivo de calendário com sua agenda atual.
            </p>
            <button
              type="button"
              onClick={exportarICS}
              style={{
                font: '600 13px/1 var(--font-body)',
                padding: '11px 18px',
                borderRadius: 999,
                border: '1px solid var(--line)',
                background: 'transparent',
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              baixar agora
            </button>
            {linkICS && (
              <>
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: '1px dashed var(--line-2)',
                  }}
                >
                  <Eyebrow>link sincronizado</Eyebrow>
                  <p style={{ font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '6px 0 8px' }}>
                    cole no google calendar pra atualizar sozinho.
                  </p>
                  <input
                    readOnly
                    value={linkICS}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  />
                </div>
              </>
            )}
            <Hand color="var(--ink-3)" size={15} style={{ display: 'block', marginTop: 14 }}>
              o link não expira sozinho · revoga em "usuário"
            </Hand>
          </Card>
        </aside>
      </div>
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = String(r.result);
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = () => reject(r.error ?? new Error('falha ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

function origin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: '500 13px/1.3 var(--font-body)',
  color: 'var(--ink)',
  outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}

function Card({
  titulo,
  eyebrow,
  children,
}: {
  titulo: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: '20px 22px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18 }}>
          {titulo}
        </span>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      </div>
      {children}
    </div>
  );
}
