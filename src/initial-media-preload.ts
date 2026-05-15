const TWITTER_IMAGE_HOST = 'pbs.twimg.com'
const TWITTER_RESIZABLE_PATH_PREFIX = '/media/'
const PRELOAD_COUNT = 12
const CANDIDATES = [
  { size: 'small', width: 680 },
  { size: 'medium', width: 1200 },
  { size: 'large', width: 2048 },
] as const

type InitialGridItem = {
  mediaType?: string
  thumbUrl?: string
  posterUrl?: string
}

type InitialManifest = {
  buildId?: string
  files?: {
    gridOne?: string
  }
}

function withTwitterSize(url: string, size: (typeof CANDIDATES)[number]['size']): string {
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
  if (!manifest.buildId || !manifest.files?.gridOne) {
    return
  }

  const gridUrl = new URL(`data/${manifest.files.gridOne}`, appBase)
  gridUrl.searchParams.set('v', manifest.buildId)
  const gridResponse = await fetch(gridUrl)
  if (!gridResponse.ok) {
    return
  }

  const items = (await gridResponse.json()) as InitialGridItem[]
  for (const item of items.slice(0, PRELOAD_COUNT)) {
    const href = resolveImageUrl(item)
    if (href) {
      appendPreload(href)
    }
  }
}

void preloadInitialMedia().catch(() => {})
