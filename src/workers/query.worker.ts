/// <reference lib="webworker" />

import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type { EmbeddingArtifacts } from '@/features/bookmarks/embedding-artifacts'
import {
  EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE,
  runBookmarksQuery,
  SEMANTIC_QUERY_VECTOR_NOT_READY_MESSAGE,
} from '@/features/bookmarks/query-engine'
import type {
  QueryWorkerRequest,
  QueryWorkerResponse,
} from '@/workers/query-worker-protocol'

type QueryArtifacts = CoreArtifacts & Partial<EmbeddingArtifacts>

let hydratedArtifacts: QueryArtifacts | null = null
let embeddingHydrationPromise: Promise<void> | null = null

const workerScope = self as DedicatedWorkerGlobalScope

async function hydrateEmbeddingsFromUrl(url: string) {
  if (!hydratedArtifacts) {
    throw new Error('Query worker received embedding artifacts before core hydration completed.')
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load bookmark embeddings: ${response.status} ${response.statusText}`)
  }

  const embeddingArtifacts: EmbeddingArtifacts = {
    embeddingIndex: (await response.json()) as EmbeddingArtifacts['embeddingIndex'],
  }

  hydratedArtifacts = {
    ...hydratedArtifacts,
    ...embeddingArtifacts,
  }
}

workerScope.addEventListener('message', (event: MessageEvent<QueryWorkerRequest>) => {
  const message = event.data

  if (message.type === 'hydrate-core') {
    hydratedArtifacts = message.artifacts
    embeddingHydrationPromise = null
    return
  }

  if (message.type === 'hydrate-embeddings') {
    if (!hydratedArtifacts) {
      workerScope.postMessage({
        type: 'error',
        message: 'Query worker received embedding artifacts before core hydration completed.',
      } satisfies QueryWorkerResponse)
      return
    }

    hydratedArtifacts = {
      ...hydratedArtifacts,
      ...message.artifacts,
    }
    return
  }

  if (message.type === 'hydrate-embeddings-url') {
    if (!embeddingHydrationPromise) {
      embeddingHydrationPromise = hydrateEmbeddingsFromUrl(message.url)
        .then(() => {
          workerScope.postMessage({
            type: 'embeddings-hydrated',
          } satisfies QueryWorkerResponse)
        })
        .catch((error) => {
          embeddingHydrationPromise = null
          workerScope.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown embedding hydration error',
          } satisfies QueryWorkerResponse)
        })
    }

    return
  }

  if (!hydratedArtifacts) {
    workerScope.postMessage({
      type: 'error',
      message: 'Query worker received a query before hydration completed.',
    } satisfies QueryWorkerResponse)
    return
  }

  try {
    workerScope.postMessage({
      type: 'result',
      result: runBookmarksQuery(hydratedArtifacts, message.state, message.semanticQuery),
    } satisfies QueryWorkerResponse)
  } catch (error) {
    if (error instanceof Error && error.message === EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE) {
      workerScope.postMessage({
        type: 'needs-embeddings',
      } satisfies QueryWorkerResponse)
      return
    }

    if (error instanceof Error && error.message === SEMANTIC_QUERY_VECTOR_NOT_READY_MESSAGE) {
      workerScope.postMessage({
        type: 'needs-semantic-query',
      } satisfies QueryWorkerResponse)
      return
    }

    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown query worker error',
    } satisfies QueryWorkerResponse)
  }
})
