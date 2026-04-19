import type {
  CoreArtifacts,
  ExportArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
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

function resolveDataUrl(path: string): string {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL(path.replace(/^\//, ''), appBase).toString()
}

function resolveArtifactPath(path: string): string {
  return `data/${path.replace(/^\/+/, '')}`
}

function withVersionQuery(path: string, version: string): string {
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
  const response = await fetch(resolveDataUrl('data/manifest.json'), {
    cache: 'no-store',
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
  return options?.cache ?? createBookmarksArtifactCache()
}

export async function loadManifest(options?: DataLoaderOptions): Promise<Manifest> {
  if (!options?.fetchJson) {
    return fetchManifest()
  }

  return getFetchJson(options)<Manifest>('data/manifest.json')
}

export async function loadCoreArtifacts(options?: DataLoaderOptions): Promise<CoreArtifacts> {
  const fetchJson = getFetchJson(options)
  const cache = getCache(options)
  const manifest = await loadManifest(options)
  const cached = await cache.getCore(manifest.buildId)

  if (cached) {
    return {
      manifest,
      ...cached,
    }
  }

  const [docs, gridOne, gridAll, orderBookmarked, orderPosted] = await Promise.all([
    Promise.all(
      manifest.files.docs.map((fileName) =>
        fetchJson<TweetDoc[]>(
          withVersionQuery(resolveArtifactPath(fileName), manifest.buildId),
        ),
      ),
    ),
    fetchJson<GridItem[]>(
      withVersionQuery(resolveArtifactPath(manifest.files.gridOne), manifest.buildId),
    ),
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

  const coreArtifacts: CoreArtifacts = {
    manifest,
    docsChunks: manifest.files.docs.map((fileName, index) => ({
      fileName,
      docs: docs[index] ?? [],
    })),
    gridOne,
    gridAll,
    orderBookmarked,
    orderPosted,
  }

  await cache.setCore(manifest.buildId, {
    docsChunks: coreArtifacts.docsChunks,
    gridOne,
    gridAll,
    orderBookmarked,
    orderPosted,
  })

  return coreArtifacts
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
