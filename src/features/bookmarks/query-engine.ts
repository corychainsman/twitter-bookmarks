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
import type { QueryResult, QueryState, TweetDoc } from '@/features/bookmarks/model'

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
  adjustedScore: number
}

const decodedEmbeddingVectorsCache = new WeakMap<EmbeddingIndex, Int8Array>()

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

function getDecodedEmbeddingVectors(embeddingIndex: EmbeddingIndex): Int8Array {
  const cached = decodedEmbeddingVectorsCache.get(embeddingIndex)
  if (cached) {
    return cached
  }

  const decoded = decodeInt8Base64(embeddingIndex.vectors)
  decodedEmbeddingVectorsCache.set(embeddingIndex, decoded)
  return decoded
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
    const sourceRecordIndex = input.embeddingIndex.records.findIndex(
      (record) => record.gridId === input.similarToGridId,
    )
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

  embeddingIndex.records.forEach((record, recordIndex) => {
    if (semanticVector.excludedTweetId && record.tweetId === semanticVector.excludedTweetId) {
      return
    }

    const score = dotUnitVectorWithQuantizedRow({
      dimension,
      queryVector: semanticVector.vector,
      rowIndex: recordIndex,
      vectors,
    })
    const recordsForKind = scoresByKind.get(record.kind) ?? []
    recordsForKind.push({
      record,
      score,
      adjustedScore: score,
    })
    scoresByKind.set(record.kind, recordsForKind)
  })

  for (const recordsForKind of scoresByKind.values()) {
    recordsForKind.sort((left, right) => right.score - left.score)

    recordsForKind.forEach((recordScore, recordIndex) => {
      const rankPercentile =
        recordsForKind.length <= 1
          ? 1
          : 1 - recordIndex / Math.max(1, recordsForKind.length - 1)
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
    })
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

function resolveOneModeGridId(input: {
  doc: TweetDoc
  rank?: SemanticTweetRank
  state: QueryState
}): string {
  if (input.rank?.preferredGridId) {
    return input.rank.preferredGridId
  }

  const mediaIndex = input.state.preferMotion
    ? input.doc.representativeMotionMediaIndex
    : input.doc.representativeMediaIndex

  return `${input.doc.id}:${mediaIndex}`
}

function orderGridIdsForTweet(input: {
  gridIds: string[]
  rank?: SemanticTweetRank
}): string[] {
  if (!input.rank?.preferredGridId || !input.gridIds.includes(input.rank.preferredGridId)) {
    return input.gridIds
  }

  return [
    input.rank.preferredGridId,
    ...input.gridIds.filter((gridId) => gridId !== input.rank?.preferredGridId),
  ]
}

export function runBookmarksQuery(
  artifacts: QueryArtifacts,
  state: QueryState,
  semanticQuery?: SemanticQuery,
): QueryResult {
  const docs = artifacts.docsChunks.flatMap((chunk) => chunk.docs)
  const docsById = new Map(docs.map((doc) => [doc.id, doc]))
  const gridAllByTweetId = new Map<string, string[]>()

  for (const gridItem of artifacts.gridAll) {
    const existing = gridAllByTweetId.get(gridItem.tweetId)
    if (existing) {
      existing.push(gridItem.gridId)
      continue
    }
    gridAllByTweetId.set(gridItem.tweetId, [gridItem.gridId])
  }

  const needsEmbeddingRanking =
    state.q.trim().length > 0 || state.similarToGridId || semanticQuery

  if (needsEmbeddingRanking) {
    if (!artifacts.embeddingIndex) {
      throw new Error(EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE)
    }
  }

  const semanticRanks = needsEmbeddingRanking && artifacts.embeddingIndex
    ? rankTweetsBySemanticSimilarity(artifacts.embeddingIndex, state, semanticQuery)
    : null
  const semanticRanksByTweetId = semanticRanks
    ? new Map(semanticRanks.map((rank) => [rank.tweetId, rank]))
    : null

  const orderedTweetIds = semanticRanks
    ? semanticRanks.map((rank) => rank.tweetId)
    : state.sort === 'random'
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

  if (!semanticRanks && state.dir === 'asc') {
    orderedTweetIds.reverse()
  }

  const filteredTweetIds = orderedTweetIds.filter((tweetId) => {
    const doc = docsById.get(tweetId)
    if (!doc) {
      return false
    }

    return true
  })

  const orderedGridIds =
    state.mode === 'all'
      ? filteredTweetIds.flatMap((tweetId) =>
          orderGridIdsForTweet({
            gridIds: gridAllByTweetId.get(tweetId) ?? [],
            rank: semanticRanksByTweetId?.get(tweetId),
          }),
        )
      : filteredTweetIds.flatMap((tweetId) => {
          const doc = docsById.get(tweetId)
          if (!doc) {
            return []
          }

          return [
            resolveOneModeGridId({
              doc,
              rank: semanticRanksByTweetId?.get(tweetId),
              state,
            }),
          ]
        })

  return {
    total: orderedGridIds.length,
    orderedGridIds,
    appliedSeed: state.sort === 'random' ? state.seed : undefined,
  }
}
