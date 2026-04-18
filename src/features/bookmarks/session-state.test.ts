import { describe, expect, it } from 'vitest'

import {
  readBookmarksSessionState,
  writeBookmarksScrollSnapshot,
  writeBookmarksSelectedGridId,
  type SessionStore,
} from '@/features/bookmarks/session-state'

function createMemoryStore(): SessionStore {
  const values = new Map<string, string>()

  return {
    get(key) {
      return values.get(key) ?? null
    },
    set(key, value) {
      values.set(key, value)
    },
    delete(key) {
      values.delete(key)
    },
  }
}

describe('bookmarks session state', () => {
  it('round-trips scroll and selected lightbox item state', () => {
    const store = createMemoryStore()

    writeBookmarksScrollSnapshot(store, 420)
    writeBookmarksSelectedGridId(store, 'tweet-1:1')

    expect(readBookmarksSessionState(store)).toEqual({
      scrollY: 420,
      selectedGridId: 'tweet-1:1',
    })

    writeBookmarksSelectedGridId(store, null)

    expect(readBookmarksSessionState(store)).toEqual({
      scrollY: 420,
      selectedGridId: null,
    })
  })
})
