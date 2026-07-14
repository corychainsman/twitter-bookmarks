import { BookmarksGrid } from '@/components/grid/BookmarksGrid'
import type { MasonryScrollAnchorRequest } from '@/components/grid/masonry-anchor'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'

type BookmarksPageContentProps = {
  columnCount: number
  docsById: Map<string, TweetDoc>
  hasFirstQueryResult: boolean
  immersive: boolean
  items: GridItem[]
  loadingError: string | null
  onInitialMediaReady: () => void
  onOpen: (gridId: string) => void
  onPinchZoom: (deltaColumns: number) => void
  onScrollAnchorApplied: (requestId: number) => void
  ready: boolean
  scrollAnchorRequest: MasonryScrollAnchorRequest | null
  viewKey: string
}

function BookmarksPageStatus({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <Empty className="max-w-sm border-[var(--app-panel-border)] bg-[var(--app-panel-surface)] rounded-[var(--app-panel-radius)]">
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          {description ? <EmptyDescription>{description}</EmptyDescription> : null}
        </EmptyHeader>
      </Empty>
    </div>
  )
}

export function BookmarksPageContent({
  columnCount,
  docsById,
  hasFirstQueryResult,
  immersive,
  items,
  loadingError,
  onInitialMediaReady,
  onOpen,
  onPinchZoom,
  onScrollAnchorApplied,
  ready,
  scrollAnchorRequest,
  viewKey,
}: BookmarksPageContentProps) {
  if (loadingError) {
    return <BookmarksPageStatus title="Load failed" description={loadingError} />
  }

  if (!ready || !hasFirstQueryResult) {
    return null
  }

  return (
    <BookmarksGrid
      columnCount={columnCount}
      items={items}
      docsById={docsById}
      immersive={immersive}
      onInitialMediaReady={onInitialMediaReady}
      onOpen={onOpen}
      onPinchZoom={onPinchZoom}
      onScrollAnchorApplied={onScrollAnchorApplied}
      scrollAnchorRequest={scrollAnchorRequest}
      viewKey={viewKey}
    />
  )
}
