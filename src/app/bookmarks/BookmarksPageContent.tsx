import { BookmarksMasonry } from '@/components/grid/BookmarksMasonry'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'

type BookmarksPageContentProps = {
  columnCount: number
  docsById: Map<string, TweetDoc>
  immersive: boolean
  isQueryPending: boolean
  items: GridItem[]
  loadingError: string | null
  onOpen: (gridId: string) => void
  ready: boolean
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
      <Empty className="app-empty max-w-sm">
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
  onOpen,
  ready,
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
      onOpen={onOpen}
    />
  )
}
