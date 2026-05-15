import type { SemanticQuery } from '@/features/bookmarks/embedding-artifacts'
import type { QueryState } from '@/features/bookmarks/model'

export type BookmarksQueryRequestInput = {
  state: QueryState
  hasEmbeddingIndex: boolean
  semanticQuery: SemanticQuery | null
  semanticQueryKey: string | null
  semanticImageQueryName: string | null
}

export type BookmarksQueryRequest =
  | {
      type: 'query'
      state: QueryState
      semanticQuery?: SemanticQuery
    }
  | {
      type: 'needs-embeddings'
    }
  | {
      type: 'needs-semantic-query'
    }

export function semanticTextQueryKey(text: string): string {
  return `text:${text.trim()}`
}

export function resolveBookmarksQueryRequest(
  input: BookmarksQueryRequestInput,
): BookmarksQueryRequest {
  const trimmedSemanticText = input.state.q.trim()
  const isImageSemanticSearch =
    input.semanticImageQueryName !== null &&
    trimmedSemanticText.length === 0 &&
    input.semanticQuery?.source === 'image'

  const semanticQueryForRequest = input.state.similarToGridId
    ? undefined
    : resolveSemanticQueryForRequest({
        trimmedSemanticText,
        semanticQuery: input.semanticQuery,
        semanticQueryKey: input.semanticQueryKey,
        isImageSemanticSearch,
      })

  const isWaitingForSemanticQuery =
    !input.state.similarToGridId &&
    (trimmedSemanticText.length > 0 || input.semanticImageQueryName !== null) &&
    !semanticQueryForRequest

  if (isWaitingForSemanticQuery) {
    return { type: 'needs-semantic-query' }
  }

  if (
    (trimmedSemanticText.length > 0 || input.state.similarToGridId || semanticQueryForRequest) &&
    !input.hasEmbeddingIndex
  ) {
    return { type: 'needs-embeddings' }
  }

  if (semanticQueryForRequest) {
    return {
      type: 'query',
      state: input.state,
      semanticQuery: semanticQueryForRequest,
    }
  }

  return {
    type: 'query',
    state: input.state,
  }
}

function resolveSemanticQueryForRequest(input: {
  trimmedSemanticText: string
  semanticQuery: SemanticQuery | null
  semanticQueryKey: string | null
  isImageSemanticSearch: boolean
}): SemanticQuery | undefined {
  if (input.trimmedSemanticText.length > 0) {
    return input.semanticQueryKey === semanticTextQueryKey(input.trimmedSemanticText)
      ? (input.semanticQuery ?? undefined)
      : undefined
  }

  return input.isImageSemanticSearch ? (input.semanticQuery ?? undefined) : undefined
}
