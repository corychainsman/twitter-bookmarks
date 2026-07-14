import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GridItem } from '@/features/bookmarks/model'

const IOS_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function createItems(count: number): GridItem[] {
  return Array.from({ length: count }, (_, index) => ({
    gridId: `tweet-${index + 1}:0`,
    tweetId: `tweet-${index + 1}`,
    mediaIndex: 0,
    mediaType: 'photo',
    thumbUrl: `https://img.example.com/${index + 1}.jpg`,
    fullUrl: `https://img.example.com/${index + 1}-full.jpg`,
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
  }))
}

describe('BookmarksGrid', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('uses bounded static batches on iOS without loading desktop virtualization', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IOS_USER_AGENT)
    const { BookmarksGrid } = await import('@/components/grid/BookmarksGrid')
    const firstPaintItems = createItems(5)
    const { container, rerender } = render(
      <BookmarksGrid
        columnCount={2}
        docsById={new Map()}
        immersive
        items={firstPaintItems}
        onOpen={() => {}}
        onPinchZoom={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
        viewKey="test-view"
      />,
    )

    expect(container.querySelectorAll('.app-ios-static-item')).toHaveLength(5)

    rerender(
      <BookmarksGrid
        columnCount={2}
        docsById={new Map()}
        immersive
        items={createItems(300)}
        onOpen={() => {}}
        onPinchZoom={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
        viewKey="test-view"
      />,
    )

    await waitFor(() => {
      expect(container.querySelectorAll('.app-ios-static-item')).toHaveLength(80)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(container.querySelectorAll('.app-ios-static-item')).toHaveLength(160)
  })
})
