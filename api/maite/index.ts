import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { envObrigatorio, envOpcional } from '../_shared/env.js';
import { msgErroAnthropic } from '../_shared/anthropic.js';
import { userIdDoJwt } from '../_shared/auth.js';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';
import {
  buscarPagina,
  extrairJsonLd,
  extrairMetaTags,
  extrairProdutoSemIA,
  lojaDoHost,
  type ProdutoExtraido,
} from '../_shared/precos.js';

/**
 * /api/maite · as duas ações da área da Maitê numa função só — o plano
 * Hobby da Vercel limita a 12 functions por deploy e o projeto já
 * estava no teto (foi isso que derrubou os primeiros deploys da área).
 *
 *   POST /api/maite?acao=extrair · JWT · cola link → produto estruturado
 *   POST /api/maite?acao=radar   · CRON_SECRET · revisita preços 2x/dia
 *
 * ── extrair ──────────────────────────────────────────────────────────
 * Camadas: JSON-LD/meta (grátis) → Claude lendo o HTML (fallback).
 * Loja que bloqueia robô (Amazon) devolve 200 com aviso — o formulário
 * deixa completar na mão. Degradação graciosa como no extrair-escala.
 *
 * ── radar ────────────────────────────────────────────────────────────
 * Pra cada item monitorado com URL: extrai preço sem IA, grava o ponto
 * no histórico, atualiza o item e — se CRUZOU o alvo pra baixo — avisa
 * com push + sino pros membros da lista. Tolerante a falhas individuais.
 */

const MODELO = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
// HTML de loja é 90% ruído (scripts, css) · manda só um recorte pro modelo
const MAX_HTML_CHARS = 60_000;

const FERRAMENTA = {
  name: 'registrar_produto',
  description: 'Registra os dados do produto extraídos da página HTML.',
  input_schema: {
    type: 'object',
    properties: {
      nome: {
        type: 'string',
        description: 'Nome completo do produto como anunciado (marca + modelo + variante).',
      },
      preco: {
        type: 'number',
        description:
          'Preço atual à vista em reais, como número (ex: 3779.90). Se a página mostra vários, o preço principal do produto anunciado. 0 se não encontrou.',
      },
      imagemUrl: {
        type: 'string',
        description: 'URL absoluta da imagem principal do produto. Vazio se não encontrou.',
      },
    },
    required: ['nome', 'preco'],
  },
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }
  const acao = req.query['acao'];
  if (acao === 'radar') {
    await rodarRadar(req, res);
    return;
  }
  await extrairProduto(req, res);
}

// ─────────────────────────────────────────────────────────────────────
// extrair · cola o link, sai produto estruturado
// ─────────────────────────────────────────────────────────────────────

function limparHtml(html: string): string {
  // remove script/style/svg antes de recortar · sobra o que interessa
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s{3,}/g, '  ')
    .slice(0, MAX_HTML_CHARS);
}

async function extrairComClaude(
  url: string,
  html: string,
): Promise<{ produto: ProdutoExtraido | null; erro?: { status: number; corpo: string } }> {
  const apiKey = envObrigatorio('ANTHROPIC_API_KEY');
  const prompt = [
    'Você está lendo o HTML de uma página de produto de e-commerce brasileiro.',
    `URL: ${url}`,
    '',
    'Extraia nome, preço atual à vista (em reais, número) e imagem principal.',
    'REGRAS RÍGIDAS:',
    '1. O preço é o do produto principal da página — ignore "produtos relacionados", frete e parcelas.',
    '2. Se houver preço "de/por", use o "por" (preço atual).',
    '3. Não invente: se o HTML não tem preço legível, mande preco 0.',
    '',
    'HTML (recortado):',
    limparHtml(html),
  ].join('\n');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      tools: [FERRAMENTA],
      tool_choice: { type: 'tool', name: FERRAMENTA.name },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error('maite/extrair: anthropic falhou', resp.status, txt.slice(0, 300));
    return { produto: null, erro: { status: resp.status, corpo: txt } };
  }

  const json = (await resp.json()) as {
    content?: Array<{ type: string; input?: { nome?: string; preco?: number; imagemUrl?: string } }>;
  };
  const tool = json.content?.find((c) => c.type === 'tool_use');
  if (!tool?.input?.nome) return { produto: null };
  return {
    produto: {
      nome: tool.input.nome,
      preco: tool.input.preco && tool.input.preco > 0 ? tool.input.preco : undefined,
      imagemUrl: tool.input.imagemUrl || undefined,
    },
  };
}

async function extrairProduto(req: VercelRequest, res: VercelResponse): Promise<void> {
  const userId = await userIdDoJwt(req, supabaseAdmin());
  if (!userId) {
    res.status(401).json({ erro: 'sessão expirada · entra de novo e tenta outra vez' });
    return;
  }

  const { url } = (req.body ?? {}) as { url?: string };
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ erro: 'manda um link http(s) válido da página do produto' });
    return;
  }

  const loja = lojaDoHost(url);
  const avisos: string[] = [];

  try {
    const html = await buscarPagina(url, 15_000);
    if (!html) {
      // loja bloqueou robô (Amazon faz isso) · devolve o esqueleto pra
      // completar na mão em vez de erro
      res.status(200).json({
        produto: { loja },
        avisos: ['a loja bloqueou a leitura automática · preenche nome e preço na mão'],
      });
      return;
    }

    const semIA: ProdutoExtraido = {
      ...extrairMetaTags(html),
      ...extrairJsonLd(html),
    };
    if (semIA.nome && semIA.preco) {
      res.status(200).json({ produto: { ...semIA, loja }, avisos });
      return;
    }

    // página abriu mas não tem dado estruturado · Claude lê o HTML
    const ia = await extrairComClaude(url, html);
    if (ia.erro) {
      res.status(502).json({
        erro: msgErroAnthropic(ia.erro.status, ia.erro.corpo),
        detalhe: ia.erro.corpo.slice(0, 400),
      });
      return;
    }
    if (!ia.produto) {
      avisos.push('não consegui ler o preço dessa página · confere e completa na mão');
    }
    res.status(200).json({
      produto: {
        nome: ia.produto?.nome ?? semIA.nome,
        preco: ia.produto?.preco ?? semIA.preco,
        imagemUrl: ia.produto?.imagemUrl ?? semIA.imagemUrl,
        loja,
      },
      avisos,
    });
  } catch (err) {
    console.error('maite/extrair: erro inesperado', err);
    res.status(500).json({ erro: 'algo travou aqui ao ler o link · tenta de novo' });
  }
}

// ─────────────────────────────────────────────────────────────────────
// radar · disparado por pg_cron 2x ao dia (v22)
// ─────────────────────────────────────────────────────────────────────

interface ItemRadar {
  id: string;
  lista_id: string;
  nome: string;
  url: string;
  preco_alvo: number | null;
  preco_atual: number | null;
}

function extrairSecret(req: VercelRequest): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function secretConfere(recebido: string | null, esperado: string): boolean {
  if (!recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

let vapidConfigured = false;
function configurarVapid(): void {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    envObrigatorio('VAPID_SUBJECT'),
    envObrigatorio('VAPID_PUBLIC'),
    envObrigatorio('VAPID_PRIVATE'),
  );
  vapidConfigured = true;
}

const fmtBRL = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function rodarRadar(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = envObrigatorio('CRON_SECRET');
  if (!secretConfere(extrairSecret(req), cronSecret)) {
    res.status(401).json({ erro: 'unauthorized' });
    return;
  }

  const adm = supabaseAdmin();

  const { data: itens, error } = await adm
    .from('maite_itens')
    .select('id,lista_id,nome,url,preco_alvo,preco_atual')
    .eq('monitorar', true)
    .not('url', 'is', null)
    .not('status', 'in', '("comprado","presente")');

  if (error) {
    console.error('maite/radar: select falhou', error);
    res.status(500).json({ erro: error.message });
    return;
  }

  const lista = (itens ?? []) as ItemRadar[];
  let coletados = 0;
  let bloqueados = 0;
  const alertas: Array<{ item: ItemRadar; preco: number }> = [];

  await Promise.all(
    lista.map(async (item) => {
      const produto = await extrairProdutoSemIA(item.url);
      if (!produto?.preco) {
        bloqueados += 1;
        return;
      }
      const preco = produto.preco;
      coletados += 1;

      await adm.from('maite_precos').insert({
        item_id: item.id,
        preco,
        loja: produto.loja ?? null,
        fonte: 'radar',
      });
      await adm
        .from('maite_itens')
        .update({ preco_atual: preco, preco_atual_em: new Date().toISOString() })
        .eq('id', item.id);

      // alerta só quando CRUZA o alvo (antes acima, agora abaixo) ·
      // senão spamma 2x ao dia enquanto o preço ficar bom
      const cruzouAlvo =
        item.preco_alvo != null &&
        preco <= item.preco_alvo &&
        (item.preco_atual == null || item.preco_atual > item.preco_alvo);
      if (cruzouAlvo) alertas.push({ item, preco });
    }),
  );

  // ── notificações · sino + push pros membros das listas com alerta ──
  let pushEnviados = 0;
  if (alertas.length > 0) {
    configurarVapid();
    const listaIds = [...new Set(alertas.map((a) => a.item.lista_id))];
    const { data: membros } = await adm
      .from('maite_membros')
      .select('lista_id,user_id')
      .in('lista_id', listaIds);

    const expirados: string[] = [];
    for (const alerta of alertas) {
      const titulo = 'preço bom pra Maitê 🎯';
      const corpo = `${alerta.item.nome} chegou a ${fmtBRL(alerta.preco)} · abaixo do seu alvo`;
      const userIds = (membros ?? [])
        .filter((m) => m.lista_id === alerta.item.lista_id)
        .map((m) => m.user_id as string);

      for (const uid of userIds) {
        await adm.from('notificacoes').insert({
          user_id: uid,
          tipo: 'sugestao',
          titulo,
          detalhe: corpo,
        });
      }

      if (userIds.length === 0) continue;
      const { data: subs } = await adm
        .from('push_subscriptions')
        .select('endpoint,p256dh,auth')
        .in('user_id', userIds);

      await Promise.all(
        (subs ?? []).map(async (s) => {
          const sub: WebPushSubscription = {
            endpoint: s.endpoint as string,
            keys: { p256dh: s.p256dh as string, auth: s.auth as string },
          };
          const payload = JSON.stringify({
            titulo,
            corpo,
            url: '/ritmo/maite',
            tag: `maite-alvo-${alerta.item.id}`,
          });
          try {
            await webpush.sendNotification(sub, payload, { TTL: 3600 });
            pushEnviados += 1;
          } catch (err: unknown) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) expirados.push(sub.endpoint);
          }
        }),
      );
    }
    if (expirados.length > 0) {
      await adm.from('push_subscriptions').delete().in('endpoint', expirados);
    }
  }

  res.status(200).json({
    monitorados: lista.length,
    coletados,
    bloqueados,
    alertas: alertas.length,
    pushEnviados,
    timestamp: new Date().toISOString(),
    debug: envOpcional('VERCEL_ENV'),
  });
}
