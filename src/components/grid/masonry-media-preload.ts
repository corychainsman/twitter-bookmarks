import type { GridItem } from '@/features/bookmarks/model'
import { resolveGridMediaDelivery } from '@/features/bookmarks/media-delivery'
import type { MediaPreloadCandidate } from '@/lib/media-preload'

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

    const delivery = resolveGridMediaDelivery(item, sourceSetOptions)
    candidates[writeIndex++] = {
      kind: 'image',
      url: delivery.image.src,
      ...(delivery.image.srcSet ? { srcSet: delivery.image.srcSet } : {}),
      ...(delivery.image.sizes ? { sizes: delivery.image.sizes } : {}),
    }

    if (delivery.isMotion && item.previewUrl) {
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
