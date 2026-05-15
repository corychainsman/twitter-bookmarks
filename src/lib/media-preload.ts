export type MediaPreloadKind = 'image' | 'video'

export type MediaPreloadCandidate = {
  kind: MediaPreloadKind
  url?: string
}

export type MediaPreloader = {
  preloadImage: (url: string) => void
  preloadVideo: (url: string) => void
}

export const DEFAULT_PRELOAD_CONCURRENCY = 6

export function createBrowserMediaPreloader(): MediaPreloader {
  return {
    preloadImage(url) {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
    },
    preloadVideo(url) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'video'
      link.href = url
      document.head.appendChild(link)
    },
  }
}

export function preloadMediaCandidates(
  candidates: MediaPreloadCandidate[],
  options: {
    concurrency?: number
    preloader?: MediaPreloader
    seen?: Set<string>
  } = {},
): string[] {
  if (typeof document === 'undefined' && !options.preloader) {
    return []
  }

  const preloader = options.preloader ?? createBrowserMediaPreloader()
  const seen = options.seen ?? new Set<string>()
  const concurrency = Math.max(0, options.concurrency ?? DEFAULT_PRELOAD_CONCURRENCY)
  const loadedUrls: string[] = []

  for (const candidate of candidates) {
    if (loadedUrls.length >= concurrency) {
      break
    }

    if (!candidate.url || seen.has(candidate.url)) {
      continue
    }

    seen.add(candidate.url)
    loadedUrls.push(candidate.url)

    if (candidate.kind === 'video') {
      preloader.preloadVideo(candidate.url)
      continue
    }

    preloader.preloadImage(candidate.url)
  }

  return loadedUrls
}
