/// <reference lib="webworker" />

import type {
  CoreArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
import {
  runBookmarksQuery,
  SEARCH_ARTIFACTS_NOT_HYDRATED_MESSAGE,
} from '@/features/bookmarks/query-engine'
import type {
  QueryWorkerRequest,
  QueryWorkerResponse,
} from '@/workers/query-worker-protocol'

type QueryArtifacts = CoreArtifacts & Partial<SearchArtifacts>

let hydratedArtifacts: QueryArtifacts | null = null

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.addEventListener('message', (event: MessageEvent<QueryWorkerRequest>) => {
  const message = event.data

  if (message.type === 'hydrate-core') {
    hydratedArtifacts = message.artifacts
    return
  }

  if (message.type === 'hydrate-search') {
    if (!hydratedArtifacts) {
      workerScope.postMessage({
        type: 'error',
        message: 'Query worker received search artifacts before core hydration completed.',
      } satisfies QueryWorkerResponse)
      return
    }

    hydratedArtifacts = {
      ...hydratedArtifacts,
      ...message.artifacts,
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
      result: runBookmarksQuery(hydratedArtifacts, message.state),
    } satisfies QueryWorkerResponse)
  } catch (error) {
    if (error instanceof Error && error.message === SEARCH_ARTIFACTS_NOT_HYDRATED_MESSAGE) {
      workerScope.postMessage({
        type: 'needs-search',
      } satisfies QueryWorkerResponse)
      return
    }

    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown query worker error',
    } satisfies QueryWorkerResponse)
  }
})
