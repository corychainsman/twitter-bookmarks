export type TwitterImageSize = 'small' | 'medium' | 'large' | 'orig'

const TWITTER_IMAGE_HOST = 'pbs.twimg.com'
const TWITTER_RESIZABLE_PATH_PREFIX = '/media/'
const MIRRORED_TWITTER_MEDIA_PATH_PREFIX = '/pbs/media/'
const twitterOriginalJpgCache = new Map<string, string>()
const mirroredTwitterSourceSetCache = new Map<string, Map<number | string, TwitterImageSourceSet>>()
const twitterSizeCache = new Map<string, Map<TwitterImageSize, string>>()

// Self-hosted mirror images live at <base>/pbs/<twimg-path>; resized AVIF
// variants always exist at <base>/pbs/<path-without-extension>/w{N}.avif.
// Keep in sync with MIRROR_VARIANT_WIDTHS in scripts/mirror-lib.ts.
const MIRROR_IMAGE_PATH_PREFIX = '/pbs/'
export const MIRROR_IMAGE_WIDTHS = [320, 480, 680, 960, 1280] as const

// Above 2x, extra physical pixels are visually indistinguishable in grid tiles
// but roughly double the bytes; cap the multiplier used for tier selection.
const MAX_EFFECTIVE_DEVICE_PIXEL_RATIO = 2

export function isMirroredImageUrl(url: string): boolean {
  if (!url) {
    return false
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  return (
    parsed.pathname.startsWith(MIRROR_IMAGE_PATH_PREFIX) && /\.[a-z0-9]+$/i.test(parsed.pathname)
  )
}

export function mirroredVariantUrl(url: string, width: number): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  const stem = parsed.pathname.replace(/\.[a-z0-9]+$/i, '')
  parsed.pathname = `${stem}/w${width}.avif`
  parsed.search = ''
  return parsed.toString()
}

function mirroredTwitterMediaUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (!parsed.pathname.startsWith(MIRRORED_TWITTER_MEDIA_PATH_PREFIX)) {
    return null
  }

  const mediaPath = parsed.pathname.slice('/pbs'.length)
  return `https://${TWITTER_IMAGE_HOST}${mediaPath}`
}

const MIRROR_SIZE_WIDTHS: Record<Exclude<TwitterImageSize, 'orig'>, number> = {
  small: 680,
  medium: 1280,
  large: 1280,
}

export function withTwitterSize(url: string, size: TwitterImageSize): string {
  if (!url) {
    return url
  }
  const cachedBySize = twitterSizeCache.get(url) ?? (twitterSizeCache.set(url, new Map()), twitterSizeCache.get(url)!)
  const cached = cachedBySize.get(size)
  if (cached) return cached
  if (url.startsWith('https://pbs.twimg.com/media/')) {
    const queryIndex = url.indexOf('?'), nameIndex = url.indexOf('name='), nextParamIndex = nameIndex < 0 ? -1 : url.indexOf('&', nameIndex)
    const sizedUrl = queryIndex < 0
      ? `${url}?name=${size}`
      : nameIndex < 0
        ? `${url}&name=${size}`
        : `${url.slice(0, nameIndex + 5)}${size}${url.slice(nextParamIndex < 0 ? url.length : nextParamIndex)}`
    cachedBySize.set(size, sizedUrl)
    return sizedUrl
  }

  if (isMirroredImageUrl(url)) {
    return size === 'orig' ? url : mirroredVariantUrl(url, MIRROR_SIZE_WIDTHS[size])
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    cachedBySize.set(size, url)
    return url
  }

  if (parsed.hostname !== TWITTER_IMAGE_HOST) {
    cachedBySize.set(size, url)
    return url
  }

  if (!parsed.pathname.startsWith(TWITTER_RESIZABLE_PATH_PREFIX)) {
    cachedBySize.set(size, url)
    return url
  }

  parsed.searchParams.set('name', size)
  const sizedUrl = parsed.toString()
  cachedBySize.set(size, sizedUrl)
  return sizedUrl
}

export function withTwitterOriginalJpg(url: string): string {
  if (!url) {
    return url
  }
  const cached = twitterOriginalJpgCache.get(url)
  if (cached) return cached
  if (url.startsWith('https://pbs.twimg.com/media/')) {
    const queryIndex = url.indexOf('?')
    const originalJpgUrl = `${queryIndex < 0 ? url : url.slice(0, queryIndex)}?format=jpg&name=orig`
    twitterOriginalJpgCache.set(url, originalJpgUrl)
    return originalJpgUrl
  }

  if (isMirroredImageUrl(url)) {
    // Mirrored URLs already point at the archived original bytes.
    return url
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    twitterOriginalJpgCache.set(url, url)
    return url
  }

  if (parsed.hostname !== TWITTER_IMAGE_HOST) {
    twitterOriginalJpgCache.set(url, url)
    return url
  }

  if (!parsed.pathname.startsWith(TWITTER_RESIZABLE_PATH_PREFIX)) {
    twitterOriginalJpgCache.set(url, url)
    return url
  }

  parsed.search = 'format=jpg&name=orig'
  const originalJpgUrl = parsed.toString()
  twitterOriginalJpgCache.set(url, originalJpgUrl)
  return originalJpgUrl
}

export type TwitterImageSourceSet = {
  src: string
  srcSet?: string
  sizes?: string
}

type TwitterImageSourceSetOptions = {
  devicePixelRatio?: number
  maxSize?: Exclude<TwitterImageSize, 'orig'>
  renderedWidth?: number
  sizes?: string
}

const RESPONSIVE_SIZES =
  '(max-width: 800px) 100vw, (max-width: 1200px) 50vw, 33vw'
const sourceSetCache = new Map<string, Map<number | string, TwitterImageSourceSet>>()

function resolveEffectiveDevicePixelRatio(devicePixelRatio: number | undefined): number {
  if (!Number.isFinite(devicePixelRatio) || !devicePixelRatio || devicePixelRatio <= 0) {
    return 1
  }

  return Math.min(devicePixelRatio, MAX_EFFECTIVE_DEVICE_PIXEL_RATIO)
}

function resolveMaxTwitterImageCandidate(
  options: TwitterImageSourceSetOptions,
): Exclude<TwitterImageSize, 'orig'> {
  const renderedWidth = Number.isFinite(options.renderedWidth) ? options.renderedWidth : undefined
  const devicePixelRatio = resolveEffectiveDevicePixelRatio(options.devicePixelRatio)

  if (renderedWidth && renderedWidth > 0) {
    const targetPixelWidth = renderedWidth * devicePixelRatio
    return targetPixelWidth <= 680 ? 'small' : targetPixelWidth <= 1200 ? 'medium' : 'large'
  }

  return options.maxSize ?? 'large'
}

function hasRenderedWidthOption(options: TwitterImageSourceSetOptions): boolean {
  return Boolean(
    Number.isFinite(options.renderedWidth) && options.renderedWidth && options.renderedWidth > 0,
  )
}

function resolveMirroredImageSourceSet(
  url: string,
  options: TwitterImageSourceSetOptions,
): TwitterImageSourceSet {
  const candidates = MIRROR_IMAGE_WIDTHS.map((width) => ({
    width,
    url: mirroredVariantUrl(url, width),
  }))

  const devicePixelRatio = resolveEffectiveDevicePixelRatio(options.devicePixelRatio)
  const renderedWidth = hasRenderedWidthOption(options) ? options.renderedWidth : undefined
  const targetPixelWidth = renderedWidth
    ? Math.ceil(renderedWidth * devicePixelRatio)
    : MIRROR_SIZE_WIDTHS[options.maxSize ?? 'medium']
  const selected =
    candidates.find(({ width }) => width >= targetPixelWidth) ?? candidates[candidates.length - 1]
  const selectedIndex = candidates.indexOf(selected)
  const eligibleCandidates = candidates.slice(0, selectedIndex + 1)

  return {
    src: selected.url,
    srcSet:
      eligibleCandidates.length > 1
        ? eligibleCandidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', ')
        : undefined,
    sizes: eligibleCandidates.length > 1 ? options.sizes ?? RESPONSIVE_SIZES : undefined,
  }
}

export function resolveMirroredImageFallbackSourceSet(
  url: string,
  options: TwitterImageSourceSetOptions = {},
): TwitterImageSourceSet {
  const cachedByOptions = mirroredTwitterSourceSetCache.get(url) ?? (mirroredTwitterSourceSetCache.set(url, new Map()), mirroredTwitterSourceSetCache.get(url)!)
  const cacheKey = options.devicePixelRatio === 1 && options.maxSize === undefined && options.renderedWidth && options.sizes === `${options.renderedWidth}px`
    ? options.renderedWidth
    : `${options.devicePixelRatio ?? ''}|${options.maxSize ?? ''}|${options.renderedWidth ?? ''}|${options.sizes ?? ''}`
  const cached = cachedByOptions.get(cacheKey)
  if (cached) return cached

  const twitterUrl = mirroredTwitterMediaUrl(url)
  const sourceSet = twitterUrl
    ? resolveTwitterImageSourceSet(twitterUrl, options)
    : { src: url }
  cachedByOptions.set(cacheKey, sourceSet)
  return sourceSet
}

export function resolveTwitterImageSourceSet(
  url: string,
  options: TwitterImageSourceSetOptions = {},
): TwitterImageSourceSet {
  const cachedByOptions = sourceSetCache.get(url) ?? (sourceSetCache.set(url, new Map()), sourceSetCache.get(url)!)
  const cacheKey = options.devicePixelRatio === 1 && options.maxSize === undefined && options.renderedWidth && options.sizes === `${options.renderedWidth}px`
    ? options.renderedWidth
    : `${options.devicePixelRatio ?? ''}|${options.maxSize ?? ''}|${options.renderedWidth ?? ''}|${options.sizes ?? ''}`
  const cached = cachedByOptions.get(cacheKey)
  if (cached) return cached

  if (isMirroredImageUrl(url)) {
    const sourceSet = resolveMirroredImageSourceSet(url, options)
    cachedByOptions.set(cacheKey, sourceSet)
    return sourceSet
  }

  const hasRenderedWidth = hasRenderedWidthOption(options)
  const maxCandidate = resolveMaxTwitterImageCandidate(options)
  const small = withTwitterSize(url, 'small')
  if (maxCandidate === 'small') {
    const sourceSet = { src: small }
    cachedByOptions.set(cacheKey, sourceSet)
    return sourceSet
  }
  const medium = withTwitterSize(url, 'medium')
  if (maxCandidate === 'medium') {
    const sourceSet = small === url && medium === url
      ? { src: url }
      : {
          src: hasRenderedWidth ? medium : options.maxSize === 'small' ? small : medium,
          srcSet: `${small} 680w, ${medium} 1200w`,
          sizes: options.sizes ?? RESPONSIVE_SIZES,
        }
    cachedByOptions.set(cacheKey, sourceSet)
    return sourceSet
  }
  const large = withTwitterSize(url, 'large')
  if (small === url && medium === url && large === url) {
    const sourceSet = { src: url }
    cachedByOptions.set(cacheKey, sourceSet)
    return sourceSet
  }

  const srcSet = `${small} 680w, ${medium} 1200w, ${large} 2048w`
  const src = hasRenderedWidth ? large : options.maxSize === 'small' ? small : medium

  const sourceSet = {
    src,
    srcSet,
    sizes: options.sizes ?? RESPONSIVE_SIZES,
  }
  cachedByOptions.set(cacheKey, sourceSet)
  return sourceSet
}
