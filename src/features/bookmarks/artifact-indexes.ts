import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'

type DocsChunks = CoreArtifacts['docsChunks']

export type TweetDocIndex = {
  all: TweetDoc[]
  byId: Map<string, TweetDoc>
}

export type GridItemIndex = {
  byId: Map<string, GridItem>
  idsByTweetId: Map<string, string[]>
}

const tweetDocIndexes = new WeakMap<DocsChunks, TweetDocIndex>()
const gridItemIndexes = new WeakMap<GridItem[], GridItemIndex>()

export function getTweetDocIndex(docsChunks: DocsChunks): TweetDocIndex {
  const cached = tweetDocIndexes.get(docsChunks)
  if (cached) return cached

  const all: TweetDoc[] = []
  const byId = new Map<string, TweetDoc>()
  for (const chunk of docsChunks) {
    for (const doc of chunk.docs) {
      all.push(doc)
      byId.set(doc.id, doc)
    }
  }

  const index = { all, byId }
  tweetDocIndexes.set(docsChunks, index)
  return index
}

export function getGridItemIndex(gridAll: GridItem[]): GridItemIndex {
  const cached = gridItemIndexes.get(gridAll)
  if (cached) return cached

  const byId = new Map<string, GridItem>()
  const idsByTweetId = new Map<string, string[]>()
  for (const item of gridAll) {
    byId.set(item.gridId, item)
    const ids = idsByTweetId.get(item.tweetId)
    if (ids) ids.push(item.gridId)
    else idsByTweetId.set(item.tweetId, [item.gridId])
  }

  const index = { byId, idsByTweetId }
  gridItemIndexes.set(gridAll, index)
  return index
}
