import { describe, expect, it } from 'vitest'

import {
  bookmarksQueryNeedsDocs,
  canUseDefaultFirstPaint,
  createBookmarksQuery,
  createBookmarksViewKey,
  createSemanticTextQueryKey,
} from '@/features/bookmarks/query-request'
import { DEFAULT_QUERY_STATE } from '@/features/bookmarks/url-state'

describe('BookmarksQuery', () => {
  it('projects only query-engine state across the query seam', () => {
    expect(
      createBookmarksQuery({
        q: 'deferred',
        sort: DEFAULT_QUERY_STATE.sort,
        dir: DEFAULT_QUERY_STATE.dir,
        mode: DEFAULT_QUERY_STATE.mode,
        preferMotion: DEFAULT_QUERY_STATE.preferMotion,
        similarToGridId: DEFAULT_QUERY_STATE.similarToGridId,
        seed: DEFAULT_QUERY_STATE.seed,
      }),
    ).toEqual({
      q: 'deferred',
      sort: 'bookmarked',
      dir: 'desc',
      mode: 'all',
      preferMotion: false,
      similarToGridId: undefined,
      seed: undefined,
    })
  })

  it('centralizes docs requirements and stable view identity', () => {
    const query = createBookmarksQuery({
      q: '',
      sort: 'random',
      dir: DEFAULT_QUERY_STATE.dir,
      mode: DEFAULT_QUERY_STATE.mode,
      preferMotion: DEFAULT_QUERY_STATE.preferMotion,
      similarToGridId: undefined,
      seed: 'seed',
    })
    expect(bookmarksQueryNeedsDocs(query)).toBe(true)
    expect(bookmarksQueryNeedsDocs({ ...query, sort: 'bookmarked', q: 'design' })).toBe(true)
    expect(createBookmarksViewKey(query)).toBe('random|desc|all|||0|seed')
    expect(createSemanticTextQueryKey('  compiler ')).toBe('text:compiler')
  })

  it('limits first-paint artifacts to the matching default content view', () => {
    const defaultQuery = createBookmarksQuery({
      q: '',
      sort: 'bookmarked',
      dir: 'desc',
      mode: 'all',
      preferMotion: false,
      similarToGridId: undefined,
      seed: undefined,
    })

    expect(canUseDefaultFirstPaint(defaultQuery)).toBe(true)
    expect(canUseDefaultFirstPaint({ ...defaultQuery, dir: 'asc' })).toBe(false)
    expect(canUseDefaultFirstPaint({ ...defaultQuery, q: 'design' })).toBe(false)
    expect(canUseDefaultFirstPaint({ ...defaultQuery, mode: 'one' })).toBe(false)
  })
})
