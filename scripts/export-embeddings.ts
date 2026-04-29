import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@huggingface/transformers'

import {
  BOOKMARKS_EMBEDDING_DIMENSIONS,
  BOOKMARKS_EMBEDDING_INDEX_VERSION,
  BOOKMARKS_EMBEDDING_MODEL_ID,
} from '../src/features/bookmarks/embedding-config'
import {
  buildTweetEmbeddingText,
  encodeInt8Base64,
  normalizeEmbeddingVector,
  quantizeUnitVector,
  type EmbeddingIndex,
  type EmbeddingRecord,
} from '../src/features/bookmarks/embedding-artifacts'
import type { Manifest, MediaItem, TweetDoc } from '../src/features/bookmarks/model'

const projectRoot = process.cwd()
const outputDirectory = path.join(projectRoot, 'public/data')
const manifestPath = path.join(outputDirectory, 'manifest.json')
const embeddingsFileName = 'embeddings/index.json'
const textBatchSize = 48
const imageBatchSize = 8

type MediaEmbeddingCandidate = {
  record: EmbeddingRecord
  url: string
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function getTensorRows(tensor: { data: ArrayLike<number>; dims: number[] }): Int8Array[] {
  const [rowCount = 0, dimensions = 0] = tensor.dims
  if (dimensions !== BOOKMARKS_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${BOOKMARKS_EMBEDDING_DIMENSIONS}-dimension embeddings, received ${dimensions}.`,
    )
  }

  const rows: Int8Array[] = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const start = rowIndex * dimensions
    const row = new Float32Array(dimensions)

    for (let index = 0; index < dimensions; index += 1) {
      row[index] = tensor.data[start + index] ?? 0
    }

    rows.push(quantizeUnitVector(normalizeEmbeddingVector(row)))
  }

  return rows
}

function mediaSourceUrl(media: MediaItem): string {
  return media.posterUrl ?? media.thumbUrl ?? media.fullUrl
}

function mediaRecordKind(media: MediaItem): EmbeddingRecord['kind'] {
  return media.type === 'photo' ? 'media-image' : 'media-video'
}

function mediaRecordLabel(tweet: TweetDoc, media: MediaItem): string {
  const author = tweet.authorHandle ? `@${tweet.authorHandle}` : tweet.authorName
  const mediaLabel = media.type.replace('_', ' ')

  return [mediaLabel, author, tweet.text].filter(Boolean).join(' | ')
}

function buildMediaCandidates(docs: TweetDoc[]): MediaEmbeddingCandidate[] {
  return docs.flatMap((tweet) =>
    tweet.media.map((media, mediaIndex) => {
      const gridId = `${tweet.id}:${mediaIndex}`
      const url = mediaSourceUrl(media)

      return {
        url,
        record: {
          id: `${gridId}:visual`,
          tweetId: tweet.id,
          gridId,
          mediaIndex,
          kind: mediaRecordKind(media),
          label: mediaRecordLabel(tweet, media),
          sourceUrl: url,
        },
      }
    }),
  )
}

function flattenRows(rows: Int8Array[]): Int8Array {
  const vectors = new Int8Array(rows.length * BOOKMARKS_EMBEDDING_DIMENSIONS)

  rows.forEach((row, index) => {
    vectors.set(row, index * BOOKMARKS_EMBEDDING_DIMENSIONS)
  })

  return vectors
}

async function loadDocs(manifest: Manifest): Promise<TweetDoc[]> {
  const chunks = await Promise.all(
    manifest.files.docs.map((fileName) =>
      readJson<TweetDoc[]>(path.join(outputDirectory, fileName)),
    ),
  )

  return chunks.flat()
}

async function main() {
  const manifest = await readJson<Manifest>(manifestPath)
  const docs = await loadDocs(manifest)
  const records: EmbeddingRecord[] = []
  const rows: Int8Array[] = []

  console.log(`Loading ${BOOKMARKS_EMBEDDING_MODEL_ID} text encoder...`)
  const tokenizer = await AutoTokenizer.from_pretrained(BOOKMARKS_EMBEDDING_MODEL_ID)
  const textModel = await CLIPTextModelWithProjection.from_pretrained(
    BOOKMARKS_EMBEDDING_MODEL_ID,
    { dtype: 'q8' },
  )

  for (let index = 0; index < docs.length; index += textBatchSize) {
    const batch = docs.slice(index, index + textBatchSize)
    const textInputs = tokenizer(batch.map(buildTweetEmbeddingText), {
      padding: true,
      truncation: true,
    })
    const { text_embeds: textEmbeds } = await textModel(textInputs)
    const batchRows = getTensorRows(textEmbeds)

    batch.forEach((tweet, batchIndex) => {
      const row = batchRows[batchIndex]
      if (!row) {
        return
      }

      records.push({
        id: `${tweet.id}:text`,
        tweetId: tweet.id,
        kind: 'tweet-text',
        label: buildTweetEmbeddingText(tweet),
      })
      rows.push(row)
    })

    console.log(`Embedded text ${Math.min(index + batch.length, docs.length)} / ${docs.length}`)
  }

  console.log(`Loading ${BOOKMARKS_EMBEDDING_MODEL_ID} vision encoder...`)
  const processor = await AutoProcessor.from_pretrained(BOOKMARKS_EMBEDDING_MODEL_ID)
  const visionModel = await CLIPVisionModelWithProjection.from_pretrained(
    BOOKMARKS_EMBEDDING_MODEL_ID,
    { dtype: 'q8' },
  )
  const mediaCandidates = buildMediaCandidates(docs)
  let skippedMediaCount = 0

  for (let index = 0; index < mediaCandidates.length; index += imageBatchSize) {
    const batch = mediaCandidates.slice(index, index + imageBatchSize)
    const loadedImages = await Promise.all(
      batch.map(async (candidate) => {
        try {
          return {
            candidate,
            image: await RawImage.read(candidate.url),
          }
        } catch (error) {
          skippedMediaCount += 1
          const reason = error instanceof Error ? error.message : 'unknown error'
          console.warn(`Skipping ${candidate.record.id}: ${reason}`)
          return null
        }
      }),
    )
    const validImages = loadedImages.filter(
      (loaded): loaded is NonNullable<(typeof loadedImages)[number]> => loaded !== null,
    )

    if (validImages.length > 0) {
      const imageInputs = await processor(validImages.map((loaded) => loaded.image))
      const { image_embeds: imageEmbeds } = await visionModel(imageInputs)
      const batchRows = getTensorRows(imageEmbeds)

      validImages.forEach(({ candidate }, batchIndex) => {
        const row = batchRows[batchIndex]
        if (!row) {
          return
        }

        records.push(candidate.record)
        rows.push(row)
      })
    }

    console.log(
      `Embedded media ${Math.min(index + batch.length, mediaCandidates.length)} / ${mediaCandidates.length}`,
    )
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
    files: {
      ...manifest.files,
      embeddings: embeddingsFileName,
    },
  }

  await writeJson(path.join(outputDirectory, embeddingsFileName), embeddingIndex)
  await writeJson(manifestPath, nextManifest)

  console.log(
    `Exported ${records.length} embedding records to ${path.relative(
      projectRoot,
      path.join(outputDirectory, embeddingsFileName),
    )}.`,
  )
  if (skippedMediaCount > 0) {
    console.warn(`Skipped ${skippedMediaCount} media assets that could not be loaded.`)
  }
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : 'Unknown embedding export failure'
  console.error(`export-embeddings failed: ${reason}`)
  process.exitCode = 1
})
