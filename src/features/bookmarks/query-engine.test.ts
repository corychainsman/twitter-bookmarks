import { describe, expect, it } from 'vitest'

import { buildExportArtifacts } from '@/features/bookmarks/export-artifacts'
import type { RawBookmarkRecord } from '@/features/bookmarks/model'
import { runBookmarksQuery } from '@/features/bookmarks/query-engine'
import { DEFAULT_QUERY_STATE } from '@/features/bookmarks/url-state'

describe('runBookmarksQuery', () => {
  it('uses motion representatives in one-item mode when preferMotion is enabled', () => {
    const records: RawBookmarkRecord[] = [
      {
        id: 'tweet-1',
        tweetId: 'tweet-1',
        sortIndex: '300',
        postedAt: '2026-03-12T10:00:00.000Z',
        url: 'https://x.com/alice/status/tweet-1',
        text: 'Graph compilers with a demo clip',
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
        sortIndex: '250',
        postedAt: '2026-03-11T10:00:00.000Z',
        url: 'https://x.com/carol/status/tweet-2',
        text: 'Animated gif bookmark',
        mediaObjects: [
          {
            type: 'animated_gif',
            previewUrl: 'https://pbs.twimg.com/media/tweet-2-poster.jpg',
            variants: [
              {
                url: 'https://video.twimg.com/tweet-2.mp4',
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
    })

    const result = runBookmarksQuery(artifacts, {
      ...DEFAULT_QUERY_STATE,
      mode: 'one',
      preferMotion: true,
    })

    expect(result).toEqual({
      total: 2,
      orderedGridIds: ['tweet-1:1', 'tweet-2:0'],
    })
  })

  it('keeps random ordering deterministic for a given seed and changes it when the seed changes', () => {
    const records: RawBookmarkRecord[] = [
      {
        id: 'tweet-a',
        tweetId: 'tweet-a',
        sortIndex: '100',
        postedAt: '2026-03-10T10:00:00.000Z',
        url: 'https://x.com/a/status/tweet-a',
        text: 'A',
        mediaObjects: [{ type: 'photo', url: 'https://img/a.jpg' }],
      },
      {
        id: 'tweet-b',
        tweetId: 'tweet-b',
        sortIndex: '200',
        postedAt: '2026-03-11T10:00:00.000Z',
        url: 'https://x.com/b/status/tweet-b',
        text: 'B',
        mediaObjects: [{ type: 'photo', url: 'https://img/b.jpg' }],
      },
      {
        id: 'tweet-c',
        tweetId: 'tweet-c',
        sortIndex: '300',
        postedAt: '2026-03-12T10:00:00.000Z',
        url: 'https://x.com/c/status/tweet-c',
        text: 'C',
        mediaObjects: [{ type: 'photo', url: 'https://img/c.jpg' }],
      },
      {
        id: 'tweet-d',
        tweetId: 'tweet-d',
        sortIndex: '400',
        postedAt: '2026-03-13T10:00:00.000Z',
        url: 'https://x.com/d/status/tweet-d',
        text: 'D',
        mediaObjects: [{ type: 'photo', url: 'https://img/d.jpg' }],
      },
    ]

    const artifacts = buildExportArtifacts(records, {
      buildId: 'build-random',
      builtAt: '2026-04-17T19:00:00.000Z',
    })

    const alphaOne = runBookmarksQuery(artifacts, {
      ...DEFAULT_QUERY_STATE,
      sort: 'random',
      keepSeed: true,
      seed: 'alpha-seed',
    })
    const alphaTwo = runBookmarksQuery(artifacts, {
      ...DEFAULT_QUERY_STATE,
      sort: 'random',
      keepSeed: true,
      seed: 'alpha-seed',
    })
    const bravo = runBookmarksQuery(artifacts, {
      ...DEFAULT_QUERY_STATE,
      sort: 'random',
      keepSeed: true,
      seed: 'bravo-seed',
    })

    expect(alphaOne.appliedSeed).toBe('alpha-seed')
    expect(alphaTwo.appliedSeed).toBe('alpha-seed')
    expect(bravo.appliedSeed).toBe('bravo-seed')
    expect(alphaOne.orderedGridIds).toEqual(alphaTwo.orderedGridIds)
    expect(alphaOne.orderedGridIds).not.toEqual(bravo.orderedGridIds)
  })

  it('matches quoted tweet text in search results', () => {
    const records: RawBookmarkRecord[] = [
      {
        id: 'tweet-quoted',
        tweetId: 'tweet-quoted',
        sortIndex: '300',
        postedAt: '2026-03-12T10:00:00.000Z',
        url: 'https://x.com/alice/status/tweet-quoted',
        text: 'This bookmark text does not contain the query',
        quotedTweet: {
          text: 'Kernel scheduling notes from the quoted tweet',
        },
        mediaObjects: [{ type: 'photo', url: 'https://img/quoted.jpg' }],
      },
      {
        id: 'tweet-other',
        tweetId: 'tweet-other',
        sortIndex: '200',
        postedAt: '2026-03-11T10:00:00.000Z',
        url: 'https://x.com/bob/status/tweet-other',
        text: 'A different media bookmark',
        mediaObjects: [{ type: 'photo', url: 'https://img/other.jpg' }],
      },
    ]

    const artifacts = buildExportArtifacts(records, {
      buildId: 'build-search',
      builtAt: '2026-04-17T19:00:00.000Z',
    })

    const result = runBookmarksQuery(artifacts, {
      ...DEFAULT_QUERY_STATE,
      q: 'kernel',
    })

    expect(result).toEqual({
      total: 1,
      orderedGridIds: ['tweet-quoted:0'],
    })
  })

  it('matches substrings anywhere inside indexed tweet fields', () => {
    const records: RawBookmarkRecord[] = [
      {
        id: 'tweet-handle',
        tweetId: 'tweet-handle',
        sortIndex: '300',
        postedAt: '2026-03-12T10:00:00.000Z',
        url: 'https://x.com/assemblerdaily/status/tweet-handle',
        text: 'Search should not need word boundaries',
        authorHandle: 'assemblerdaily',
        mediaObjects: [{ type: 'photo', url: 'https://img/handle.jpg' }],
      },
      {
        id: 'tweet-other',
        tweetId: 'tweet-other',
        sortIndex: '200',
        postedAt: '2026-03-11T10:00:00.000Z',
        url: 'https://x.com/other/status/tweet-other',
        text: 'A different bookmark',
        authorHandle: 'other',
        mediaObjects: [{ type: 'photo', url: 'https://img/other.jpg' }],
      },
    ]

    const artifacts = buildExportArtifacts(records, {
      buildId: 'build-substring-search',
      builtAt: '2026-04-17T19:00:00.000Z',
    })

    const result = runBookmarksQuery(artifacts, {
      ...DEFAULT_QUERY_STATE,
      q: 'mblerdai',
    })

    expect(result).toEqual({
      total: 1,
      orderedGridIds: ['tweet-handle:0'],
    })
  })

  it('matches fuzzy misspellings across indexed tweet fields', () => {
    const records: RawBookmarkRecord[] = [
      {
        id: 'tweet-fuzzy',
        tweetId: 'tweet-fuzzy',
        sortIndex: '300',
        postedAt: '2026-03-12T10:00:00.000Z',
        url: 'https://x.com/alice/status/tweet-fuzzy',
        text: 'Kernel scheduler notes for media pipelines',
        mediaObjects: [{ type: 'photo', url: 'https://img/fuzzy.jpg' }],
      },
      {
        id: 'tweet-other',
        tweetId: 'tweet-other',
        sortIndex: '200',
        postedAt: '2026-03-11T10:00:00.000Z',
        url: 'https://x.com/bob/status/tweet-other',
        text: 'A different bookmark',
        mediaObjects: [{ type: 'photo', url: 'https://img/other.jpg' }],
      },
    ]

    const artifacts = buildExportArtifacts(records, {
      buildId: 'build-fuzzy-search',
      builtAt: '2026-04-17T19:00:00.000Z',
    })

    const result = runBookmarksQuery(artifacts, {
      ...DEFAULT_QUERY_STATE,
      q: 'kernal schedulr',
    })

    expect(result).toEqual({
      total: 1,
      orderedGridIds: ['tweet-fuzzy:0'],
    })
  })

  it('runs non-search queries without requiring hydrated search artifacts', () => {
    const artifacts = buildExportArtifacts(
      [
        {
          id: 'tweet-core',
          tweetId: 'tweet-core',
          sortIndex: '100',
          postedAt: '2026-03-12T10:00:00.000Z',
          url: 'https://x.com/alice/status/tweet-core',
          text: 'Core only',
          mediaObjects: [{ type: 'photo', url: 'https://img/core.jpg' }],
        },
      ],
      {
        buildId: 'build-core',
        builtAt: '2026-04-17T19:00:00.000Z',
      },
    )

    const result = runBookmarksQuery(
      {
        manifest: artifacts.manifest,
        docsChunks: artifacts.docsChunks,
        gridOne: artifacts.gridOne,
        gridAll: artifacts.gridAll,
        orderBookmarked: artifacts.orderBookmarked,
        orderPosted: artifacts.orderPosted,
      },
      DEFAULT_QUERY_STATE,
    )

    expect(result).toEqual({
      total: 1,
      orderedGridIds: ['tweet-core:0'],
    })
  })

  it('throws a dedicated error when search is requested before search artifacts are hydrated', () => {
    const artifacts = buildExportArtifacts(
      [
        {
          id: 'tweet-core',
          tweetId: 'tweet-core',
          sortIndex: '100',
          postedAt: '2026-03-12T10:00:00.000Z',
          url: 'https://x.com/alice/status/tweet-core',
          text: 'Kernel scheduler notes',
          mediaObjects: [{ type: 'photo', url: 'https://img/core.jpg' }],
        },
      ],
      {
        buildId: 'build-core',
        builtAt: '2026-04-17T19:00:00.000Z',
      },
    )

    expect(() =>
      runBookmarksQuery(
        {
          manifest: artifacts.manifest,
          docsChunks: artifacts.docsChunks,
          gridOne: artifacts.gridOne,
          gridAll: artifacts.gridAll,
          orderBookmarked: artifacts.orderBookmarked,
          orderPosted: artifacts.orderPosted,
        },
        {
          ...DEFAULT_QUERY_STATE,
          q: 'kernel',
        },
      ),
    ).toThrow('Search artifacts have not been hydrated')
  })
})
