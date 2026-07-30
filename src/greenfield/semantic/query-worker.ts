/// <reference lib="webworker" />

import { env, pipeline } from "@huggingface/transformers"

import {
  SEMANTIC_EMBEDDING_DIMENSIONS,
  SEMANTIC_LOCAL_MODEL_ROOT,
  SEMANTIC_MODEL_ID,
} from "./config"
import { encodeInt8Base64Url, quantizeNormalizedVector } from "./vector-codec"

declare const self: DedicatedWorkerGlobalScope

type QueryRequest = { type: "encode"; id: number; text: string }

env.allowRemoteModels = false
env.allowLocalModels = true
env.localModelPath = SEMANTIC_LOCAL_MODEL_ROOT

const extractorPromise = pipeline("feature-extraction", SEMANTIC_MODEL_ID, {
  dtype: "q8",
  local_files_only: true,
}).then((extractor) => {
  self.postMessage({ type: "ready" })
  return extractor
})

self.addEventListener("message", (event: MessageEvent<QueryRequest>) => {
  if (event.data.type !== "encode") return
  const { id, text } = event.data

  void extractorPromise
    .then(async (extractor) => {
      const output = await extractor(text, { pooling: "mean", normalize: true })
      if (output.data.length !== SEMANTIC_EMBEDDING_DIMENSIONS) {
        throw new Error(`Unexpected query embedding size: ${output.data.length}`)
      }
      const vector = quantizeNormalizedVector(output.data as ArrayLike<number>)
      self.postMessage({ type: "result", id, vector: encodeInt8Base64Url(vector) })
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Semantic query encoding failed"
      self.postMessage({ type: "error", id, message })
    })
})

void extractorPromise.catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Semantic model initialization failed"
  self.postMessage({ type: "fatal", message })
})
