/**
 * Extração de preço de páginas de produto · usado pelo radar (cron) e
 * pelo endpoint de adicionar-por-link da área da Maitê.
 *
 * Estratégia em camadas, da mais barata pra mais cara:
 *   1. JSON-LD (schema.org/Product) — ML, Magalu, sites de marca expõem
 *   2. meta tags og:price / product:price
 * A camada com Claude fica no endpoint (extrair-produto), não aqui —
 * o cron roda só as camadas grátis pra não gastar token 2x ao dia.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export interface ProdutoExtraido {
  nome?: string;
  preco?: number;
  imagemUrl?: string;
  loja?: string;
}

/** Busca a página com timeout curto · retorna null se bloqueado/fora do ar. */
export async function buscarPagina(url: string, timeoutMs = 10_000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!resp.ok) return null;
    const tipo = resp.headers.get('content-type') ?? '';
    if (!tipo.includes('html')) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Nome curto da loja a partir do host (amazon, mercado livre, magalu…). */
export function lojaDoHost(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('amazon')) return 'amazon';
    if (host.includes('mercadolivre') || host.includes('mercadolibre')) return 'mercado livre';
    if (host.includes('magazineluiza') || host.includes('magalu')) return 'magalu';
    if (host.includes('americanas')) return 'americanas';
    if (host.includes('alobebe')) return 'alô bebê';
    if (host.includes('casasbahia')) return 'casas bahia';
    if (host.includes('carrefour')) return 'carrefour';
    // "tulipababy.com.br" → "tulipababy"
    return host.split('.')[0];
  } catch {
    return 'loja';
  }
}

function parsePrecoBR(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return undefined;
  // aceita "3.779,00", "3779.00", "R$ 3.779"
  const limpo = raw.replace(/[^\d.,]/g, '');
  if (!limpo) return undefined;
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

interface JsonLdNode {
  '@type'?: string | string[];
  '@graph'?: JsonLdNode[];
  name?: string;
  image?: string | string[] | { url?: string };
  offers?: JsonLdNode | JsonLdNode[];
  price?: unknown;
  lowPrice?: unknown;
}

function ehProduto(node: JsonLdNode): boolean {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes('Product') : t === 'Product';
}

function precoDeOffers(offers: JsonLdNode | JsonLdNode[] | undefined): number | undefined {
  if (!offers) return undefined;
  for (const o of Array.isArray(offers) ? offers : [offers]) {
    const p = parsePrecoBR(o.price) ?? parsePrecoBR(o.lowPrice);
    if (p) return p;
  }
  return undefined;
}

function imagemDeNode(img: JsonLdNode['image']): string | undefined {
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return typeof img[0] === 'string' ? img[0] : undefined;
  if (img && typeof img === 'object') return img.url;
  return undefined;
}

/** Extrai Product do JSON-LD da página · o caminho feliz sem IA. */
export function extrairJsonLd(html: string): ProdutoExtraido | null {
  const scripts = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of scripts) {
    let raiz: unknown;
    try {
      raiz = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const candidatos: JsonLdNode[] = [];
    for (const node of Array.isArray(raiz) ? raiz : [raiz]) {
      const n = node as JsonLdNode;
      candidatos.push(n, ...(n['@graph'] ?? []));
    }
    for (const node of candidatos) {
      if (!node || !ehProduto(node)) continue;
      const preco = precoDeOffers(node.offers);
      if (!preco && !node.name) continue;
      return {
        nome: node.name,
        preco,
        imagemUrl: imagemDeNode(node.image),
      };
    }
  }
  return null;
}

/** Fallback via meta tags (og:image, product:price:amount, itemprop). */
export function extrairMetaTags(html: string): ProdutoExtraido | null {
  const meta = (prop: string): string | undefined => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${prop}["']`,
      'i',
    );
    return html.match(re)?.[1] ?? html.match(alt)?.[1];
  };
  const preco =
    parsePrecoBR(meta('product:price:amount')) ??
    parsePrecoBR(meta('og:price:amount')) ??
    parsePrecoBR(meta('price'));
  const nome = meta('og:title');
  const imagemUrl = meta('og:image');
  if (!preco && !nome) return null;
  return { nome, preco, imagemUrl };
}

/** Camadas grátis combinadas · null se a página não entregou nada útil. */
export async function extrairProdutoSemIA(url: string): Promise<ProdutoExtraido | null> {
  const html = await buscarPagina(url);
  if (!html) return null;
  const ld = extrairJsonLd(html);
  const metas = extrairMetaTags(html);
  if (!ld && !metas) return null;
  return {
    nome: ld?.nome ?? metas?.nome,
    preco: ld?.preco ?? metas?.preco,
    imagemUrl: ld?.imagemUrl ?? metas?.imagemUrl,
    loja: lojaDoHost(url),
  };
}
