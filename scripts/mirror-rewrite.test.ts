import { describe, expect, it } from 'vitest'

import type { ExportArtifacts } from '../src/features/bookmarks/export-artifacts'
import type { GridItem, TweetDoc } from '../src/features/bookmarks/model'
import type { MirrorManifest } from './mirror-lib'
import { applyMirrorRewrite } from './mirror-rewrite'

const PHOTO_URL = 'https://pbs.twimg.com/media/abc.jpg'
const VIDEO_URL = 'https://video.twimg.com/amplify_video/1/vid/avc1/100x100/clip.mp4?tag=21'
const POSTER_URL = 'https://pbs.twimg.com/amplify_video_thumb/1/img/poster.jpg'
const DEAD_URL = 'https://pbs.twimg.com/media/dead.jpg'

function buildArtifacts(): ExportArtifacts {
  const media: TweetDoc['media'] = [
    { type: 'photo', thumbUrl: PHOTO_URL, fullUrl: PHOTO_URL },
    { type: 'video', thumbUrl: POSTER_URL, fullUrl: VIDEO_URL, posterUrl: POSTER_URL },
    { type: 'photo', thumbUrl: DEAD_URL, fullUrl: DEAD_URL },
  ]
  const doc: TweetDoc = {
    id: 't1',
    sortIndex: null,
    postedAt: null,
    url: 'https://x.com/u/status/t1',
    text: 'hello',
    folderNames: [],
    media,
    representativeMediaIndex: 0,
    representativeMotionMediaIndex: 1,
  }
  const gridItems: GridItem[] = media.map((item, mediaIndex) => ({
    gridId: `t1:${mediaIndex}`,
    tweetId: 't1',
    mediaIndex,
    mediaType: item.type,
    thumbUrl: item.thumbUrl,
    fullUrl: item.fullUrl,
    posterUrl: item.posterUrl,
  }))

  return {
    manifest: {
      buildId: 'test',
      builtAt: 'test',
      tweetCount: 1,
      gridItemCountOne: 1,
      gridItemCountAll: gridItems.length,
      chunkSize: 500,
      files: {
        docs: ['tweets/docs-0001.json'],
        gridOne: 'grid/one.json',
        gridAll: 'grid/all.json',
        orderBookmarked: 'order/bookmarked.json',
        orderPosted: 'order/posted.json',
        searchIndex: 'search/index.json',
        searchStore: 'search/store.json',
      },
    },
    docsChunks: [{ fileName: 'tweets/docs-0001.json', docs: [doc] }],
    // buildExportArtifacts creates distinct objects for gridOne and gridAll.
    gridOne: [{ ...gridItems[0] }],
    gridAll: gridItems,
    orderBookmarked: ['t1'],
    orderPosted: ['t1'],
    searchIndex: {},
    searchStore: [],
  } as unknown as ExportArtifacts
}

function buildManifest(): MirrorManifest {
  return {
    version: 1,
    assets: {
      [PHOTO_URL]: {
        status: 'ok',
        kind: 'image',
        key: 'pbs/media/abc.jpg',
        thumbhash: 'aGFzaA==',
        attempts: 1,
      },
      [VIDEO_URL]: {
        status: 'ok',
        kind: 'video',
        key: 'vid/amplify_video/1/vid/avc1/100x100/clip.mp4',
        previewKey: 'vid/amplify_video/1/vid/avc1/100x100/clip/preview.mp4',
        playbackKey: 'vid/amplify_video/1/vid/avc1/100x100/clip/playback.mp4',
        attempts: 1,
      },
      [POSTER_URL]: {
        status: 'ok',
        kind: 'image',
        key: 'pbs/amplify_video_thumb/1/img/poster.jpg',
        thumbhash: 'cG9zdGVy',
        attempts: 1,
      },
      [DEAD_URL]: {
        status: 'failed',
        kind: 'image',
        key: 'pbs/media/dead.jpg',
        attempts: 3,
        error: 'gone: 404',
      },
    },
  }
}

describe('applyMirrorRewrite', () => {
  it('rewrites mirrored URLs, keeps failed ones, and annotates grid items', () => {
    const artifacts = buildArtifacts()
    const stats = applyMirrorRewrite(artifacts, buildManifest(), 'https://media.example.com/')

    const [photo, video, dead] = artifacts.docsChunks[0].docs[0].media
    expect(photo.fullUrl).toBe('https://media.example.com/pbs/media/abc.jpg')
    expect(photo.originUrl).toBe(PHOTO_URL)
    expect(video.fullUrl).toBe('https://media.example.com/vid/amplify_video/1/vid/avc1/100x100/clip/playback.mp4')
    expect(video.posterUrl).toBe('https://media.example.com/pbs/amplify_video_thumb/1/img/poster.jpg')
    expect(video.originUrl).toBe(VIDEO_URL)
    expect(dead.fullUrl).toBe(DEAD_URL)
    expect(dead.originUrl).toBeUndefined()

    const [photoTile, videoTile, deadTile] = artifacts.gridAll
    expect(photoTile.thumbUrl).toBe('https://media.example.com/pbs/media/abc.jpg')
    expect(photoTile.thumbhash).toBe('aGFzaA==')
    expect(videoTile.thumbhash).toBe('cG9zdGVy')
    expect(videoTile.previewUrl).toBe(
      'https://media.example.com/vid/amplify_video/1/vid/avc1/100x100/clip/preview.mp4',
    )
    expect(videoTile.fullUrl).toBe(
      'https://media.example.com/vid/amplify_video/1/vid/avc1/100x100/clip/playback.mp4',
    )
    expect(photoTile.previewUrl).toBeUndefined()
    expect(deadTile.thumbUrl).toBe(DEAD_URL)
    expect(deadTile.thumbhash).toBeUndefined()

    expect(artifacts.manifest.mediaBaseUrl).toBe('https://media.example.com')
    expect(stats.rewrittenUrls).toBeGreaterThan(0)
    expect(stats.thumbhashedGridItems).toBe(3)
    expect(stats.previewGridItems).toBe(1)
  })
})
