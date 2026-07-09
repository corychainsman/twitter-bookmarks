import type { GridItem } from '@/features/bookmarks/model'
import type { MediaPreloadCandidate } from '@/lib/media-preload'
import { resolveTwitterImageSourceSet } from '@/lib/twitter-media-url'

const preloadCandidatesCache = new WeakMap<GridItem[], Map<number | string, MediaPreloadCandidate[]>>()

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
  const candidates = new Array<MediaPreloadCandidate>((endIndex - startIndex) * 2)
  let writeIndex = 0
  // Resolve through the same source-set logic MediaTile uses so the preloader
  // warms exactly the tier the rendered <img> will request.
  const sourceSetOptions = {
    devicePixelRatio: input.devicePixelRatio,
    renderedWidth: input.renderedWidth,
    sizes: `${input.renderedWidth}px`,
  }

  for (let index = startIndex; index < endIndex; index += 1) {
    const item = input.items[index]
    if (!item) {
      continue
    }

    const isMotion = item.mediaType === 'video' || item.mediaType === 'animated_gif'
    const sourceUrl = isMotion ? item.posterUrl ?? item.thumbUrl : item.thumbUrl
    candidates[writeIndex++] = {
      kind: 'image',
      url: resolveTwitterImageSourceSet(sourceUrl, sourceSetOptions).src,
    }

    if (isMotion && item.previewUrl) {
      candidates[writeIndex++] = {
        kind: 'video',
        url: item.previewUrl,
      }
    }
  }

  candidates.length = writeIndex
  cachedByKey.set(cacheKey, candidates)
  return candidates
}
