/// <reference lib="webworker" />
// OwL service worker: the app shell for offline start, cached covers, and songs saved on this device.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { createPartialResponse } from "workbox-range-requests";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// autoUpdate: a new version takes over right away (the page reloads into it).
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }));

/** Songs the user saved for offline listening (see src/offline.ts, which fills it). */
const OFFLINE = "owl-offline";
const saved = async (request: Request) => (await caches.open(OFFLINE)).match(request.url, { ignoreVary: true });

// Audio: a saved song plays from the device. The player asks for byte ranges to seek, so the stored
// file answers with the requested slice (206). Anything else streams from the server as before.
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/stream/"),
  async ({ request: req }) => {
    const hit = await saved(req);
    if (hit) return req.headers.has("range") ? createPartialResponse(req, hit) : hit;
    return fetch(req);
  },
);

// Lyrics of saved songs work offline too.
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/lyrics/"),
  async ({ request }) => (await saved(request)) ?? fetch(request),
);

// Covers: saved songs' covers first, then a general cache-first cache (they never change for an id).
const covers = new CacheFirst({
  cacheName: "covers",
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({ maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 }),
  ],
});
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/cover/"),
  async (options) => (await saved(options.request)) ?? covers.handle(options),
);
