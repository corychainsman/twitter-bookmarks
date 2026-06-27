import type { TweetDoc } from '@/features/bookmarks/model'
import {
  withTwitterOriginalJpg,
  withTwitterSize,
} from '@/lib/twitter-media-url'
import type { MediaPreloadCandidate } from '@/lib/media-preload'

const lightboxSlidesCache = new WeakMap<TweetDoc, ReturnType<typeof buildBookmarksLightboxSlides>>()

function createLightboxImageSourceSet(media: TweetDoc['media'][number]) {
  if (!media.width || !media.height || media.width <= 0 || media.height <= 0) {
    return undefined
  }

  const mediaWidth = media.width
  const mediaHeight = media.height
  const aspectRatio = mediaWidth / mediaHeight
  const sources = []
  const small = withTwitterSize(media.fullUrl, 'small')
  const smallWidth = Math.min(680, mediaWidth)
  sources.push({ src: small, width: smallWidth, height: Math.round(smallWidth / aspectRatio) })
  const medium = withTwitterSize(media.fullUrl, 'medium')
  if (medium !== small) {
    const mediumWidth = Math.min(1200, mediaWidth)
    sources.push({ src: medium, width: mediumWidth, height: Math.round(mediumWidth / aspectRatio) })
  }
  const large = withTwitterSize(media.fullUrl, 'large')
  if (large !== medium) {
    const largeWidth = Math.min(2048, mediaWidth)
    sources.push({ src: large, width: largeWidth, height: Math.round(largeWidth / aspectRatio) })
  }
  const src = withTwitterOriginalJpg(media.fullUrl)
  if (src !== large) sources.push({ src, width: mediaWidth, height: mediaHeight })
  return sources
}

function buildBookmarksLightboxSlides(tweet: TweetDoc | undefined) {
  if (!tweet) return []
  const slides = new Array(tweet.media.length)
  for (let index = 0; index < tweet.media.length; index += 1) {
    const media = tweet.media[index]!
    const gridId = `${tweet.id}:${index}`
    slides[index] = media.type === 'photo'
      ? {
          gridId,
          src: withTwitterSize(media.fullUrl, 'large'),
          srcSet: createLightboxImageSourceSet(media),
          width: media.width,
          height: media.height,
          alt: tweet.text ?? '',
        }
      : {
          gridId,
          type: 'video' as const,
          src: media.fullUrl,
          poster: withTwitterSize(media.posterUrl ?? media.thumbUrl, 'medium'),
          width: media.width,
          height: media.height,
          loop: media.type === 'animated_gif',
          muted: true,
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
