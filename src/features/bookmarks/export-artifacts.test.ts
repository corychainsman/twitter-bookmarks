import { describe, expect, it } from 'vitest'

import { buildExportArtifacts } from '@/features/bookmarks/export-artifacts'
import type { RawBookmarkRecord } from '@/features/bookmarks/model'

describe('buildExportArtifacts', () => {
  it('filters to media tweets and precomputes one-per-tweet and all-media projections', () => {
    const records: RawBookmarkRecord[] = [
      {
        id: 'tweet-1',
        tweetId: 'tweet-1',
        sortIndex: '300',
        postedAt: '2026-03-12T10:00:00.000Z',
        url: 'https://x.com/alice/status/tweet-1',
        text: 'Graph compilers with a demo clip',
        articleTitle: 'Compilers at scale',
        articleText: 'An article about compilers and GPU scheduling.',
        quotedTweet: {
          text: 'Quoted context about kernels',
        },
        authorName: 'Alice',
        authorHandle: 'alice',
        folderNames: ['Compilers'],
        engagement: {
          likeCount: 120,
          replyCount: 12,
          repostCount: 30,
        },
        mediaObjects: [
          {
            type: 'photo',
            url: 'https://pbs.twimg.com/media/tweet-1-photo.jpg',
            width: 1200,
            height: 900,
          },
          {
            type: 'video',
            previewUrl: 'https://pbs.twimg.com/media/tweet-1-video-poster.jpg',
            variants: [
              {
                url: 'https://video.twimg.com/tweet-1.mp4',
                bitrate: 832000,
                contentType: 'video/mp4',
              },
            ],
            width: 1080,
            height: 1920,
          },
        ],
      },
      {
        id: 'tweet-2',
        tweetId: 'tweet-2',
        sortIndex: '200',
        postedAt: '2026-03-10T10:00:00.000Z',
        url: 'https://x.com/bob/status/tweet-2',
        text: 'Plain text bookmark without media',
        authorName: 'Bob',
        authorHandle: 'bob',
      },
      {
        id: 'tweet-3',
        tweetId: 'tweet-3',
        sortIndex: '250',
        postedAt: '2026-03-11T10:00:00.000Z',
        url: 'https://x.com/carol/status/tweet-3',
        text: 'Animated gif bookmark',
        authorName: 'Carol',
        authorHandle: 'carol',
        mediaObjects: [
          {
            type: 'animated_gif',
            previewUrl: 'https://pbs.twimg.com/media/tweet-3-poster.jpg',
            variants: [
              {
                url: 'https://video.twimg.com/tweet-3.mp4',
                contentType: 'video/mp4',
              },
            ],
            width: 720,
            height: 720,
          },
        ],
      },
    ]

    const artifacts = buildExportArtifacts(records, {
      buildId: 'build-123',
      builtAt: '2026-04-17T19:00:00.000Z',
      chunkSize: 1,
    })

    expect(artifacts.docsChunks).toHaveLength(2)
    expect(artifacts.docsChunks[0]?.docs).toHaveLength(1)
    expect(artifacts.docsChunks[1]?.docs).toHaveLength(1)

    const firstDoc = artifacts.docsChunks[0]?.docs[0]
    expect(firstDoc).toMatchObject({
      id: 'tweet-1',
      articleTitle: 'Compilers at scale',
      articleText: 'An article about compilers and GPU scheduling.',
      quotedText: 'Quoted context about kernels',
      folderNames: ['Compilers'],
      likes: 120,
      replies: 12,
      reposts: 30,
      representativeMediaIndex: 0,
      representativeMotionMediaIndex: 1,
    })

    expect(artifacts.gridOne).toEqual([
      expect.objectContaining({
        gridId: 'tweet-1:0',
        tweetId: 'tweet-1',
        mediaIndex: 0,
        mediaType: 'photo',
      }),
      expect.objectContaining({
        gridId: 'tweet-3:0',
        tweetId: 'tweet-3',
        mediaIndex: 0,
        mediaType: 'animated_gif',
      }),
    ])

    expect(artifacts.gridAll).toEqual([
      expect.objectContaining({ gridId: 'tweet-1:0', mediaType: 'photo' }),
      expect.objectContaining({ gridId: 'tweet-1:1', mediaType: 'video' }),
      expect.objectContaining({ gridId: 'tweet-3:0', mediaType: 'animated_gif' }),
    ])

    expect(artifacts.orderBookmarked).toEqual(['tweet-1', 'tweet-3'])
    expect(artifacts.orderPosted).toEqual(['tweet-1', 'tweet-3'])

    expect(artifacts.manifest).toEqual({
      buildId: 'build-123',
      builtAt: '2026-04-17T19:00:00.000Z',
      tweetCount: 2,
      gridItemCountOne: 2,
      gridItemCountAll: 3,
      chunkSize: 1,
      files: {
        docs: ['tweets/docs-0001.json', 'tweets/docs-0002.json'],
        gridOne: 'grid/one.json',
        gridAll: 'grid/all.json',
        orderBookmarked: 'order/bookmarked.json',
        orderPosted: 'order/posted.json',
        searchIndex: 'search/index.json',
        searchStore: 'search/store.json',
      },
    })
  })
})
