import {
  type CoreArtifacts,
} from '@/features/bookmarks/export-artifacts'
import { BOOKMARKS_SEMANTIC_RESULT_LIMIT } from '@/features/bookmarks/embedding-config'
import {
  decodeInt8Base64,
  dotUnitVectorWithQuantizedRow,
  normalizeEmbeddingVector,
  type EmbeddingArtifacts,
  type EmbeddingIndex,
  type SemanticQuery,
} from '@/features/bookmarks/embedding-artifacts'
import type { GridItem, QueryResult, QueryState, TweetDoc } from '@/features/bookmarks/model'

export const EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE =
  'Semantic embedding artifacts have not been hydrated'
export const SEMANTIC_QUERY_VECTOR_NOT_READY_MESSAGE = 'Semantic query vector is not ready'

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

const decodedEmbeddingVectorsCache = new WeakMap<EmbeddingIndex, Int8Array>(), embeddingRecordIndexesCache = new WeakMap<EmbeddingIndex, Map<string, number>>(), randomTweetIdsCache = new Map<string, string[]>(), randomSeedHashCache = new Map<string, [number, number]>()
const gridAllByTweetIdCache = new WeakMap<GridItem[], Map<string, string[]>>(), docsCache = new WeakMap<QueryArtifacts['docsChunks'], { docs: TweetDoc[]; byId: Map<string, TweetDoc> }>()
const queryResultCache = new Map<string, QueryResult>()

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

function rankIdBySeed(seed: string, id: string): number {
  let seedHash = randomSeedHashCache.get(seed)
  if (!seedHash) {
    let seedHashA = 0xdeadbeef, seedHashB = 0x41c6ce57
    for (let index = 0; index < seed.length; index += 1) {
      const code = seed.charCodeAt(index)
      seedHashA = Math.imul(seedHashA ^ code, 2654435761)
      seedHashB = Math.imul(seedHashB ^ code, 1597334677)
    }
    seedHash = [Math.imul(seedHashA ^ 58, 2654435761), Math.imul(seedHashB ^ 58, 1597334677)]
    randomSeedHashCache.set(seed, seedHash)
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
  state: QueryState,
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
    if (state.q.trim().length > 0) {
      throw new Error(SEMANTIC_QUERY_VECTOR_NOT_READY_MESSAGE)
    }

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

function expandOneModeGridIds(tweetIds: string[], docsById: Map<string, TweetDoc>, state: QueryState, ranks: Map<string, SemanticTweetRank> | null): string[] {
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

function getGridAllByTweetId(gridAll: GridItem[]): Map<string, string[]> {
  const cached = gridAllByTweetIdCache.get(gridAll)
  if (cached) {
    return cached
  }

  const grouped = new Map<string, string[]>()
  for (const gridItem of gridAll) {
    const gridIds = grouped.get(gridItem.tweetId) ?? (grouped.set(gridItem.tweetId, []), grouped.get(gridItem.tweetId)!)
    gridIds.push(gridItem.gridId)
  }
  gridAllByTweetIdCache.set(gridAll, grouped)
  return grouped
}

function getDocs(docsChunks: QueryArtifacts['docsChunks']) {
  const cached = docsCache.get(docsChunks)
  if (cached) {
    return cached
  }
  const docs: TweetDoc[] = [], byId = new Map<string, TweetDoc>()
  for (const chunk of docsChunks) for (const doc of chunk.docs) {
    docs.push(doc)
    byId.set(doc.id, doc)
  }
  const cachedDocs = { docs, byId }
  docsCache.set(docsChunks, cachedDocs)
  return cachedDocs
}

function getRandomTweetIds(buildId: string, seed: string, docs: TweetDoc[]) {
  const key = `${buildId}:${seed}`
  const cached = randomTweetIdsCache.get(key)
  if (cached) return cached
  const ranked = new Array<{ id: string; rank: number }>(docs.length)
  for (let index = 0; index < docs.length; index += 1) {
    const id = docs[index]!.id
    ranked[index] = { id, rank: rankIdBySeed(seed, id) }
  }
  ranked.sort((left, right) => left.rank - right.rank)
  const ids = new Array<string>(ranked.length)
  for (let index = 0; index < ranked.length; index += 1) ids[index] = ranked[index]!.id
  randomTweetIdsCache.set(key, ids)
  return ids
}

export function runBookmarksQuery(
  artifacts: QueryArtifacts,
  state: QueryState,
  semanticQuery?: SemanticQuery,
): QueryResult {
  const hasTextQuery = state.q.length > 0 && state.q.trim().length > 0
  const needsEmbeddingRanking = hasTextQuery || state.similarToGridId || semanticQuery

  if (needsEmbeddingRanking) {
    if (!artifacts.embeddingIndex) {
      throw new Error(EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE)
    }
  }
  const queryResultCacheKey = !semanticQuery && (state.similarToGridId || !needsEmbeddingRanking) ? `${artifacts.manifest.buildId}|${state.sort}|${state.dir}|${state.mode}|${state.preferMotion}|${state.similarToGridId ?? ''}|${state.sort === 'random' ? state.seed ?? '' : ''}` : ''
  const cachedQueryResult = queryResultCacheKey ? queryResultCache.get(queryResultCacheKey) : undefined
  if (cachedQueryResult) return cachedQueryResult
  const docs = state.sort === 'random' || state.mode === 'one' ? getDocs(artifacts.docsChunks) : null
  const gridAllByTweetId = getGridAllByTweetId(artifacts.gridAll)

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
  orderedTweetIds ??= state.sort === 'random'
      ? getRandomTweetIds(artifacts.manifest.buildId, state.seed ?? '', docs!.docs)
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
  if (queryResultCacheKey) queryResultCache.set(queryResultCacheKey, result)
  return result
}
