const LEGACY_MEDIA_CACHE_PREFIX = 'twitter-bookmarks-media-'
const CLEANUP_WORKER_ACTIVATION_TIMEOUT_MS = 2_000

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

async function clearLegacyMediaCaches(): Promise<void> {
  if (typeof caches === 'undefined') {
    return
  }

  try {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(LEGACY_MEDIA_CACHE_PREFIX))
        .map((cacheName) => caches.delete(cacheName)),
    )
  } catch {
    // Safari can throw for all Cache Storage access in Private Browsing. Native
    // HTTP caching remains available, so cleanup is strictly best-effort.
  }
}

async function waitForCleanupWorkerActivation(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const worker = registration.installing ?? registration.waiting
  if (!worker || worker.state === 'activated') {
    return
  }

  await new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeoutId)
      worker.removeEventListener('statechange', handleStateChange)
      resolve()
    }
    const handleStateChange = () => {
      if (worker.state !== 'activated' && worker.state !== 'redundant') return
      finish()
    }
    const timeoutId = window.setTimeout(finish, CLEANUP_WORKER_ACTIVATION_TIMEOUT_MS)
    worker.addEventListener('statechange', handleStateChange)
  })
}

export async function registerMediaCacheWorker(): Promise<void> {
  if (!canUseMediaCacheWorker()) {
    return
  }

  await clearLegacyMediaCaches()

  try {
    const registration = await navigator.serviceWorker.register(resolveMediaCacheWorkerUrl(), {
      scope: resolveMediaCacheWorkerScope(),
    })
    await waitForCleanupWorkerActivation(registration)
    // The previously controlling worker can recreate its cache while the cleanup
    // worker installs. Purge once more after activation closes that race.
    await clearLegacyMediaCaches()
  } catch {
    // The worker only retires the old Cache API layer. Registration failure must
    // not prevent the app from using the CDN and the browser's HTTP cache.
  }
}
