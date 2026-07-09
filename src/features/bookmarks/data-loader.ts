import type {
  CoreArtifacts,
  ExportArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
import type { EmbeddingArtifacts } from '@/features/bookmarks/embedding-artifacts'
import type { GridItem, Manifest, TweetDoc } from '@/features/bookmarks/model'
import {
  createBookmarksArtifactCache,
  type BookmarksArtifactCache,
} from '@/features/bookmarks/idb-cache'

export type JsonFetcher = <T>(path: string) => Promise<T>

export type DataLoaderOptions = {
  fetchJson?: JsonFetcher
  cache?: BookmarksArtifactCache
}

let dataUrlBase = ''
let defaultCache: BookmarksArtifactCache | null = null

function resolveDataUrl(path: string): string {
  dataUrlBase ||= new URL(import.meta.env.BASE_URL, window.location.origin).toString()
  return `${dataUrlBase}${path.charCodeAt(0) === 47 ? path.slice(1) : path}`
}

function resolveArtifactPath(path: string): string {
  return `data/${path.replace(/^\/+/, '')}`
}

function withVersionQuery(path: string, version: string): string {
  if (path.indexOf('?') < 0) return `${path}?v=${version}`
  const [pathname, existingQuery = ''] = path.split('?')
  const params = new URLSearchParams(existingQuery)
  params.set('v', version)
  const query = params.toString()

  return query.length > 0 ? `${pathname}?${query}` : pathname
}

async function defaultFetchJson<T>(path: string): Promise<T> {
  const response = await fetch(resolveDataUrl(path))

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

async function fetchManifest(): Promise<Manifest> {
  // no-cache (not no-store): still revalidates on every load so new buildIds are
  // picked up immediately, but lets the request match the index.html preload and
  // reuse the cached body on a 304.
  const response = await fetch(resolveDataUrl('data/manifest.json'), {
    cache: 'no-cache',
  })

  if (!response.ok) {
    throw new Error(
      `Failed to load data/manifest.json: ${response.status} ${response.statusText}`,
    )
  }

  return response.json() as Promise<Manifest>
}

function getFetchJson(options?: DataLoaderOptions): JsonFetcher {
  return options?.fetchJson ?? defaultFetchJson
}

function getCache(options?: DataLoaderOptions): BookmarksArtifactCache {
  return options?.cache ?? (defaultCache ??= createBookmarksArtifactCache())
}

export async function loadManifest(options?: DataLoaderOptions): Promise<Manifest> {
  if (!options?.fetchJson) {
    return fetchManifest()
  }

  return getFetchJson(options)<Manifest>('data/manifest.json')
}

export type ProgressiveCoreArtifacts = {
  /** Ready to render/query; docsChunks is empty on the network path until docsReady resolves. */
  artifacts: CoreArtifacts
  /** Resolves with the docs chunks (immediately when served from the IDB cache). */
  docsReady: Promise<CoreArtifacts['docsChunks']>
}

/**
 * Loads the artifacts the grid needs for first render (gridAll + orders) and lets
 * docs chunks — only needed for captions, one-mode, and random sort — stream in
 * behind them. The IDB cache is written only once docs have arrived, so cached
 * loads always contain complete data.
 */
export async function loadCoreArtifactsProgressive(
  options?: DataLoaderOptions,
): Promise<ProgressiveCoreArtifacts> {
  const fetchJson = getFetchJson(options)
  const cache = getCache(options)
  const manifest = await loadManifest(options)
  const cached = await cache.getCore(manifest.buildId)

  if (cached) {
    const artifacts: CoreArtifacts = {
      manifest,
      ...cached,
      gridOne: [],
    }
    return { artifacts, docsReady: Promise.resolve(artifacts.docsChunks) }
  }

  const docsPromise = Promise.all(
    manifest.files.docs.map((fileName) =>
      fetchJson<TweetDoc[]>(
        withVersionQuery(resolveArtifactPath(fileName), manifest.buildId),
      ),
    ),
  )
  const [gridAll, orderBookmarked, orderPosted] = await Promise.all([
    fetchJson<GridItem[]>(
      withVersionQuery(resolveArtifactPath(manifest.files.gridAll), manifest.buildId),
    ),
    fetchJson<string[]>(
      withVersionQuery(resolveArtifactPath(manifest.files.orderBookmarked), manifest.buildId),
    ),
    fetchJson<string[]>(
      withVersionQuery(resolveArtifactPath(manifest.files.orderPosted), manifest.buildId),
    ),
  ])

  const artifacts: CoreArtifacts = {
    manifest,
    docsChunks: [],
    gridOne: [],
    gridAll,
    orderBookmarked,
    orderPosted,
  }

  const docsReady = docsPromise.then(async (docs) => {
    const docsChunks = manifest.files.docs.map((fileName, index) => ({
      fileName,
      docs: docs[index] ?? [],
    }))

    await cache.setCore(manifest.buildId, {
      docsChunks,
      gridOne: [],
      gridAll,
      orderBookmarked,
      orderPosted,
    })

    return docsChunks
  })

  return { artifacts, docsReady }
}

export async function loadCoreArtifacts(options?: DataLoaderOptions): Promise<CoreArtifacts> {
  const { artifacts, docsReady } = await loadCoreArtifactsProgressive(options)
  const docsChunks = await docsReady

  return { ...artifacts, docsChunks }
}

export async function loadSearchArtifacts(
  manifest: Manifest,
  options?: DataLoaderOptions,
): Promise<SearchArtifacts> {
  const fetchJson = getFetchJson(options)
  const cache = getCache(options)
  const cached = await cache.getSearch(manifest.buildId)

  if (cached) {
    return cached
  }

  const searchArtifacts: SearchArtifacts = {
    searchIndex: await fetchJson<ExportArtifacts['searchIndex']>(
      withVersionQuery(resolveArtifactPath(manifest.files.searchIndex), manifest.buildId),
    ),
    searchStore: await fetchJson<ExportArtifacts['searchStore']>(
      withVersionQuery(resolveArtifactPath(manifest.files.searchStore), manifest.buildId),
    ),
  }

  await cache.setSearch(manifest.buildId, searchArtifacts)

  return searchArtifacts
}

export async function loadEmbeddingArtifacts(
  manifest: Manifest,
  options?: DataLoaderOptions,
): Promise<EmbeddingArtifacts> {
  if (!manifest.files.embeddings) {
    throw new Error('Semantic embeddings are not exported. Run bun run data:embeddings.')
  }

  const fetchJson = getFetchJson(options)
  const cache = getCache(options)
  const cached = await cache.getEmbeddings(manifest.buildId)

  if (cached) {
    return cached
  }

  const embeddingArtifacts: EmbeddingArtifacts = {
    embeddingIndex: await fetchJson<EmbeddingArtifacts['embeddingIndex']>(
      withVersionQuery(resolveArtifactPath(manifest.files.embeddings), manifest.buildId),
    ),
  }

  await cache.setEmbeddings(manifest.buildId, embeddingArtifacts)

  return embeddingArtifacts
}
