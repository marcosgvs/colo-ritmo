import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { supabaseAdmin } from '../_shared/supabaseAdmin.js';
import { envObrigatorio, envOpcional } from '../_shared/env.js';
import { extrairProdutoSemIA } from '../_shared/precos.js';

/**
 * /api/cron/radar-precos · disparado por pg_cron 2x ao dia (v22).
 *
 * Pra cada item monitorado da lista da Maitê com URL:
 *   1. revisita a página e extrai o preço (JSON-LD/meta · sem IA, sem custo)
 *   2. grava o ponto no histórico (maite_precos) e atualiza o item
 *   3. se cruzou o preço-alvo pra baixo, avisa: push + sino pros membros
 *
 * Lojas que bloqueiam robô (Amazon) falham em silêncio — o card na view
 * mostra a data da última coleta e tem botão de atualizar manual.
 * Tolerante a falhas individuais, como o lembrete-plantao.
 */

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
    console.error('radar: select falhou', error);
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
