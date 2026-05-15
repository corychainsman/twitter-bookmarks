import type { TweetDoc } from '@/features/bookmarks/model'
import {
  withTwitterOriginalJpg,
  withTwitterSize,
  type TwitterImageSize,
} from '@/lib/twitter-media-url'
import type { MediaPreloadCandidate } from '@/lib/media-preload'

const LIGHTBOX_IMAGE_SIZES: Array<{
  size: Exclude<TwitterImageSize, 'orig'>
  width: number
}> = [
  { size: 'small', width: 680 },
  { size: 'medium', width: 1200 },
  { size: 'large', width: 2048 },
]

function createLightboxImageSourceSet(media: TweetDoc['media'][number]) {
  if (!media.width || !media.height || media.width <= 0 || media.height <= 0) {
    return undefined
  }

  const mediaWidth = media.width
  const mediaHeight = media.height
  const aspectRatio = mediaWidth / mediaHeight
  const sources = LIGHTBOX_IMAGE_SIZES.map(({ size, width }) => {
    const sourceWidth = Math.min(width, mediaWidth)

    return {
      src: withTwitterSize(media.fullUrl, size),
      width: sourceWidth,
      height: Math.round(sourceWidth / aspectRatio),
    }
  })

  sources.push({
    src: withTwitterOriginalJpg(media.fullUrl),
    width: mediaWidth,
    height: mediaHeight,
  })

  return sources.filter(
    (source, index) => sources.findIndex((candidate) => candidate.src === source.src) === index,
  )
}

export function createBookmarksLightboxSlides(tweet: TweetDoc | undefined) {
  return (tweet?.media ?? []).map((media) =>
    media.type === 'photo'
      ? {
          src: withTwitterSize(media.fullUrl, 'large'),
          srcSet: createLightboxImageSourceSet(media),
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
