import type { GridItem } from '@/features/bookmarks/model'
import { isMirroredImageUrl, MIRROR_IMAGE_WIDTHS, mirroredVariantUrl } from '@/lib/twitter-media-url'

const PRECACHE_START_DELAY_MS = 4_000
const PRECACHE_CONCURRENCY = 3

let precacheStarted = false

type SaveDataNavigator = Navigator & { connection?: { saveData?: boolean } }

function shouldPrecache(): boolean {
  if (typeof window === 'undefined' || precacheStarted) {
    return false
  }

  return !(navigator as SaveDataNavigator).connection?.saveData
}

// Approximates the tier the browser will pick from the tiles' srcset/sizes so
// the precached bytes are the same ones the grid requests.
function devicePrecacheWidth(): number {
  const viewportWidth = window.innerWidth || 1280
  const viewportFraction = viewportWidth <= 800 ? 1 : viewportWidth <= 1200 ? 0.5 : 0.33
  const targetPixelWidth = Math.ceil(
    viewportWidth * viewportFraction * Math.max(1, window.devicePixelRatio || 1),
  )

  return (
    MIRROR_IMAGE_WIDTHS.find((width) => width >= targetPixelWidth) ??
    MIRROR_IMAGE_WIDTHS[MIRROR_IMAGE_WIDTHS.length - 1]
  )
}

/**
 * Progressively fetches the grid-size variant of every mirrored tile after
 * first paint. The media-cache service worker (or plain HTTP cache, given the
 * immutable headers) absorbs each response, so scroll/filter/search hits are
 * served from disk afterwards.
 */
export function startGridThumbPrecache(items: GridItem[]): void {
  if (!shouldPrecache()) {
    return
  }
  precacheStarted = true

  const width = devicePrecacheWidth()
  const urls = [
    ...new Set(
      items
        .map((item) => item.thumbUrl)
        .filter((url) => isMirroredImageUrl(url))
        .map((url) => mirroredVariantUrl(url, width)),
    ),
  ]

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
