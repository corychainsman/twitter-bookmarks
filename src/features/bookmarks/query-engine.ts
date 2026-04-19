import MiniSearch from 'minisearch'

import {
  BOOKMARK_SEARCH_BOOSTS,
  BOOKMARK_SEARCH_FIELDS,
  type SearchStoreEntry,
  type CoreArtifacts,
  type SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
import type { QueryResult, QueryState } from '@/features/bookmarks/model'

export const SEARCH_ARTIFACTS_NOT_HYDRATED_MESSAGE = 'Search artifacts have not been hydrated'

type QueryArtifacts = CoreArtifacts & Partial<SearchArtifacts>

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getSearchEntryFields(entry: SearchStoreEntry): string[] {
  return BOOKMARK_SEARCH_FIELDS.map((field) => entry[field] ?? '')
}

function matchesSearchEntrySubstring(entry: SearchStoreEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) {
    return true
  }

  const queryTerms = normalizedQuery.split(/\s+/).filter((term) => term.length > 0)
  const normalizedFields = getSearchEntryFields(entry)
    .map((field) => normalizeSearchValue(field))
    .filter((field) => field.length > 0)

  if (normalizedFields.some((field) => field.includes(normalizedQuery))) {
    return true
  }

  return queryTerms.every((term) => normalizedFields.some((field) => field.includes(term)))
}

function findMatchingTweetIds(artifacts: SearchArtifacts, query: string): Set<string> {
  const matches = new Set<string>()
  const normalizedQuery = normalizeSearchValue(query)

  for (const entry of artifacts.searchStore) {
    if (matchesSearchEntrySubstring(entry, normalizedQuery)) {
      matches.add(entry.id)
    }
  }

  const miniSearch = MiniSearch.loadJSON(JSON.stringify(artifacts.searchIndex), {
    idField: 'id',
    fields: [...BOOKMARK_SEARCH_FIELDS],
    storeFields: ['id'],
    searchOptions: {
      boost: BOOKMARK_SEARCH_BOOSTS,
    },
  })

  for (const match of miniSearch.search(query, {
    boost: BOOKMARK_SEARCH_BOOSTS,
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND',
  })) {
    matches.add(String(match.id))
  }

  return matches
}

function rankIdBySeed(seed: string, id: string): number {
  let hashA = 0xdeadbeef
  let hashB = 0x41c6ce57
  const input = `${seed}:${id}`

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index)
    hashA = Math.imul(hashA ^ code, 2654435761)
    hashB = Math.imul(hashB ^ code, 1597334677)
  }

  hashA = Math.imul(hashA ^ (hashA >>> 16), 2246822507)
  hashA ^= Math.imul(hashB ^ (hashB >>> 13), 3266489909)
  hashB = Math.imul(hashB ^ (hashB >>> 16), 2246822507)
  hashB ^= Math.imul(hashA ^ (hashA >>> 13), 3266489909)

  return 4294967296 * (2097151 & hashB) + (hashA >>> 0)
}

export function runBookmarksQuery(
  artifacts: QueryArtifacts,
  state: QueryState,
): QueryResult {
  const docs = artifacts.docsChunks.flatMap((chunk) => chunk.docs)
  const docsById = new Map(docs.map((doc) => [doc.id, doc]))
  const gridAllByTweetId = new Map<string, string[]>()
  const trimmedQuery = state.q.trim()

  for (const gridItem of artifacts.gridAll) {
    const existing = gridAllByTweetId.get(gridItem.tweetId)
    if (existing) {
      existing.push(gridItem.gridId)
      continue
    }
    gridAllByTweetId.set(gridItem.tweetId, [gridItem.gridId])
  }

  const orderedTweetIds =
    state.sort === 'random'
      ? artifacts.docsChunks
          .flatMap((chunk) => chunk.docs)
          .map((doc) => doc.id)
          .sort((left, right) => {
            const seed = state.seed ?? ''
            return rankIdBySeed(seed, left) - rankIdBySeed(seed, right)
          })
      : state.sort === 'posted'
        ? [...artifacts.orderPosted]
        : [...artifacts.orderBookmarked]

  if (trimmedQuery.length > 0 && (!artifacts.searchIndex || !artifacts.searchStore)) {
    throw new Error(SEARCH_ARTIFACTS_NOT_HYDRATED_MESSAGE)
  }

  const matchingTweetIds =
    trimmedQuery.length > 0 && artifacts.searchIndex && artifacts.searchStore
      ? findMatchingTweetIds(
          {
            searchIndex: artifacts.searchIndex,
            searchStore: artifacts.searchStore,
          },
          trimmedQuery,
        )
      : null

  if (state.dir === 'asc') {
    orderedTweetIds.reverse()
  }

  const filteredTweetIds = orderedTweetIds.filter((tweetId) => {
    const doc = docsById.get(tweetId)
    if (!doc) {
      return false
    }

    if (matchingTweetIds && !matchingTweetIds.has(tweetId)) {
      return false
    }

    return true
  })

  const orderedGridIds =
    state.mode === 'all'
      ? filteredTweetIds.flatMap((tweetId) => gridAllByTweetId.get(tweetId) ?? [])
      : filteredTweetIds.flatMap((tweetId) => {
          const doc = docsById.get(tweetId)
          if (!doc) {
            return []
          }

          const mediaIndex = state.preferMotion
            ? doc.representativeMotionMediaIndex
            : doc.representativeMediaIndex

          return [`${tweetId}:${mediaIndex}`]
        })

  return {
    total: orderedGridIds.length,
    orderedGridIds,
    appliedSeed: state.sort === 'random' ? state.seed : undefined,
  }
}
