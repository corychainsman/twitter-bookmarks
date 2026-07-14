import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type {
  EmbeddingArtifacts,
  SemanticQuery,
} from '@/features/bookmarks/embedding-artifacts'
import type { QueryResult } from '@/features/bookmarks/model'
import type { BookmarksQuery } from '@/features/bookmarks/query-request'

export type QueryWorkerRequest =
  | {
      type: 'hydrate-core'
      artifacts: CoreArtifacts
    }
  | {
      type: 'hydrate-docs'
      buildId: string
      docsChunks: CoreArtifacts['docsChunks']
    }
  | {
      type: 'hydrate-embeddings'
      artifacts: EmbeddingArtifacts
    }
  | {
      type: 'hydrate-embeddings-url'
      url: string
    }
  | {
      type: 'query'
      requestId: number
      query: BookmarksQuery
      semanticQuery?: SemanticQuery
    }

export type QueryWorkerResponse =
  | {
      type: 'result'
      requestId: number
      result: QueryResult
    }
  | {
      type: 'needs-embeddings'
      requestId: number
    }
  | {
      type: 'embeddings-hydrated'
    }
  | {
      type: 'error'
      message: string
      requestId?: number
    }
