import {
  type CoreArtifacts,
} from '@/features/bookmarks/export-artifacts'
import {
  getGridItemIndex,
  getTweetDocIndex,
} from '@/features/bookmarks/artifact-indexes'
import { BOOKMARKS_SEMANTIC_RESULT_LIMIT } from '@/features/bookmarks/embedding-config'
import {
  decodeInt8Base64,
  dotUnitVectorWithQuantizedRow,
  normalizeEmbeddingVector,
  type EmbeddingArtifacts,
  type EmbeddingIndex,
  type SemanticQuery,
} from '@/features/bookmarks/embedding-artifacts'
import type { Manifest, QueryResult, TweetDoc } from '@/features/bookmarks/model'
import type { BookmarksQuery } from '@/features/bookmarks/query-request'

export const EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE =
  'Semantic embedding artifacts have not been hydrated'

export type BookmarksQueryErrorCode = 'embeddings-not-hydrated'

export class BookmarksQueryError extends Error {
  readonly code: BookmarksQueryErrorCode

  constructor(
    code: BookmarksQueryErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'BookmarksQueryError'
    this.code = code
  }
}

export function isBookmarksQueryError(
  error: unknown,
  code: BookmarksQueryErrorCode,
): error is BookmarksQueryError {
  return error instanceof BookmarksQueryError && error.code === code
}

type QueryArtifacts = CoreArtifacts & Partial<EmbeddingArtifacts>

type SemanticTweetRank = {
  tweetId: string
  score: number
  rawScore: number
  preferredGridId?: string
}

type SemanticRecordScore = {
  record: EmbeddingIndex['records'][number]
  score: number
}

type ManifestQueryCache = {
  queryResults: Map<string, QueryResult>
  randomTweetIds: Map<string, string[]>
  seedHashes: Map<string, [number, number]>
}

const MAX_CACHED_QUERIES_PER_MANIFEST = 64
const decodedEmbeddingVectorsCache = new WeakMap<EmbeddingIndex, Int8Array>()
const embeddingRecordIndexesCache = new WeakMap<EmbeddingIndex, Map<string, number>>()
const manifestQueryCaches = new WeakMap<Manifest, ManifestQueryCache>()

function getManifestQueryCache(manifest: Manifest): ManifestQueryCache {
  const cached = manifestQueryCaches.get(manifest)
  if (cached) return cached

  const cache = {
    queryResults: new Map<string, QueryResult>(),
    randomTweetIds: new Map<string, string[]>(),
    seedHashes: new Map<string, [number, number]>(),
  }
  manifestQueryCaches.set(manifest, cache)
  return cache
}

function setBoundedCacheValue<Key, Value>(cache: Map<Key, Value>, key: Key, value: Value): void {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size <= MAX_CACHED_QUERIES_PER_MANIFEST) return

  const oldestKey = cache.keys().next().value
  if (oldestKey !== undefined) cache.delete(oldestKey)
}

const SEMANTIC_KIND_WEIGHTS = {
  textQuery: {
    'media-image': 1.08,
    'media-video': 1.06,
    'tweet-text': 0.94,
  },
  visualQuery: {
    'media-image': 1.08,
    'media-video': 1.06,
    'tweet-text': 0.78,
  },
} as const

function rankIdBySeed(
  seed: string,
  id: string,
  seedHashes: Map<string, [number, number]>,
): number {
  let seedHash = seedHashes.get(seed)
  if (!seedHash) {
    let seedHashA = 0xdeadbeef, seedHashB = 0x41c6ce57
    for (let index = 0; index < seed.length; index += 1) {
      const code = seed.charCodeAt(index)
      seedHashA = Math.imul(seedHashA ^ code, 2654435761)
      seedHashB = Math.imul(seedHashB ^ code, 1597334677)
    }
    seedHash = [Math.imul(seedHashA ^ 58, 2654435761), Math.imul(seedHashB ^ 58, 1597334677)]
    setBoundedCacheValue(seedHashes, seed, seedHash)
  }
  let [hashA, hashB] = seedHash
  for (let index = 0; index < id.length; index += 1) {
    const code = id.charCodeAt(index)
    hashA = Math.imul(hashA ^ code, 2654435761)
    hashB = Math.imul(hashB ^ code, 1597334677)
  }

  hashA = Math.imul(hashA ^ (hashA >>> 16), 2246822507)
  hashA ^= Math.imul(hashB ^ (hashB >>> 13), 3266489909)
  hashB = Math.imul(hashB ^ (hashB >>> 16), 2246822507)
  hashB ^= Math.imul(hashA ^ (hashA >>> 13), 3266489909)

  return 4294967296 * (2097151 & hashB) + (hashA >>> 0)
}

function getDecodedEmbeddingVectors(embeddingIndex: EmbeddingIndex): Int8Array {
  const cached = decodedEmbeddingVectorsCache.get(embeddingIndex)
  if (cached) {
    return cached
  }

  const decoded = decodeInt8Base64(embeddingIndex.vectors)
  decodedEmbeddingVectorsCache.set(embeddingIndex, decoded)
  return decoded
}

function getEmbeddingRecordIndexes(embeddingIndex: EmbeddingIndex): Map<string, number> {
  const cached = embeddingRecordIndexesCache.get(embeddingIndex)
  if (cached) return cached
  const indexes = new Map<string, number>()
  for (let index = 0; index < embeddingIndex.records.length; index += 1) {
    const gridId = embeddingIndex.records[index]!.gridId
    if (gridId) indexes.set(gridId, index)
  }
  embeddingRecordIndexesCache.set(embeddingIndex, indexes)
  return indexes
}

function getQuantizedRecordVector(input: {
  dimension: number
  recordIndex: number
  vectors: Int8Array
}): Float32Array {
  const rowOffset = input.recordIndex * input.dimension
  const vector = new Float32Array(input.dimension)

  for (let index = 0; index < input.dimension; index += 1) {
    vector[index] = (input.vectors[rowOffset + index] ?? 0) / 127
  }

  return normalizeEmbeddingVector(vector)
}

function resolveSemanticQueryVector(input: {
  embeddingIndex: EmbeddingIndex
  semanticQuery?: SemanticQuery
  similarToGridId?: string
  vectors: Int8Array
}): { vector: Float32Array; excludedTweetId?: string } | null {
  const dimension = input.embeddingIndex.model.dimensions

  if (input.similarToGridId) {
    const sourceRecordIndex = getEmbeddingRecordIndexes(input.embeddingIndex).get(input.similarToGridId) ?? -1
    const sourceRecord = input.embeddingIndex.records[sourceRecordIndex]

    if (!sourceRecord) {
      return null
    }

    return {
      vector: getQuantizedRecordVector({
        dimension,
        recordIndex: sourceRecordIndex,
        vectors: input.vectors,
      }),
      excludedTweetId: sourceRecord.tweetId,
    }
  }

  if (!input.semanticQuery) {
    return null
  }

  return {
    vector: normalizeEmbeddingVector(input.semanticQuery.vector),
  }
}

function rankTweetsBySemanticSimilarity(
  embeddingIndex: EmbeddingIndex,
  state: BookmarksQuery,
  semanticQuery?: SemanticQuery,
): SemanticTweetRank[] | null {
  const vectors = getDecodedEmbeddingVectors(embeddingIndex)
  const semanticVector = resolveSemanticQueryVector({
    embeddingIndex,
    semanticQuery,
    similarToGridId: state.similarToGridId,
    vectors,
  })

  if (!semanticVector) {
    return null
  }

  const dimension = embeddingIndex.model.dimensions
  const ranksByTweetId = new Map<string, SemanticTweetRank>()
  const scoresByKind = new Map<string, SemanticRecordScore[]>()
  const kindWeights =
    semanticQuery?.source === 'image' || state.similarToGridId
      ? SEMANTIC_KIND_WEIGHTS.visualQuery
      : SEMANTIC_KIND_WEIGHTS.textQuery

  for (let recordIndex = 0; recordIndex < embeddingIndex.records.length; recordIndex += 1) {
    const record = embeddingIndex.records[recordIndex]!
    if (semanticVector.excludedTweetId && record.tweetId === semanticVector.excludedTweetId) {
      continue
    }

    const score = dotUnitVectorWithQuantizedRow({
      dimension,
      queryVector: semanticVector.vector,
      rowIndex: recordIndex,
      vectors,
    })
    const recordsForKind = scoresByKind.get(record.kind) ?? (scoresByKind.set(record.kind, []), scoresByKind.get(record.kind)!)
    recordsForKind.push({
      record,
      score,
    })
  }

  for (const recordsForKind of scoresByKind.values()) {
    recordsForKind.sort((left, right) => right.score - left.score)
    const rankDenominator = Math.max(1, recordsForKind.length - 1)

    for (let recordIndex = 0; recordIndex < recordsForKind.length; recordIndex += 1) {
      const recordScore = recordsForKind[recordIndex]!
      const rankPercentile =
        recordsForKind.length <= 1
          ? 1
          : 1 - recordIndex / rankDenominator
      const kindWeight = kindWeights[recordScore.record.kind]
      const adjustedScore = rankPercentile * kindWeight + recordScore.score * 0.001
      const currentRank = ranksByTweetId.get(recordScore.record.tweetId)

      if (
        !currentRank ||
        adjustedScore > currentRank.score ||
        (adjustedScore === currentRank.score && recordScore.score > currentRank.rawScore)
      ) {
        ranksByTweetId.set(recordScore.record.tweetId, {
          tweetId: recordScore.record.tweetId,
          score: adjustedScore,
          rawScore: recordScore.score,
          preferredGridId: recordScore.record.gridId,
        })
      }
    }
  }

  const ranks = [...ranksByTweetId.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.rawScore - left.rawScore ||
        left.tweetId.localeCompare(right.tweetId),
    )
    .slice(0, BOOKMARKS_SEMANTIC_RESULT_LIMIT)

  if (state.dir === 'asc') {
    ranks.reverse()
  }

  return ranks
}

const LEXICAL_FIELDS = [
  ['text', 8],
  ['articleTitle', 6],
  ['quotedText', 5],
  ['articleText', 3],
  ['authorName', 2],
  ['authorHandle', 2],
] as const satisfies ReadonlyArray<readonly [keyof TweetDoc, number]>

function rankTweetsLexically(docs: TweetDoc[], query: string): string[] {
  const phrase = query.trim().toLocaleLowerCase()
  const terms = [...new Set(phrase.split(/\s+/).filter(Boolean))]
  if (terms.length === 0) return []

  const ranked: Array<{ id: string; score: number; sourceIndex: number }> = []
  for (let sourceIndex = 0; sourceIndex < docs.length; sourceIndex += 1) {
    const doc = docs[sourceIndex]!
    let score = 0
    let matchedTerms = 0
    const fieldValues = LEXICAL_FIELDS.map(([key, weight]) => ({
      text: String(doc[key] ?? '').toLocaleLowerCase(),
      weight,
    }))
    fieldValues.push({
      text: doc.folderNames.join(' ').toLocaleLowerCase(),
      weight: 2,
    })

    for (const term of terms) {
      let termScore = 0
      for (const field of fieldValues) {
        if (field.text.includes(term)) termScore += field.weight
      }
      if (termScore > 0) {
        matchedTerms += 1
        score += termScore
      }
    }

    if (matchedTerms !== terms.length) continue
    if (doc.text.toLocaleLowerCase().includes(phrase)) score += 12
    ranked.push({ id: doc.id, score, sourceIndex })
  }

  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      left.sourceIndex - right.sourceIndex ||
      left.id.localeCompare(right.id),
  )
  return ranked.map((entry) => entry.id)
}

function expandGridIdsForTweets(tweetIds: string[], gridAllByTweetId: Map<string, string[]>, expectedLength: number): string[] {
  const gridIds = new Array<string>(expectedLength)
  let writeIndex = 0
  for (const tweetId of tweetIds) {
    const ids = gridAllByTweetId.get(tweetId)
    if (!ids) continue
    for (const id of ids) gridIds[writeIndex++] = id
  }
  gridIds.length = writeIndex
  return gridIds
}

function expandRankedGridIdsForTweets(tweetIds: string[], gridAllByTweetId: Map<string, string[]>, ranks: Map<string, SemanticTweetRank>): string[] {
  const orderedGridIds = new Array<string>(tweetIds.length * 3)
  let writeIndex = 0
  for (const tweetId of tweetIds) {
    const gridIds = gridAllByTweetId.get(tweetId)
    if (!gridIds) continue
    const preferredGridId = ranks.get(tweetId)?.preferredGridId
    if (preferredGridId) orderedGridIds[writeIndex++] = preferredGridId
    for (const gridId of gridIds) if (gridId !== preferredGridId) orderedGridIds[writeIndex++] = gridId
  }
  orderedGridIds.length = writeIndex
  return orderedGridIds
}

function expandOneModeGridIds(tweetIds: string[], docsById: Map<string, TweetDoc>, state: BookmarksQuery, ranks: Map<string, SemanticTweetRank> | null): string[] {
  const gridIds = new Array<string>(tweetIds.length)
  let writeIndex = 0
  const mediaIndexKey = state.preferMotion ? 'representativeMotionMediaIndex' : 'representativeMediaIndex'
  for (const tweetId of tweetIds) {
    const doc = docsById.get(tweetId)
    if (!doc) continue
    const preferredGridId = ranks?.get(tweetId)?.preferredGridId
    gridIds[writeIndex++] = preferredGridId ?? `${doc.id}:${doc[mediaIndexKey]}`
  }
  gridIds.length = writeIndex
  return gridIds
}

function getRandomTweetIds(manifest: Manifest, seed: string, docs: TweetDoc[]) {
  const cache = getManifestQueryCache(manifest)
  const cached = cache.randomTweetIds.get(seed)
  if (cached) return cached
  const ranked = new Array<{ id: string; rank: number }>(docs.length)
  for (let index = 0; index < docs.length; index += 1) {
    const id = docs[index]!.id
    ranked[index] = { id, rank: rankIdBySeed(seed, id, cache.seedHashes) }
  }
  ranked.sort((left, right) => left.rank - right.rank)
  const ids = new Array<string>(ranked.length)
  for (let index = 0; index < ranked.length; index += 1) ids[index] = ranked[index]!.id
  setBoundedCacheValue(cache.randomTweetIds, seed, ids)
  return ids
}

export function runBookmarksQuery(
  artifacts: QueryArtifacts,
  state: BookmarksQuery,
  semanticQuery?: SemanticQuery,
): QueryResult {
  const hasTextQuery = state.q.length > 0 && state.q.trim().length > 0
  const needsEmbeddingRanking = Boolean(state.similarToGridId || semanticQuery)
  const needsLexicalRanking = hasTextQuery && !semanticQuery

  if (needsEmbeddingRanking) {
    if (!artifacts.embeddingIndex) {
      throw new BookmarksQueryError(
        'embeddings-not-hydrated',
        EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE,
      )
    }
  }
  const queryResultCacheKey = !semanticQuery && (state.similarToGridId || !needsEmbeddingRanking)
    ? [
        state.sort,
        state.dir,
        state.mode,
        state.preferMotion ? '1' : '0',
        needsLexicalRanking ? state.q.trim().toLocaleLowerCase() : '',
        state.similarToGridId ?? '',
        state.sort === 'random' ? (state.seed ?? '') : '',
      ].join('|')
    : ''
  const queryCache = getManifestQueryCache(artifacts.manifest).queryResults
  const cachedQueryResult = queryResultCacheKey ? queryCache.get(queryResultCacheKey) : undefined
  if (cachedQueryResult) return cachedQueryResult
  const docs = needsLexicalRanking || state.sort === 'random' || state.mode === 'one'
    ? getTweetDocIndex(artifacts.docsChunks)
    : null
  const gridAllByTweetId = getGridItemIndex(artifacts.gridAll).idsByTweetId

  const semanticRanks = needsEmbeddingRanking && artifacts.embeddingIndex
    ? rankTweetsBySemanticSimilarity(artifacts.embeddingIndex, state, semanticQuery)
    : null
  const semanticRanksByTweetId = semanticRanks ? new Map<string, SemanticTweetRank>() : null
  let orderedTweetIds = semanticRanks ? new Array<string>(semanticRanks.length) : null
  if (semanticRanks && semanticRanksByTweetId && orderedTweetIds) {
    for (let index = 0; index < semanticRanks.length; index += 1) {
      const rank = semanticRanks[index]!
      semanticRanksByTweetId.set(rank.tweetId, rank)
      orderedTweetIds[index] = rank.tweetId
    }
  }
  orderedTweetIds ??= needsLexicalRanking
    ? rankTweetsLexically(docs!.all, state.q)
    : state.sort === 'random'
      ? getRandomTweetIds(artifacts.manifest, state.seed ?? '', docs!.all)
      : state.sort === 'posted'
        ? artifacts.orderPosted
        : artifacts.orderBookmarked

  if (!semanticRanks && state.dir === 'asc') {
    orderedTweetIds = orderedTweetIds.slice().reverse()
  }

  const orderedGridIds =
    state.mode === 'all'
      ? semanticRanksByTweetId ? expandRankedGridIdsForTweets(orderedTweetIds, gridAllByTweetId, semanticRanksByTweetId) : expandGridIdsForTweets(orderedTweetIds, gridAllByTweetId, artifacts.gridAll.length)
      : expandOneModeGridIds(orderedTweetIds, docs!.byId, state, semanticRanksByTweetId)

  const result = {
    total: orderedGridIds.length,
    orderedGridIds,
    appliedSeed: state.sort === 'random' ? state.seed : undefined,
  }
  if (queryResultCacheKey) setBoundedCacheValue(queryCache, queryResultCacheKey, result)
  return result
}
