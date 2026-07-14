/// <reference lib="webworker" />

import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type { EmbeddingArtifacts } from '@/features/bookmarks/embedding-artifacts'
import {
  isBookmarksQueryError,
  runBookmarksQuery,
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

  if (message.type === 'hydrate-docs') {
    if (!hydratedArtifacts || hydratedArtifacts.manifest.buildId !== message.buildId) {
      workerScope.postMessage({
        type: 'error',
        message: 'Query worker received TweetDoc artifacts for a different core build.',
      } satisfies QueryWorkerResponse)
      return
    }

    hydratedArtifacts = {
      ...hydratedArtifacts,
      docsChunks: message.docsChunks,
    }
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
      requestId: message.requestId,
    } satisfies QueryWorkerResponse)
    return
  }

  try {
    workerScope.postMessage({
      type: 'result',
      requestId: message.requestId,
      result: runBookmarksQuery(hydratedArtifacts, message.query, message.semanticQuery),
    } satisfies QueryWorkerResponse)
  } catch (error) {
    if (isBookmarksQueryError(error, 'embeddings-not-hydrated')) {
      workerScope.postMessage({
        type: 'needs-embeddings',
        requestId: message.requestId,
      } satisfies QueryWorkerResponse)
      return
    }

    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown query worker error',
      requestId: message.requestId,
    } satisfies QueryWorkerResponse)
  }
})
