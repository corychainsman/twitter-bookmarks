export type TwitterImageSize = 'small' | 'medium' | 'large' | 'orig'

const TWITTER_IMAGE_HOST = 'pbs.twimg.com'
const TWITTER_RESIZABLE_PATH_PREFIX = '/media/'

export function withTwitterSize(url: string, size: TwitterImageSize): string {
  if (!url) {
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

  parsed.searchParams.set('name', size)
  return parsed.toString()
}

export type TwitterImageSourceSet = {
  src: string
  srcSet?: string
  sizes?: string
}

const RESPONSIVE_SIZES =
  '(max-width: 800px) 100vw, (max-width: 1200px) 50vw, 33vw'

export function resolveTwitterImageSourceSet(url: string): TwitterImageSourceSet {
  const small = withTwitterSize(url, 'small')
  const medium = withTwitterSize(url, 'medium')
  const large = withTwitterSize(url, 'large')

  if (small === url && medium === url && large === url) {
    return { src: url }
  }

  return {
    src: medium,
    srcSet: `${small} 680w, ${medium} 1200w, ${large} 2048w`,
    sizes: RESPONSIVE_SIZES,
  }
}
