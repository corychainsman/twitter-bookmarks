import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import { loadCoreArtifactsProgressive } from '@/features/bookmarks/data-loader'
import { useBookmarksPageController } from '@/app/bookmarks/useBookmarksPageController'

vi.mock('@/features/bookmarks/data-loader', () => ({
  loadCoreArtifactsProgressive: vi.fn(),
}))

const coreArtifacts: CoreArtifacts = {
  manifest: {
    buildId: 'test-build',
    builtAt: '2026-05-01T00:00:00.000Z',
    tweetCount: 0,
    gridItemCountOne: 0,
    gridItemCountAll: 0,
    chunkSize: 500,
    files: {
      docs: [],
      gridOne: 'grid-one.json',
      gridAll: 'grid-all.json',
      orderBookmarked: 'order-bookmarked.json',
      orderPosted: 'order-posted.json',
      searchIndex: 'search-index.json',
      searchStore: 'search-store.json',
    },
  },
  docsChunks: [],
  gridOne: [],
  gridAll: [],
  orderBookmarked: [],
  orderPosted: [],
}

class MockWorker {
  static instances: MockWorker[] = []
  static nextResult: { total: number; orderedGridIds: string[] } = {
    total: 0,
    orderedGridIds: [],
  }

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  postMessage = vi.fn((message: { type?: string }) => {
    if (message.type !== 'query') {
      return
    }

    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          type: 'result',
          result: MockWorker.nextResult,
        },
      } as MessageEvent<unknown>)
    })
  })
  terminate = vi.fn()

  constructor() {
    MockWorker.instances.push(this)
  }
}

function getQueryWorker() {
  const worker = MockWorker.instances[0]
  if (!worker) {
    throw new Error('Expected query worker to be constructed.')
  }
  return worker
}

function getQueryMessages() {
  return getQueryWorker().postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === 'query')
}

function getEmbeddingMessages() {
  return MockWorker.instances[1]?.postMessage.mock.calls.map(([message]) => message) ?? []
}

async function flushReactWork() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useBookmarksPageController', () => {
  beforeEach(() => {
    MockWorker.instances = []
    MockWorker.nextResult = { total: 0, orderedGridIds: [] }
    vi.mocked(loadCoreArtifactsProgressive).mockResolvedValue({
      artifacts: coreArtifacts,
      docsReady: Promise.resolve(coreArtifacts.docsChunks),
    })

    vi.stubGlobal('Worker', MockWorker)
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps typing responsive while debouncing expensive search result refreshes', async () => {
    const { result } = renderHook(() => useBookmarksPageController())

    await flushReactWork()
    await flushReactWork()

    expect(loadCoreArtifactsProgressive).toHaveBeenCalled()
    expect(getQueryMessages()).toHaveLength(1)

    vi.useFakeTimers()
    act(() => {
      result.current.onSearchChange('a')
      result.current.onSearchChange('ab')
      result.current.onSearchChange('abc')
    })
    await flushReactWork()

    expect(result.current.queryState.q).toBe('abc')
    expect(getQueryMessages()).toHaveLength(1)
    expect(getEmbeddingMessages()).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(179)
    })

    expect(getQueryMessages()).toHaveLength(1)
    expect(getEmbeddingMessages()).toHaveLength(0)

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    await flushReactWork()

    expect(getEmbeddingMessages()).toHaveLength(1)
    expect(getEmbeddingMessages()[0]).toMatchObject({
      type: 'embed-text',
      text: 'abc',
    })
  })

  it('never shows an empty grid once hasFirstQueryResult is true', async () => {
    // Regression test: hasFirstQueryResult and queryResult must commit in the same
    // render. If hasFirstQueryResult flips true a render before queryResult lands,
    // visibleItems reads a stale (empty) queryResult and the grid flashes empty.
    const gridItem = {
      gridId: 'tweet-1:0',
      tweetId: 'tweet-1',
      mediaIndex: 0,
      mediaType: 'photo' as const,
      thumbUrl: 'https://example.com/thumb.jpg',
      fullUrl: 'https://example.com/full.jpg',
    }
    vi.mocked(loadCoreArtifactsProgressive).mockResolvedValue({
      artifacts: { ...coreArtifacts, gridAll: [gridItem] },
      docsReady: Promise.resolve(coreArtifacts.docsChunks),
    })
    MockWorker.nextResult = { total: 1, orderedGridIds: ['tweet-1:0'] }

    const { result } = renderHook(() => useBookmarksPageController())

    await flushReactWork()
    await flushReactWork()

    expect(result.current.hasFirstQueryResult).toBe(true)
    expect(result.current.visibleItems).toEqual([gridItem])
  })

  it('runs the initial query in-page when module workers are unavailable', async () => {
    vi.stubGlobal('Worker', class {
      constructor() {
        throw new Error('module workers unavailable')
      }
    })

    const { result } = renderHook(() => useBookmarksPageController())

    await flushReactWork()
    await flushReactWork()

    expect(result.current.hasFirstQueryResult).toBe(true)
    expect(result.current.queryResult.total).toBe(0)
    expect(result.current.loadingError).toBeNull()
  })

  it('hydrates a selected lightbox item from the URL', async () => {
    window.history.replaceState(null, '', '/?selected=tweet-1%3A2')

    const { result } = renderHook(() => useBookmarksPageController())

    expect(result.current.selection).toEqual({
      tweetId: 'tweet-1',
      mediaIndex: 2,
    })

    await flushReactWork()
  })

  it('syncs lightbox selection to the URL while preserving query state', async () => {
    window.history.replaceState(null, '', '/?q=compiler')

    const { result } = renderHook(() => useBookmarksPageController())

    await flushReactWork()

    act(() => {
      result.current.onOpenLightbox('tweet-1:1')
    })
    await flushReactWork()

    expect(new URLSearchParams(window.location.search).get('q')).toBe('compiler')
    expect(new URLSearchParams(window.location.search).get('selected')).toBe('tweet-1:1')

    act(() => {
      result.current.onLightboxSelectionChange('tweet-1:2')
    })
    await flushReactWork()

    expect(new URLSearchParams(window.location.search).get('selected')).toBe('tweet-1:2')

    act(() => {
      result.current.onCloseLightbox()
    })
    await flushReactWork()

    expect(new URLSearchParams(window.location.search).get('q')).toBe('compiler')
    expect(new URLSearchParams(window.location.search).has('selected')).toBe(false)
  })
})
