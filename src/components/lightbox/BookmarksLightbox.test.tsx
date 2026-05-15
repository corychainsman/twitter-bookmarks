import { describe, expect, it } from 'vitest'

import type { TweetDoc } from '@/features/bookmarks/model'
import {
  createBookmarksLightboxSlides,
  createLightboxPreloadCandidates,
} from '@/components/lightbox/lightbox-slides'

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

describe('createBookmarksLightboxSlides', () => {
  it('renders photos as full-size image slides', () => {
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
        src: 'https://pbs.twimg.com/media/example.jpg?format=jpg&name=orig',
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
            fullUrl: 'https://video.twimg.com/ext_tw_video/example.mp4',
            posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/poster.jpg',
            width: 1280,
            height: 720,
          },
        ],
      }),
    )

    expect(slides).toEqual([
      {
        type: 'video',
        src: 'https://video.twimg.com/ext_tw_video/example.mp4',
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
        type: 'video',
        src: 'https://video.twimg.com/tweet_video/example.mp4',
        poster: 'https://pbs.twimg.com/tweet_video_thumb/example.jpg',
        width: 640,
        height: 640,
        loop: true,
        muted: true,
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
        url: 'https://pbs.twimg.com/media/three.jpg?format=jpg&name=orig',
      },
      {
        kind: 'image',
        url: 'https://pbs.twimg.com/media/one.jpg?format=jpg&name=orig',
      },
    ])
  })
})
