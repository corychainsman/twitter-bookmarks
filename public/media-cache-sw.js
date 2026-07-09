const MEDIA_CACHE_NAME = 'twitter-bookmarks-media-v2'
// Keep in sync with CACHEABLE_MEDIA_HOSTS in src/lib/media-cache.ts.
const CACHEABLE_MEDIA_HOSTS = new Set([
  'pbs.twimg.com',
  'video.twimg.com',
  'tbmedia.corychainsman.com',
])
// High enough to hold the full mirrored thumb tier (~3k tiles) plus overflow.
const MAX_MEDIA_CACHE_ENTRIES = 4500
const WARM_BATCH_SIZE = 8

function isCacheableMediaUrl(url) {
  try {
    return CACHEABLE_MEDIA_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function isCacheableMediaRequest(request) {
  // Range requests (video seeking/scrubbing) must hit the network directly: the Cache
  // API has no concept of partial content, so caching a 206 here would serve the wrong
  // byte range back for a later seek to a different offset on the same URL.
  return (
    request.method === 'GET' && !request.headers.has('Range') && isCacheableMediaUrl(request.url)
  )
}

async function trimMediaCache(cache) {
  try {
    const keys = await cache.keys()
    if (keys.length <= MAX_MEDIA_CACHE_ENTRIES) {
      return
    }

    await Promise.all(keys.slice(0, keys.length - MAX_MEDIA_CACHE_ENTRIES).map((key) => cache.delete(key)))
  } catch {
    // Best-effort trim; a failure here must not affect any in-flight fetch.
  }
}

async function cacheMediaRequest(request) {
  // The Cache API is meaningfully stricter in some browsers (e.g. Safari throws on
  // certain opaque-response writes and on any Cache access in Private Browsing).
  // A caching failure must never turn an otherwise-successful fetch into a failed
  // one for the page, so every cache read/write here is best-effort: fall back to
  // a plain network fetch if the cache layer misbehaves at any step.
  let cache
  try {
    cache = await caches.open(MEDIA_CACHE_NAME)
    const cached = await cache.match(request, { ignoreVary: true })
    if (cached) {
      return cached
    }
  } catch {
    return fetch(request)
  }

  const response = await fetch(request)

  if (response.ok || response.type === 'opaque') {
    try {
      await cache.put(request, response.clone())
      void trimMediaCache(cache)
    } catch {
      // Best-effort: ignore cache write failures, still return the real response.
    }
  }

  return response
}

async function warmMediaUrl(url) {
  if (!isCacheableMediaUrl(url)) {
    return
  }

  // Best-effort background warming; failures here must never surface as an error
  // to the page (this runs detached from any real image request).
  try {
    const request = new Request(url, {
      credentials: 'omit',
      mode: 'no-cors',
    })
    const cache = await caches.open(MEDIA_CACHE_NAME)

    if (await cache.match(request, { ignoreVary: true })) {
      return
    }

    const response = await fetch(request)
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response)
    }
  } catch {
    // ignore
  }
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (!isCacheableMediaRequest(event.request)) {
    return
  }

  event.respondWith(cacheMediaRequest(event.request))
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'warm-media-cache' || !Array.isArray(event.data.urls)) {
    return
  }

  const urls = [...new Set(event.data.urls.filter((url) => typeof url === 'string'))]
  event.waitUntil(
    (async () => {
      for (let index = 0; index < urls.length; index += WARM_BATCH_SIZE) {
        await Promise.all(urls.slice(index, index + WARM_BATCH_SIZE).map(warmMediaUrl))
      }

      const cache = await caches.open(MEDIA_CACHE_NAME)
      await trimMediaCache(cache)
    })(),
  )
})
