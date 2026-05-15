import { describe, expect, it } from 'vitest'

import type { GridItem } from '@/features/bookmarks/model'
import { createMasonryMediaPreloadCandidates } from '@/components/grid/masonry-media-preload'

const photoItem: GridItem = {
  gridId: 'tweet-1:0',
  tweetId: 'tweet-1',
  mediaIndex: 0,
  mediaType: 'photo',
  thumbUrl: 'https://pbs.twimg.com/media/photo.jpg',
  fullUrl: 'https://pbs.twimg.com/media/photo.jpg',
}

const videoItem: GridItem = {
  gridId: 'tweet-2:0',
  tweetId: 'tweet-2',
  mediaIndex: 0,
  mediaType: 'video',
  thumbUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/thumb.jpg',
  fullUrl: 'https://video.twimg.com/ext_tw_video/video.mp4',
  posterUrl: 'https://pbs.twimg.com/ext_tw_video_thumb/poster.jpg',
}

describe('createMasonryMediaPreloadCandidates', () => {
  it('creates bounded image preload candidates for upcoming masonry items', () => {
    expect(
      createMasonryMediaPreloadCandidates({
        devicePixelRatio: 2,
        items: [photoItem, videoItem, photoItem],
        renderedWidth: 360,
        startIndex: 0,
        take: 2,
      }),
    ).toEqual([
      {
        kind: 'image',
        url: 'https://pbs.twimg.com/media/photo.jpg?name=medium',
      },
      {
        kind: 'image',
        url: 'https://pbs.twimg.com/ext_tw_video_thumb/poster.jpg',
      },
    ])
  })
})
