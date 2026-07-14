const LEGACY_MEDIA_CACHE_PREFIX = 'twitter-bookmarks-media-'

async function clearLegacyMediaCaches() {
  try {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(LEGACY_MEDIA_CACHE_PREFIX))
        .map((cacheName) => caches.delete(cacheName)),
    )
  } catch {
    // Cache Storage can be unavailable in Safari Private Browsing. This worker is
    // cleanup-only, so a failure must not affect the app's native network path.
  }
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    clearLegacyMediaCaches().then(() => self.clients.claim()),
  )
})
