import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MediaTile } from '@/components/media/MediaTile'
import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { formatPostedDate } from '@/lib/format'

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

const tweet: TweetDoc = {
  id: 'tweet-1',
  sortIndex: '100',
  postedAt: '2026-04-17T08:00:00.000Z',
  url: 'https://x.com/example/status/tweet-1',
  text: 'Immersive mode should hide this tweet copy.',
  authorHandle: 'example',
  folderNames: ['Inspo'],
  media: [
    {
      type: 'photo',
      thumbUrl: 'https://img.example.com/thumb.jpg',
      fullUrl: 'https://img.example.com/full.jpg',
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    },
  ],
  representativeMediaIndex: 0,
  representativeMotionMediaIndex: 0,
}

describe('MediaTile', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows bookmark metadata in the default tile mode', () => {
    render(
      <MediaTile
        item={item}
        tweet={tweet}
        immersive={false}
        onOpen={() => {}}
      />,
    )

    expect(screen.getByText(tweet.text)).toBeInTheDocument()
    expect(screen.getByText(/photo/i)).toBeInTheDocument()
    expect(screen.getByText(`@${tweet.authorHandle}`)).toBeInTheDocument()
    expect(screen.getByText(formatPostedDate(tweet.postedAt))).toBeInTheDocument()
    expect(screen.getByText('Inspo')).toBeInTheDocument()
  })

  it('renders only media in immersive mode', () => {
    render(
      <MediaTile
        item={item}
        tweet={tweet}
        immersive
        onOpen={() => {}}
      />,
    )

    expect(screen.getByRole('img', { name: tweet.text })).toBeInTheDocument()
    expect(screen.queryByText(tweet.text)).not.toBeInTheDocument()
    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(`@${tweet.authorHandle}`)).not.toBeInTheDocument()
    expect(screen.queryByText(formatPostedDate(tweet.postedAt))).not.toBeInTheDocument()
    expect(screen.queryByText('Inspo')).not.toBeInTheDocument()
  })

  it('passes image loading priority through to the rendered media', () => {
    render(
      <MediaTile
        item={item}
        tweet={tweet}
        immersive
        loading="eager"
        fetchPriority="high"
        initialMedia
        onOpen={() => {}}
      />,
    )

    const image = screen.getByRole('img', { name: tweet.text })
    expect(image).toHaveAttribute('loading', 'eager')
    expect(image).toHaveAttribute('fetchpriority', 'high')
    expect(image).toHaveAttribute('data-initial-media', 'true')
  })

  it('selects grid thumbnail candidates from rendered width and pixel density', () => {
    render(
      <MediaTile
        item={{
          ...item,
          thumbUrl: 'https://pbs.twimg.com/media/thumb.jpg',
        }}
        tweet={tweet}
        immersive
        imageDevicePixelRatio={3}
        imageRenderedWidth={342}
        imageSizes="342px"
        initialMedia
        onOpen={() => {}}
      />,
    )

    const image = screen.getByRole('img', { name: tweet.text })
    expect(image).toHaveAttribute('src', 'https://pbs.twimg.com/media/thumb.jpg?name=medium')
    expect(image).toHaveAttribute(
      'srcset',
      'https://pbs.twimg.com/media/thumb.jpg?name=small 680w, https://pbs.twimg.com/media/thumb.jpg?name=medium 1200w',
    )
    expect(image).toHaveAttribute('sizes', '342px')
  })

  it('renders mirrored image AVIF candidates with responsive Twitter fallbacks', () => {
    render(
      <MediaTile
        item={{
          ...item,
          thumbUrl: 'https://tbmedia.corychainsman.com/pbs/media/thumb.jpg',
        }}
        tweet={tweet}
        immersive
        imageDevicePixelRatio={2}
        imageRenderedWidth={320}
        imageSizes="320px"
        initialMedia
        onOpen={() => {}}
      />,
    )

    const source = document.querySelector('source[type="image/avif"]')
    const image = screen.getByRole('img', { name: tweet.text })
    expect(source).toHaveAttribute(
      'srcset',
      'https://tbmedia.corychainsman.com/pbs/media/thumb/w320.avif 320w, https://tbmedia.corychainsman.com/pbs/media/thumb/w480.avif 480w, https://tbmedia.corychainsman.com/pbs/media/thumb/w680.avif 680w, https://tbmedia.corychainsman.com/pbs/media/thumb/w960.avif 960w, https://tbmedia.corychainsman.com/pbs/media/thumb/w1280.avif 1280w',
    )
    expect(source).toHaveAttribute('sizes', '320px')
    expect(image).toHaveAttribute(
      'src',
      'https://pbs.twimg.com/media/thumb.jpg?name=small',
    )
    expect(image).not.toHaveAttribute('srcset')
  })

  it('attaches deferred image sources when the tile enters the viewport', () => {
    vi.useFakeTimers()
    let intersectionCallback: IntersectionObserverCallback | null = null
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn()
      observe = vi.fn()

      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback
      }
    })

    render(
      <MediaTile
        item={{
          ...item,
          thumbUrl: 'https://pbs.twimg.com/media/thumb.jpg',
        }}
        tweet={tweet}
        immersive
        imageDevicePixelRatio={1}
        imageRenderedWidth={320}
        imageSizes="320px"
        onOpen={() => {}}
      />,
    )

    const image = screen.getByRole('img', { name: tweet.text })
    expect(image).not.toHaveAttribute('src')

    act(() => vi.advanceTimersByTime(30_000))
    expect(image).not.toHaveAttribute('src')

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    expect(image).toHaveAttribute('src', 'https://pbs.twimg.com/media/thumb.jpg?name=small')
  })

  it('attaches motion posters before loading preview video bytes', () => {
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      disconnect: () => void
      observe: () => void

      constructor() {
        this.disconnect = disconnect
        this.observe = observe
      }
    })

    render(
      <MediaTile
        item={{
          ...item,
          mediaType: 'video',
          previewUrl: 'https://video.example.com/preview.mp4',
          posterUrl: 'https://pbs.twimg.com/media/poster.jpg',
        }}
        tweet={tweet}
        immersive
        imageDevicePixelRatio={1}
        imageRenderedWidth={320}
        imageSizes="320px"
        onOpen={() => {}}
      />,
    )

    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video).not.toHaveAttribute('src')
    expect(video).toHaveAttribute('poster', 'https://pbs.twimg.com/media/poster.jpg?name=small')
  })

  it('loads initial motion preview video immediately', () => {
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      disconnect: () => void
      observe: () => void

      constructor() {
        this.disconnect = disconnect
        this.observe = observe
      }
    })

    render(
      <MediaTile
        item={{
          ...item,
          mediaType: 'video',
          previewUrl: 'https://video.example.com/preview.mp4',
          posterUrl: 'https://pbs.twimg.com/media/poster.jpg',
        }}
        tweet={tweet}
        immersive
        imageDevicePixelRatio={1}
        imageRenderedWidth={320}
        imageSizes="320px"
        initialMedia
        onOpen={() => {}}
      />,
    )

    const video = document.querySelector('video')
    expect(video).toHaveAttribute('src', 'https://video.example.com/preview.mp4')
    expect(video).toHaveAttribute('poster', 'https://pbs.twimg.com/media/poster.jpg?name=small')
  })

  it('renders motion previews when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    render(
      <MediaTile
        item={{
          ...item,
          mediaType: 'video',
          previewUrl: 'https://video.example.com/preview.mp4',
          posterUrl: 'https://pbs.twimg.com/media/poster.jpg',
        }}
        tweet={tweet}
        immersive
        imageDevicePixelRatio={1}
        imageRenderedWidth={320}
        imageSizes="320px"
        onOpen={() => {}}
      />,
    )

    expect(document.querySelector('video')).not.toBeNull()
  })
})
