/*
 * Pacy service worker — app shell only.
 *
 * WRITTEN BY HAND, DELIBERATELY. A generated worker (Workbox/Serwist) caches
 * broadly by default and would need to be argued back down to safety. Here the
 * only thing that is ever cached is same-origin static output, and the rules
 * are short enough to read in full before trusting them.
 *
 * THE RULE THAT MATTERS: no backend response is ever cached, ever.
 * Prescription state, QR tokens and dispense results must always hit the
 * network. A cached /patient/prescriptions would show a fill that has already
 * been spent; a cached QR token would be a code the server has already
 * expired. Both are worse than being offline, because they look correct.
 *
 * This worker enforces that structurally rather than by rule: the fetch
 * handler returns early for anything that is not a same-origin GET, so
 * cross-origin requests (the backend, Supabase) are never even seen by the
 * caching logic — the browser performs them normally.
 */

const CACHE = "pacy-shell-v1";

// Static output only. Everything here is content-hashed or immutable, so a
// stale copy is impossible by construction.
const CACHEABLE_PREFIXES = ["/_next/static/", "/icons/"];

self.addEventListener("install", () => {
  // Nothing is precached: the shell is hashed per build, so warming the cache
  // would only pin assets the next deploy renames anyway.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Non-GET never touches the cache: mints, dispenses and revokes are real
  // chain writes and must reach the server exactly once.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin — the backend API and Supabase auth. Left entirely alone.
  if (url.origin !== self.location.origin) return;

  const cacheable = CACHEABLE_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
  if (!cacheable) return;

  // Cache-first, safe because these URLs are content-addressed.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
