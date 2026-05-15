const MEDIA_CACHE_NAME = 'twitter-bookmarks-media-v1'
const CACHEABLE_MEDIA_HOSTS = new Set(['pbs.twimg.com', 'video.twimg.com'])
const MAX_MEDIA_CACHE_ENTRIES = 900
const WARM_BATCH_SIZE = 8

function isCacheableMediaUrl(url) {
  try {
    return CACHEABLE_MEDIA_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function isCacheableMediaRequest(request) {
  return request.method === 'GET' && isCacheableMediaUrl(request.url)
}

async function trimMediaCache(cache) {
  const keys = await cache.keys()
  if (keys.length <= MAX_MEDIA_CACHE_ENTRIES) {
    return
  }

  await Promise.all(keys.slice(0, keys.length - MAX_MEDIA_CACHE_ENTRIES).map((key) => cache.delete(key)))
}

async function cacheMediaRequest(request) {
  const cache = await caches.open(MEDIA_CACHE_NAME)
  const cached = await cache.match(request, { ignoreVary: true })

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone())
    void trimMediaCache(cache)
  }

  return response
}

async function warmMediaUrl(url) {
  if (!isCacheableMediaUrl(url)) {
    return
  }

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
