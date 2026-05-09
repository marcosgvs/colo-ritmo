import { useState, type ChangeEvent } from 'react';
import type { Bloco, BlocoPlantao, HospitaisMap } from '@/types';
import {
  eventoParaBloco,
  fmtDate,
  fmtRange,
  gerarICS,
  parsearICS,
} from '@/lib/data';
import { Eyebrow, Hand, MonthPicker, Mono, Pill } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { PageHead } from './_PageHead';

interface SyncProps {
  blocos: Bloco[];
  hospitais: HospitaisMap;
  onAdicionarBlocos: (b: BlocoPlantao[]) => void;
  /** ICS token público do user · gerado server-side. */
  icsToken?: string | null;
  nomeUser?: string;
}

type Estado = 'parado' | 'lendo' | 'enviando' | 'pronto' | 'erro';

interface Resultado {
  blocos: BlocoPlantao[];
  avisos: string[];
}

export function Sync({ blocos, hospitais, onAdicionarBlocos, icsToken, nomeUser }: SyncProps) {
  const [hospitalId, setHospitalId] = useState<string>(() => Object.keys(hospitais)[0] ?? '');
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [estado, setEstado] = useState<Estado>('parado');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [icsTexto, setIcsTexto] = useState('');

  const linkICS = icsToken ? `${origin()}/api/ics/${icsToken}.ics` : null;

  async function onPdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !hospitalId) return;
    if (file.size > 20 * 1024 * 1024) {
      setErro('arquivo > 20mb · pode ser uma escala muito grande?');
      setEstado('erro');
      return;
    }
    setEstado('lendo');
    setErro(null);
    try {
      const base64 = await fileToBase64(file);
      setEstado('enviando');
      const [ano, mesNum] = mes.split('-').map((v) => parseInt(v, 10));
      const resp = await fetch('/api/extrair-escala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: base64,
          hospitalId,
          ano,
          mes: mesNum,
          nome: nomeUser,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        setErro(`servidor não respondeu bem · ${resp.status}`);
        setEstado('erro');
        console.error('extrair-escala:', txt);
        return;
      }
      const json = (await resp.json()) as Resultado;
      setResultado(json);
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
      setResultado({ blocos, avisos });
      setEstado('pronto');
    } catch (err) {
      setErro((err as Error).message);
      setEstado('erro');
    }
  }

  function confirmarImport() {
    if (!resultado) return;
    onAdicionarBlocos(resultado.blocos);
    setResultado(null);
    setIcsTexto('');
    setEstado('parado');
  }

  function exportarICS() {
    const ics = gerarICS(blocos, hospitais, { nome: nomeUser ?? 'Colo Ritmo' });
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colo-ritmo-${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHead
        eyebrow="sincronizar agenda"
        titulo="trazer e levar plantões."
        hand="solta o pdf da escala ou cola um ics — eu organizo."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 32,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card titulo="importar pdf da escala" eyebrow="claude lê e devolve em json">
            <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 14px' }}>
              o modelo extrai linha por linha · se ele tiver dúvida em alguma, vem como aviso e
              você decide.
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
              <p style={{ font: '600 16px/1.3 var(--font-body)', color: 'var(--ink)', margin: 0 }}>
                {estado === 'enviando'
                  ? 'olhando a escala…'
                  : estado === 'lendo'
                    ? 'lendo arquivo…'
                    : 'arrasta ou clica pra escolher'}
              </p>
              <Mono style={{ display: 'block', marginTop: 6, color: 'var(--ink-3)' }}>
                pdf · até 20mb
              </Mono>
            </label>
            {erro && (
              <p style={{ font: '500 13px/1.4 var(--font-body)', color: 'var(--coral-ink)', marginTop: 10 }}>
                {erro}
              </p>
            )}
          </Card>

          <Card titulo="ou colar um ics" eyebrow="útil pra google · apple">
            <textarea
              value={icsTexto}
              onChange={(e) => setIcsTexto(e.target.value)}
              placeholder="BEGIN:VCALENDAR..."
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
              ler ics
            </button>
          </Card>

          {resultado && (
            <Card
              titulo={
                resultado.blocos.length === 1
                  ? '1 plantão pronto pra somar'
                  : `${resultado.blocos.length} plantões prontos pra somar`
              }
              eyebrow="revisa antes de salvar"
            >
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
                </div>
              )}

              {resultado.blocos.length === 0 ? (
                <EmptyState
                  titulo="nada extraído."
                  recado="às vezes o pdf é uma imagem escaneada ruim · vale tentar outro mês."
                />
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {resultado.blocos.slice(0, 8).map((b) => (
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
                        <Mono style={{ width: 110 }}>{fmtDate(b.data)}</Mono>
                        <Mono>{fmtRange(b.horaInicio, b.duracao)}</Mono>
                        <span style={{ flex: 1 }} />
                        <Pill kind="info">{b.duracao}h</Pill>
                      </div>
                    ))}
                    {resultado.blocos.length > 8 && (
                      <Mono style={{ color: 'var(--ink-3)' }}>
                        + {resultado.blocos.length - 8} blocos
                      </Mono>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={confirmarImport}
                      style={{
                        font: '600 13px/1 var(--font-body)',
                        padding: '12px 20px',
                        borderRadius: 999,
                        border: 'none',
                        background: 'var(--sage-ink)',
                        color: 'var(--bg)',
                        cursor: 'pointer',
                      }}
                    >
                      adicionar {resultado.blocos.length} plantões
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResultado(null);
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
              gera um .ics com sua agenda atual.
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
              baixar .ics agora
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
