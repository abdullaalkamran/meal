/* MyDorm service worker.
 *
 * Two jobs:
 *  1. Web Push — show pushed notifications + handle clicks, so alerts arrive
 *     even when the app/tab is closed.
 *  2. App-shell caching — serve the UI (JS/CSS/fonts/icons) from the device so
 *     opening the app and moving between screens feels instant, like a native
 *     app, instead of re-downloading everything from the server each time.
 *
 * Deliberately conservative: only immutable, content-hashed build assets and
 * icons are cached. Pages (HTML) and every /api/* data call always go to the
 * network, so bills, meals and auth are never served stale.
 */

const CACHE = "mydorm-shell-v1";

// Activate a new SW immediately so an updated caching strategy takes over fast.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions so a deploy can't get stuck serving
      // yesterday's assets.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Cache-first for immutable, hashed build assets and static icons/fonts — these
// never change under a fixed URL, so it's safe to serve them from cache forever
// and refresh in the background. This is what makes repeat opens instant.
function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true; // hashed JS/CSS chunks
  return /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POST/RPC writes

  const url = new URL(req.url);

  // Data + auth + RSC navigations are always live — never cached.
  if (url.pathname.startsWith("/api/")) return;
  if (url.searchParams.has("_rsc")) return;

  if (!isCacheableAsset(url)) return; // pages/HTML fall through to the network

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) {
        // Serve instantly; refresh the cached copy in the background so a later
        // open gets the newest asset without ever blocking this one.
        event.waitUntil(
          fetch(req)
            .then((res) => {
              if (res && res.ok) return cache.put(req, res.clone());
            })
            .catch(() => {})
        );
        return cached;
      }
      // First time we see this asset: fetch, cache, and return it.
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        // Offline with nothing cached — let the browser surface the failure.
        throw err;
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "MyDorm", body: "You have a new notification." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON payload — fall back to the text body if any.
    if (event.data) payload.body = event.data.text();
  }
  const { title, body, url } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus an already-open MyDorm tab if there is one; otherwise open it.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
