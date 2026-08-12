import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envObrigatorio } from '../_shared/env.js';
import { msgErroAnthropic } from '../_shared/anthropic.js';
import { userIdDoJwt } from '../_shared/auth.js';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';
import {
  buscarPagina,
  extrairJsonLd,
  extrairMetaTags,
  lojaDoHost,
  type ProdutoExtraido,
} from '../_shared/precos.js';

/**
 * /api/maite/extrair-produto · cola um link de loja, sai produto estruturado.
 *
 * Camadas: JSON-LD/meta (grátis) → Claude lendo o HTML (fallback).
 * Se a loja bloqueia o fetch (Amazon faz isso), devolve 200 com o que
 * deu pra inferir + aviso — o formulário deixa completar na mão.
 * Mesma filosofia de degradação graciosa do extrair-escala.
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
    console.error('extrair-produto: anthropic falhou', resp.status, txt.slice(0, 300));
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'use POST' });
    return;
  }

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
    console.error('extrair-produto: erro inesperado', err);
    res.status(500).json({ erro: 'algo travou aqui ao ler o link · tenta de novo' });
  }
}
