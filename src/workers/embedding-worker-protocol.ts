import type { SemanticQuerySource } from '@/features/bookmarks/embedding-artifacts'

export type EmbeddingWorkerRequest =
  | {
      type: 'warmup-text'
    }
  | {
      type: 'embed-text'
      requestId: number
      text: string
    }
  | {
      type: 'embed-image'
      requestId: number
      file: Blob
    }

export type EmbeddingWorkerResponse =
  | {
      type: 'result'
      requestId: number
      source: SemanticQuerySource
      vector: number[]
    }
  | {
      type: 'error'
      requestId: number
      message: string
    }
