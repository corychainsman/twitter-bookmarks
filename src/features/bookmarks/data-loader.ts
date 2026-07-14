import type {
  CoreArtifacts,
  ExportArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
import type { EmbeddingArtifacts } from '@/features/bookmarks/embedding-artifacts'
import type { GridItem, Manifest, TweetDoc } from '@/features/bookmarks/model'
import {
  resolveArtifactPath,
  withArtifactVersion,
} from '@/features/bookmarks/artifact-url'
import {
  createBookmarksArtifactCache,
  type BookmarksArtifactCache,
} from '@/features/bookmarks/idb-cache'

export type JsonFetcher = <T>(path: string) => Promise<T>

export type DataLoaderOptions = {
  fetchJson?: JsonFetcher
  cache?: BookmarksArtifactCache
  deferBackgroundUntilPaint?: boolean
}

let dataUrlBase = ''
let defaultCache: BookmarksArtifactCache | null = null

function resolveDataUrl(path: string): string {
  dataUrlBase ||= new URL(import.meta.env.BASE_URL, window.location.origin).toString()
  return `${dataUrlBase}${path.charCodeAt(0) === 47 ? path.slice(1) : path}`
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

function waitForNextPaint(options?: DataLoaderOptions): Promise<void> {
  if (!options?.deferBackgroundUntilPaint || typeof requestAnimationFrame === 'undefined') {
    return Promise.resolve()
  }

  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export async function loadManifest(options?: DataLoaderOptions): Promise<Manifest> {
  if (!options?.fetchJson) {
    return fetchManifest()
  }

  return getFetchJson(options)<Manifest>('data/manifest.json')
}

export type ProgressiveCoreArtifacts = {
  manifest: Manifest
  /** Default-view slice that can render while the full query artifacts stream in. */
  firstPaintItems: GridItem[]
  /** Resolves with the full grid and ordering artifacts. */
  coreReady: Promise<CoreArtifacts>
  /** Resolves with TweetDoc chunks independently of the full grid. */
  docsReady: Promise<CoreArtifacts['docsChunks']>
  /** Best-effort persistence; never blocks the interactive app path. */
  cacheReady: Promise<void>
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
    return {
      manifest,
      firstPaintItems: artifacts.gridAll,
      coreReady: Promise.resolve(artifacts),
      docsReady: Promise.resolve(artifacts.docsChunks),
      cacheReady: Promise.resolve(),
    }
  }

  // Give the tiny default-view slice the connection before starting multi-megabyte
  // background artifacts. On constrained networks, firing every fetch together
  // makes the first paint compete with data the current viewport cannot use yet.
  const firstPaintItems = manifest.files.gridFirst
    ? await fetchJson<GridItem[]>(
        withArtifactVersion(resolveArtifactPath(manifest.files.gridFirst), manifest.buildId),
      )
    : null
  const backgroundStart = waitForNextPaint(options)
  const coreDataPromise = backgroundStart.then(() =>
    Promise.all([
      fetchJson<GridItem[]>(
        withArtifactVersion(resolveArtifactPath(manifest.files.gridAll), manifest.buildId),
      ),
      fetchJson<string[]>(
        withArtifactVersion(resolveArtifactPath(manifest.files.orderBookmarked), manifest.buildId),
      ),
      fetchJson<string[]>(
        withArtifactVersion(resolveArtifactPath(manifest.files.orderPosted), manifest.buildId),
      ),
    ]),
  )
  const docsPromise = backgroundStart.then(() =>
    Promise.all(
      manifest.files.docs.map((fileName) =>
        fetchJson<TweetDoc[]>(
          withArtifactVersion(resolveArtifactPath(fileName), manifest.buildId),
        ),
      ),
    ),
  )

  const coreReady = coreDataPromise.then(([gridAll, orderBookmarked, orderPosted]) => ({
    manifest,
    docsChunks: [],
    gridOne: [],
    gridAll,
    orderBookmarked,
    orderPosted,
  }))

  const docsReady = docsPromise.then((docs) =>
    manifest.files.docs.map((fileName, index) => ({
      fileName,
      docs: docs[index] ?? [],
    })),
  )
  const cacheReady = Promise.all([coreReady, docsReady])
    .then(async ([coreArtifacts, docsChunks]) => {
      await cache.setCore(manifest.buildId, {
        docsChunks,
        gridOne: [],
        gridAll: coreArtifacts.gridAll,
        orderBookmarked: coreArtifacts.orderBookmarked,
        orderPosted: coreArtifacts.orderPosted,
      })
    })
    .catch(() => undefined)

  return {
    manifest,
    firstPaintItems: firstPaintItems ?? (await coreReady).gridAll,
    coreReady,
    docsReady,
    cacheReady,
  }
}

export async function loadCoreArtifacts(options?: DataLoaderOptions): Promise<CoreArtifacts> {
  const { coreReady, docsReady, cacheReady } = await loadCoreArtifactsProgressive(options)
  const artifacts = await coreReady
  const docsChunks = await docsReady
  await cacheReady

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

  const [searchIndex, searchStore] = await Promise.all([
    fetchJson<ExportArtifacts['searchIndex']>(
      withArtifactVersion(resolveArtifactPath(manifest.files.searchIndex), manifest.buildId),
    ),
    fetchJson<ExportArtifacts['searchStore']>(
      withArtifactVersion(resolveArtifactPath(manifest.files.searchStore), manifest.buildId),
    ),
  ])
  const searchArtifacts: SearchArtifacts = { searchIndex, searchStore }

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
      withArtifactVersion(resolveArtifactPath(manifest.files.embeddings), manifest.buildId),
    ),
  }

  await cache.setEmbeddings(manifest.buildId, embeddingArtifacts)

  return embeddingArtifacts
}
