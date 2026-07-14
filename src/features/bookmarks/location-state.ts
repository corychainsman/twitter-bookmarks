import type { QueryState } from '@/features/bookmarks/model'
import {
  type ParseQueryStateOptions,
  parseQueryState,
  serializeQueryState,
} from '@/features/bookmarks/url-state'

export type GridSelection = {
  tweetId: string
  mediaIndex: number
}

export type BookmarksLocationState = {
  queryState: QueryState
  selectedGridId: string | null
}

export function parseGridSelection(gridId: string | null): GridSelection | null {
  if (!gridId) return null

  const separatorIndex = gridId.lastIndexOf(':')
  if (separatorIndex <= 0) return null

  const tweetId = gridId.slice(0, separatorIndex)
  const mediaIndex = Number(gridId.slice(separatorIndex + 1))
  if (!Number.isInteger(mediaIndex) || mediaIndex < 0) return null

  return { tweetId, mediaIndex }
}

export function parseBookmarksLocation(
  params: URLSearchParams,
  options: ParseQueryStateOptions,
): BookmarksLocationState {
  const selected = params.get('selected')

  return {
    queryState: parseQueryState(params, options),
    selectedGridId: parseGridSelection(selected) ? selected : null,
  }
}

export function serializeBookmarksLocation(
  queryState: QueryState,
  selectedGridId: string | null,
): URLSearchParams {
  const params = serializeQueryState(queryState)
  if (parseGridSelection(selectedGridId)) {
    params.set('selected', selectedGridId!)
  }
  return params
}

export function buildBookmarksLocationPath(
  pathname: string,
  queryState: QueryState,
  selectedGridId: string | null,
): string {
  const query = serializeBookmarksLocation(queryState, selectedGridId).toString()
  return query ? `${pathname}?${query}` : pathname
}
