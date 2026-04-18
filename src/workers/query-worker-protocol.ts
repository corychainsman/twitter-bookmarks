import type {
  CoreArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
import type { QueryResult, QueryState } from '@/features/bookmarks/model'

export type QueryWorkerRequest =
  | {
      type: 'hydrate-core'
      artifacts: CoreArtifacts
    }
  | {
      type: 'hydrate-search'
      artifacts: SearchArtifacts
    }
  | {
      type: 'query'
      state: QueryState
    }

export type QueryWorkerResponse =
  | {
      type: 'result'
      result: QueryResult
    }
  | {
      type: 'needs-search'
    }
  | {
      type: 'error'
      message: string
    }
