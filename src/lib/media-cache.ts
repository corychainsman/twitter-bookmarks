const CACHEABLE_MEDIA_HOSTS = new Set(['pbs.twimg.com', 'video.twimg.com'])
const warmedMediaUrls = new Set<string>()

type MediaCacheMessage = {
  type: 'warm-media-cache'
  urls: string[]
}

function canUseMediaCacheWorker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    (window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  )
}

function resolveMediaCacheWorkerUrl(): string {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL('media-cache-sw.js', baseUrl).toString()
}

function resolveMediaCacheWorkerScope(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function isCacheableMediaUrl(url: string): boolean {
  try {
    return CACHEABLE_MEDIA_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

export function registerMediaCacheWorker(): void {
  if (!canUseMediaCacheWorker()) {
    return
  }

  void navigator.serviceWorker.register(resolveMediaCacheWorkerUrl(), {
    scope: resolveMediaCacheWorkerScope(),
  })
}

export function warmMediaCache(urls: string[]): string[] {
  if (!canUseMediaCacheWorker()) {
    return []
  }

  const cacheableUrls = urls.filter((url) => {
    if (!isCacheableMediaUrl(url) || warmedMediaUrls.has(url)) {
      return false
    }

    warmedMediaUrls.add(url)
    return true
  })

  if (cacheableUrls.length === 0) {
    return []
  }

  const message: MediaCacheMessage = {
    type: 'warm-media-cache',
    urls: cacheableUrls,
  }

  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message)
    return cacheableUrls
  }

  void navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage(message)
  })

  return cacheableUrls
}
