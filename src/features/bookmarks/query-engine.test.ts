import { describe, expect, it } from 'vitest'

import { buildExportArtifacts } from '@/features/bookmarks/export-artifacts'
import {
  encodeInt8Base64,
  type EmbeddingIndex,
} from '@/features/bookmarks/embedding-artifacts'
import type { RawBookmarkRecord } from '@/features/bookmarks/model'
import { runBookmarksQuery } from '@/features/bookmarks/query-engine'
import { DEFAULT_QUERY_STATE } from '@/features/bookmarks/url-state'

function buildTestEmbeddingIndex(records: EmbeddingIndex['records'], vectors: number[][]): EmbeddingIndex {
  return {
    version: 1,
    buildId: 'build-semantic',
    builtAt: '2026-04-17T19:00:00.000Z',
    model: {
      id: 'test-model',
      dimensions: 2,
      quantization: 'int8-unit-vector',
    },
    records,
    vectors: encodeInt8Base64(new Int8Array(vectors.flat())),
  }
}

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

  it('throws a dedicated error when text search is requested before embedding artifacts are hydrated', () => {
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
    ).toThrow('Semantic embedding artifacts have not been hydrated')
  })

  it('ranks semantic search results using text and media embedding records', () => {
    const artifacts = buildExportArtifacts(
      [
        {
          id: 'tweet-text',
          tweetId: 'tweet-text',
          sortIndex: '100',
          postedAt: '2026-03-12T10:00:00.000Z',
          url: 'https://x.com/alice/status/tweet-text',
          text: 'A sculptural chair',
          mediaObjects: [{ type: 'photo', url: 'https://img/text.jpg' }],
        },
        {
          id: 'tweet-media',
          tweetId: 'tweet-media',
          sortIndex: '200',
          postedAt: '2026-03-13T10:00:00.000Z',
          url: 'https://x.com/bob/status/tweet-media',
          text: 'No matching words here',
          mediaObjects: [{ type: 'photo', url: 'https://img/media.jpg' }],
        },
      ],
      {
        buildId: 'build-semantic',
        builtAt: '2026-04-17T19:00:00.000Z',
      },
    )

    const result = runBookmarksQuery(
      {
        ...artifacts,
        embeddingIndex: buildTestEmbeddingIndex(
          [
            {
              id: 'tweet-text:text',
              tweetId: 'tweet-text',
              kind: 'tweet-text',
              label: 'chair',
            },
            {
              id: 'tweet-media:0:visual',
              tweetId: 'tweet-media',
              gridId: 'tweet-media:0',
              mediaIndex: 0,
              kind: 'media-image',
              label: 'chair photo',
            },
          ],
          [
            [127, 0],
            [100, 80],
          ],
        ),
      },
      {
        ...DEFAULT_QUERY_STATE,
        q: 'furniture inspo',
        mode: 'one',
      },
      {
        source: 'text',
        vector: [1, 0],
      },
    )

    expect(result.orderedGridIds).toEqual(['tweet-media:0', 'tweet-text:0'])
  })

  it('uses the strongest matching media item as the one-mode semantic representative', () => {
    const artifacts = buildExportArtifacts(
      [
        {
          id: 'tweet-gallery',
          tweetId: 'tweet-gallery',
          sortIndex: '100',
          postedAt: '2026-03-12T10:00:00.000Z',
          url: 'https://x.com/alice/status/tweet-gallery',
          text: 'A two image gallery',
          mediaObjects: [
            { type: 'photo', url: 'https://img/first.jpg' },
            { type: 'photo', url: 'https://img/second.jpg' },
          ],
        },
      ],
      {
        buildId: 'build-semantic-gallery',
        builtAt: '2026-04-17T19:00:00.000Z',
      },
    )

    const result = runBookmarksQuery(
      {
        ...artifacts,
        embeddingIndex: buildTestEmbeddingIndex(
          [
            {
              id: 'tweet-gallery:0:visual',
              tweetId: 'tweet-gallery',
              gridId: 'tweet-gallery:0',
              mediaIndex: 0,
              kind: 'media-image',
              label: 'first',
            },
            {
              id: 'tweet-gallery:1:visual',
              tweetId: 'tweet-gallery',
              gridId: 'tweet-gallery:1',
              mediaIndex: 1,
              kind: 'media-image',
              label: 'second',
            },
          ],
          [
            [0, 127],
            [127, 0],
          ],
        ),
      },
      {
        ...DEFAULT_QUERY_STATE,
        mode: 'one',
      },
      {
        source: 'image',
        vector: [1, 0],
      },
    )

    expect(result.orderedGridIds).toEqual(['tweet-gallery:1'])
  })

  it('browses by similarity from a selected media item and excludes the source tweet', () => {
    const artifacts = buildExportArtifacts(
      [
        {
          id: 'tweet-source',
          tweetId: 'tweet-source',
          sortIndex: '300',
          postedAt: '2026-03-14T10:00:00.000Z',
          url: 'https://x.com/a/status/tweet-source',
          text: 'Source',
          mediaObjects: [{ type: 'photo', url: 'https://img/source.jpg' }],
        },
        {
          id: 'tweet-near',
          tweetId: 'tweet-near',
          sortIndex: '200',
          postedAt: '2026-03-13T10:00:00.000Z',
          url: 'https://x.com/b/status/tweet-near',
          text: 'Near',
          mediaObjects: [{ type: 'photo', url: 'https://img/near.jpg' }],
        },
        {
          id: 'tweet-far',
          tweetId: 'tweet-far',
          sortIndex: '100',
          postedAt: '2026-03-12T10:00:00.000Z',
          url: 'https://x.com/c/status/tweet-far',
          text: 'Far',
          mediaObjects: [{ type: 'photo', url: 'https://img/far.jpg' }],
        },
      ],
      {
        buildId: 'build-semantic-similar',
        builtAt: '2026-04-17T19:00:00.000Z',
      },
    )

    const result = runBookmarksQuery(
      {
        ...artifacts,
        embeddingIndex: buildTestEmbeddingIndex(
          [
            {
              id: 'tweet-source:0:visual',
              tweetId: 'tweet-source',
              gridId: 'tweet-source:0',
              mediaIndex: 0,
              kind: 'media-image',
              label: 'source',
            },
            {
              id: 'tweet-near:0:visual',
              tweetId: 'tweet-near',
              gridId: 'tweet-near:0',
              mediaIndex: 0,
              kind: 'media-image',
              label: 'near',
            },
            {
              id: 'tweet-far:0:visual',
              tweetId: 'tweet-far',
              gridId: 'tweet-far:0',
              mediaIndex: 0,
              kind: 'media-image',
              label: 'far',
            },
          ],
          [
            [127, 0],
            [110, 20],
            [0, 127],
          ],
        ),
      },
      {
        ...DEFAULT_QUERY_STATE,
        similarToGridId: 'tweet-source:0',
        mode: 'one',
      },
    )

    expect(result.orderedGridIds).toEqual(['tweet-near:0', 'tweet-far:0'])
  })
})
