import type { TweetDoc } from '@/features/bookmarks/model'
import { resolveLightboxMediaDelivery } from '@/features/bookmarks/media-delivery'
import type { MediaPreloadCandidate } from '@/lib/media-preload'

const lightboxSlidesCache = new WeakMap<TweetDoc, ReturnType<typeof buildBookmarksLightboxSlides>>()

function buildBookmarksLightboxSlides(tweet: TweetDoc | undefined) {
  if (!tweet) return []
  const slides = new Array(tweet.media.length)
  for (let index = 0; index < tweet.media.length; index += 1) {
    const media = tweet.media[index]!
    const gridId = `${tweet.id}:${index}`
    const delivery = resolveLightboxMediaDelivery(media)
    slides[index] = delivery.kind === 'photo'
      ? {
          gridId,
          src: delivery.src,
          srcSet: delivery.srcSet,
          width: media.width,
          height: media.height,
          alt: tweet.text ?? '',
        }
      : {
          gridId,
          type: 'video' as const,
          src: delivery.src,
          poster: delivery.poster,
          width: media.width,
          height: media.height,
          loop: true,
          muted: false,
        }
  }
  return slides
}

export function createBookmarksLightboxSlides(tweet: TweetDoc | undefined) {
  if (!tweet) return []
  const cached = lightboxSlidesCache.get(tweet)
  if (cached) return cached
  const slides = buildBookmarksLightboxSlides(tweet)
  lightboxSlidesCache.set(tweet, slides)
  return slides
}

const lightboxPreloadCandidatesCache = new WeakMap<ReturnType<typeof createBookmarksLightboxSlides>, Map<number, MediaPreloadCandidate[]>>()

function pushLightboxPreloadCandidate(
  candidates: MediaPreloadCandidate[],
  slide: ReturnType<typeof createBookmarksLightboxSlides>[number] | undefined,
) {
  if (!slide) return
  candidates.push({ kind: 'image', url: 'type' in slide && slide.type === 'video' ? slide.poster : slide.src })
}

function buildLightboxPreloadCandidates(
  slides: ReturnType<typeof createBookmarksLightboxSlides>,
  index: number,
): MediaPreloadCandidate[] {
  const candidates: MediaPreloadCandidate[] = []
  pushLightboxPreloadCandidate(candidates, slides[index])
  pushLightboxPreloadCandidate(candidates, slides[index + 1])
  pushLightboxPreloadCandidate(candidates, slides[index - 1])
  pushLightboxPreloadCandidate(candidates, slides[index + 2])
  pushLightboxPreloadCandidate(candidates, slides[index - 2])

  return candidates
}

export function createLightboxPreloadCandidates(
  slides: ReturnType<typeof createBookmarksLightboxSlides>,
  index: number,
): MediaPreloadCandidate[] {
  const byIndex = lightboxPreloadCandidatesCache.get(slides) ?? (lightboxPreloadCandidatesCache.set(slides, new Map()), lightboxPreloadCandidatesCache.get(slides)!)
  const cached = byIndex.get(index)
  if (cached) return cached
  const candidates = buildLightboxPreloadCandidates(slides, index)
  byIndex.set(index, candidates)
  return candidates
}
