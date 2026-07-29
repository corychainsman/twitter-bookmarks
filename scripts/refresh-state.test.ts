import { describe, expect, it } from 'vitest'

import {
  bookmarkSnapshotChanged,
  selectBookmarkSnapshot,
  shouldRunFullReconciliation,
  type RefreshState,
} from './refresh-state'

const state: RefreshState = {
  schemaVersion: 1,
  newestBookmarkId: 'newest',
  bookmarkCount: 2,
  lastSuccessfulAt: '2026-07-28T12:00:00.000Z',
  lastFullReconciliationAt: '2026-07-28T12:00:00.000Z',
  catalogBuildId: 'catalog-1',
}

describe('production refresh checkpoint', () => {
  it('selects the highest timeline rank as the durable bookmark token', () => {
    expect(
      selectBookmarkSnapshot(
        [
          { id: 'oldest', sortIndex: '1' },
          { id: 'newest', sortIndex: '3' },
          { id: 'middle', sortIndex: '2' },
        ],
        'middle',
      ),
    ).toEqual({
      newestBookmarkId: 'newest',
      bookmarkCount: 3,
      checkpointTokenPresent: true,
    })
  })

  it('requires a full reconciliation when the GitHub token is absent locally', () => {
    expect(
      shouldRunFullReconciliation(state, {
        newestBookmarkId: 'newest',
        bookmarkCount: 2,
        checkpointTokenPresent: false,
      }),
    ).toBe(true)
  })

  it('does not republish an unchanged incremental snapshot', () => {
    expect(
      bookmarkSnapshotChanged(state, {
        newestBookmarkId: 'newest',
        bookmarkCount: 2,
        checkpointTokenPresent: true,
      }),
    ).toBe(false)
  })
})
