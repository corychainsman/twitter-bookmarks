import type { GridItem, ImageRendition, MediaItem } from '@/features/bookmarks/model'
import {
  isMirroredImageUrl,
  resolveMirroredImageFallbackSourceSet,
  resolveTwitterImageSourceSet,
  withTwitterOriginalJpg,
  withTwitterSize,
} from '@/lib/twitter-media-url'

export type ImageDeliverySourceSet = {
  src: string
  srcSet?: string
  sizes?: string
}

export type GridMediaDelivery = {
  fallback?: ImageDeliverySourceSet
  image: ImageDeliverySourceSet
  isMotion: boolean
  previewUrl?: string
  renderOptimizedPicture: boolean
}

export type GridMediaDeliveryOptions = {
  devicePixelRatio?: number
  renderedWidth?: number
  sizes?: string
}

export type MediaRequestState = 'initial' | 'priority' | 'admitted' | 'deferred'

export type LightboxMediaDelivery =
  | {
      kind: 'photo'
      src: string
      srcSet?: Array<{ src: string; width: number; height: number }>
    }
  | {
      kind: 'video'
      src: string
      poster: string
    }

const MAX_GRID_DEVICE_PIXEL_RATIO = 2
const gridDeliveryCache = new WeakMap<GridItem, Map<string, GridMediaDelivery>>()
const lightboxDeliveryCache = new WeakMap<MediaItem, LightboxMediaDelivery>()

function normalizedRenditions(renditions: ImageRendition[] | undefined): ImageRendition[] {
  if (!renditions?.length) {
    return []
  }

  const byWidth = new Map<number, ImageRendition>()
  for (const rendition of renditions) {
    if (rendition.width > 0 && rendition.url) {
      byWidth.set(rendition.width, rendition)
    }
  }
  return [...byWidth.values()].sort((left, right) => left.width - right.width)
}

function resolveGridRenditions(
  renditions: ImageRendition[],
  options: GridMediaDeliveryOptions,
): ImageDeliverySourceSet | null {
  const candidates = normalizedRenditions(renditions)
  if (candidates.length === 0) {
    return null
  }

  const devicePixelRatio = Math.min(
    MAX_GRID_DEVICE_PIXEL_RATIO,
    Math.max(1, options.devicePixelRatio ?? 1),
  )
  const renderedWidth = Math.max(1, options.renderedWidth ?? candidates[0]!.width)
  const targetWidth = Math.ceil(renderedWidth * devicePixelRatio)
  const selectedIndex = Math.max(
    0,
    candidates.findIndex((candidate) => candidate.width >= targetWidth),
  )
  const resolvedIndex =
    candidates[selectedIndex]?.width >= targetWidth ? selectedIndex : candidates.length - 1
  // Do not expose renditions larger than the selected 2x cap. Otherwise a 3x
  // browser can override the cap when it evaluates srcset itself.
  const eligibleCandidates = candidates.slice(0, resolvedIndex + 1)
  const selected = eligibleCandidates[eligibleCandidates.length - 1]!

  return {
    src: selected.url,
    srcSet:
      eligibleCandidates.length > 1
        ? eligibleCandidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', ')
        : undefined,
    sizes: eligibleCandidates.length > 1 ? options.sizes : undefined,
  }
}

function gridDeliveryCacheKey(options: GridMediaDeliveryOptions): string {
  return `${options.devicePixelRatio ?? ''}|${options.renderedWidth ?? ''}|${options.sizes ?? ''}`
}

export function resolveGridMediaDelivery(
  item: GridItem,
  options: GridMediaDeliveryOptions = {},
): GridMediaDelivery {
  const cacheKey = gridDeliveryCacheKey(options)
  const cachedByOptions = gridDeliveryCache.get(item) ?? new Map<string, GridMediaDelivery>()
  const cached = cachedByOptions.get(cacheKey)
  if (cached) {
    return cached
  }

  const isMotion = item.mediaType === 'video' || item.mediaType === 'animated_gif'
  const sourceUrl = isMotion ? item.posterUrl ?? item.thumbUrl : item.thumbUrl
  const publishedImage = resolveGridRenditions(item.imageRenditions ?? [], options)
  const image =
    publishedImage ??
    resolveTwitterImageSourceSet(sourceUrl, {
      devicePixelRatio: options.devicePixelRatio,
      renderedWidth: options.renderedWidth,
      sizes: options.sizes,
    })
  const renderOptimizedPicture = Boolean(publishedImage) || isMirroredImageUrl(sourceUrl)
  const fallback = isMirroredImageUrl(sourceUrl)
    ? resolveMirroredImageFallbackSourceSet(sourceUrl, {
        devicePixelRatio: options.devicePixelRatio,
        renderedWidth: options.renderedWidth,
        sizes: options.sizes,
      })
    : publishedImage
      ? { src: sourceUrl }
      : undefined
  const delivery: GridMediaDelivery = {
    fallback,
    image,
    isMotion,
    previewUrl: isMotion ? item.previewUrl ?? item.fullUrl : undefined,
    renderOptimizedPicture,
  }
  cachedByOptions.set(cacheKey, delivery)
  gridDeliveryCache.set(item, cachedByOptions)
  return delivery
}

function dimensionsAtWidth(media: MediaItem, width: number) {
  const aspectRatio =
    media.aspectRatio ??
    (media.width && media.height && media.width > 0 && media.height > 0
      ? media.width / media.height
      : undefined)
  return {
    width,
    height: aspectRatio ? Math.round(width / aspectRatio) : media.height ?? width,
  }
}

function resolvePublishedLightboxPhoto(media: MediaItem): LightboxMediaDelivery | null {
  const renditions = normalizedRenditions(media.imageRenditions)
  if (renditions.length === 0) {
    return null
  }

  const sources = renditions.map((rendition) => ({
    src: rendition.url,
    ...dimensionsAtWidth(media, rendition.width),
  }))
  const original = withTwitterOriginalJpg(media.fullUrl)
  if (original !== sources[sources.length - 1]?.src && media.width && media.height) {
    sources.push({ src: original, width: media.width, height: media.height })
  }

  return {
    kind: 'photo',
    src: renditions[renditions.length - 1]!.url,
    srcSet: sources,
  }
}

function resolveLegacyLightboxPhoto(media: MediaItem): LightboxMediaDelivery {
  const sources: Array<{ src: string; width: number; height: number }> = []
  if (media.width && media.height && media.width > 0 && media.height > 0) {
    const small = withTwitterSize(media.fullUrl, 'small')
    const smallWidth = Math.min(680, media.width)
    sources.push({ src: small, ...dimensionsAtWidth(media, smallWidth) })
    const medium = withTwitterSize(media.fullUrl, 'medium')
    if (medium !== small) {
      const mediumWidth = Math.min(1200, media.width)
      sources.push({ src: medium, ...dimensionsAtWidth(media, mediumWidth) })
    }
    const large = withTwitterSize(media.fullUrl, 'large')
    if (large !== medium) {
      const largeWidth = Math.min(2048, media.width)
      sources.push({ src: large, ...dimensionsAtWidth(media, largeWidth) })
    }
    const original = withTwitterOriginalJpg(media.fullUrl)
    if (original !== large) {
      sources.push({ src: original, width: media.width, height: media.height })
    }
  }

  return {
    kind: 'photo',
    src: withTwitterSize(media.fullUrl, 'large'),
    srcSet: sources.length > 0 ? sources : undefined,
  }
}

export function resolveLightboxMediaDelivery(media: MediaItem): LightboxMediaDelivery {
  const cached = lightboxDeliveryCache.get(media)
  if (cached) {
    return cached
  }

  let delivery: LightboxMediaDelivery
  if (media.type === 'photo') {
    delivery = resolvePublishedLightboxPhoto(media) ?? resolveLegacyLightboxPhoto(media)
  } else {
    const posterRenditions = normalizedRenditions(media.imageRenditions)
    const poster =
      posterRenditions.find((rendition) => rendition.width >= 1200) ??
      posterRenditions[posterRenditions.length - 1]
    delivery = {
      kind: 'video',
      src: media.fullUrl,
      poster: poster?.url ?? withTwitterSize(media.posterUrl ?? media.thumbUrl, 'medium'),
    }
  }

  lightboxDeliveryCache.set(media, delivery)
  return delivery
}
