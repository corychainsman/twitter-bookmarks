import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import { loadCoreArtifacts } from '@/features/bookmarks/data-loader'
import { useBookmarksPageController } from '@/app/bookmarks/useBookmarksPageController'

vi.mock('@/features/bookmarks/data-loader', () => ({
  loadCoreArtifacts: vi.fn(),
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

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  postMessage = vi.fn()
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

function getEmbeddingWorker() {
  const worker = MockWorker.instances[1]
  if (!worker) {
    throw new Error('Expected embedding worker to be constructed.')
  }
  return worker
}

function getQueryMessages() {
  return getQueryWorker().postMessage.mock.calls
    .map(([message]) => message)
    .filter((message) => message.type === 'query')
}

function getEmbeddingMessages() {
  return getEmbeddingWorker().postMessage.mock.calls.map(([message]) => message)
}

async function flushReactWork() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useBookmarksPageController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWorker.instances = []
    vi.mocked(loadCoreArtifacts).mockResolvedValue(coreArtifacts)

    Object.defineProperty(window, 'Worker', {
      configurable: true,
      value: MockWorker,
    })
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    })
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps typing responsive while debouncing expensive search result refreshes', async () => {
    const { result } = renderHook(() => useBookmarksPageController())

    await flushReactWork()
    await flushReactWork()

    expect(loadCoreArtifacts).toHaveBeenCalled()
    expect(getQueryMessages()).toHaveLength(1)

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
})
