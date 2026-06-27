import type { GridItem } from '@/features/bookmarks/model'
import type { MediaPreloadCandidate } from '@/lib/media-preload'
import { withTwitterSize } from '@/lib/twitter-media-url'

const preloadCandidatesCache = new WeakMap<GridItem[], Map<number | string, MediaPreloadCandidate[]>>()

function resolvePreloadImageUrl(url: string, size: 'small' | 'medium' | 'large') {
  return withTwitterSize(url, size)
}

export function createMasonryMediaPreloadCandidates(input: {
  devicePixelRatio: number
  items: GridItem[]
  renderedWidth: number
  startIndex: number
  take: number
}): MediaPreloadCandidate[] {
  const startIndex = Math.max(0, Math.floor(input.startIndex))
  const endIndex = Math.min(input.items.length, startIndex + Math.max(0, Math.floor(input.take)))
  const cacheKey = input.devicePixelRatio === 1 ? input.renderedWidth * 1_000_000_000 + startIndex * 100_000 + endIndex : `${input.devicePixelRatio}|${input.renderedWidth}|${startIndex}|${endIndex}`
  const cachedByKey = preloadCandidatesCache.get(input.items) ?? (preloadCandidatesCache.set(input.items, new Map()), preloadCandidatesCache.get(input.items)!)
  const cached = cachedByKey.get(cacheKey)
  if (cached) return cached
  const candidates = new Array<MediaPreloadCandidate>(endIndex - startIndex)
  let writeIndex = 0
  const targetWidth = Math.ceil(input.renderedWidth * Math.max(1, input.devicePixelRatio))
  const size = targetWidth <= 680 ? 'small' : targetWidth <= 1200 ? 'medium' : 'large'

  for (let index = startIndex; index < endIndex; index += 1) {
    const item = input.items[index]
    if (!item) {
      continue
    }

    const sourceUrl =
      item.mediaType === 'photo'
        ? item.thumbUrl
        : item.posterUrl ?? item.thumbUrl
    candidates[writeIndex++] = {
      kind: 'image',
      url: resolvePreloadImageUrl(sourceUrl, size),
    }
  }

  candidates.length = writeIndex
  cachedByKey.set(cacheKey, candidates)
  return candidates
}
