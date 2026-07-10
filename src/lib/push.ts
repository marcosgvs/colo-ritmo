/**
 * Web Push helpers · client-side.
 *
 * Fluxo:
 *   1. registrarServiceWorker() — chamado uma vez no boot. Limpa SW antigo
 *      do scope raiz (quando o app vivia em `/`) e registra o novo em `/ritmo/`.
 *   2. assinarPush() — pede permissão, gera PushSubscription,
 *      manda pra /api/push/subscribe com o JWT da session
 *   3. cancelarPush(userId) — desassina e tira do banco
 *
 * Os helpers são tolerantes a navegadores sem suporte (Safari < 16.4
 * iOS, etc) — retornam `false` ou `null` sem throw.
 */

import { supabase } from './supabase.js';

const SW_PATH = '/ritmo/service-worker.js';
const SW_SCOPE = '/ritmo/';

export function suportaPush(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Desinstala SWs antigos registrados em outro scope · cobre a transição
 * de `/service-worker.js` (scope `/`) pra `/ritmo/service-worker.js`
 * (scope `/ritmo/`). Sem isso, o user antigo fica com 2 SWs duplicados
 * recebendo push.
 */
async function limparSWAntigos(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const novoScope = new URL(SW_SCOPE, window.location.origin).href;
    for (const reg of regs) {
      if (reg.scope !== novoScope) {
        // Desinstala SW antigo (scope raiz ou qualquer outro)
        // Subscription dele é descartada junto · user vai precisar re-permitir push.
        try {
          await reg.unregister();
        } catch {
          /* ignora */
        }
      }
    }
  } catch {
    /* ignora · não bloqueia boot se navegador não cooperar */
  }
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!suportaPush()) return null;
  try {
    await limparSWAntigos();
    return await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
  } catch (err) {
    console.warn('push: falhou ao registrar SW', err);
    return null;
  }
}

async function buscarVapidPublic(): Promise<string | null> {
  try {
    const r = await fetch('/api/push/vapid-public');
    if (!r.ok) return null;
    const json = (await r.json()) as { vapidPublic?: string };
    return json.vapidPublic ?? null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export async function assinarPush(): Promise<PushSubscription | null> {
  if (!suportaPush()) return null;
  const reg = await navigator.serviceWorker.ready;

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return null;

  const vapid = await buscarVapidPublic();
  if (!vapid) return null;

  // O endpoint resolve o user_id pelo JWT · sem session não tem como assinar.
  const { data: sessData } = await supabase().auth.getSession();
  const accessToken = sessData.session?.access_token;
  if (!accessToken) return null;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }

  const resp = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      userAgent: navigator.userAgent,
    }),
  });
  if (!resp.ok) {
    console.warn('push: subscribe falhou', resp.status);
    return null;
  }

  return sub;
}

export async function cancelarPush(): Promise<boolean> {
  if (!suportaPush()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    // O endpoint exige JWT (deleta só subscriptions do próprio user).
    const { data: sessData } = await supabase().auth.getSession();
    const accessToken = sessData.session?.access_token;
    if (accessToken) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ endpoint }),
      });
    }
  } catch {
    // ignora — local já desassinou · cron limpa a row órfã via 404/410
  }
  return true;
}
