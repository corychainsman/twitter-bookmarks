import { describe, expect, it } from 'vitest'

import {
  getGridItemIndex,
  getTweetDocIndex,
} from '@/features/bookmarks/artifact-indexes'
import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'

describe('artifact indexes', () => {
  it('builds and reuses the TweetDoc index for an artifact array', () => {
    const doc = { id: 'tweet-1' } as TweetDoc
    const chunks = [{ fileName: 'docs.json', docs: [doc] }] as CoreArtifacts['docsChunks']
    const first = getTweetDocIndex(chunks)

    expect(first.all).toEqual([doc])
    expect(first.byId.get('tweet-1')).toBe(doc)
    expect(getTweetDocIndex(chunks)).toBe(first)
  })

  it('builds both grid lookup shapes in one pass and reuses them', () => {
    const items = [
      { gridId: 'tweet-1:0', tweetId: 'tweet-1' },
      { gridId: 'tweet-1:1', tweetId: 'tweet-1' },
    ] as GridItem[]
    const first = getGridItemIndex(items)

    expect(first.byId.get('tweet-1:1')).toBe(items[1])
    expect(first.idsByTweetId.get('tweet-1')).toEqual(['tweet-1:0', 'tweet-1:1'])
    expect(getGridItemIndex(items)).toBe(first)
  })
})
