import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { env, pipeline } from '@huggingface/transformers'

import {
  BOOKMARKS_EMBEDDING_DIMENSIONS,
  BOOKMARKS_EMBEDDING_INDEX_VERSION,
  BOOKMARKS_EMBEDDING_MODEL_ID,
} from './catalog/embedding-config'
import {
  buildTweetEmbeddingText,
  encodeInt8Base64,
  normalizeEmbeddingVector,
  quantizeUnitVector,
  type EmbeddingIndex,
  type EmbeddingRecord,
} from './catalog/embedding-artifacts'
import {
  enrichmentTextByGridId,
  readSemanticEnrichment,
} from './catalog/semantic-enrichment'
import type { Manifest, TweetDoc } from './catalog/model'

const projectRoot = process.cwd()
const outputDirectory = path.join(projectRoot, 'public/data')
const manifestPath = path.join(outputDirectory, 'manifest.json')
const embeddingsFileName = 'embeddings/index.json'
const enrichmentPath = path.join(projectRoot, 'data/semantic-enrichment.json')
const textBatchSize = 64

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function loadDocs(manifest: Manifest): Promise<TweetDoc[]> {
  const chunks = await Promise.all(
    manifest.files.docs.map((fileName) =>
      readJson<TweetDoc[]>(path.join(outputDirectory, fileName)),
    ),
  )
  return chunks.flat()
}

function tensorRows(tensor: { data: ArrayLike<number | bigint>; dims: readonly number[] }): Int8Array[] {
  const [rowCount = 0, dimensions = 0] = tensor.dims
  if (dimensions !== BOOKMARKS_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${BOOKMARKS_EMBEDDING_DIMENSIONS}-dimension embeddings, received ${dimensions}.`,
    )
  }

  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const offset = rowIndex * dimensions
    const row = new Float32Array(dimensions)
    for (let index = 0; index < dimensions; index += 1) {
      row[index] = Number(tensor.data[offset + index] ?? 0)
    }
    return quantizeUnitVector(normalizeEmbeddingVector(row))
  })
}

function flattenRows(rows: Int8Array[]): Int8Array {
  const values = new Int8Array(rows.length * BOOKMARKS_EMBEDDING_DIMENSIONS)
  rows.forEach((row, index) => values.set(row, index * BOOKMARKS_EMBEDDING_DIMENSIONS))
  return values
}

async function main() {
  const manifest = await readJson<Manifest>(manifestPath)
  const docs = await loadDocs(manifest)
  const enrichment = enrichmentTextByGridId(await readSemanticEnrichment(enrichmentPath))
  const records: EmbeddingRecord[] = []
  const rows: Int8Array[] = []

  env.allowRemoteModels = false
  env.allowLocalModels = true
  env.localModelPath = `${path.join(projectRoot, 'public/models')}${path.sep}`

  console.log(`Loading local ${BOOKMARKS_EMBEDDING_MODEL_ID} query-compatible encoder...`)
  const extractor = await pipeline('feature-extraction', BOOKMARKS_EMBEDDING_MODEL_ID, {
    dtype: 'q8',
    local_files_only: true,
  })

  for (let index = 0; index < docs.length; index += textBatchSize) {
    const batch = docs.slice(index, index + textBatchSize)
    const labels = batch.map((tweet) => buildTweetEmbeddingText(tweet, enrichment))
    const output = await extractor(labels, { pooling: 'mean', normalize: true })
    const batchRows = tensorRows(output)

    batch.forEach((tweet, batchIndex) => {
      const row = batchRows[batchIndex]
      if (!row) return
      records.push({
        id: `${tweet.id}:record`,
        tweetId: tweet.id,
        kind: 'record-text',
        label: labels[batchIndex] ?? '',
      })
      rows.push(row)
    })

    console.log(`Embedded records ${Math.min(index + batch.length, docs.length)} / ${docs.length}`)
  }

  const embeddingIndex: EmbeddingIndex = {
    version: BOOKMARKS_EMBEDDING_INDEX_VERSION,
    buildId: manifest.buildId,
    builtAt: new Date().toISOString(),
    model: {
      id: BOOKMARKS_EMBEDDING_MODEL_ID,
      dimensions: BOOKMARKS_EMBEDDING_DIMENSIONS,
      quantization: 'int8-unit-vector',
    },
    records,
    vectors: encodeInt8Base64(flattenRows(rows)),
  }
  const nextManifest: Manifest = {
    ...manifest,
    files: { ...manifest.files, embeddings: embeddingsFileName },
  }

  await writeJson(path.join(outputDirectory, embeddingsFileName), embeddingIndex)
  await writeJson(manifestPath, nextManifest)
  console.log(`Exported ${records.length} enriched record embeddings.`)
}

main().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : 'Unknown embedding export failure'
  console.error(`export-embeddings failed: ${reason}`)
  process.exitCode = 1
})
