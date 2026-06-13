import type { GridItem } from '@/features/bookmarks/model'
import { isMirroredImageUrl, mirroredVariantUrl } from '@/lib/twitter-media-url'

const PRECACHE_START_DELAY_MS = 4_000
const PRECACHE_CONCURRENCY = 3
// On mobile (single narrow column), the browser picks w1280 at DPR 3 — 120 KB each.
// Cap total tiles and use a smaller tier to avoid saturating mobile bandwidth.
const PRECACHE_WIDTH_MOBILE = 320
const PRECACHE_WIDTH_DESKTOP = 680
const PRECACHE_MAX_TILES_MOBILE = 200
const PRECACHE_MAX_TILES_DESKTOP = 1500

let precacheStarted = false

type NetworkNavigator = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string }
}

function isSlowConnection(): boolean {
  const conn = (navigator as NetworkNavigator).connection
  if (!conn) return false
  if (conn.saveData) return true
  const type = conn.effectiveType
  return type === 'slow-2g' || type === '2g' || type === '3g'
}

function isMobileViewport(): boolean {
  return window.innerWidth <= 800
}

function shouldPrecache(): boolean {
  if (typeof window === 'undefined' || precacheStarted) {
    return false
  }
  return !isSlowConnection()
}

/**
 * Progressively fetches thumbnail variants for mirrored tiles after first paint.
 * Uses a smaller AVIF tier on mobile (w320 vs w680) and caps total tile count
 * to avoid saturating mobile bandwidth with multi-hundred-MB background downloads.
 */
export function startGridThumbPrecache(items: GridItem[]): void {
  if (!shouldPrecache()) {
    return
  }
  precacheStarted = true

  const mobile = isMobileViewport()
  const width = mobile ? PRECACHE_WIDTH_MOBILE : PRECACHE_WIDTH_DESKTOP
  const maxTiles = mobile ? PRECACHE_MAX_TILES_MOBILE : PRECACHE_MAX_TILES_DESKTOP

  const urls = [
    ...new Set(
      items
        .map((item) => item.thumbUrl)
        .filter((url) => isMirroredImageUrl(url))
        .map((url) => mirroredVariantUrl(url, width)),
    ),
  ].slice(0, maxTiles)

  if (urls.length === 0) {
    return
  }

  let nextIndex = 0

  const pump = async () => {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex]
      nextIndex += 1
      try {
        await fetch(url, { mode: 'no-cors', credentials: 'omit', priority: 'low' })
      } catch {
        // Best-effort cache warming; skip failures.
      }
    }
  }

  window.setTimeout(() => {
    for (let lane = 0; lane < PRECACHE_CONCURRENCY; lane += 1) {
      void pump()
    }
  }, PRECACHE_START_DELAY_MS)
}
