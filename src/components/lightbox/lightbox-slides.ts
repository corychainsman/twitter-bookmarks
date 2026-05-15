import type { TweetDoc } from '@/features/bookmarks/model'
import { withTwitterOriginalJpg } from '@/lib/twitter-media-url'
import type { MediaPreloadCandidate } from '@/lib/media-preload'

export function createBookmarksLightboxSlides(tweet: TweetDoc | undefined) {
  return (tweet?.media ?? []).map((media) =>
    media.type === 'photo'
      ? {
          src: withTwitterOriginalJpg(media.fullUrl),
          width: media.width,
          height: media.height,
          alt: tweet?.text ?? '',
        }
      : {
          type: 'video' as const,
          src: media.fullUrl,
          poster: media.posterUrl ?? media.thumbUrl,
          width: media.width,
          height: media.height,
          loop: media.type === 'animated_gif',
          muted: media.type === 'animated_gif',
        },
  )
}

export function createLightboxPreloadCandidates(
  slides: ReturnType<typeof createBookmarksLightboxSlides>,
  index: number,
): MediaPreloadCandidate[] {
  const candidates: MediaPreloadCandidate[] = []
  const indexes = [index, index + 1, index - 1, index + 2, index - 2]

  for (const candidateIndex of indexes) {
    const slide = slides[candidateIndex]
    if (!slide) {
      continue
    }

    if ('type' in slide && slide.type === 'video') {
      candidates.push({ kind: 'image', url: slide.poster })
      continue
    }

    candidates.push({ kind: 'image', url: slide.src })
  }

  return candidates
}
