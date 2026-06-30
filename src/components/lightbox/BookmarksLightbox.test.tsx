import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TweetDoc } from '@/features/bookmarks/model'
import { BookmarksLightbox } from '@/components/lightbox/BookmarksLightbox'
import {
  createBookmarksLightboxSlides,
  createLightboxPreloadCandidates,
} from '@/components/lightbox/lightbox-slides'

vi.mock('yet-another-react-lightbox', () => ({
  default: ({
    index,
    render: lightboxRender,
    slides,
  }: {
    index: number
    render: {
      slide?: (props: {
        slide: unknown
        offset: number
        rect: { width: number; height: number }
      }) => ReactNode
    }
    slides: unknown[]
  }) => (
    <div data-testid="mock-lightbox">
      {slides.map((slide, slideIndex) => (
        <div key={String((slide as { gridId?: string }).gridId ?? slideIndex)}>
          {lightboxRender.slide?.({
            slide,
            offset: slideIndex - index,
            rect: { width: 1000, height: 800 },
          })}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('yet-another-react-lightbox/plugins', () => ({
  Zoom: () => null,
}))

function createTweet(overrides: Partial<TweetDoc>): TweetDoc {
  return {
    id: 'tweet-1',
    sortIndex: null,
    postedAt: null,
    url: 'https://x.com/example/status/1',
    text: 'Example tweet',
    folderNames: [],
    media: [],
    representativeMediaIndex: 0,
    representativeMotionMediaIndex: 0,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('createBookmarksLightboxSlides', () => {
  it('renders photos as responsive image slides', () => {
    const slides = createBookmarksLightboxSlides(
      createTweet({
        media: [
          {
            type: 'photo',
            thumbUrl: 'https://pbs.twimg.com/media/example.jpg',
            fullUrl: 'https://pbs.twimg.com/media/example.jpg',
            width: 1200,
            height: 800,
          },
        ],
      }),
    )

    expect(slides).toEqual([
      {
        gridId: 'tweet-1:0',
        src: 'https://pbs.twimg.com/media/example.jpg?name=large',
        srcSet: [
          {
            src: 'https://pbs.twimg.com/media/example.jpg?name=small',
            width: 680,
            height: 453,
          },
          {
            src: 'https://pbs.twimg.com/media/example.jpg?name=medium',
            width: 1200,
            height: 800,
          },
          {
            src: 'https://pbs.twimg.com/media/example.jpg?name=large',
            width: 1200,
            height: 800,
          },
          {
            src: 'https://pbs.twimg.com/media/example.jpg?format=jpg&name=orig',
            width: 1200,
            height: 800,
          },
        ],
        width: 1200,
        height: 800,
        alt: 'Example tweet',
      },
    ])
  })

  it('renders videos as direct media slides instead of tweet embeds', () => {
    const slides = createBookmarksLightboxSlides(
      createTweet({
        media: [
          {
            type: 'video',
            thumbUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/example.jpg',
            fullUrl: 'https://tbmedia.corychainsman.com/vid/ext_tw_video/example/playback.mp4',
            posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/poster.jpg',
            width: 1280,
            height: 720,
          },
        ],
      }),
    )

    expect(slides).toEqual([
      {
        gridId: 'tweet-1:0',
        type: 'video',
        src: 'https://tbmedia.corychainsman.com/vid/ext_tw_video/example/playback.mp4',
        poster: 'https://pbs.twimg.com/ext_tw_video_thumb/poster.jpg',
        width: 1280,
        height: 720,
        loop: false,
        muted: false,
      },
    ])
  })

  it('loops and mutes animated gifs', () => {
    const slides = createBookmarksLightboxSlides(
      createTweet({
        media: [
          {
            type: 'animated_gif',
            thumbUrl: 'https://pbs.twimg.com/tweet_video_thumb/example.jpg',
            fullUrl: 'https://video.twimg.com/tweet_video/example.mp4',
            width: 640,
            height: 640,
          },
        ],
      }),
    )

    expect(slides).toEqual([
      {
        gridId: 'tweet-1:0',
        type: 'video',
        src: 'https://video.twimg.com/tweet_video/example.mp4',
        poster: 'https://pbs.twimg.com/tweet_video_thumb/example.jpg',
        width: 640,
        height: 640,
        loop: true,
        muted: false,
      },
    ])
  })

  it('preloads current and neighboring lightbox media without fetching videos', () => {
    const slides = createBookmarksLightboxSlides(
      createTweet({
        media: [
          {
            type: 'photo',
            thumbUrl: 'https://pbs.twimg.com/media/one.jpg',
            fullUrl: 'https://pbs.twimg.com/media/one.jpg',
          },
          {
            type: 'video',
            thumbUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/two.jpg',
            fullUrl: 'https://video.twimg.com/ext_tw_video/two.mp4',
          },
          {
            type: 'photo',
            thumbUrl: 'https://pbs.twimg.com/media/three.jpg',
            fullUrl: 'https://pbs.twimg.com/media/three.jpg',
          },
        ],
      }),
    )

    expect(createLightboxPreloadCandidates(slides, 1)).toEqual([
      {
        kind: 'image',
        url: 'https://pbs.twimg.com/ext_tw_video_thumb/two.jpg',
      },
      {
        kind: 'image',
        url: 'https://pbs.twimg.com/media/three.jpg?name=large',
      },
      {
        kind: 'image',
        url: 'https://pbs.twimg.com/media/one.jpg?name=large',
      },
    ])
  })
})

describe('BookmarksLightbox video autoplay', () => {
  it('autoplays only the active video slide', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined)
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined)
    const tweet = createTweet({
      media: [
        {
          type: 'video',
          thumbUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/one.jpg',
          fullUrl: 'https://video.twimg.com/ext_tw_video/one.mp4',
          width: 1280,
          height: 720,
        },
        {
          type: 'video',
          thumbUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/two.jpg',
          fullUrl: 'https://video.twimg.com/ext_tw_video/two.mp4',
          width: 1280,
          height: 720,
        },
      ],
    })

    render(
      <BookmarksLightbox
        docsById={new Map([[tweet.id, tweet]])}
        selection={{ tweetId: tweet.id, mediaIndex: 1 }}
        onClose={() => {}}
        onBrowseSimilar={() => {}}
        onSelectionChange={() => {}}
      />,
    )

    const videos = [...document.querySelectorAll('video')]

    expect(videos).toHaveLength(2)
    expect(videos[0]).not.toHaveAttribute('autoplay')
    expect(videos[0]).toHaveAttribute('preload', 'metadata')
    expect(videos[1]).toHaveAttribute('autoplay')
    expect(videos[1]).toHaveAttribute('preload', 'auto')
    expect(videos[0].muted).toBe(true)
    expect(videos[1].muted).toBe(true)

    await waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1)
    })
    expect(pause).toHaveBeenCalledTimes(1)

    videos[1].muted = false
    fireEvent.volumeChange(videos[1])

    await waitFor(() => {
      expect(videos[0].muted).toBe(false)
      expect(videos[1].muted).toBe(false)
    })

    videos[1].muted = true
    fireEvent.volumeChange(videos[1])

    await waitFor(() => {
      expect(videos[0].muted).toBe(true)
      expect(videos[1].muted).toBe(true)
    })
  })
})
