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
  postMessage = vi.fn((message: { type?: string; requestId?: number }) => {
    if (message.type !== 'query') {
      return
    }

    queueMicrotask(() => {
      this.onmessage?.({
        data: {
          type: 'result',
          requestId: message.requestId,
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
      manifest: coreArtifacts.manifest,
      firstPaintItems: [],
      coreReady: Promise.resolve(coreArtifacts),
      docsReady: Promise.resolve(coreArtifacts.docsChunks),
      cacheReady: Promise.resolve(),
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

  it('queries lexical results while the semantic vector is still pending', async () => {
    const doc = {
      id: 'tweet-1',
      sortIndex: null,
      postedAt: null,
      url: 'https://x.com/a/status/tweet-1',
      text: 'Industrial design reference',
      folderNames: [],
      media: [],
      representativeMediaIndex: 0,
      representativeMotionMediaIndex: 0,
    }
    const cachedArtifacts = {
      ...coreArtifacts,
      docsChunks: [{ fileName: 'docs.json', docs: [doc] }],
    }
    vi.mocked(loadCoreArtifactsProgressive).mockResolvedValue({
      manifest: cachedArtifacts.manifest,
      firstPaintItems: [],
      coreReady: Promise.resolve(cachedArtifacts),
      docsReady: Promise.resolve(cachedArtifacts.docsChunks),
      cacheReady: Promise.resolve(),
    })
    const { result } = renderHook(() => useBookmarksPageController())
    await flushReactWork()
    await flushReactWork()

    vi.useFakeTimers()
    act(() => result.current.onSearchChange('design'))
    await act(async () => vi.advanceTimersByTime(180))
    await flushReactWork()

    expect(getEmbeddingMessages()).toHaveLength(1)
    expect(getQueryMessages()).toHaveLength(2)
    expect(getQueryMessages()[1]).toMatchObject({
      query: { q: 'design' },
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
      manifest: coreArtifacts.manifest,
      firstPaintItems: [],
      coreReady: Promise.resolve({ ...coreArtifacts, gridAll: [gridItem] }),
      docsReady: Promise.resolve(coreArtifacts.docsChunks),
      cacheReady: Promise.resolve(),
    })
    MockWorker.nextResult = { total: 1, orderedGridIds: ['tweet-1:0'] }

    const { result } = renderHook(() => useBookmarksPageController())

    await flushReactWork()
    await flushReactWork()

    expect(result.current.hasFirstQueryResult).toBe(true)
    expect(result.current.visibleItems).toEqual([gridItem])
  })

  it('renders the default first-paint slice before full query artifacts are ready', async () => {
    const firstItem = {
      gridId: 'tweet-first:0',
      tweetId: 'tweet-first',
      mediaIndex: 0,
      mediaType: 'photo' as const,
      thumbUrl: 'https://example.com/first-thumb.jpg',
      fullUrl: 'https://example.com/first.jpg',
    }
    let resolveCore: (artifacts: CoreArtifacts) => void = () => undefined
    const coreReady = new Promise<CoreArtifacts>((resolve) => {
      resolveCore = resolve
    })
    const manifest = {
      ...coreArtifacts.manifest,
      gridItemCountAll: 3_198,
    }
    vi.mocked(loadCoreArtifactsProgressive).mockResolvedValue({
      manifest,
      firstPaintItems: [firstItem],
      coreReady,
      docsReady: Promise.resolve([]),
      cacheReady: Promise.resolve(),
    })

    const { result } = renderHook(() => useBookmarksPageController())
    await flushReactWork()
    await flushReactWork()

    expect(result.current.hasLoadedArtifacts).toBe(true)
    expect(result.current.hasFirstQueryResult).toBe(true)
    expect(result.current.queryResult.total).toBe(3_198)
    expect(result.current.visibleItems).toEqual([firstItem])
    expect(getQueryMessages()).toHaveLength(0)

    await act(async () => {
      resolveCore({ ...coreArtifacts, manifest, gridAll: [firstItem] })
      await coreReady
    })
    await flushReactWork()

    expect(getQueryMessages()).toHaveLength(1)
  })

  it('ignores stale worker results after a newer query request', async () => {
    const latestItem = {
      gridId: 'latest:0',
      tweetId: 'latest',
      mediaIndex: 0,
      mediaType: 'photo' as const,
      thumbUrl: 'https://example.com/latest-thumb.jpg',
      fullUrl: 'https://example.com/latest.jpg',
    }
    const staleItem = {
      ...latestItem,
      gridId: 'stale:0',
      tweetId: 'stale',
    }
    vi.mocked(loadCoreArtifactsProgressive).mockResolvedValue({
      manifest: coreArtifacts.manifest,
      firstPaintItems: [],
      coreReady: Promise.resolve({ ...coreArtifacts, gridAll: [latestItem, staleItem] }),
      docsReady: Promise.resolve(coreArtifacts.docsChunks),
      cacheReady: Promise.resolve(),
    })
    MockWorker.nextResult = { total: 1, orderedGridIds: [latestItem.gridId] }

    const { result } = renderHook(() => useBookmarksPageController())
    await flushReactWork()
    await flushReactWork()

    act(() => result.current.onDirectionToggle())
    await flushReactWork()
    const messages = getQueryMessages()
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({
      requestId: 2,
      query: { dir: 'asc' },
    })
    expect(messages[1]).not.toHaveProperty('query.immersive')
    expect(messages[1]).not.toHaveProperty('query.zoom')

    act(() => {
      getQueryWorker().onmessage?.({
        data: {
          type: 'result',
          requestId: 1,
          result: { total: 1, orderedGridIds: [staleItem.gridId] },
        },
      } as MessageEvent<unknown>)
    })

    expect(result.current.visibleItems).toEqual([latestItem])
  })

  it('hydrates streamed TweetDoc chunks without cloning core grid artifacts again', async () => {
    let resolveDocs: (chunks: CoreArtifacts['docsChunks']) => void = () => undefined
    const docsReady = new Promise<CoreArtifacts['docsChunks']>((resolve) => {
      resolveDocs = resolve
    })
    vi.mocked(loadCoreArtifactsProgressive).mockResolvedValue({
      manifest: coreArtifacts.manifest,
      firstPaintItems: [],
      coreReady: Promise.resolve(coreArtifacts),
      docsReady,
      cacheReady: Promise.resolve(),
    })

    renderHook(() => useBookmarksPageController())
    await flushReactWork()

    const doc = {
      id: 'tweet-1',
      sortIndex: null,
      postedAt: null,
      url: 'https://x.com/a/status/tweet-1',
      text: 'Tweet',
      folderNames: [],
      media: [],
      representativeMediaIndex: 0,
      representativeMotionMediaIndex: 0,
    }
    await act(async () => {
      resolveDocs([{ fileName: 'docs.json', docs: [doc] }])
      await docsReady
    })
    await flushReactWork()

    const hydrationMessages = getQueryWorker().postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'hydrate-core' || message.type === 'hydrate-docs')
    expect(hydrationMessages).toHaveLength(2)
    expect(hydrationMessages[0]).toMatchObject({ type: 'hydrate-core' })
    expect(hydrationMessages[1]).toMatchObject({
      type: 'hydrate-docs',
      buildId: 'test-build',
    })
    expect(hydrationMessages[1]).not.toHaveProperty('artifacts.gridAll')
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
