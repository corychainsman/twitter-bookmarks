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

export function registerMediaCacheWorker(): void {
  if (!canUseMediaCacheWorker()) {
    return
  }

  void navigator.serviceWorker.register(resolveMediaCacheWorkerUrl(), {
    scope: resolveMediaCacheWorkerScope(),
  })
}
