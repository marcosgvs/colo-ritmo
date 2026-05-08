/* eslint-disable no-restricted-globals */

/**
 * Colo Ritmo · service worker
 *
 * Responsabilidades:
 *   1. Receber web push e mostrar notificação (titulo, corpo, ações).
 *   2. Reabrir/focar a aba da agenda quando o user clica.
 *   3. Cache do app shell · estratégia diferenciada por tipo:
 *      - HTML/JS/CSS · stale-while-revalidate (UI sempre disponível)
 *      - assets/* (logos, svgs) · cache-first (imutáveis)
 *      - /api/* · network-only (sempre fresh)
 *
 * Versão do cache muda em cada deploy (build hash). Caches antigos são
 * limpos no activate.
 */

const VERSAO = 'colo-ritmo-v1';
const CACHE_SHELL = `${VERSAO}-shell`;
const CACHE_ASSETS = `${VERSAO}-assets`;

const SHELL_INICIAL = ['/', '/colo-ritmo-mark.svg'];

const NOTIF_DEFAULT = {
  titulo: 'Colo Ritmo',
  corpo: 'um lembrete chegou pra você',
  url: '/',
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

  // /api/* nunca cacheia · sempre rede
  if (url.pathname.startsWith('/api/')) return;

  // /assets/* (build hashed) · cache-first imutável
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, CACHE_ASSETS));
    return;
  }

  // Logos e estáticos públicos · cache-first
  if (
    url.pathname.startsWith('/colo-ritmo') ||
    url.pathname === '/service-worker.js'
  ) {
    event.respondWith(cacheFirst(request, CACHE_ASSETS));
    return;
  }

  // HTML / SPA shell · stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_SHELL));
});

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

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchAndUpdate = fetch(request)
    .then((resp) => {
      if (resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);

  return cached ?? (await fetchAndUpdate) ?? Response.error();
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
      icon: data.icon ?? '/colo-ritmo-mark.svg',
      badge: data.badge ?? '/colo-ritmo-mark.svg',
      tag: data.tag,
      data: { url: data.url ?? '/' },
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

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
