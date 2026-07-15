import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    thumbUrl: `https://tbmedia.corychainsman.com/pbs/media/${index + 1}.jpg`,
    fullUrl: `https://tbmedia.corychainsman.com/pbs/media/${index + 1}.jpg`,
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
    imageRenditions: [
      {
        url: `https://tbmedia.corychainsman.com/pbs/media/${index + 1}/renditions/v2/w320-test.avif`,
        width: 320,
        contentType: 'image/avif',
      },
    ],
  }))
}

describe('BookmarksGrid', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('uses bounded static batches on iOS without loading desktop virtualization', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IOS_USER_AGENT)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3)
    let admissionCallback: IntersectionObserverCallback | undefined
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        if (options?.rootMargin === '300px 0px') admissionCallback = callback
      }
    })
    const { BookmarksGrid } = await import('@/components/grid/BookmarksGrid')
    const firstPaintItems = createItems(5)
    const { container, rerender } = render(
      <BookmarksGrid
        columnCount={4}
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
        columnCount={4}
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
    expect(container.querySelectorAll('img[src]')).toHaveLength(80)
    expect(container.querySelectorAll('img[loading="eager"]')).toHaveLength(12)
    expect(container.querySelectorAll('img[loading="lazy"]')).toHaveLength(68)
    expect(container.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      'https://tbmedia.corychainsman.com/pbs/media/1/renditions/v2/w320-test.avif',
    )

    const thirteenthTile = container.querySelector<HTMLElement>(
      '[data-media-admission-id="tweet-13:0"]',
    )!
    act(() => {
      admissionCallback?.(
        [{ isIntersecting: true, target: thirteenthTile } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    expect(container.querySelectorAll('img[src]')).toHaveLength(80)

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(container.querySelectorAll('.app-ios-static-item')).toHaveLength(160)
    expect(container.querySelectorAll('img[src]')).toHaveLength(160)
    expect(container.querySelectorAll('img[loading="eager"]')).toHaveLength(12)
    expect(container.querySelectorAll('img[loading="lazy"]')).toHaveLength(148)
  })
})
