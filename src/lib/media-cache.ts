// Keep in sync with CACHEABLE_MEDIA_HOSTS in public/media-cache-sw.js.
const CACHEABLE_MEDIA_HOSTS = new Set([
  'pbs.twimg.com',
  'video.twimg.com',
  'tbmedia.corychainsman.com',
])
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

type NetworkInformationLike = {
  saveData?: boolean
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
}

// On narrow-viewport (usually cellular) devices, cap how many off-screen tiles the
// background warm may fetch; desktop warms the full current view.
export const BACKGROUND_WARM_MOBILE_VIEWPORT_MAX_PX = 800
export const BACKGROUND_WARM_MOBILE_TILE_CAP = 200

const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g', '3g'])

// Background cache warming (e.g. the full off-screen thumb tier) is a nice-to-have,
// not something worth spending a user's metered/slow connection on.
export function isConnectionEligibleForBackgroundWarm(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  if (!connection) {
    return true
  }

  if (connection.saveData) {
    return false
  }

  return !connection.effectiveType || !SLOW_EFFECTIVE_TYPES.has(connection.effectiveType)
}

export function warmMediaCache(urls: string[]): string[] {
  if (!canUseMediaCacheWorker()) {
    return []
  }

  const cacheableUrls: string[] = []
  for (const url of urls) {
    if (warmedMediaUrls.has(url) || !isCacheableMediaUrl(url)) {
      continue
    }

    warmedMediaUrls.add(url)
    cacheableUrls.push(url)
  }

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
