import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { createBookmarksArtifactCache } from '@/features/bookmarks/idb-cache'

describe('bookmarks artifact cache', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('twitter-bookmarks-cache')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  })

  it('stores and retrieves core, search, and embedding artifacts separately by build id', async () => {
    const cache = createBookmarksArtifactCache()

    await cache.setCore('build-a', {
      docsChunks: [
        {
          fileName: 'tweets/docs-0001.json',
          docs: [],
        },
      ],
      gridOne: [],
      gridAll: [],
      orderBookmarked: ['tweet-1'],
      orderPosted: ['tweet-1'],
    })
    await cache.setSearch('build-a', {
      searchIndex: { serialized: true },
      searchStore: [
        {
          id: 'tweet-1',
          text: 'example',
          quotedText: '',
          articleTitle: '',
          articleText: '',
          authorName: '',
          authorHandle: '',
          folderNames: '',
        },
      ],
    })
    await cache.setEmbeddings('build-a', {
      embeddingIndex: {
        version: 1,
        buildId: 'build-a',
        builtAt: '2026-04-17T19:00:00.000Z',
        model: {
          id: 'test-model',
          dimensions: 2,
          quantization: 'int8-unit-vector',
        },
        records: [],
        vectors: '',
      },
    })

    expect(await cache.getCore('build-a')).toEqual({
      docsChunks: [
        {
          fileName: 'tweets/docs-0001.json',
          docs: [],
        },
      ],
      gridOne: [],
      gridAll: [],
      orderBookmarked: ['tweet-1'],
      orderPosted: ['tweet-1'],
    })
    expect(await cache.getSearch('build-a')).toEqual({
      searchIndex: { serialized: true },
      searchStore: [
        {
          id: 'tweet-1',
          text: 'example',
          quotedText: '',
          articleTitle: '',
          articleText: '',
          authorName: '',
          authorHandle: '',
          folderNames: '',
        },
      ],
    })
    expect(await cache.getEmbeddings('build-a')).toEqual({
      embeddingIndex: {
        version: 1,
        buildId: 'build-a',
        builtAt: '2026-04-17T19:00:00.000Z',
        model: {
          id: 'test-model',
          dimensions: 2,
          quantization: 'int8-unit-vector',
        },
        records: [],
        vectors: '',
      },
    })
    expect(await cache.getCore('missing')).toBeNull()
    expect(await cache.getSearch('missing')).toBeNull()
    expect(await cache.getEmbeddings('missing')).toBeNull()
  })
})
