import { useMemo, useState } from 'react';
import { Eyebrow, Mono, Pill, type PillKind } from '@/components/atoms';
import { EmptyState } from '@/components/empty';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  useListaMaite,
  type ItemMaite,
  type NovoItemMaite,
  type PontoPreco,
  type StatusMaite,
} from '@/hooks/useListaMaite';
import { authHeader } from '@/lib/supabase';
import { PageHead } from './_PageHead';

/**
 * Maite · lista de desejos da Maitê com radar de preço.
 *
 * Cola o link da loja → o app extrai nome/preço/foto → o radar revisita
 * 2x ao dia e avisa (push + sino) quando o preço cruza o alvo.
 * Lista compartilhada do casal (tabelas maite_*, não user_state).
 */

const BLACK_FRIDAY = '2026-11-28';

const STATUS_LABEL: Record<StatusMaite, string> = {
  pesquisando: 'pesquisando',
  esperando_bf: 'esperando black friday',
  comprar_agora: 'comprar agora',
  comprado: 'comprado',
  presente: 'ganhamos de presente',
};

const STATUS_KIND: Record<StatusMaite, PillKind> = {
  pesquisando: 'neutral',
  esperando_bf: 'warn',
  comprar_agora: 'ok',
  comprado: 'lavender',
  presente: 'aqua',
};

const fmtBRL = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: n % 1 === 0 ? 0 : 2 });

function diasAteBF(): number {
  const hoje = new Date();
  const bf = new Date(`${BLACK_FRIDAY}T00:00:00-03:00`);
  return Math.max(0, Math.ceil((bf.getTime() - hoje.getTime()) / 86_400_000));
}

interface MaiteProps {
  userId: string | null;
}

export function Maite({ userId }: MaiteProps) {
  const lista = useListaMaite(userId);
  const isMobile = useIsMobile();

  const resumo = useMemo(() => {
    const abertos = lista.itens.filter((i) => i.status !== 'comprado' && i.status !== 'presente');
    const resolvidos = lista.itens.filter((i) => i.status === 'comprado' || i.status === 'presente');
    const faltaComprar = abertos.reduce((s, i) => s + (i.precoAtual ?? 0), 0);
    const economizado = lista.itens.reduce((s, i) => {
      if (i.precoTabela != null && i.precoAtual != null && i.precoTabela > i.precoAtual) {
        return s + (i.precoTabela - i.precoAtual);
      }
      return s;
    }, 0);
    return { faltaComprar, economizado, resolvidos: resolvidos.length, total: lista.itens.length };
  }, [lista.itens]);

  if (lista.status === 'sem-tabela') {
    return (
      <>
        <Cabecalho />
        <EmptyState
          eyebrow="quase lá"
          titulo="o banco ainda não conhece a maitê."
          recado="falta aplicar a migration v22 no supabase — depois disso a lista aparece aqui."
        />
      </>
    );
  }

  if (lista.status === 'carregando' || lista.status === 'inativo') {
    return (
      <>
        <Cabecalho />
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-3)', font: '400 14px/1.6 var(--font-body)' }}>
          carregando a listinha…
        </div>
      </>
    );
  }

  if (lista.status === 'erro') {
    return (
      <>
        <Cabecalho />
        <EmptyState titulo="algo travou por aqui." recado={lista.erro ?? 'tenta recarregar a página'} />
      </>
    );
  }

  if (!lista.listaId) {
    return (
      <>
        <Cabecalho />
        <EmptyState
          eyebrow="sem lista"
          titulo="sua conta ainda não participa de nenhuma lista."
          recado="a lista da maitê é criada pela migration v22 — confere se o seed rodou."
        />
      </>
    );
  }

  return (
    <>
      <Cabecalho />

      {/* resumo · três números que importam */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 10 : 16,
          marginBottom: isMobile ? 18 : 28,
        }}
      >
        <CardNumero rotulo="falta comprar" valor={fmtBRL(resumo.faltaComprar)} corInk="var(--ink)" />
        <CardNumero rotulo="economia vs preço de tabela" valor={fmtBRL(resumo.economizado)} corInk="var(--sage-ink)" />
        <CardNumero rotulo="black friday" valor={`${diasAteBF()} dias`} corInk="var(--lavender-ink)" sub="28/11 · alvo dos itens grandes" />
      </div>

      <AdicionarPorLink onSalvar={lista.adicionarItem} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: isMobile ? 12 : 18,
          marginTop: isMobile ? 16 : 24,
        }}
      >
        {lista.itens.map((item) => (
          <CardItem
            key={item.id}
            item={item}
            pontos={lista.precos[item.id] ?? []}
            onAtualizar={lista.atualizarItem}
            onRemover={lista.removerItem}
            onRegistrarPreco={lista.registrarPreco}
          />
        ))}
      </div>

      {lista.itens.length === 0 && (
        <EmptyState
          eyebrow="lista vazia"
          titulo="nada por aqui ainda."
          recado="cola o link de uma loja ali em cima que eu cuido do resto."
        />
      )}
    </>
  );
}

function Cabecalho() {
  return (
    <PageHead
      eyebrow="maitê · enxoval"
      titulo="as coisinhas dela."
      hand="radar de preço ligado — eu aviso quando for hora de comprar 💜"
    />
  );
}

function CardNumero({ rotulo, valor, corInk, sub }: { rotulo: string; valor: string; corInk: string; sub?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '16px 20px',
      }}
    >
      <Eyebrow>{rotulo}</Eyebrow>
      <div style={{ font: '500 30px/1.2 var(--font-display)', color: corInk, marginTop: 6 }}>{valor}</div>
      {sub && <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/** Formulário de adicionar · cola o link, o endpoint extrai, você confere. */
function AdicionarPorLink({ onSalvar }: { onSalvar: (novo: NovoItemMaite) => Promise<string | null> }) {
  const isMobile = useIsMobile();
  const [url, setUrl] = useState('');
  const [extraindo, setExtraindo] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [rascunho, setRascunho] = useState<NovoItemMaite | null>(null);

  async function extrair(): Promise<void> {
    const link = url.trim();
    if (!link) {
      setRascunho({ nome: '', status: 'pesquisando' });
      return;
    }
    setExtraindo(true);
    setAvisos([]);
    try {
      const resp = await fetch('/api/maite?acao=extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ url: link }),
      });
      const json = (await resp.json()) as {
        erro?: string;
        avisos?: string[];
        produto?: { nome?: string; preco?: number; imagemUrl?: string; loja?: string };
      };
      if (!resp.ok) {
        setAvisos([json.erro ?? 'não deu pra ler esse link · tenta de novo']);
        return;
      }
      setAvisos(json.avisos ?? []);
      setRascunho({
        nome: json.produto?.nome ?? '',
        precoAtual: json.produto?.preco,
        imagemUrl: json.produto?.imagemUrl,
        loja: json.produto?.loja,
        url: link,
        status: 'pesquisando',
      });
    } catch {
      setAvisos(['sem conexão com o servidor · tenta de novo']);
    } finally {
      setExtraindo(false);
    }
  }

  async function salvar(): Promise<void> {
    if (!rascunho || !rascunho.nome.trim()) return;
    await onSalvar(rascunho);
    setRascunho(null);
    setUrl('');
    setAvisos([]);
  }

  const inputStyle: React.CSSProperties = {
    font: '400 14px/1.4 var(--font-body)',
    color: 'var(--ink)',
    background: 'var(--bg)',
    border: '1px solid var(--line-2)',
    borderRadius: 10,
    padding: '10px 12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        background: 'var(--bg-alt)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: isMobile ? 14 : 18,
      }}
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void extrair();
          }}
          placeholder="cola o link da loja (amazon, ml, magalu…) e eu leio nome, preço e foto"
          aria-label="link do produto"
          style={{ ...inputStyle, flex: '1 1 260px' }}
        />
        <button type="button" onClick={() => void extrair()} disabled={extraindo} style={botaoPrimario(extraindo)}>
          {extraindo ? 'lendo…' : url.trim() ? 'ler o link' : 'adicionar na mão'}
        </button>
      </div>

      {avisos.map((a) => (
        <div key={a} style={{ marginTop: 10, font: '400 12px/1.5 var(--font-body)', color: '#B8884A' }}>
          {a}
        </div>
      ))}

      {rascunho && (
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr',
            gap: 10,
            alignItems: 'end',
          }}
        >
          <Campo rotulo="nome">
            <input
              value={rascunho.nome}
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
              placeholder="nome do produto"
              style={inputStyle}
            />
          </Campo>
          <Campo rotulo="preço atual (R$)">
            <input
              inputMode="decimal"
              value={rascunho.precoAtual ?? ''}
              onChange={(e) => setRascunho({ ...rascunho, precoAtual: parseNum(e.target.value) })}
              placeholder="0,00"
              style={inputStyle}
            />
          </Campo>
          <Campo rotulo="preço-alvo (R$)">
            <input
              inputMode="decimal"
              value={rascunho.precoAlvo ?? ''}
              onChange={(e) => setRascunho({ ...rascunho, precoAlvo: parseNum(e.target.value) })}
              placeholder="avisa abaixo de…"
              style={inputStyle}
            />
          </Campo>
          <button type="button" onClick={() => void salvar()} disabled={!rascunho.nome.trim()} style={botaoPrimario(!rascunho.nome.trim())}>
            aplicar na lista
          </button>
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', font: '700 10px/1 var(--font-body)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>
        {rotulo}
      </span>
      {children}
    </label>
  );
}

function botaoPrimario(disabled: boolean): React.CSSProperties {
  return {
    font: '600 13px/1 var(--font-body)',
    padding: '11px 18px',
    borderRadius: 999,
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    background: 'var(--lavender)',
    color: '#fff',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
  };
}

function parseNum(raw: string): number | undefined {
  const n = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const EMOJI_CATEGORIA: Record<string, string> = {
  passeio: '👶',
  quarto: '🛏️',
  banho: '🛁',
  'alimentação': '🍼',
  'eletrônicos': '📡',
  higiene: '🧷',
};

interface CardItemProps {
  item: ItemMaite;
  pontos: PontoPreco[];
  onAtualizar: (id: string, patch: Partial<NovoItemMaite> & { monitorar?: boolean }) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onRegistrarPreco: (itemId: string, preco: number, loja?: string) => Promise<void>;
}

function CardItem({ item, pontos, onAtualizar, onRemover, onRegistrarPreco }: CardItemProps) {
  const [atualizando, setAtualizando] = useState(false);
  const [editandoAlvo, setEditandoAlvo] = useState(false);
  const [alvoRaw, setAlvoRaw] = useState(item.precoAlvo != null ? String(item.precoAlvo) : '');

  const resolvido = item.status === 'comprado' || item.status === 'presente';
  const abaixoDoAlvo = item.precoAlvo != null && item.precoAtual != null && item.precoAtual <= item.precoAlvo;

  async function atualizarPreco(): Promise<void> {
    if (!item.url) return;
    setAtualizando(true);
    try {
      const resp = await fetch('/api/maite?acao=extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ url: item.url }),
      });
      const json = (await resp.json()) as { produto?: { preco?: number; loja?: string } };
      if (resp.ok && json.produto?.preco) {
        await onRegistrarPreco(item.id, json.produto.preco, json.produto.loja);
      }
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <article
      style={{
        background: 'var(--bg)',
        border: `1px solid ${abaixoDoAlvo && !resolvido ? 'var(--sage)' : 'var(--line)'}`,
        borderRadius: 16,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        opacity: resolvido ? 0.72 : 1,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 56,
            height: 56,
            flex: '0 0 56px',
            borderRadius: 12,
            background: 'var(--bg-alt)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            overflow: 'hidden',
          }}
        >
          {item.imagemUrl ? (
            <img src={item.imagemUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{EMOJI_CATEGORIA[item.categoria ?? ''] ?? '🎁'}</span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: '600 14px/1.35 var(--font-body)', color: 'var(--ink)', overflowWrap: 'break-word' }}>
            {item.nome}
          </div>
          <div style={{ marginTop: 4, font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)' }}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'var(--lavender-ink)', textDecoration: 'none' }}>
                {item.loja ?? 'abrir na loja'} ↗
              </a>
            ) : (
              item.loja
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ font: '500 26px/1 var(--font-display)', color: abaixoDoAlvo ? 'var(--sage-ink)' : 'var(--ink)' }}>
          {item.precoAtual != null ? fmtBRL(item.precoAtual) : '—'}
        </span>
        {item.precoTabela != null && item.precoAtual != null && item.precoTabela > item.precoAtual && (
          <span style={{ font: '400 13px/1 var(--font-body)', color: 'var(--ink-3)', textDecoration: 'line-through' }}>
            {fmtBRL(item.precoTabela)}
          </span>
        )}
        <Sparkline pontos={pontos} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill kind={STATUS_KIND[item.status]}>{STATUS_LABEL[item.status]}</Pill>
        {editandoAlvo ? (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input
              autoFocus
              inputMode="decimal"
              value={alvoRaw}
              onChange={(e) => setAlvoRaw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void onAtualizar(item.id, { precoAlvo: parseNum(alvoRaw) });
                  setEditandoAlvo(false);
                }
                if (e.key === 'Escape') setEditandoAlvo(false);
              }}
              onBlur={() => {
                void onAtualizar(item.id, { precoAlvo: parseNum(alvoRaw) });
                setEditandoAlvo(false);
              }}
              style={{
                width: 90,
                font: '400 12px/1 var(--font-body)',
                padding: '6px 8px',
                border: '1px solid var(--line-2)',
                borderRadius: 8,
              }}
            />
          </span>
        ) : (
          <button type="button" onClick={() => setEditandoAlvo(true)} style={botaoFantasma}>
            {item.precoAlvo != null ? `alvo ${fmtBRL(item.precoAlvo)}` : 'definir alvo'}
          </button>
        )}
      </div>

      {item.obs && (
        <div style={{ font: '400 12px/1.5 var(--font-body)', color: 'var(--ink-2)', background: 'var(--bg-alt)', borderRadius: 10, padding: '8px 10px' }}>
          {item.obs}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
        <select
          value={item.status}
          onChange={(e) => void onAtualizar(item.id, { status: e.target.value as StatusMaite })}
          aria-label="mudar status"
          style={{
            font: '400 12px/1 var(--font-body)',
            color: 'var(--ink-2)',
            padding: '7px 8px',
            borderRadius: 8,
            border: '1px solid var(--line-2)',
            background: 'var(--bg)',
          }}
        >
          {(Object.keys(STATUS_LABEL) as StatusMaite[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {item.url && !resolvido && (
          <button type="button" onClick={() => void atualizarPreco()} disabled={atualizando} style={botaoFantasma}>
            {atualizando ? 'lendo…' : 'atualizar preço'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`tirar "${item.nome}" da lista?`)) void onRemover(item.id);
          }}
          style={{ ...botaoFantasma, color: 'var(--coral-ink)', marginLeft: 'auto' }}
        >
          remover
        </button>
      </div>

      {item.precoAtualEm && (
        <Mono style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          preço de {new Date(item.precoAtualEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          {item.monitorar ? ' · radar 2x/dia' : ''}
        </Mono>
      )}
    </article>
  );
}

const botaoFantasma: React.CSSProperties = {
  font: '600 12px/1 var(--font-body)',
  padding: '7px 12px',
  borderRadius: 999,
  border: '1px solid var(--line-2)',
  background: 'transparent',
  color: 'var(--ink-2)',
  cursor: 'pointer',
};

/** Linha do histórico de preço · só aparece com 2+ pontos. */
function Sparkline({ pontos }: { pontos: PontoPreco[] }) {
  if (pontos.length < 2) return null;
  const ultimos = pontos.slice(-20);
  const valores = ultimos.map((p) => p.preco);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const range = max - min || 1;
  const w = 96;
  const h = 24;
  const passo = w / (ultimos.length - 1);
  const path = ultimos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * passo).toFixed(1)},${(h - 3 - ((p.preco - min) / range) * (h - 6)).toFixed(1)}`)
    .join(' ');
  const subiu = valores[valores.length - 1] > valores[0];
  return (
    <svg width={w} height={h} aria-label="histórico de preço" style={{ marginLeft: 'auto' }}>
      <path d={path} fill="none" stroke={subiu ? 'var(--coral)' : 'var(--sage)'} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
