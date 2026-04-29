import { describe, expect, it, vi } from 'vitest'

import type {
  CoreArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
import type { EmbeddingArtifacts } from '@/features/bookmarks/embedding-artifacts'
import {
  loadEmbeddingArtifacts,
  loadCoreArtifacts,
  loadSearchArtifacts,
  type JsonFetcher,
} from '@/features/bookmarks/data-loader'
import type { Manifest } from '@/features/bookmarks/model'

const manifest: Manifest = {
  buildId: 'build-1',
  builtAt: '2026-04-17T19:00:00.000Z',
  tweetCount: 1,
  gridItemCountOne: 1,
  gridItemCountAll: 1,
  chunkSize: 500,
  files: {
    docs: ['tweets/docs-0001.json'],
    gridOne: 'grid/one.json',
    gridAll: 'grid/all.json',
    orderBookmarked: 'order/bookmarked.json',
    orderPosted: 'order/posted.json',
    searchIndex: 'search/index.json',
    searchStore: 'search/store.json',
    embeddings: 'embeddings/index.json',
  },
}

describe('data loader', () => {
  it('loads core artifacts without fetching search files', async () => {
    const requestedPaths: string[] = []
    const fetchJson: JsonFetcher = async <T,>(path: string): Promise<T> => {
      requestedPaths.push(path)

      const responses: Record<string, unknown> = {
        'data/manifest.json': manifest,
        'data/tweets/docs-0001.json?v=build-1': [
          {
            id: 'tweet-1',
            sortIndex: '100',
            postedAt: '2026-03-12T10:00:00.000Z',
            url: 'https://x.com/alice/status/tweet-1',
            text: 'Example',
            folderNames: [],
            media: [
              {
                type: 'photo',
                thumbUrl: 'https://img/1.jpg',
                fullUrl: 'https://img/1.jpg',
              },
            ],
            representativeMediaIndex: 0,
            representativeMotionMediaIndex: 0,
          },
        ],
        'data/grid/one.json?v=build-1': [{ gridId: 'tweet-1:0', tweetId: 'tweet-1', mediaIndex: 0, mediaType: 'photo', thumbUrl: 'https://img/1.jpg', fullUrl: 'https://img/1.jpg' }],
        'data/grid/all.json?v=build-1': [{ gridId: 'tweet-1:0', tweetId: 'tweet-1', mediaIndex: 0, mediaType: 'photo', thumbUrl: 'https://img/1.jpg', fullUrl: 'https://img/1.jpg' }],
        'data/order/bookmarked.json?v=build-1': ['tweet-1'],
        'data/order/posted.json?v=build-1': ['tweet-1'],
        'search/index.json': { shouldNotLoad: true },
        'search/store.json': [{ id: 'tweet-1' }],
      }

      return responses[path] as T
    }

    const cache = {
      getCore: vi.fn(async () => null),
      setCore: vi.fn(async () => undefined),
      getSearch: vi.fn(async () => null),
      setSearch: vi.fn(async () => undefined),
      getEmbeddings: vi.fn(async () => null),
      setEmbeddings: vi.fn(async () => undefined),
    }

    const artifacts = await loadCoreArtifacts({ fetchJson, cache })

    expect(artifacts.manifest.buildId).toBe('build-1')
    expect(requestedPaths).toEqual([
      'data/manifest.json',
      'data/tweets/docs-0001.json?v=build-1',
      'data/grid/one.json?v=build-1',
      'data/grid/all.json?v=build-1',
      'data/order/bookmarked.json?v=build-1',
      'data/order/posted.json?v=build-1',
    ])
    expect(cache.setCore).toHaveBeenCalledTimes(1)
  })

  it('loads search artifacts on demand and reuses the cache on repeat calls', async () => {
    const requestedPaths: string[] = []
    const searchArtifacts: SearchArtifacts = {
      searchIndex: { serialized: true },
      searchStore: [{ id: 'tweet-1', text: 'example', quotedText: '', articleTitle: '', articleText: '', authorName: '', authorHandle: '', folderNames: '' }],
    }
    let cachedSearch: SearchArtifacts | null = null

    const fetchJson: JsonFetcher = async <T,>(path: string): Promise<T> => {
      requestedPaths.push(path)

      if (path === 'data/search/index.json?v=build-1') {
        return searchArtifacts.searchIndex as T
      }
      if (path === 'data/search/store.json?v=build-1') {
        return searchArtifacts.searchStore as T
      }

      throw new Error(`Unexpected path ${path}`)
    }

    const cache = {
      getCore: vi.fn(async (): Promise<CoreArtifacts | null> => null),
      setCore: vi.fn(async () => undefined),
      getSearch: vi.fn(async () => cachedSearch),
      setSearch: vi.fn(async (_buildId: string, value: SearchArtifacts) => {
        cachedSearch = value
      }),
      getEmbeddings: vi.fn(async (): Promise<EmbeddingArtifacts | null> => null),
      setEmbeddings: vi.fn(async () => undefined),
    }

    const first = await loadSearchArtifacts(manifest, { fetchJson, cache })
    const second = await loadSearchArtifacts(manifest, { fetchJson, cache })

    expect(first).toEqual(searchArtifacts)
    expect(second).toEqual(searchArtifacts)
    expect(requestedPaths).toEqual([
      'data/search/index.json?v=build-1',
      'data/search/store.json?v=build-1',
    ])
  })

  it('loads embedding artifacts on demand and reuses the cache on repeat calls', async () => {
    const requestedPaths: string[] = []
    const embeddingArtifacts: EmbeddingArtifacts = {
      embeddingIndex: {
        version: 1,
        buildId: 'build-1',
        builtAt: '2026-04-17T19:00:00.000Z',
        model: {
          id: 'test-model',
          dimensions: 2,
          quantization: 'int8-unit-vector',
        },
        records: [],
        vectors: '',
      },
    }
    let cachedEmbeddings: EmbeddingArtifacts | null = null

    const fetchJson: JsonFetcher = async <T,>(path: string): Promise<T> => {
      requestedPaths.push(path)

      if (path === 'data/embeddings/index.json?v=build-1') {
        return embeddingArtifacts.embeddingIndex as T
      }

      throw new Error(`Unexpected path ${path}`)
    }

    const cache = {
      getCore: vi.fn(async (): Promise<CoreArtifacts | null> => null),
      setCore: vi.fn(async () => undefined),
      getSearch: vi.fn(async (): Promise<SearchArtifacts | null> => null),
      setSearch: vi.fn(async () => undefined),
      getEmbeddings: vi.fn(async () => cachedEmbeddings),
      setEmbeddings: vi.fn(async (_buildId: string, value: EmbeddingArtifacts) => {
        cachedEmbeddings = value
      }),
    }

    const first = await loadEmbeddingArtifacts(manifest, { fetchJson, cache })
    const second = await loadEmbeddingArtifacts(manifest, { fetchJson, cache })

    expect(first).toEqual(embeddingArtifacts)
    expect(second).toEqual(embeddingArtifacts)
    expect(requestedPaths).toEqual(['data/embeddings/index.json?v=build-1'])
  })
})
