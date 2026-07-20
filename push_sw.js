// Kuni web push service worker.
//
// Deliberately separate from Flutter's generated `flutter_service_worker.js`:
// only one registration may own a given scope, so registering this at the app
// root would evict Flutter's offline cache. It is registered under a `push/`
// sub-scope instead. Scope limits which pages a worker *controls*, not which
// pushes it receives, so a narrow scope costs nothing here — and
// `includeUncontrolled` below still finds the app's own tab.

// Mirrors the payload push-send sends. A push with no (or unparseable) body
// still shows something rather than the browser's own "This site has been
// updated in the background" placeholder.
function readPayload(event) {
  const fallback = { title: 'Kuni', body: '' };
  if (!event.data) return fallback;
  try {
    const data = event.data.json();
    return {
      title: typeof data.title === 'string' && data.title ? data.title : fallback.title,
      body: typeof data.body === 'string' ? data.body : '',
    };
  } catch (_) {
    return { title: fallback.title, body: event.data.text() };
  }
}

self.addEventListener('push', function (event) {
  const payload = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: 'icons/Icon-192.png',
      badge: 'icons/Icon-192.png',
      // One notification per conversation partner would need the sender id in
      // the payload; collapsing every chat push onto one tag instead means a
      // burst of messages replaces itself rather than stacking up.
      tag: 'kuni-chat',
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  // The app root, one level up from this worker's `push/` scope.
  const target = new URL('../', self.registration.scope).href;
  event.waitUntil(
    self.clients
      // includeUncontrolled matters: the app's tab is controlled by Flutter's
      // service worker at the root scope, not by this one, so without it the
      // click would always open a duplicate tab.
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clients) {
        for (const client of clients) {
          if (client.url.startsWith(target) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});

// A push service may rotate an endpoint on its own. The app re-subscribes and
// re-uploads on every launch, so the only job here is to drop the stale
// registration; the next launch stores the replacement.
self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.registration.pushManager
      .getSubscription()
      .then(function (subscription) {
        return subscription ? subscription.unsubscribe() : undefined;
      })
      .catch(function () {}),
  );
});
