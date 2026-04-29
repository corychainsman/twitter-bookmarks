/// <reference lib="webworker" />

import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@huggingface/transformers'

import { BOOKMARKS_EMBEDDING_MODEL_ID } from '@/features/bookmarks/embedding-config'
import { normalizeEmbeddingVector } from '@/features/bookmarks/embedding-artifacts'
import type {
  EmbeddingWorkerRequest,
  EmbeddingWorkerResponse,
} from '@/workers/embedding-worker-protocol'

type TextEncoderBundle = {
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>
  model: Awaited<ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>>
}

type VisionEncoderBundle = {
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
  model: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>>
}

let textEncoderPromise: Promise<TextEncoderBundle> | null = null
let visionEncoderPromise: Promise<VisionEncoderBundle> | null = null

const workerScope = self as DedicatedWorkerGlobalScope

function getTextEncoder(): Promise<TextEncoderBundle> {
  if (!textEncoderPromise) {
    textEncoderPromise = Promise.all([
      AutoTokenizer.from_pretrained(BOOKMARKS_EMBEDDING_MODEL_ID),
      CLIPTextModelWithProjection.from_pretrained(BOOKMARKS_EMBEDDING_MODEL_ID, {
        dtype: 'q8',
      }),
    ]).then(([tokenizer, model]) => ({ tokenizer, model }))
  }

  return textEncoderPromise
}

function getVisionEncoder(): Promise<VisionEncoderBundle> {
  if (!visionEncoderPromise) {
    visionEncoderPromise = Promise.all([
      AutoProcessor.from_pretrained(BOOKMARKS_EMBEDDING_MODEL_ID),
      CLIPVisionModelWithProjection.from_pretrained(BOOKMARKS_EMBEDDING_MODEL_ID, {
        dtype: 'q8',
      }),
    ]).then(([processor, model]) => ({ processor, model }))
  }

  return visionEncoderPromise
}

function tensorRowToNormalizedArray(
  tensor: { data: ArrayLike<number>; dims: number[] },
  rowIndex: number,
): number[] {
  const dimensions = tensor.dims[1] ?? tensor.data.length
  const row = new Float32Array(dimensions)
  const start = rowIndex * dimensions

  for (let index = 0; index < dimensions; index += 1) {
    row[index] = tensor.data[start + index] ?? 0
  }

  return Array.from(normalizeEmbeddingVector(row))
}

function averageNormalizedVectors(vectors: number[][]): number[] {
  const dimensions = vectors[0]?.length ?? 0
  const average = new Float32Array(dimensions)

  for (const vector of vectors) {
    for (let index = 0; index < dimensions; index += 1) {
      average[index] += vector[index] ?? 0
    }
  }

  for (let index = 0; index < dimensions; index += 1) {
    average[index] /= Math.max(1, vectors.length)
  }

  return Array.from(normalizeEmbeddingVector(average))
}

function buildTextQueryPrompts(text: string): string[] {
  const trimmed = text.trim()

  return [
    trimmed,
    `a photo of ${trimmed}`,
    `an image of ${trimmed}`,
  ]
}

async function embedText(message: Extract<EmbeddingWorkerRequest, { type: 'embed-text' }>) {
  const { tokenizer, model } = await getTextEncoder()
  const prompts = buildTextQueryPrompts(message.text)
  const inputs = tokenizer(prompts, {
    padding: true,
    truncation: true,
  })
  const { text_embeds: textEmbeds } = await model(inputs)
  const vectors = prompts.map((_, index) => tensorRowToNormalizedArray(textEmbeds, index))

  workerScope.postMessage({
    type: 'result',
    requestId: message.requestId,
    source: 'text',
    vector: averageNormalizedVectors(vectors),
  } satisfies EmbeddingWorkerResponse)
}

async function embedImage(message: Extract<EmbeddingWorkerRequest, { type: 'embed-image' }>) {
  const { processor, model } = await getVisionEncoder()
  const image = await RawImage.read(message.file)
  const inputs = await processor(image)
  const { image_embeds: imageEmbeds } = await model(inputs)

  workerScope.postMessage({
    type: 'result',
    requestId: message.requestId,
    source: 'image',
    vector: tensorRowToNormalizedArray(imageEmbeds, 0),
  } satisfies EmbeddingWorkerResponse)
}

workerScope.addEventListener('message', (event: MessageEvent<EmbeddingWorkerRequest>) => {
  const message = event.data
  if (message.type === 'warmup-text') {
    void getTextEncoder().catch(() => {})
    return
  }

  const task = message.type === 'embed-text' ? embedText(message) : embedImage(message)

  task.catch((error) => {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : 'Unknown embedding worker error',
    } satisfies EmbeddingWorkerResponse)
  })
})
