import * as React from 'react'
import {
  Masonry,
  WindowScroller,
  createMasonryCellPositioner,
  type MasonryCellProps,
} from 'react-virtualized'

import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ImagesIcon } from 'lucide-react'
import { MediaTile } from '@/components/media/MediaTile'
import {
  restoreMasonryScrollAnchor,
  type MasonryScrollAnchorRequest,
} from '@/components/grid/masonry-anchor'
import {
  createEstimatedBookmarksMasonryCache,
  estimateBookmarksMasonryHeight,
  resolveBookmarksMasonryColumnWidth,
} from '@/components/grid/masonry-estimates'
import { MeasuredMasonryCell } from '@/components/grid/MeasuredMasonryCell'
import { resolveBookmarksMasonryRenderKey } from '@/components/grid/masonry-render-key'
import { resolveBookmarksMasonryCellStyle } from '@/components/grid/masonry-cell-style'
import { resolveMasonryViewportTopInset } from '@/components/grid/masonry-viewport'

type BookmarksMasonryProps = {
  items: GridItem[]
  columnCount: number
  docsById: Map<string, TweetDoc>
  immersive: boolean
  onOpen: (gridId: string) => void
  onInitialMediaReady?: () => void
  scrollAnchorRequest: MasonryScrollAnchorRequest | null
  onScrollAnchorApplied: (requestId: number) => void
}

const ANCHOR_RESTORE_ATTEMPTS = 3
const MINIMUM_PREFETCH_ITEMS = 50
const MINIMUM_EAGER_ITEMS = 18
const VIEWPORT_PREFETCH_MULTIPLIER = 3
const noop = () => {}

function resolveToolbarBottom(): number {
  const toolbar = document.querySelector<HTMLElement>('.app-toolbar')
  return toolbar ? toolbar.getBoundingClientRect().bottom : 0
}

function resolveBookmarksMasonryCellKey(items: GridItem[], index: number): string {
  const item = items[index]
  return item ? `${item.gridId}:${index}` : `missing:${index}`
}

function resolveBookmarksMasonryRenderedCellKey(
  key: React.Key,
  style: React.CSSProperties | undefined,
): string {
  const renderPhase = style?.position === 'absolute' ? 'positioned' : 'measure'
  return `${String(key)}:${renderPhase}`
}

function createBookmarksMasonryRenderedCellKeyAllocator() {
  const renderedKeyCounts = new Map<string, number>()
  let clearScheduled = false

  const clear = () => {
    renderedKeyCounts.clear()
    clearScheduled = false
  }

  const scheduleClear = () => {
    if (clearScheduled) {
      return
    }

    clearScheduled = true

    if (typeof queueMicrotask === 'function') {
      queueMicrotask(clear)
      return
    }

    Promise.resolve().then(clear)
  }

  return {
    clear,
    resolve(key: React.Key, style: React.CSSProperties | undefined): string {
      scheduleClear()

      const baseKey = resolveBookmarksMasonryRenderedCellKey(key, style)
      const renderedCount = renderedKeyCounts.get(baseKey) ?? 0
      renderedKeyCounts.set(baseKey, renderedCount + 1)

      return renderedCount === 0 ? baseKey : `${baseKey}:duplicate-${renderedCount}`
    },
  }
}

function useMeasuredElementWidth(element: HTMLDivElement | null) {
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    if (!element) {
      return
    }

    const measure = () => {
      setWidth(element.clientWidth)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure, { passive: true })
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return width
}

function combineRefs(
  setContainerElement: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>,
  registerChild: (element?: Element | null) => void,
) {
  return (node: HTMLDivElement | null) => {
    setContainerElement(node)
    registerChild(node)
  }
}

function resolveBookmarksMasonryOverscanPx(input: {
  columnCount: number
  columnWidth: number
  immersive: boolean
  items: GridItem[]
  viewportHeight: number
}) {
  const viewportOverscanPx = Math.max(
    0,
    Math.ceil(input.viewportHeight * VIEWPORT_PREFETCH_MULTIPLIER),
  )

  if (input.items.length === 0) {
    return viewportOverscanPx
  }

  const sampleSize = Math.min(input.items.length, MINIMUM_PREFETCH_ITEMS)
  const estimatedAverageHeight =
    input.items
      .slice(0, sampleSize)
      .reduce(
        (totalHeight, item) =>
          totalHeight +
          estimateBookmarksMasonryHeight({
            item,
            columnWidth: input.columnWidth,
            immersive: input.immersive,
          }),
        0,
      ) / sampleSize
  const itemOverscanPx = Math.ceil(
    (estimatedAverageHeight * MINIMUM_PREFETCH_ITEMS) / Math.max(1, input.columnCount),
  )

  return Math.max(viewportOverscanPx, itemOverscanPx)
}

export function BookmarksMasonry({
  items,
  columnCount,
  docsById,
  immersive,
  onOpen,
  onInitialMediaReady,
  scrollAnchorRequest,
  onScrollAnchorApplied,
}: BookmarksMasonryProps) {
  const [renderedImmersive, setRenderedImmersive] = React.useState(immersive)
  const [containerElement, setContainerElement] = React.useState<HTMLDivElement | null>(null)
  const containerWidth = useMeasuredElementWidth(containerElement)
  const isResettingImmersiveLayout = immersive !== renderedImmersive
  const renderedCellKeyAllocatorRef = React.useRef(
    createBookmarksMasonryRenderedCellKeyAllocator(),
  )
  const hasReportedInitialMediaReadyRef = React.useRef(false)
  const handleInitialMediaReady = onInitialMediaReady ?? noop

  React.useLayoutEffect(() => {
    renderedCellKeyAllocatorRef.current.clear()
  })

  React.useEffect(() => {
    if (!isResettingImmersiveLayout) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setRenderedImmersive(immersive)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [immersive, isResettingImmersiveLayout])

  const columnWidth = React.useMemo(
    () =>
      resolveBookmarksMasonryColumnWidth({
        containerWidth,
        columnCount,
      }),
    [columnCount, containerWidth],
  )
  const cellMeasurerCache = React.useMemo(
    () =>
      createEstimatedBookmarksMasonryCache({
        items,
        columnWidth,
        immersive: renderedImmersive,
      }),
    [columnWidth, items, renderedImmersive],
  )
  const cellPositioner = React.useMemo(
    () =>
      createMasonryCellPositioner({
        cellMeasurerCache,
        columnCount,
        columnWidth,
        spacer: 0,
      }),
    [cellMeasurerCache, columnCount, columnWidth],
  )
  const masonryRenderKey = React.useMemo(
    () =>
      resolveBookmarksMasonryRenderKey({
        columnCount,
        columnWidth,
        immersive: renderedImmersive,
        items,
      }),
    [columnCount, columnWidth, items, renderedImmersive],
  )
  const eagerItemCount = Math.min(
    items.length,
    Math.max(MINIMUM_EAGER_ITEMS, columnCount * 3),
  )

  React.useEffect(() => {
    if (!scrollAnchorRequest) {
      return
    }

    let frameId = 0
    let attemptsRemaining = ANCHOR_RESTORE_ATTEMPTS

    const restoreAnchor = () => {
      restoreMasonryScrollAnchor(scrollAnchorRequest)

      if (attemptsRemaining > 0) {
        attemptsRemaining -= 1
        frameId = window.requestAnimationFrame(restoreAnchor)
        return
      }

      onScrollAnchorApplied(scrollAnchorRequest.requestId)
    }

    frameId = window.requestAnimationFrame(restoreAnchor)
    return () => window.cancelAnimationFrame(frameId)
  }, [onScrollAnchorApplied, scrollAnchorRequest])

  React.useEffect(() => {
    if (
      hasReportedInitialMediaReadyRef.current ||
      !containerElement ||
      containerWidth <= 0 ||
      isResettingImmersiveLayout
    ) {
      return
    }

    let frameId = 0
    const cleanupCallbacks: Array<() => void> = []

    const reportReady = () => {
      if (hasReportedInitialMediaReadyRef.current) {
        return
      }

      hasReportedInitialMediaReadyRef.current = true
      handleInitialMediaReady()
    }

    frameId = window.requestAnimationFrame(() => {
      const images = [
        ...containerElement.querySelectorAll<HTMLImageElement>(
          'img[data-initial-media="true"]',
        ),
      ]

      if (images.length === 0 || images.every((image) => image.complete)) {
        reportReady()
        return
      }

      let remaining = images.filter((image) => !image.complete).length
      const handleSettled = () => {
        remaining -= 1
        if (remaining <= 0) {
          reportReady()
        }
      }

      for (const image of images) {
        if (image.complete) {
          continue
        }

        image.addEventListener('load', handleSettled, { once: true })
        image.addEventListener('error', handleSettled, { once: true })
        cleanupCallbacks.push(() => {
          image.removeEventListener('load', handleSettled)
          image.removeEventListener('error', handleSettled)
        })
      }
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      cleanupCallbacks.forEach((cleanup) => cleanup())
    }
  }, [
    containerElement,
    containerWidth,
    isResettingImmersiveLayout,
    handleInitialMediaReady,
    masonryRenderKey,
  ])

  const cellRenderer = React.useCallback(
    ({ index, key, parent, style }: MasonryCellProps) => {
      const item = items[index]
      if (!item) {
        return null
      }
      const cellStyle = resolveBookmarksMasonryCellStyle(style)

      return (
        <MeasuredMasonryCell
          cache={cellMeasurerCache}
          gridId={item.gridId}
          index={index}
          key={renderedCellKeyAllocatorRef.current.resolve(key, style)}
          parent={parent}
          style={cellStyle}
        >
          <div className="app-masonry-item">
            <MediaTile
              item={item}
              tweet={docsById.get(item.tweetId)}
              immersive={renderedImmersive}
              loading={index < eagerItemCount ? 'eager' : 'lazy'}
              fetchPriority={index < eagerItemCount ? 'high' : 'low'}
              initialMedia={index < eagerItemCount}
              onOpen={() => onOpen(item.gridId)}
            />
          </div>
        </MeasuredMasonryCell>
      )
    },
    [cellMeasurerCache, docsById, eagerItemCount, items, onOpen, renderedImmersive],
  )

  if (items.length === 0) {
    return (
      <div className="px-4 py-10 sm:px-6">
        <Empty className="border-[var(--app-panel-border)] bg-[var(--app-panel-surface)] rounded-[var(--app-panel-radius)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ImagesIcon />
            </EmptyMedia>
            <EmptyTitle>No matching media bookmarks</EmptyTitle>
            <EmptyDescription>
              Adjust the search, folder, sort, or display mode to bring items back into view.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="app-masonry">
      <WindowScroller>
        {({ height, registerChild, scrollTop }) => (
          <div ref={combineRefs(setContainerElement, registerChild)}>
            {containerWidth > 0 && !isResettingImmersiveLayout ? (
              (() => {
                const viewportTopInset =
                  containerElement && typeof document !== 'undefined'
                    ? resolveMasonryViewportTopInset({
                        containerTop: containerElement.getBoundingClientRect().top,
                        toolbarBottom: resolveToolbarBottom(),
                      })
                    : 0
                const effectiveHeight = Math.max(0, height - viewportTopInset)
                const effectiveScrollTop = scrollTop + viewportTopInset
                const overscanByPixels = resolveBookmarksMasonryOverscanPx({
                  columnCount,
                  columnWidth,
                  immersive: renderedImmersive,
                  items,
                  viewportHeight: effectiveHeight,
                })

                return (
                  <Masonry
                    key={masonryRenderKey}
                    autoHeight
                    cellCount={items.length}
                    cellMeasurerCache={cellMeasurerCache}
                    cellPositioner={cellPositioner}
                    cellRenderer={cellRenderer}
                    height={effectiveHeight}
                    keyMapper={(index: number) => resolveBookmarksMasonryCellKey(items, index)}
                    overscanByPixels={overscanByPixels}
                    role="list"
                    scrollTop={effectiveScrollTop}
                    width={containerWidth}
                  />
                )
              })()
            ) : null}
          </div>
        )}
      </WindowScroller>
    </div>
  )
}
