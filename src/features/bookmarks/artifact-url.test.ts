import { describe, expect, it } from 'vitest'

import {
  resolveArtifactPath,
  resolveArtifactUrl,
  resolveEmbeddingIndexUrl,
  withArtifactVersion,
} from '@/features/bookmarks/artifact-url'
import type { Manifest } from '@/features/bookmarks/model'

const manifest: Manifest = {
  buildId: 'build 1',
  builtAt: '2026-07-13T00:00:00.000Z',
  tweetCount: 0,
  gridItemCountOne: 0,
  gridItemCountAll: 0,
  chunkSize: 500,
  files: {
    docs: [],
    gridOne: 'grid/one.json',
    gridAll: 'grid/all.json',
    orderBookmarked: 'order/bookmarked.json',
    orderPosted: 'order/posted.json',
    searchIndex: 'search/index.json',
    searchStore: 'search/store.json',
    embeddings: '/embeddings/index.json',
  },
}

describe('artifact URLs', () => {
  it('normalizes public artifact paths and replaces an existing version', () => {
    expect(resolveArtifactPath('/grid/all.json')).toBe('data/grid/all.json')
    expect(withArtifactVersion('data/grid/all.json?format=json&v=old', 'new')).toBe(
      'data/grid/all.json?format=json&v=new',
    )
  })

  it('resolves versioned URLs under the deployed application base', () => {
    expect(
      resolveArtifactUrl('/grid/all.json', 'build 1', 'https://example.com/twitter-bookmarks/'),
    ).toBe('https://example.com/twitter-bookmarks/data/grid/all.json?v=build+1')
    expect(
      resolveEmbeddingIndexUrl(manifest, 'https://example.com/twitter-bookmarks/'),
    ).toBe('https://example.com/twitter-bookmarks/data/embeddings/index.json?v=build+1')
  })

  it('reports a missing embedding artifact at the Manifest seam', () => {
    expect(() =>
      resolveEmbeddingIndexUrl({
        ...manifest,
        files: { ...manifest.files, embeddings: undefined },
      }),
    ).toThrow('Semantic embeddings are not exported')
  })
})
