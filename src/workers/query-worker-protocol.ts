import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type {
  EmbeddingArtifacts,
  SemanticQuery,
} from '@/features/bookmarks/embedding-artifacts'
import type { QueryResult, QueryState } from '@/features/bookmarks/model'

export type QueryWorkerRequest =
  | {
      type: 'hydrate-core'
      artifacts: CoreArtifacts
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
      state: QueryState
      semanticQuery?: SemanticQuery
    }

export type QueryWorkerResponse =
  | {
      type: 'result'
      result: QueryResult
    }
  | {
      type: 'needs-embeddings'
    }
  | {
      type: 'needs-semantic-query'
    }
  | {
      type: 'embeddings-hydrated'
    }
  | {
      type: 'error'
      message: string
    }
