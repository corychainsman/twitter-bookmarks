export type TwitterImageSize = 'small' | 'medium' | 'large' | 'orig'

const TWITTER_IMAGE_HOST = 'pbs.twimg.com'
const TWITTER_RESIZABLE_PATH_PREFIX = '/media/'

// Self-hosted mirror images live at <base>/pbs/<twimg-path>; resized AVIF
// variants always exist at <base>/pbs/<path-without-extension>/w{N}.avif.
const MIRROR_IMAGE_PATH_PREFIX = '/pbs/'
export const MIRROR_IMAGE_WIDTHS = [320, 680, 1280] as const

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

const MIRROR_SIZE_WIDTHS: Record<Exclude<TwitterImageSize, 'orig'>, number> = {
  small: 680,
  medium: 1280,
  large: 1280,
}

export function withTwitterSize(url: string, size: TwitterImageSize): string {
  if (!url) {
    return url
  }

  if (isMirroredImageUrl(url)) {
    return size === 'orig' ? url : mirroredVariantUrl(url, MIRROR_SIZE_WIDTHS[size])
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (parsed.hostname !== TWITTER_IMAGE_HOST) {
    return url
  }

  if (!parsed.pathname.startsWith(TWITTER_RESIZABLE_PATH_PREFIX)) {
    return url
  }

  parsed.searchParams.set('name', size)
  return parsed.toString()
}

export function withTwitterOriginalJpg(url: string): string {
  if (!url) {
    return url
  }

  if (isMirroredImageUrl(url)) {
    // Mirrored URLs already point at the archived original bytes.
    return url
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (parsed.hostname !== TWITTER_IMAGE_HOST) {
    return url
  }

  if (!parsed.pathname.startsWith(TWITTER_RESIZABLE_PATH_PREFIX)) {
    return url
  }

  parsed.search = new URLSearchParams({
    format: 'jpg',
    name: 'orig',
  }).toString()
  return parsed.toString()
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

const TWITTER_IMAGE_CANDIDATES: Array<{
  size: Exclude<TwitterImageSize, 'orig'>
  width: number
}> = [
  { size: 'small', width: 680 },
  { size: 'medium', width: 1200 },
  { size: 'large', width: 2048 },
]

function getTwitterImageCandidateRank(size: Exclude<TwitterImageSize, 'orig'>): number {
  return TWITTER_IMAGE_CANDIDATES.findIndex((candidate) => candidate.size === size)
}

function resolveMaxTwitterImageCandidate(
  options: TwitterImageSourceSetOptions,
): Exclude<TwitterImageSize, 'orig'> {
  const renderedWidth = Number.isFinite(options.renderedWidth) ? options.renderedWidth : undefined
  const devicePixelRatio =
    Number.isFinite(options.devicePixelRatio) && options.devicePixelRatio && options.devicePixelRatio > 0
      ? options.devicePixelRatio
      : 1

  if (renderedWidth && renderedWidth > 0) {
    const targetPixelWidth = Math.ceil(renderedWidth * devicePixelRatio)
    const candidate =
      TWITTER_IMAGE_CANDIDATES.find(({ width }) => width >= targetPixelWidth) ??
      TWITTER_IMAGE_CANDIDATES[TWITTER_IMAGE_CANDIDATES.length - 1]

    return candidate.size
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

  const devicePixelRatio =
    Number.isFinite(options.devicePixelRatio) && options.devicePixelRatio && options.devicePixelRatio > 0
      ? options.devicePixelRatio
      : 1
  const renderedWidth = hasRenderedWidthOption(options) ? options.renderedWidth : undefined
  const targetPixelWidth = renderedWidth
    ? Math.ceil(renderedWidth * devicePixelRatio)
    : MIRROR_SIZE_WIDTHS[options.maxSize ?? 'medium']
  const selected =
    candidates.find(({ width }) => width >= targetPixelWidth) ?? candidates[candidates.length - 1]

  return {
    src: selected.url,
    srcSet: candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', '),
    sizes: options.sizes ?? RESPONSIVE_SIZES,
  }
}

export function resolveTwitterImageSourceSet(
  url: string,
  options: TwitterImageSourceSetOptions = {},
): TwitterImageSourceSet {
  if (isMirroredImageUrl(url)) {
    return resolveMirroredImageSourceSet(url, options)
  }

  const small = withTwitterSize(url, 'small')
  const medium = withTwitterSize(url, 'medium')
  const large = withTwitterSize(url, 'large')
  const urlsBySize: Record<Exclude<TwitterImageSize, 'orig'>, string> = {
    small,
    medium,
    large,
  }
  const maxCandidate = resolveMaxTwitterImageCandidate(options)
  const maxCandidateRank = getTwitterImageCandidateRank(maxCandidate)
  const candidateSizes = TWITTER_IMAGE_CANDIDATES.slice(0, maxCandidateRank + 1).map(
    (candidate) => ({
      ...candidate,
      url: urlsBySize[candidate.size],
    }),
  )

  if (small === url && medium === url && large === url) {
    return { src: url }
  }

  const src = hasRenderedWidthOption(options)
    ? urlsBySize[maxCandidate]
    : options.maxSize === 'small'
      ? small
      : medium

  return {
    src,
    srcSet: candidateSizes.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', '),
    sizes: options.sizes ?? RESPONSIVE_SIZES,
  }
}
