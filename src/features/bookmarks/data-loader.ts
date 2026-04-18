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

async function defaultFetchJson<T>(path: string): Promise<T> {
  const response = await fetch(resolveDataUrl(path))

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

function getFetchJson(options?: DataLoaderOptions): JsonFetcher {
  return options?.fetchJson ?? defaultFetchJson
}

function getCache(options?: DataLoaderOptions): BookmarksArtifactCache {
  return options?.cache ?? createBookmarksArtifactCache()
}

export async function loadManifest(options?: DataLoaderOptions): Promise<Manifest> {
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
      manifest.files.docs.map((fileName) => fetchJson<TweetDoc[]>(resolveArtifactPath(fileName))),
    ),
    fetchJson<GridItem[]>(resolveArtifactPath(manifest.files.gridOne)),
    fetchJson<GridItem[]>(resolveArtifactPath(manifest.files.gridAll)),
    fetchJson<string[]>(resolveArtifactPath(manifest.files.orderBookmarked)),
    fetchJson<string[]>(resolveArtifactPath(manifest.files.orderPosted)),
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
      resolveArtifactPath(manifest.files.searchIndex),
    ),
    searchStore: await fetchJson<ExportArtifacts['searchStore']>(
      resolveArtifactPath(manifest.files.searchStore),
    ),
  }

  await cache.setSearch(manifest.buildId, searchArtifacts)

  return searchArtifacts
}
