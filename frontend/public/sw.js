const CACHE_NAME = "thebarathon-shell-v2";
const SHELL_URLS = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch page navigations: re-fetching a navigate-mode request from
  // inside a service worker throws in some browsers (Firefox), which is
  // exactly what broke every page load here. Let the browser handle these
  // directly — this SW is only for installability/app-shell assets, not
  // full offline support.
  if (request.mode === "navigate" || request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // /api/ is dynamic+authenticated, /tiles/ is a multi-GB file fetched with
  // Range requests — the Cache API can't store 206 Partial Content
  // responses at all, and shouldn't try to hold a multi-GB file anyway.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/tiles/")) return;
  if (request.headers.has("range")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
