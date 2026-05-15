import type { GridItem } from '@/features/bookmarks/model'
import type { MediaPreloadCandidate } from '@/lib/media-preload'
import { resolveTwitterImageSourceSet } from '@/lib/twitter-media-url'

export function createMasonryMediaPreloadCandidates(input: {
  devicePixelRatio: number
  items: GridItem[]
  renderedWidth: number
  startIndex: number
  take: number
}): MediaPreloadCandidate[] {
  const startIndex = Math.max(0, Math.floor(input.startIndex))
  const endIndex = Math.min(input.items.length, startIndex + Math.max(0, Math.floor(input.take)))
  const candidates: MediaPreloadCandidate[] = []

  for (let index = startIndex; index < endIndex; index += 1) {
    const item = input.items[index]
    if (!item) {
      continue
    }

    const sourceUrl =
      item.mediaType === 'photo'
        ? item.thumbUrl
        : item.posterUrl ?? item.thumbUrl
    const imageSources = resolveTwitterImageSourceSet(sourceUrl, {
      devicePixelRatio: input.devicePixelRatio,
      renderedWidth: input.renderedWidth,
      sizes: `${input.renderedWidth}px`,
    })

    candidates.push({
      kind: 'image',
      url: imageSources.src,
    })
  }

  return candidates
}
