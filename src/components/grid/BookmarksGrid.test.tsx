import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GridItem } from '@/features/bookmarks/model'

const IOS_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPADOS_DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

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
    Reflect.deleteProperty(window.navigator, 'maxTouchPoints')
  })

  it('uses bounded static batches on iOS without loading desktop virtualization', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IOS_USER_AGENT)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3)
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()

      constructor() {}
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

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(container.querySelectorAll('.app-ios-static-item')).toHaveLength(160)
    expect(container.querySelectorAll('img[src]')).toHaveLength(160)
    expect(container.querySelectorAll('img[loading="eager"]')).toHaveLength(12)
    expect(container.querySelectorAll('img[loading="lazy"]')).toHaveLength(148)
  })

  it('admits only nearby motion sources with one stable observer on iOS', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IOS_USER_AGENT)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
    let admissionCallback: IntersectionObserverCallback | undefined
    let admissionObserverCount = 0
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        if (options?.rootMargin === '300px 0px') {
          admissionCallback = callback
          admissionObserverCount += 1
        }
      }
    })
    const { BookmarksGrid } = await import('@/components/grid/BookmarksGrid')
    const motionItem: GridItem = {
      ...createItems(1)[0]!,
      gridId: 'motion:0',
      tweetId: 'motion',
      mediaType: 'video',
      previewUrl: 'https://tbmedia.corychainsman.com/vid/motion/preview.mp4',
      posterUrl: 'https://tbmedia.corychainsman.com/pbs/motion/poster.jpg',
    }
    const { container } = render(
      <BookmarksGrid
        columnCount={4}
        docsById={new Map()}
        immersive
        items={[...createItems(12), motionItem]}
        onOpen={() => {}}
        onPinchZoom={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
        viewKey="test-view"
      />,
    )

    const motionTile = container.querySelector<HTMLElement>(
      '[data-media-admission-id="motion:0"]',
    )!
    const video = motionTile.querySelector('video')!
    expect(video).not.toHaveAttribute('src')
    expect(video).not.toHaveAttribute('poster')
    expect(admissionObserverCount).toBe(1)

    act(() => {
      admissionCallback?.(
        [{ isIntersecting: true, target: motionTile } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    await waitFor(() => {
      expect(video).toHaveAttribute(
        'src',
        'https://tbmedia.corychainsman.com/vid/motion/preview.mp4',
      )
    })
    expect(admissionObserverCount).toBe(1)
  })

  it('uses the iOS static grid for iPadOS desktop-mode Safari', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(IPADOS_DESKTOP_USER_AGENT)
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 5,
    })
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn()
      observe = vi.fn()
      unobserve = vi.fn()
    })

    const { BookmarksGrid } = await import('@/components/grid/BookmarksGrid')
    const { container } = render(
      <BookmarksGrid
        columnCount={4}
        docsById={new Map()}
        immersive
        items={createItems(3)}
        onOpen={() => {}}
        onPinchZoom={() => {}}
        onScrollAnchorApplied={() => {}}
        scrollAnchorRequest={null}
        viewKey="test-view"
      />,
    )

    expect(container.querySelectorAll('.app-ios-static-item')).toHaveLength(3)
  })
})
