const TWITTER_IMAGE_HOST = 'pbs.twimg.com'
const TWITTER_RESIZABLE_PATH_PREFIX = '/media/'
const PRELOAD_COUNT = 12
type TwitterImageSize = 'small' | 'medium' | 'large'

type InitialGridItem = {
  mediaType?: string
  thumbUrl?: string
  posterUrl?: string
}

type InitialManifest = {
  buildId?: string
  files?: {
    gridAll?: string
  }
}

function withTwitterSize(url: string, size: TwitterImageSize): string {
  if (url.startsWith('https://pbs.twimg.com/media/')) {
    const queryIndex = url.indexOf('?'), nameIndex = url.indexOf('name='), nextParamIndex = nameIndex < 0 ? -1 : url.indexOf('&', nameIndex)
    return queryIndex < 0 ? `${url}?name=${size}` : nameIndex < 0 ? `${url}&name=${size}` : `${url.slice(0, nameIndex + 5)}${size}${url.slice(nextParamIndex < 0 ? url.length : nextParamIndex)}`
  }
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname !== TWITTER_IMAGE_HOST ||
      !parsed.pathname.startsWith(TWITTER_RESIZABLE_PATH_PREFIX)
    ) {
      return url
    }

    parsed.searchParams.set('name', size)
    return parsed.toString()
  } catch {
    return url
  }
}

const MIRROR_IMAGE_PATH_PREFIX = '/pbs/'
const MIRROR_WIDTHS = [320, 680, 1280]
const CANDIDATES: { size: TwitterImageSize; width: number }[] = [
  { size: 'small', width: 680 },
  { size: 'medium', width: 1200 },
  { size: 'large', width: 2048 },
]

function withMirrorWidth(url: string, targetWidth: number): string | null {
  try {
    const parsed = new URL(url)
    if (
      !parsed.pathname.startsWith(MIRROR_IMAGE_PATH_PREFIX) ||
      !/\.[a-z0-9]+$/i.test(parsed.pathname)
    ) {
      return null
    }

    const width =
      MIRROR_WIDTHS.find((candidate) => candidate >= targetWidth) ||
      MIRROR_WIDTHS[MIRROR_WIDTHS.length - 1]
    parsed.pathname = `${parsed.pathname.replace(/\.[a-z0-9]+$/i, '')}/w${width}.avif`
    parsed.search = ''
    return parsed.toString()
  } catch {
    return null
  }
}

function resolveImageUrl(item: InitialGridItem): string | null {
  const sourceUrl =
    item.mediaType === 'photo' ? item.thumbUrl : item.posterUrl || item.thumbUrl
  if (!sourceUrl) {
    return null
  }

  const columnWidth = Math.max(
    160,
    Math.min(520, Math.ceil(window.innerWidth / (window.innerWidth >= 1200 ? 4 : 2))),
  )
  const targetWidth = columnWidth * Math.max(1, window.devicePixelRatio || 1)

  const mirroredUrl = withMirrorWidth(sourceUrl, targetWidth)
  if (mirroredUrl) {
    return mirroredUrl
  }

  const candidate =
    CANDIDATES.find(({ width }) => width >= targetWidth) || CANDIDATES[CANDIDATES.length - 1]

  return withTwitterSize(sourceUrl, candidate.size)
}

function appendPreload(href: string) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = href
  link.fetchPriority = 'high'
  document.head.appendChild(link)
}

async function preloadInitialMedia() {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin)
  const manifestResponse = await fetch(new URL('data/manifest.json', appBase), {
    cache: 'no-store',
  })
  if (!manifestResponse.ok) {
    return
  }

  const manifest = (await manifestResponse.json()) as InitialManifest
  if (!manifest.buildId || !manifest.files?.gridAll) {
    return
  }

  const gridUrl = new URL(`data/${manifest.files.gridAll}`, appBase)
  gridUrl.searchParams.set('v', manifest.buildId)
  const gridResponse = await fetch(gridUrl)
  if (!gridResponse.ok) {
    return
  }

  const items = (await gridResponse.json()) as InitialGridItem[]
  for (let index = 0; index < PRELOAD_COUNT && index < items.length; index += 1) {
    const item = items[index]!
    const href = resolveImageUrl(item)
    if (href) {
      appendPreload(href)
    }
  }
}

void preloadInitialMedia().catch(() => {})
