import { BookmarksMasonry } from '@/components/grid/BookmarksMasonry'
import type { MasonryScrollAnchorRequest } from '@/components/grid/masonry-anchor'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'

type BookmarksPageContentProps = {
  columnCount: number
  docsById: Map<string, TweetDoc>
  immersive: boolean
  isQueryPending: boolean
  items: GridItem[]
  loadingError: string | null
  onInitialMediaReady: () => void
  onOpen: (gridId: string) => void
  onScrollAnchorApplied: (requestId: number) => void
  ready: boolean
  scrollAnchorRequest: MasonryScrollAnchorRequest | null
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
  immersive,
  isQueryPending,
  items,
  loadingError,
  onInitialMediaReady,
  onOpen,
  onScrollAnchorApplied,
  ready,
  scrollAnchorRequest,
}: BookmarksPageContentProps) {
  if (loadingError) {
    return <BookmarksPageStatus title="Load failed" description={loadingError} />
  }

  if (!ready) {
    return (
      <BookmarksPageStatus
        title="Loading"
        description={isQueryPending ? 'Querying' : undefined}
      />
    )
  }

  return (
    <BookmarksMasonry
      columnCount={columnCount}
      items={items}
      docsById={docsById}
      immersive={immersive}
      onInitialMediaReady={onInitialMediaReady}
      onOpen={onOpen}
      onScrollAnchorApplied={onScrollAnchorApplied}
      scrollAnchorRequest={scrollAnchorRequest}
    />
  )
}
