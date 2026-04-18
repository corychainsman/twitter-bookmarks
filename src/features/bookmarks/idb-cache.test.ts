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

  it('stores and retrieves core and search artifacts separately by build id', async () => {
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
    expect(await cache.getCore('missing')).toBeNull()
    expect(await cache.getSearch('missing')).toBeNull()
  })
})
