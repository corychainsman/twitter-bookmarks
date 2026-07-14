import type { QueryState } from '@/features/bookmarks/model'

export type BookmarksQuery = Pick<
  QueryState,
  'q' | 'sort' | 'dir' | 'mode' | 'preferMotion' | 'similarToGridId' | 'seed'
>

export function createBookmarksQuery(
  input: BookmarksQuery,
): BookmarksQuery {
  return {
    q: input.q,
    sort: input.sort,
    dir: input.dir,
    mode: input.mode,
    preferMotion: input.preferMotion,
    similarToGridId: input.similarToGridId,
    seed: input.seed,
  }
}

export function bookmarksQueryNeedsDocs(query: BookmarksQuery): boolean {
  return query.q.trim().length > 0 || query.sort === 'random' || query.mode === 'one'
}

export function canUseDefaultFirstPaint(query: BookmarksQuery): boolean {
  return (
    query.q.trim().length === 0 &&
    query.sort === 'bookmarked' &&
    query.dir === 'desc' &&
    query.mode === 'all' &&
    !query.similarToGridId
  )
}

export function createBookmarksViewKey(query: BookmarksQuery): string {
  return [
    query.sort,
    query.dir,
    query.mode,
    query.q,
    query.similarToGridId ?? '',
    query.preferMotion ? '1' : '0',
    query.sort === 'random' ? (query.seed ?? '') : '',
  ].join('|')
}

export function createSemanticTextQueryKey(text: string): string {
  return `text:${text.trim()}`
}
