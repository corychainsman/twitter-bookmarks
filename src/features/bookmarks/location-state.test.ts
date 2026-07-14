import { describe, expect, it } from 'vitest'

import {
  buildBookmarksLocationPath,
  parseBookmarksLocation,
  parseGridSelection,
} from '@/features/bookmarks/location-state'
import { DEFAULT_QUERY_STATE } from '@/features/bookmarks/url-state'

const options = { generateSeed: () => 'seed-1234' }

describe('bookmark location state', () => {
  it('parses the media suffix without constraining tweet id contents', () => {
    expect(parseGridSelection('archive:tweet-1:2')).toEqual({
      tweetId: 'archive:tweet-1',
      mediaIndex: 2,
    })
    expect(parseGridSelection('tweet-1:-1')).toBeNull()
    expect(parseGridSelection('tweet-1:nope')).toBeNull()
  })

  it('parses QueryState and a validated lightbox selection together', () => {
    expect(parseBookmarksLocation(new URLSearchParams('q=compiler&selected=tweet-1%3A2'), options))
      .toEqual({
        queryState: { ...DEFAULT_QUERY_STATE, q: 'compiler' },
        selectedGridId: 'tweet-1:2',
      })
    expect(parseBookmarksLocation(new URLSearchParams('selected=invalid'), options).selectedGridId)
      .toBeNull()
  })

  it('serializes a complete shareable location without invalid selections', () => {
    expect(
      buildBookmarksLocationPath('/bookmarks', { ...DEFAULT_QUERY_STATE, q: 'compiler' }, 't:1'),
    ).toBe('/bookmarks?q=compiler&selected=t%3A1')
    expect(buildBookmarksLocationPath('/', DEFAULT_QUERY_STATE, 'invalid')).toBe('/')
  })
})
