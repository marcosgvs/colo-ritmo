import { useEffect, useState, type ChangeEvent } from 'react';
import type { Bloco, BlocoPlantao, CelulaEscala, HospitaisMap, Janela } from '@/types';
import {
  fmtDate,
  fmtRange,
  gerarICS,
  toISO,
} from '@/lib/data';
import {
  eventoParaPlantao,
  listarCalendarios,
  listarEventos,
  type CalendarListItem,
} from '@/lib/gcal';
import { supabase } from '@/lib/supabase';
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

type Estado = 'parado' | 'lendo' | 'enviando' | 'pronto' | 'erro' | 'completou';

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
  // Guarda o PDF em memória pra permitir "rodar de novo" caso o user
  // tenha errado o mês (sem precisar fazer upload de novo).
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfNome, setPdfNome] = useState<string | null>(null);
  const [qtdImportada, setQtdImportada] = useState(0);

  // Estado da importação via Google Calendar.
  // gcalCalendars=null indica "ainda não carregou" (ou sem conexão).
  const [gcalCalendars, setGcalCalendars] = useState<CalendarListItem[] | null>(null);
  const [gcalSelectedId, setGcalSelectedId] = useState<string>('');
  const [gcalMeses, setGcalMeses] = useState<number>(3);
  const [gcalBuscando, setGcalBuscando] = useState(false);
  const [gcalErro, setGcalErro] = useState<string | null>(null);

  const apelidoOk = apelidoNaEscala.trim().length > 0;

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

  async function processarPdf(base64: string) {
    if (!hospitalId || !apelidoOk) return;
    if (!nomeUser) {
      setErro('cadastre seu nome em "usuário" antes · preciso pra achar você na escala');
      setEstado('erro');
      return;
    }
    setEstado('enviando');
    setErro(null);
    try {
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
          apelidoNaEscala: apelidoNaEscala.trim(),
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
      setVariantesSelecionadas(
        variantes.length === 1 ? new Set([variantes[0]!.nome]) : new Set(),
      );
      setEstado('pronto');
    } catch (err) {
      setErro((err as Error).message);
      setEstado('erro');
    }
  }

  async function onPdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !hospitalId) return;
    if (file.size > 20 * 1024 * 1024) {
      setErro('arquivo > 20mb · pode ser uma escala muito grande?');
      setEstado('erro');
      return;
    }
    if (!apelidoOk) {
      setErro('precisa preencher "seu nome na escala" antes · é como o chefe te chama no pdf');
      setEstado('erro');
      e.target.value = '';
      return;
    }
    setEstado('lendo');
    setErro(null);
    try {
      const base64 = await fileToBase64(file);
      setPdfBase64(base64);
      setPdfNome(file.name);
      await processarPdf(base64);
    } catch (err) {
      setErro((err as Error).message);
      setEstado('erro');
    } finally {
      e.target.value = '';
    }
  }

  async function rodarDeNovo() {
    if (!pdfBase64) return;
    await processarPdf(pdfBase64);
  }

  /**
   * Busca a lista de calendários acessíveis pela conta Google conectada.
   * Roda no mount · se o user não tiver provider_token, fica em null e
   * a UI mostra "conecta o google calendar primeiro" no card.
   */
  useEffect(() => {
    let cancel = false;
    async function carregar(): Promise<void> {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.provider_token;
      if (!token) {
        if (!cancel) setGcalCalendars(null);
        return;
      }
      const r = await listarCalendarios(token);
      if (cancel) return;
      if (!r.ok) {
        setGcalCalendars([]);
        setGcalErro(r.erro);
        return;
      }
      setGcalCalendars(r.valor);
      // Default: calendário primário, ou primeiro da lista.
      const primario = r.valor.find((c) => c.primary)?.id ?? r.valor[0]?.id ?? '';
      setGcalSelectedId(primario);
    }
    void carregar();
    return () => {
      cancel = true;
    };
  }, []);

  async function buscarDoGoogle(): Promise<void> {
    if (!hospitalId || !gcalSelectedId) return;
    setGcalErro(null);
    setGcalBuscando(true);
    try {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.provider_token;
      if (!token) {
        setGcalErro('sessão do google expirou · entra de novo em "você"');
        return;
      }
      const agora = new Date();
      const fim = new Date(agora);
      fim.setMonth(fim.getMonth() + gcalMeses);
      const r = await listarEventos(token, gcalSelectedId, agora.toISOString(), fim.toISOString());
      if (!r.ok) {
        setGcalErro(r.erro);
        return;
      }
      const plantoes: BlocoPlantao[] = [];
      const avisos: string[] = [];
      for (const evt of r.valor) {
        const b = eventoParaPlantao(evt, hospitalId);
        if (b) plantoes.push(b);
        else if (evt.summary) avisos.push(`pulei "${evt.summary}" · sem horário ou maior que 24h`);
      }
      if (plantoes.length === 0) {
        setGcalErro('nenhum evento com horário no período · talvez o calendário só tenha all-day');
        return;
      }
      setResultado({ blocos: plantoes, variantes: [], janelas: [], avisos, origem: 'ics' });
      setVariantesSelecionadas(new Set());
      setEstado('pronto');
    } finally {
      setGcalBuscando(false);
    }
  }

  function confirmarImport() {
    if (!resultado || !podeConfirmar) return;
    const qtd = blocosVisiveis.length;
    if (resultado.origem === 'pdf' && onAplicarEscala) {
      const apelidoSalvo =
        resultado.variantes.length > 1
          ? Array.from(variantesSelecionadas)[0] ?? apelidoNaEscala.trim()
          : apelidoNaEscala.trim();
      onAplicarEscala({
        hospitalId,
        mesISO: mes,
        blocos: blocosVisiveis,
        janelas: resultado.janelas,
        celulas: resultado.celulas,
        apelidoUsado: apelidoSalvo || undefined,
      });
    } else {
      onAdicionarBlocos(blocosVisiveis);
    }
    setResultado(null);
    setVariantesSelecionadas(new Set());
    setPdfBase64(null);
    setPdfNome(null);
    setQtdImportada(qtd);
    setEstado('completou');
    setTimeout(() => {
      setEstado('parado');
      setQtdImportada(0);
    }, 2600);
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

      {estado === 'completou' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 18,
            padding: '14px 18px',
            background: 'var(--sage-surface)',
            borderLeft: '3px solid var(--sage-ink)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: 'var(--sage-ink)',
              color: 'var(--bg)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <Eyebrow color="var(--sage-ink)">completou</Eyebrow>
            <div style={{ font: '500 14px/1.3 var(--font-body)', color: 'var(--ink)', marginTop: 2 }}>
              {qtdImportada === 1
                ? '1 plantão adicionado à sua agenda.'
                : `${qtdImportada} plantões adicionados à sua agenda.`}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 320px',
          gap: isMobile ? 18 : 32,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card titulo="importar pdf da escala" order={1}>
            <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 14px' }}>
              passo linha por linha pra encontrar seus plantões · se algo ficar duvidoso,
              marco como aviso pra você revisar antes de salvar.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 14,
              }}
            >
              <Field label="hospital">
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  style={{ ...inputStyle, width: isMobile ? '100%' : undefined }}
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
                  placeholder="ex: PSilva"
                  required
                  aria-required="true"
                  style={{
                    ...inputStyle,
                    minWidth: isMobile ? 0 : 200,
                    width: isMobile ? '100%' : undefined,
                    borderColor: apelidoOk ? 'var(--line)' : 'var(--coral)',
                  }}
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
                cursor:
                  estado === 'lendo' || estado === 'enviando'
                    ? 'wait'
                    : apelidoOk
                    ? 'pointer'
                    : 'not-allowed',
                opacity: apelidoOk ? 1 : 0.55,
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={onPdf}
                disabled={
                  estado === 'lendo' || estado === 'enviando' || !hospitalId || !apelidoOk
                }
                style={{ display: 'none' }}
              />
              {estado === 'enviando' ? (
                <LoadingFrases frases={FRASES_PDF} fontSize={16} />
              ) : (
                <p style={{ font: '600 16px/1.3 var(--font-body)', color: 'var(--ink)', margin: 0 }}>
                  {estado === 'lendo'
                    ? 'lendo arquivo…'
                    : !apelidoOk
                    ? 'preencha seu nome na escala primeiro'
                    : 'arrasta ou clica pra escolher'}
                </p>
              )}
              <Mono style={{ display: 'block', marginTop: 6, color: 'var(--ink-3)' }}>
                {estado === 'enviando' ? 'isso pode levar alguns segundos' : 'pdf · até 20mb'}
              </Mono>
            </label>
            {pdfBase64 && estado !== 'enviando' && estado !== 'lendo' && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <Mono style={{ color: 'var(--ink-3)' }}>
                  {pdfNome ?? 'pdf carregado'} · pronto pra reprocessar
                </Mono>
                <button
                  type="button"
                  onClick={() => void rodarDeNovo()}
                  disabled={!apelidoOk}
                  style={{
                    font: '600 12px/1 var(--font-body)',
                    padding: '9px 16px',
                    borderRadius: 999,
                    border: '1px solid var(--lavender-ink)',
                    background: 'var(--lavender-surface)',
                    color: 'var(--lavender-ink)',
                    cursor: apelidoOk ? 'pointer' : 'not-allowed',
                    opacity: apelidoOk ? 1 : 0.5,
                  }}
                >
                  começar de novo
                </button>
              </div>
            )}
            {erro && (
              <p style={{ font: '500 13px/1.4 var(--font-body)', color: 'var(--coral-ink)', marginTop: 10 }}>
                {erro}
              </p>
            )}
          </Card>

          <Card titulo="ou puxar do google calendar" eyebrow="usa o gcal conectado" order={3}>
            {gcalCalendars === null ? (
              <Hand color="var(--ink-2)" size={16} style={{ display: 'block' }}>
                conecta o google calendar lá em "você" primeiro · depois volta aqui pra puxar
                eventos como plantões.
              </Hand>
            ) : gcalCalendars.length === 0 ? (
              <Mono style={{ display: 'block', color: 'var(--coral-ink)' }}>
                {gcalErro ?? 'nenhum calendário acessível'}
              </Mono>
            ) : (
              <>
                <Hand color="var(--ink-2)" size={16} style={{ display: 'block', marginBottom: 14 }}>
                  escolhe um calendário · eventos com horário do período viram plantões em{' '}
                  <strong>{hospitais[hospitalId]?.abrev ?? '—'}</strong>.
                </Hand>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Field label="calendário">
                    <select
                      value={gcalSelectedId}
                      onChange={(e) => setGcalSelectedId(e.target.value)}
                      style={{ ...inputStyle, minWidth: isMobile ? 0 : 240, width: isMobile ? '100%' : undefined }}
                    >
                      {gcalCalendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary}
                          {c.primary ? ' (principal)' : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="período">
                    <select
                      value={gcalMeses}
                      onChange={(e) => setGcalMeses(Number(e.target.value))}
                      style={{ ...inputStyle, minWidth: isMobile ? 0 : 160, width: isMobile ? '100%' : undefined }}
                    >
                      <option value={1}>próximo mês</option>
                      <option value={3}>próximos 3 meses</option>
                      <option value={6}>próximos 6 meses</option>
                      <option value={12}>próximos 12 meses</option>
                    </select>
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => void buscarDoGoogle()}
                  disabled={!hospitalId || !gcalSelectedId || gcalBuscando}
                  style={{
                    font: '600 13px/1 var(--font-body)',
                    padding: '11px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    cursor: gcalBuscando ? 'wait' : 'pointer',
                    opacity: !hospitalId || gcalBuscando ? 0.55 : 1,
                  }}
                >
                  {gcalBuscando ? 'buscando…' : 'buscar eventos'}
                </button>
                {gcalErro && (
                  <Mono style={{ display: 'block', marginTop: 10, color: 'var(--coral-ink)' }}>
                    {gcalErro}
                  </Mono>
                )}
              </>
            )}
          </Card>

          {resultado && (
            <Card
              titulo={
                blocosVisiveis.length === 1
                  ? '1 plantão pronto pra somar'
                  : `${blocosVisiveis.length} plantões prontos pra somar`
              }
              eyebrow="revisa antes de salvar"
              order={2}
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
  // mobile · garante que select com nome longo de hospital não estoura
  maxWidth: '100%',
  textOverflow: 'ellipsis',
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
  order,
}: {
  titulo: string;
  eyebrow?: string;
  children: React.ReactNode;
  order?: number;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        padding: isMobile ? '16px 16px' : '20px 22px',
        boxShadow: 'var(--shadow-sm)',
        order,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'baseline',
          gap: isMobile ? 4 : 12,
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
