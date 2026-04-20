import * as React from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BookmarksMasonry } from '@/components/grid/BookmarksMasonry'
import { resolveBookmarksMasonryRenderKey } from '@/components/grid/masonry-render-key'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'

const reactVirtualizedMocks = vi.hoisted(() => {
  const positionerReset = vi.fn()

  return {
    lastMasonryProps: null as null | {
      height: number
      overscanByPixels: number
      width: number
    },
    positionerReset,
    createMasonryCellPositioner: vi.fn(() =>
      Object.assign(
        (index: number) => ({
          left: 0,
          top: index * 120,
        }),
        {
          reset: positionerReset,
        },
      ),
    ),
    masonryHandle: {
      clearCellPositions: vi.fn(),
      recomputeCellPositions: vi.fn(),
    },
    onChildScroll: vi.fn(),
  }
})

vi.mock('react-virtualized', async () => {
  const ReactModule = await import('react')
  type MockMasonryProps = {
    cellCount: number
    cellRenderer: (props: {
      index: number
      key: string
      parent: object
      style: React.CSSProperties
    }) => React.ReactNode
    height: number
    overscanByPixels: number
    width: number
  }
  class MockCellMeasurerCache {
    defaultHeight: number
    defaultWidth: number
    private readonly measured = new Map<string, { height: number; width: number }>()

    constructor({
      defaultHeight = 0,
      defaultWidth = 0,
    }: {
      defaultHeight?: number
      defaultWidth?: number
    } = {}) {
      this.defaultHeight = defaultHeight
      this.defaultWidth = defaultWidth
    }

    clear(rowIndex: number, columnIndex: number) {
      this.measured.delete(`${rowIndex}:${columnIndex}`)
    }

    clearAll() {
      this.measured.clear()
    }

    getHeight(rowIndex: number, columnIndex = 0) {
      return this.measured.get(`${rowIndex}:${columnIndex}`)?.height ?? this.defaultHeight
    }

    getWidth(rowIndex: number, columnIndex = 0) {
      return this.measured.get(`${rowIndex}:${columnIndex}`)?.width ?? this.defaultWidth
    }

    has(rowIndex: number, columnIndex: number) {
      return this.measured.has(`${rowIndex}:${columnIndex}`)
    }

    hasFixedHeight() {
      return false
    }

    hasFixedWidth() {
      return true
    }

    set(rowIndex: number, columnIndex: number, width: number, height: number) {
      this.measured.set(`${rowIndex}:${columnIndex}`, {
        height,
        width,
      })
    }
  }

  return {
    CellMeasurerCache: MockCellMeasurerCache,
    CellMeasurer: ({
      children,
    }: {
      children: ((props: {
        measure: () => void
        registerChild: (element?: Element | null) => void
      }) => React.ReactNode) | React.ReactNode
    }) =>
      typeof children === 'function'
        ? children({
            measure: () => {},
            registerChild: () => {},
          })
        : children,
    Masonry: ReactModule.forwardRef(function MockMasonry(
      props: MockMasonryProps,
      ref: React.ForwardedRef<object>,
    ) {
      ReactModule.useImperativeHandle(ref, () => reactVirtualizedMocks.masonryHandle)
      reactVirtualizedMocks.lastMasonryProps = {
        height: props.height,
        overscanByPixels: props.overscanByPixels,
        width: props.width,
      }

      return (
        <div data-testid="mock-masonry">
          {Array.from({ length: props.cellCount }, (_, index) =>
            props.cellRenderer({
              index,
              key: `cell-${index}`,
              parent: {},
              style: {
                left: 0,
                position: 'absolute',
                top: index * 120,
                width: props.width,
              },
            }),
          )}
        </div>
      )
    }),
    WindowScroller: ({
      children,
    }: {
      children: (props: {
        height: number
        isScrolling: boolean
        onChildScroll: (input: { scrollTop: number }) => void
        registerChild: (element?: Element | null) => void
        scrollLeft: number
        scrollTop: number
        width: number
      }) => React.ReactNode
    }) =>
      children({
        height: 900,
        isScrolling: false,
        onChildScroll: reactVirtualizedMocks.onChildScroll,
        registerChild: () => {},
        scrollLeft: 0,
        scrollTop: window.scrollY,
        width: 0,
      }),
    createMasonryCellPositioner: reactVirtualizedMocks.createMasonryCellPositioner,
  }
})

type MockResizeObserverInstance = {
  callback: ResizeObserverCallback
  disconnect: ReturnType<typeof vi.fn>
  observe: ReturnType<typeof vi.fn>
}

const resizeObservers: MockResizeObserverInstance[] = []

class MockResizeObserver {
  callback: ResizeObserverCallback
  disconnect = vi.fn()
  observe = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    resizeObservers.push(this)
  }
}

const items: GridItem[] = [
  {
    gridId: 'tweet-1:0',
    tweetId: 'tweet-1',
    mediaIndex: 0,
    mediaType: 'photo',
    thumbUrl: 'https://img.example.com/1.jpg',
    fullUrl: 'https://img.example.com/1-full.jpg',
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
  },
  {
    gridId: 'tweet-2:0',
    tweetId: 'tweet-2',
    mediaIndex: 0,
    mediaType: 'photo',
    thumbUrl: 'https://img.example.com/2.jpg',
    fullUrl: 'https://img.example.com/2-full.jpg',
    width: 800,
    height: 1200,
    aspectRatio: 2 / 3,
  },
]

const docsById = new Map<string, TweetDoc>(
  items.map((item) => [
    item.tweetId,
    {
      id: item.tweetId,
      sortIndex: '1',
      postedAt: '2026-04-20T00:00:00.000Z',
      url: `https://x.com/example/status/${item.tweetId}`,
      text: `Tweet ${item.tweetId}`,
      authorHandle: 'example',
      folderNames: ['Test'],
      media: [],
      representativeMediaIndex: 0,
      representativeMotionMediaIndex: 0,
    },
  ]),
)

let measuredWidth = 960

function triggerResize() {
  for (const observer of resizeObservers) {
    observer.callback([] as ResizeObserverEntry[], observer as unknown as ResizeObserver)
  }
}

function setRect(element: HTMLElement, top: number, height = 120) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        bottom: top + height,
        height,
        left: 0,
        right: 200,
        top,
        width: 200,
      }) as DOMRect,
  })
}

describe('BookmarksMasonry', () => {
  beforeEach(() => {
    measuredWidth = 960
    resizeObservers.splice(0, resizeObservers.length)
    reactVirtualizedMocks.masonryHandle.clearCellPositions.mockClear()
    reactVirtualizedMocks.masonryHandle.recomputeCellPositions.mockClear()
    reactVirtualizedMocks.onChildScroll.mockClear()
    reactVirtualizedMocks.positionerReset.mockClear()
    reactVirtualizedMocks.createMasonryCellPositioner.mockClear()
    reactVirtualizedMocks.lastMasonryProps = null

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: MockResizeObserver,
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: () => {},
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 600,
      writable: true,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return measuredWidth
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rebuilds masonry layout inputs when width, immersive mode, or item order changes', async () => {
    const { rerender } = render(
      <BookmarksMasonry
        columnCount={3}
        docsById={docsById}
        immersive={false}
        items={items}
        onOpen={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
      />,
    )

    await waitFor(() => {
      expect(reactVirtualizedMocks.createMasonryCellPositioner.mock.calls.length).toBeGreaterThan(0)
    })

    expect(reactVirtualizedMocks.onChildScroll).not.toHaveBeenCalled()

    const widthCallCount = reactVirtualizedMocks.createMasonryCellPositioner.mock.calls.length

    measuredWidth = 720
    triggerResize()

    await waitFor(() => {
      expect(reactVirtualizedMocks.createMasonryCellPositioner.mock.calls.length).toBeGreaterThan(
        widthCallCount,
      )
    })

    const immersiveCallCount =
      reactVirtualizedMocks.createMasonryCellPositioner.mock.calls.length

    rerender(
      <BookmarksMasonry
        columnCount={3}
        docsById={docsById}
        immersive
        items={items}
        onOpen={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
      />,
    )

    await waitFor(() => {
      expect(reactVirtualizedMocks.createMasonryCellPositioner.mock.calls.length).toBeGreaterThan(
        immersiveCallCount,
      )
    })

    const reorderCallCount = reactVirtualizedMocks.createMasonryCellPositioner.mock.calls.length

    rerender(
      <BookmarksMasonry
        columnCount={3}
        docsById={docsById}
        immersive
        items={[items[1], items[0]]}
        onOpen={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
      />,
    )

    await waitFor(() => {
      expect(reactVirtualizedMocks.createMasonryCellPositioner.mock.calls.length).toBeGreaterThan(
        reorderCallCount,
      )
    })

    expect(reactVirtualizedMocks.onChildScroll).not.toHaveBeenCalled()
  })

  it('changes the masonry render key when a structural layout input changes', () => {
    const baseInput = {
      columnCount: 3,
      columnWidth: 320,
      immersive: true,
      items,
    }

    expect(
      resolveBookmarksMasonryRenderKey(baseInput),
    ).not.toBe(
      resolveBookmarksMasonryRenderKey({
        ...baseInput,
        immersive: false,
      }),
    )

    expect(
      resolveBookmarksMasonryRenderKey(baseInput),
    ).not.toBe(
      resolveBookmarksMasonryRenderKey({
        ...baseInput,
        columnWidth: 240,
      }),
    )

    expect(
      resolveBookmarksMasonryRenderKey(baseInput),
    ).not.toBe(
      resolveBookmarksMasonryRenderKey({
        ...baseInput,
        items: [items[1], items[0]],
      }),
    )
  })

  it('prefetches the greater of three viewport-heights or fifty items', async () => {
    const { rerender } = render(
      <BookmarksMasonry
        columnCount={3}
        docsById={docsById}
        immersive={false}
        items={items}
        onOpen={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
      />,
    )

    await waitFor(() => {
      expect(reactVirtualizedMocks.lastMasonryProps).not.toBeNull()
    })

    expect(reactVirtualizedMocks.lastMasonryProps).toMatchObject({
      height: 900,
      overscanByPixels: 7575,
    })

    rerender(
      <BookmarksMasonry
        columnCount={50}
        docsById={docsById}
        immersive={false}
        items={items}
        onOpen={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
      />,
    )

    await waitFor(() => {
      expect(reactVirtualizedMocks.lastMasonryProps).toMatchObject({
        height: 900,
        overscanByPixels: 2700,
      })
    })
  })

  it('restores the anchored item near its previous viewport position after zoom relayout', async () => {
    const onScrollAnchorApplied = vi.fn()
    const scrollTo = vi.fn()
    const animationFrameCallbacks: FrameRequestCallback[] = []
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrameCallbacks.push(callback)
        return animationFrameCallbacks.length
      },
    })

    const { container, rerender } = render(
      <BookmarksMasonry
        columnCount={3}
        docsById={docsById}
        immersive={false}
        items={items}
        onOpen={() => {}}
        onScrollAnchorApplied={onScrollAnchorApplied}
        scrollAnchorRequest={null}
      />,
    )

    const anchoredItem = container.querySelector<HTMLElement>('[data-grid-id="tweet-2:0"]')
    expect(anchoredItem).not.toBeNull()
    setRect(anchoredItem as HTMLElement, 180)

    rerender(
      <BookmarksMasonry
        columnCount={2}
        docsById={docsById}
        immersive={false}
        items={items}
        onOpen={() => {}}
        onScrollAnchorApplied={onScrollAnchorApplied}
        scrollAnchorRequest={{
          gridId: 'tweet-2:0',
          requestId: 7,
          top: 40,
        }}
      />,
    )

    const rerenderedAnchoredItem =
      container.querySelector<HTMLElement>('[data-grid-id="tweet-2:0"]')
    expect(rerenderedAnchoredItem).not.toBeNull()
    setRect(rerenderedAnchoredItem as HTMLElement, 180)

    while (animationFrameCallbacks.length > 0) {
      const callback = animationFrameCallbacks.shift()
      callback?.(0)
    }

    expect(scrollTo).toHaveBeenCalled()
    expect(onScrollAnchorApplied).toHaveBeenCalledWith(7)

    expect(scrollTo).toHaveBeenLastCalledWith({
      behavior: 'auto',
      top: 740,
    })
  })
})
