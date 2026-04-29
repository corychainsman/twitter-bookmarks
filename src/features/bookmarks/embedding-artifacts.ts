import type { TweetDoc } from '@/features/bookmarks/model'

export type EmbeddingRecordKind = 'tweet-text' | 'media-image' | 'media-video'

export type EmbeddingRecord = {
  id: string
  tweetId: string
  gridId?: string
  mediaIndex?: number
  kind: EmbeddingRecordKind
  label: string
  sourceUrl?: string
}

export type EmbeddingIndex = {
  version: number
  buildId: string
  builtAt: string
  model: {
    id: string
    dimensions: number
    quantization: 'int8-unit-vector'
  }
  records: EmbeddingRecord[]
  vectors: string
}

export type EmbeddingArtifacts = {
  embeddingIndex: EmbeddingIndex
}

export type SemanticQuerySource = 'text' | 'image'

export type SemanticQuery = {
  source: SemanticQuerySource
  vector: number[]
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function buildTweetEmbeddingText(tweet: TweetDoc): string {
  const byline = [tweet.authorName, tweet.authorHandle ? `@${tweet.authorHandle}` : undefined]
    .filter(hasText)
    .join(' ')

  return [
    tweet.text,
    tweet.quotedText,
    tweet.articleTitle,
    tweet.articleText,
    byline ? `Author: ${byline}` : undefined,
    tweet.folderNames.length > 0 ? `Folders: ${tweet.folderNames.join(', ')}` : undefined,
  ]
    .filter(hasText)
    .join('\n')
}

export function normalizeEmbeddingVector(input: ArrayLike<number>): Float32Array {
  let magnitudeSquared = 0

  for (let index = 0; index < input.length; index += 1) {
    const value = input[index] ?? 0
    magnitudeSquared += value * value
  }

  const magnitude = Math.sqrt(magnitudeSquared)
  const normalized = new Float32Array(input.length)
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return normalized
  }

  for (let index = 0; index < input.length; index += 1) {
    normalized[index] = (input[index] ?? 0) / magnitude
  }

  return normalized
}

export function quantizeUnitVector(vector: ArrayLike<number>): Int8Array {
  const quantized = new Int8Array(vector.length)

  for (let index = 0; index < vector.length; index += 1) {
    const value = Math.max(-1, Math.min(1, vector[index] ?? 0))
    quantized[index] = Math.max(-127, Math.min(127, Math.round(value * 127)))
  }

  return quantized
}

export function encodeInt8Base64(values: Int8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(values.buffer, values.byteOffset, values.byteLength).toString('base64')
  }

  let binary = ''
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength)
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0)
  }

  return btoa(binary)
}

export function decodeInt8Base64(value: string): Int8Array {
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(value, 'base64')
    return new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Int8Array(bytes.buffer)
}

export function dotUnitVectorWithQuantizedRow(input: {
  dimension: number
  queryVector: ArrayLike<number>
  rowIndex: number
  vectors: Int8Array
}): number {
  const rowOffset = input.rowIndex * input.dimension
  let score = 0

  for (let index = 0; index < input.dimension; index += 1) {
    score += (input.queryVector[index] ?? 0) * ((input.vectors[rowOffset + index] ?? 0) / 127)
  }

  return score
}
