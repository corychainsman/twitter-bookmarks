import * as React from 'react'
import { VirtuosoMasonry } from '@virtuoso.dev/masonry'

import {
  distributeItemsByColumnOrder,
  shouldUseStaticColumnLayout,
} from '@/components/grid/column-distribution'
import { resolveMasonryInitialItemCount } from '@/components/grid/masonry-prerender'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ImagesIcon } from 'lucide-react'
import { MediaTile } from '@/components/media/MediaTile'

type MasonryContext = {
  docsById: Map<string, TweetDoc>
  immersive: boolean
  onOpen: (gridId: string) => void
}

type BookmarksMasonryProps = {
  items: GridItem[]
  columnCount: number
  docsById: Map<string, TweetDoc>
  immersive: boolean
  onOpen: (gridId: string) => void
}

function MasonryItem({
  context,
  data,
}: {
  context: MasonryContext
  data?: GridItem
  index: number
}) {
  if (!data) {
    return null
  }

  return (
    <div className="app-masonry-item">
      <MediaTile
        item={data}
        tweet={context.docsById.get(data.tweetId)}
        immersive={context.immersive}
        onOpen={() => context.onOpen(data.gridId)}
      />
    </div>
  )
}

export function BookmarksMasonry({
  items,
  columnCount,
  docsById,
  immersive,
  onOpen,
}: BookmarksMasonryProps) {
  const context = React.useMemo<MasonryContext>(
    () => ({ docsById, immersive, onOpen }),
    [docsById, immersive, onOpen],
  )
  const staticColumns = React.useMemo(
    () =>
      shouldUseStaticColumnLayout({
        itemCount: items.length,
        columnCount,
      })
        ? distributeItemsByColumnOrder(items, columnCount)
        : null,
    [columnCount, items],
  )
  const initialItemCount = React.useMemo(
    () =>
      resolveMasonryInitialItemCount({
        itemCount: items.length,
        columnCount,
        immersive,
      }),
    [columnCount, immersive, items.length],
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
      {staticColumns ? (
        <div className="app-grid-static flex items-start">
          {staticColumns.map((columnItems, columnIndex) => (
            <div key={columnIndex} className="min-w-0 flex-1">
              {columnItems.map((item) => (
                <div key={item.gridId} className="app-masonry-item">
                  <MediaTile
                    item={item}
                    tweet={docsById.get(item.tweetId)}
                    immersive={immersive}
                    onOpen={() => onOpen(item.gridId)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <VirtuosoMasonry
          key={`masonry-${columnCount}-${immersive ? 'immersive' : 'standard'}`}
          columnCount={columnCount}
          data={items}
          context={context}
          ItemContent={MasonryItem}
          initialItemCount={initialItemCount}
          useWindowScroll
        />
      )}
    </div>
  )
}
