import * as React from 'react'

import { MediaTile } from '@/components/media/MediaTile'
import type { BookmarksMasonryProps } from '@/components/grid/BookmarksMasonry'
import { useInitialMediaReady } from '@/components/grid/useInitialMediaReady'

const IOS_STATIC_BATCH_SIZE = 80
const MINIMUM_EAGER_ITEMS = 12

function isIOSWebKit(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /iP(?:hone|ad|od)/.test(navigator.userAgent) && /WebKit/.test(navigator.userAgent)
}

// Start the desktop chunk alongside artifact loading, but never request it on
// iOS where the non-virtualized grid is the only implementation we render.
const desktopMasonryModule = isIOSWebKit()
  ? null
  : import('@/components/grid/BookmarksMasonry').then((module) => ({
      default: module.BookmarksMasonry,
    }))

const DesktopBookmarksMasonry = React.lazy(() =>
  desktopMasonryModule ??
  import('@/components/grid/BookmarksMasonry').then((module) => ({
    default: module.BookmarksMasonry,
  })),
)

function BookmarksIOSStaticGrid({
  columnCount,
  docsById,
  immersive,
  items,
  onInitialMediaReady,
  onOpen,
}: Pick<
  BookmarksMasonryProps,
  'columnCount' | 'docsById' | 'immersive' | 'items' | 'onInitialMediaReady' | 'onOpen'
>) {
  const [containerElement, setContainerElement] = React.useState<HTMLDivElement | null>(null)
  const [loadMoreBatchCount, setLoadMoreBatchCount] = React.useState(0)
  const visibleCount = Math.min(
    items.length,
    IOS_STATIC_BATCH_SIZE * (1 + loadMoreBatchCount),
  )
  const visibleItems = items.slice(0, visibleCount)
  const columnWidth =
    typeof window === 'undefined'
      ? 320
      : Math.max(240, Math.floor(window.innerWidth / Math.max(1, columnCount)))
  const handleTileOpen = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const gridId = event.currentTarget.dataset.gridId
      if (gridId) onOpen(gridId)
    },
    [onOpen],
  )
  useInitialMediaReady({
    containerElement,
    enabled: true,
    onReady: onInitialMediaReady,
  })

  return (
    <div ref={setContainerElement} className="app-masonry">
      <div
        className="app-ios-static-grid"
        style={{ columnCount: Math.max(1, columnCount) }}
      >
        {visibleItems.map((item, index) => (
          <div className="app-ios-static-item" key={item.gridId}>
            <MediaTile
              item={item}
              tweet={docsById.get(item.tweetId)}
              immersive={immersive}
              loading={index < MINIMUM_EAGER_ITEMS ? 'eager' : 'lazy'}
              fetchPriority={index < MINIMUM_EAGER_ITEMS ? 'high' : 'low'}
              initialMedia={index < MINIMUM_EAGER_ITEMS}
              imageDevicePixelRatio={1}
              imageRenderedWidth={columnWidth}
              imageSizes={`${columnWidth}px`}
              onOpen={handleTileOpen}
            />
          </div>
        ))}
      </div>

      {visibleCount < items.length ? (
        <div className="flex justify-center px-4 pt-2 pb-8">
          <button
            type="button"
            className="app-control min-h-11 px-4 text-sm font-medium"
            onClick={() => setLoadMoreBatchCount((current) => current + 1)}
          >
            Load more
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function BookmarksGrid(props: BookmarksMasonryProps) {
  if (isIOSWebKit()) {
    return <BookmarksIOSStaticGrid key={props.viewKey} {...props} />
  }

  return (
    <React.Suspense fallback={null}>
      <DesktopBookmarksMasonry {...props} />
    </React.Suspense>
  )
}
