/// <reference lib="webworker" />

import { CacheableResponsePlugin } from "workbox-cacheable-response"
import type { CacheDidUpdateCallbackParam, WorkboxPlugin } from "workbox-core/types"
import { ExpirationPlugin } from "workbox-expiration"
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching"
import { registerRoute } from "workbox-routing"
import { CacheFirst, NetworkFirst } from "workbox-strategies"

import { runtimeCacheEntryCap, type RuntimeCacheKind, type StorageEstimateLike } from "./cache-policy"

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener("message", (event) => {
  if (event.data && typeof event.data === "object" && "type" in event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting()
  }
})

async function estimateStorage(): Promise<StorageEstimateLike | undefined> {
  try {
    if (!("storage" in self.navigator)) return undefined
    return await self.navigator.storage.estimate()
  } catch {
    return undefined
  }
}

class AdaptiveCacheLimitPlugin implements WorkboxPlugin {
  private readonly kind: RuntimeCacheKind
  private writesSincePrune = 0
  private pendingPrune: Promise<void> | undefined

  constructor(kind: RuntimeCacheKind) {
    this.kind = kind
  }

  async cacheDidUpdate({ cacheName }: CacheDidUpdateCallbackParam) {
    this.writesSincePrune += 1
    if (this.writesSincePrune < 8) return

    this.writesSincePrune = 0
    this.pendingPrune ??= this.prune(cacheName).finally(() => {
      this.pendingPrune = undefined
    })
    await this.pendingPrune
  }

  private async prune(cacheName: string) {
    const cap = runtimeCacheEntryCap(this.kind, await estimateStorage())
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()
    const excess = requests.length - cap
    if (excess <= 0) return

    await Promise.all(requests.slice(0, excess).map((request) => cache.delete(request)))
  }
}

registerRoute(
  ({ request, url }) =>
    request.method === "GET"
    && (
      (url.origin === self.location.origin && url.pathname.endsWith(".wasm"))
      || (
        url.origin === self.location.origin
        && url.pathname.includes("/assets/ort-wasm-")
        && url.pathname.endsWith(".mjs")
      )
      || (
        url.hostname === "cdn.jsdelivr.net"
        && url.pathname.includes("/onnxruntime-web@")
        && (url.pathname.endsWith(".wasm") || url.pathname.endsWith(".mjs"))
      )
    ),
  new CacheFirst({
    cacheName: "x-inspo-semantic-runtime-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: true,
      }),
    ],
  }),
)

const navigationStrategy = new NetworkFirst({
  cacheName: "x-inspo-app-shell-v1",
  networkTimeoutSeconds: 4,
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({
      maxEntries: 12,
      maxAgeSeconds: 60 * 60 * 24 * 7,
      purgeOnQuotaError: true,
    }),
  ],
})

registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" && url.origin === self.location.origin && !url.pathname.startsWith("/api"),
  async (options) => {
    try {
      return await navigationStrategy.handle(options)
    } catch {
      return await matchPrecache("/index.html") ?? Response.error()
    }
  },
)

registerRoute(
  ({ request, url }) =>
    request.method === "GET" && url.origin === self.location.origin && (url.pathname === "/api" || url.pathname.startsWith("/api/")),
  new NetworkFirst({
    cacheName: "elsewhere-recent-results-v3",
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60, purgeOnQuotaError: true }),
      new AdaptiveCacheLimitPlugin("results"),
    ],
  }),
)

registerRoute(
  ({ request, sameOrigin }) => request.destination === "image" && sameOrigin,
  new CacheFirst({
    cacheName: "elsewhere-media-v2",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 140,
        maxAgeSeconds: 60 * 60 * 24 * 14,
        purgeOnQuotaError: true,
      }),
      new AdaptiveCacheLimitPlugin("media"),
    ],
  }),
)

registerRoute(
  ({ request, sameOrigin }) => request.destination === "image" && !sameOrigin,
  new CacheFirst({
    cacheName: "elsewhere-cross-origin-media-v2",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 12,
        maxAgeSeconds: 60 * 60 * 24 * 7,
        purgeOnQuotaError: true,
      }),
      new AdaptiveCacheLimitPlugin("opaque-media"),
    ],
  }),
)

registerRoute(
  ({ request, sameOrigin }) => request.destination === "video" && sameOrigin && !request.headers.has("range"),
  new CacheFirst({
    cacheName: "elsewhere-video-previews-v2",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 60 * 24 * 3,
        purgeOnQuotaError: true,
      }),
      new AdaptiveCacheLimitPlugin("video"),
    ],
  }),
)

registerRoute(
  ({ request, url }) =>
    request.method === "GET" && url.origin === self.location.origin && url.pathname.startsWith("/models/"),
  new CacheFirst({
    cacheName: "x-inspo-semantic-model-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
)
