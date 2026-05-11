/* eslint-disable no-restricted-globals */

/**
 * Colo Ritmo · service worker
 *
 * Vive em `colopediatria.com.br/ritmo/service-worker.js` · scope `/ritmo/`.
 * Só intercepta requests dentro de `/ritmo/*` · APIs no root (`/api/*`)
 * passam direto sem tocar no SW.
 *
 * Responsabilidades:
 *   1. Receber web push e mostrar notificação (titulo, corpo, ações).
 *   2. Reabrir/focar a aba da agenda quando o user clica.
 *   3. Cache do app shell · estratégia diferenciada por tipo:
 *      - HTML/SPA · network-first (UI sempre fresh, cache é só fallback offline)
 *      - /ritmo/assets/* (build com hash imutável) · cache-first
 *
 * Bump em VERSAO força limpeza de caches anteriores no activate.
 */

const VERSAO = 'colo-ritmo-v4';
const CACHE_SHELL = `${VERSAO}-shell`;
const CACHE_ASSETS = `${VERSAO}-assets`;

const SHELL_INICIAL = [
  '/ritmo/',
  '/ritmo/manifest.webmanifest',
  '/ritmo/pwa-icon.svg',
  '/ritmo/pwa-icon-maskable.svg',
  '/ritmo/colo-ritmo-mark.svg',
];

const NOTIF_DEFAULT = {
  titulo: 'Colo Ritmo',
  corpo: 'um lembrete chegou pra você',
  url: '/ritmo/',
  tag: 'colo-ritmo',
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      try {
        await cache.addAll(SHELL_INICIAL);
      } catch (_) {
        // mesmo se algum item falhar (404 antes do build), não bloqueia
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // limpa caches de versões anteriores
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSAO))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Mesmo origem só. Ignora extensões de browser e cross-origin.
  if (url.origin !== self.location.origin) return;

  // /api/* nunca cacheia · sempre rede (mesmo se o SW receber por acaso)
  if (url.pathname.startsWith('/api/')) return;

  // /ritmo/assets/* (build hashed) · cache-first imutável
  if (url.pathname.startsWith('/ritmo/assets/')) {
    event.respondWith(cacheFirst(request, CACHE_ASSETS));
    return;
  }

  // Logos, manifest, ícones do PWA · cache-first
  if (
    url.pathname.startsWith('/ritmo/colo-ritmo') ||
    url.pathname.startsWith('/ritmo/pwa-icon') ||
    url.pathname === '/ritmo/manifest.webmanifest' ||
    url.pathname === '/ritmo/service-worker.js'
  ) {
    event.respondWith(cacheFirst(request, CACHE_ASSETS));
    return;
  }

  // HTML / SPA shell dentro de /ritmo · network-first (sempre tenta rede; cache é só fallback offline)
  if (url.pathname === '/ritmo/' || url.pathname.startsWith('/ritmo/')) {
    event.respondWith(networkFirst(request, CACHE_SHELL));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(request);
    if (resp.ok) cache.put(request, resp.clone());
    return resp;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp.ok) cache.put(request, resp.clone());
    return resp;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('push', (event) => {
  let data = NOTIF_DEFAULT;
  try {
    if (event.data) data = { ...NOTIF_DEFAULT, ...event.data.json() };
  } catch (_) {
    if (event.data) data = { ...NOTIF_DEFAULT, corpo: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.corpo,
      icon: data.icon ?? '/ritmo/colo-ritmo-mark.svg',
      badge: data.badge ?? '/ritmo/colo-ritmo-mark.svg',
      tag: data.tag,
      data: { url: data.url ?? '/ritmo/' },
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/ritmo/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if (new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
