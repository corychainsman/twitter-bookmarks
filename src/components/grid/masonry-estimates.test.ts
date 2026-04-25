import { describe, expect, it } from 'vitest'

import {
  createEstimatedBookmarksMasonryCache,
  estimateBookmarksMasonryHeight,
  resolveGridItemAspectRatio,
} from '@/components/grid/masonry-estimates'
import type { GridItem } from '@/features/bookmarks/model'

const item: GridItem = {
  gridId: 'tweet-1:0',
  tweetId: 'tweet-1',
  mediaIndex: 0,
  mediaType: 'photo',
  thumbUrl: 'https://img.example.com/thumb.jpg',
  fullUrl: 'https://img.example.com/full.jpg',
  width: 1200,
  height: 800,
  aspectRatio: 1.5,
}

describe('resolveGridItemAspectRatio', () => {
  it('prefers the explicit aspect ratio when available', () => {
    expect(resolveGridItemAspectRatio(item)).toBe(1.5)
  })

  it('falls back to width and height metadata', () => {
    expect(
      resolveGridItemAspectRatio({
        ...item,
        aspectRatio: undefined,
      }),
    ).toBe(1.5)
  })
})

describe('estimateBookmarksMasonryHeight', () => {
  it('uses media metadata to estimate immersive tile height', () => {
    expect(
      estimateBookmarksMasonryHeight({
        item,
        columnWidth: 300,
        immersive: true,
      }),
    ).toBe(200)
  })

  it('adds caption chrome in non-immersive mode', () => {
    expect(
      estimateBookmarksMasonryHeight({
        item,
        columnWidth: 300,
        immersive: false,
      }),
    ).toBe(308)
  })
})

describe('createEstimatedBookmarksMasonryCache', () => {
  it('serves estimated heights until a cell has been measured', () => {
    const cache = createEstimatedBookmarksMasonryCache({
      items: [item],
      columnWidth: 300,
      immersive: true,
    })

    expect(cache.has(0, 0)).toBe(false)
    expect(cache.getHeight(0, 0)).toBe(200)

    cache.set(0, 0, 300, 240)

    expect(cache.has(0, 0)).toBe(true)
    expect(cache.getHeight(0, 0)).toBe(240)
  })
})
