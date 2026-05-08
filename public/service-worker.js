/* eslint-disable no-restricted-globals */

/**
 * Colo Ritmo · service worker
 *
 * Responsabilidades:
 *   1. Receber web push e mostrar notificação (titulo, corpo, ações).
 *   2. Reabrir/focar a aba da agenda quando o user clica.
 *   3. Não cacheia nada (Sessão 4 lida com offline).
 *
 * Fica em /service-worker.js no path raiz pra ter scope='/'.
 */

const NOTIF_DEFAULT = {
  titulo: 'Colo Ritmo',
  corpo: 'um lembrete chegou pra você',
  url: '/',
  tag: 'colo-ritmo',
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = NOTIF_DEFAULT;
  try {
    if (event.data) data = { ...NOTIF_DEFAULT, ...event.data.json() };
  } catch (_) {
    // payload pode vir como texto puro — usa default
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
