import { describe, expect, it } from 'vitest'

import { createBookmarksLightboxSlides } from '@/components/lightbox/lightbox-slides'
import type { TweetDoc } from '@/features/bookmarks/model'

const tweet: TweetDoc = {
  id: 'tweet-1',
  sortIndex: null,
  postedAt: null,
  url: 'https://x.com/example/status/1',
  text: 'Example tweet',
  folderNames: [],
  media: [
    {
      type: 'photo',
      thumbUrl: 'https://pbs.twimg.com/media/photo.jpg?name=small',
      fullUrl: 'https://pbs.twimg.com/media/photo.jpg',
      width: 1600,
      height: 1000,
      aspectRatio: 1.6,
    },
  ],
  representativeMediaIndex: 0,
  representativeMotionMediaIndex: 0,
}

describe('createBookmarksLightboxSlides', () => {
  it('uses a large lightbox fallback and exposes responsive image sources', () => {
    expect(createBookmarksLightboxSlides(tweet)).toEqual([
      {
        src: 'https://pbs.twimg.com/media/photo.jpg?name=large',
        srcSet: [
          {
            src: 'https://pbs.twimg.com/media/photo.jpg?name=small',
            width: 680,
            height: 425,
          },
          {
            src: 'https://pbs.twimg.com/media/photo.jpg?name=medium',
            width: 1200,
            height: 750,
          },
          {
            src: 'https://pbs.twimg.com/media/photo.jpg?name=large',
            width: 1600,
            height: 1000,
          },
          {
            src: 'https://pbs.twimg.com/media/photo.jpg?format=jpg&name=orig',
            width: 1600,
            height: 1000,
          },
        ],
        width: 1600,
        height: 1000,
        alt: 'Example tweet',
      },
    ])
  })
})
