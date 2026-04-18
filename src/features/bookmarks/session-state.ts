export type SessionStore = {
  get(key: string): string | null
  set(key: string, value: string): void
  delete(key: string): void
}

export type BookmarksSessionState = {
  scrollY: number
  selectedGridId: string | null
}

const SCROLL_KEY = 'twitter-bookmarks.scroll-y'
const SELECTED_GRID_ID_KEY = 'twitter-bookmarks.selected-grid-id'

function parseScrollValue(value: string | null): number {
  if (!value) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function readBookmarksSessionState(store: SessionStore): BookmarksSessionState {
  return {
    scrollY: parseScrollValue(store.get(SCROLL_KEY)),
    selectedGridId: store.get(SELECTED_GRID_ID_KEY),
  }
}

export function writeBookmarksScrollSnapshot(
  store: SessionStore,
  scrollY: number,
): void {
  store.set(SCROLL_KEY, String(Math.max(0, Math.round(scrollY))))
}

export function writeBookmarksSelectedGridId(
  store: SessionStore,
  gridId: string | null,
): void {
  if (!gridId) {
    store.delete(SELECTED_GRID_ID_KEY)
    return
  }

  store.set(SELECTED_GRID_ID_KEY, gridId)
}
