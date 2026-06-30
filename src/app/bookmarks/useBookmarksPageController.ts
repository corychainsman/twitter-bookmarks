import * as React from 'react'

import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type { SemanticQuery } from '@/features/bookmarks/embedding-artifacts'
import type {
  GridItem,
  Manifest,
  QueryResult,
  QueryState,
  TweetDoc,
} from '@/features/bookmarks/model'
import { loadCoreArtifacts } from '@/features/bookmarks/data-loader'
import { startGridThumbPrecache } from '@/lib/media-precache'
import {
  readBookmarksSessionState,
  writeBookmarksScrollSnapshot,
  writeBookmarksSelectedGridId,
} from '@/features/bookmarks/session-state'
import {
  applyQueryStatePatch,
  createQuerySeed,
  DEFAULT_QUERY_STATE,
  parseQueryState,
  rerandomizeQueryState,
  serializeQueryState,
} from '@/features/bookmarks/url-state'
import {
  BOOKMARKS_ZOOM_STEP,
  resolveMasonryLayout,
  resolveNextBookmarksZoom,
} from '@/components/grid/masonry-layout'
import {
  captureMasonryScrollAnchor,
  type MasonryScrollAnchor,
  type MasonryScrollAnchorRequest,
} from '@/components/grid/masonry-anchor'
import {
  EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE,
  runBookmarksQuery,
  SEMANTIC_QUERY_VECTOR_NOT_READY_MESSAGE,
} from '@/features/bookmarks/query-engine'
import { sessionStorageStore } from '@/lib/storage'
import type {
  QueryWorkerRequest,
  QueryWorkerResponse,
} from '@/workers/query-worker-protocol'
import type {
  EmbeddingWorkerRequest,
  EmbeddingWorkerResponse,
} from '@/workers/embedding-worker-protocol'

type HydratedArtifacts = CoreArtifacts

const SEARCH_QUERY_COMMIT_DELAY_MS = 180
const QUERY_WORKER_WATCHDOG_MS = 1_500
const noop = () => {}
const gridSelectionCache = new Map<string, { tweetId: string; mediaIndex: number }>()
const visibleItemsCache = new WeakMap<string[], GridItem[]>()

function resolveDataUrl(path: string): string {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL(path.replace(/^\//, ''), appBase).toString()
}

function resolveVersionedArtifactUrl(path: string, version: string): string {
  const url = new URL(resolveDataUrl(`data/${path.replace(/^\/+/, '')}`))
  url.searchParams.set('v', version)
  return url.toString()
}

function resolveEmbeddingIndexUrl(manifest: Manifest): string {
  if (!manifest.files.embeddings) {
    throw new Error('Semantic embeddings are not exported. Run bun run data:embeddings.')
  }

  return resolveVersionedArtifactUrl(manifest.files.embeddings, manifest.buildId)
}

function useWindowWidth() {
  const [width, setWidth] = React.useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )

  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return width
}

function updateUrlFromState(state: QueryState, selectedGridId: string | null) {
  const params = serializeQueryState(state)
  if (selectedGridId) {
    params.set('selected', selectedGridId)
  }
  const nextQuery = params.toString()
  const nextUrl =
    nextQuery.length > 0 ? `${window.location.pathname}?${nextQuery}` : window.location.pathname
  if (nextUrl === `${window.location.pathname}${window.location.search}`) return
  window.history.replaceState(null, '', nextUrl)
}

function parseGridSelection(gridId: string | null): { tweetId: string; mediaIndex: number } | null {
  if (!gridId) {
    return null
  }

  const cached = gridSelectionCache.get(gridId)
  if (cached) return cached
  const [tweetId, mediaIndex] = gridId.split(':')
  if (!tweetId || mediaIndex == null) {
    return null
  }

  const selection = {
    tweetId,
    mediaIndex: Number(mediaIndex),
  }
  if (!Number.isInteger(selection.mediaIndex) || selection.mediaIndex < 0) {
    return null
  }
  gridSelectionCache.set(gridId, selection)
  return selection
}

function parseSelectedGridId(params: URLSearchParams): string | null {
  const selected = params.get('selected')
  return parseGridSelection(selected) ? selected : null
}

export function useBookmarksPageController() {
  const initialSessionState = React.useMemo(
    () => readBookmarksSessionState(sessionStorageStore),
    [],
  )
  const initialQueryState = React.useMemo(
    () =>
      parseQueryState(new URLSearchParams(window.location.search), {
        generateSeed: createQuerySeed,
      }),
    [],
  )
  const initialSelectedGridId = React.useMemo(
    () => parseSelectedGridId(new URLSearchParams(window.location.search)),
    [],
  )
  const [artifacts, setArtifacts] = React.useState<HydratedArtifacts | null>(null)
  const [loadingError, setLoadingError] = React.useState<string | null>(null)
  const [hasFirstQueryResult, setHasFirstQueryResult] = React.useState(false)
  const [queryResult, setQueryResult] = React.useState<QueryResult>({
    total: 0,
    orderedGridIds: [],
  })
  const [selectedGridId, setSelectedGridId] = React.useState<string | null>(
    initialSelectedGridId ?? initialSessionState.selectedGridId,
  )
  const [queryState, setQueryState] = React.useState<QueryState>(initialQueryState)
  const [searchInputValue, setSearchInputValue] = React.useState(initialQueryState.q)
  const [semanticQuery, setSemanticQuery] = React.useState<SemanticQuery | null>(null)
  const [semanticQueryKey, setSemanticQueryKey] = React.useState<string | null>(null)
  const [semanticImageQueryName, setSemanticImageQueryName] = React.useState<string | null>(null)
  const [semanticImagePreviewUrl, setSemanticImagePreviewUrl] = React.useState<string | null>(null)
  const [hasEmbeddingIndex, setHasEmbeddingIndex] = React.useState(false)
  const [isEmbeddingPending, setIsEmbeddingPending] = React.useState(false)
  const [scrollAnchorRequest, setScrollAnchorRequest] =
    React.useState<MasonryScrollAnchorRequest | null>(null)
  const windowWidth = useWindowWidth()
  const deferredQuery = React.useDeferredValue(queryState.q)
  const effectiveQueryState = React.useMemo(
    () => ({ ...queryState, q: deferredQuery }),
    [deferredQuery, queryState],
  )
  const {
    dir: queryRequestDir,
    keepSeed: queryRequestKeepSeed,
    mode: queryRequestMode,
    preferMotion: queryRequestPreferMotion,
    q: queryRequestText,
    seed: queryRequestSeed,
    similarToGridId: queryRequestSimilarToGridId,
    sort: queryRequestSort,
  } = effectiveQueryState
  const queryRequestState = React.useMemo(
    () => ({
      q: queryRequestText,
      sort: queryRequestSort,
      dir: queryRequestDir,
      mode: queryRequestMode,
      immersive: DEFAULT_QUERY_STATE.immersive,
      preferMotion: queryRequestPreferMotion,
      similarToGridId: queryRequestSimilarToGridId,
      zoom: DEFAULT_QUERY_STATE.zoom,
      keepSeed: queryRequestKeepSeed,
      seed: queryRequestSeed,
    }),
    [
      queryRequestDir,
      queryRequestKeepSeed,
      queryRequestMode,
      queryRequestPreferMotion,
      queryRequestSeed,
      queryRequestSimilarToGridId,
      queryRequestSort,
      queryRequestText,
    ],
  )
  const masonryLayout = React.useMemo(
    () => resolveMasonryLayout({ viewportWidth: windowWidth, zoom: queryState.zoom }),
    [queryState.zoom, windowWidth],
  )
  const workerRef = React.useRef<Worker | null>(null)
  const embeddingWorkerRef = React.useRef<Worker | null>(null)
  const workerCoreDocsHydratedRef = React.useRef(false)
  const workerAvailableRef = React.useRef(true)
  const workerLastRequestIdRef = React.useRef(0)
  const workerLastResponseIdRef = React.useRef(0)
  const hasFirstQueryResultRef = React.useRef(false)
  const lastQueryRequestRef = React.useRef<{
    semanticQuery?: SemanticQuery
    state: QueryState
  } | null>(null)
  const embeddingHydrationRef = React.useRef(false)
  const embeddingRequestIdRef = React.useRef(0)
  const embeddingRequestKeyRef = React.useRef<string | null>(null)
  const queryStateRef = React.useRef(initialQueryState)
  const scrollAnchorRequestIdRef = React.useRef(0)
  const [isQueryPending, startTransition] = React.useTransition()

  const applyQueryResult = React.useEffectEvent((result: QueryResult) => {
    startTransition(() => {
      setQueryResult(result)
    })
    hasFirstQueryResultRef.current = true
    setHasFirstQueryResult(true)
    setLoadingError(null)
  })

  const runQueryOnMainThread = React.useEffectEvent((input: {
    semanticQuery?: SemanticQuery
    state: QueryState
  }) => {
    const currentArtifacts = artifacts
    if (!currentArtifacts) {
      return
    }

    try {
      applyQueryResult(runBookmarksQuery(currentArtifacts, input.state, input.semanticQuery))
    } catch (error) {
      if (error instanceof Error && error.message === EMBEDDING_ARTIFACTS_NOT_HYDRATED_MESSAGE) {
        void ensureEmbeddingArtifacts()
        return
      }

      if (error instanceof Error && error.message === SEMANTIC_QUERY_VECTOR_NOT_READY_MESSAGE) {
        return
      }

      setLoadingError(error instanceof Error ? error.message : 'Failed to query bookmarks.')
    }
  })

  const postWorkerMessage = React.useEffectEvent((message: QueryWorkerRequest) => {
    workerRef.current?.postMessage(message)
  })

  const postEmbeddingWorkerMessage = React.useEffectEvent((message: EmbeddingWorkerRequest) => {
    let worker = embeddingWorkerRef.current
    if (!worker) {
      worker = new Worker(new URL('../../workers/embedding.worker.ts', import.meta.url), {
        type: 'module',
      })
      embeddingWorkerRef.current = worker
      worker.onmessage = (event: MessageEvent<EmbeddingWorkerResponse>) => {
        const message = event.data
        if (message.requestId !== embeddingRequestIdRef.current) return
        setIsEmbeddingPending(false)
        if (message.type === 'result') {
          setSemanticQuery({ source: message.source, vector: message.vector })
          setSemanticQueryKey(embeddingRequestKeyRef.current)
          setLoadingError(null)
          return
        }
        setLoadingError(message.message)
      }
    }
    worker.postMessage(message)
  })

  const ensureEmbeddingArtifacts = React.useEffectEvent(async () => {
    const currentArtifacts = artifacts

    if (!currentArtifacts || hasEmbeddingIndex || embeddingHydrationRef.current) {
      return
    }

    try {
      const embeddingUrl = resolveEmbeddingIndexUrl(currentArtifacts.manifest)
      embeddingHydrationRef.current = true
      postWorkerMessage({
        type: 'hydrate-embeddings-url',
        url: embeddingUrl,
      })
    } catch (error) {
      embeddingHydrationRef.current = false
      queueMicrotask(() => {
        setLoadingError(
          error instanceof Error ? error.message : 'Failed to load bookmark embeddings.',
        )
      })
    }
  })

  React.useEffect(() => {
    updateUrlFromState(initialQueryState, initialSelectedGridId)
    window.scrollTo({
      top: initialSessionState.scrollY,
      behavior: 'auto',
    })

    let worker: Worker
    try {
      worker = new Worker(new URL('../../workers/query.worker.ts', import.meta.url), {
        type: 'module',
      })
    } catch (error) {
      workerAvailableRef.current = false
      setLoadingError(
        error instanceof Error
          ? `Bookmark query worker failed; using in-page fallback. ${error.message}`
          : 'Bookmark query worker failed; using in-page fallback.',
      )
      return
    }
    workerRef.current = worker
    worker.onerror = (event) => {
      workerAvailableRef.current = false
      setLoadingError(event.message || 'Bookmark query worker failed; using in-page fallback.')
      if (!hasFirstQueryResultRef.current && lastQueryRequestRef.current) {
        runQueryOnMainThread(lastQueryRequestRef.current)
      }
    }
    worker.onmessageerror = () => {
      workerAvailableRef.current = false
      setLoadingError('Bookmark query worker could not exchange data; using in-page fallback.')
      if (!hasFirstQueryResultRef.current && lastQueryRequestRef.current) {
        runQueryOnMainThread(lastQueryRequestRef.current)
      }
    }
    worker.onmessage = (event: MessageEvent<QueryWorkerResponse>) => {
      workerLastResponseIdRef.current = workerLastRequestIdRef.current
      const message = event.data

      if (message.type === 'result') {
        applyQueryResult(message.result)
        return
      }

      if (message.type === 'needs-embeddings') {
        void ensureEmbeddingArtifacts()
        return
      }

      if (message.type === 'embeddings-hydrated') {
        embeddingHydrationRef.current = false
        setHasEmbeddingIndex(true)
        setLoadingError(null)
        return
      }

      if (message.type === 'needs-semantic-query') {
        return
      }

      embeddingHydrationRef.current = false
      setLoadingError(message.message)
    }

    return () => {
      writeBookmarksScrollSnapshot(sessionStorageStore, window.scrollY)
      worker.terminate()
      workerRef.current = null
    }
  }, [initialQueryState, initialSelectedGridId, initialSessionState.scrollY])

  React.useEffect(() => () => {
    if (embeddingWorkerRef.current) {
      embeddingWorkerRef.current.terminate()
      embeddingWorkerRef.current = null
    }
    embeddingRequestKeyRef.current = null
  }, [])

  React.useEffect(() => {
    queryStateRef.current = queryState
  }, [queryState])

  React.useEffect(() => {
    setSearchInputValue(queryState.q)
  }, [queryState.q])

  React.useEffect(() => {
    updateUrlFromState(queryState, selectedGridId)
  }, [queryState, selectedGridId])

  React.useEffect(() => {
    const handlePopState = () => {
      setQueryState(
        parseQueryState(new URLSearchParams(window.location.search), {
          generateSeed: createQuerySeed,
        }),
      )
      setSelectedGridId(parseSelectedGridId(new URLSearchParams(window.location.search)))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  React.useEffect(() => {
    let cancelled = false

    void loadCoreArtifacts()
      .then((coreArtifacts) => {
        if (cancelled) {
          return
        }

        setArtifacts(coreArtifacts)
        workerCoreDocsHydratedRef.current = false
        setHasEmbeddingIndex(false)
        postWorkerMessage({
          type: 'hydrate-core',
          artifacts: { ...coreArtifacts, docsChunks: [] },
        })
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setLoadingError(error instanceof Error ? error.message : 'Failed to load bookmark data.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (artifacts?.gridAll) {
      startGridThumbPrecache(artifacts.gridAll)
    }
  }, [artifacts])

  React.useEffect(() => {
    if (!artifacts || (workerAvailableRef.current && !workerRef.current)) {
      return
    }

    const trimmedSemanticText = queryRequestState.q.trim()
    const expectedTextQueryKey = `text:${trimmedSemanticText}`
    const semanticQueryForRequest =
      !queryRequestState.similarToGridId
        ? trimmedSemanticText.length > 0
          ? semanticQueryKey === expectedTextQueryKey
            ? semanticQuery
            : null
          : semanticImageQueryName && semanticQuery?.source === 'image'
            ? semanticQuery
            : null
        : null
    const isWaitingForSemanticQuery =
      !queryRequestState.similarToGridId &&
      (trimmedSemanticText.length > 0 || semanticImageQueryName !== null) &&
      !semanticQueryForRequest

    if (isWaitingForSemanticQuery) {
      void ensureEmbeddingArtifacts()
      return
    }

    const queryRequest = {
      state: queryRequestState,
      semanticQuery: semanticQueryForRequest ?? undefined,
    }
    lastQueryRequestRef.current = queryRequest

    let watchdogTimeoutId: number | null = null
    if (!workerAvailableRef.current) {
      runQueryOnMainThread(queryRequest)
    } else {
      if (
        (queryRequestState.sort === 'random' || queryRequestState.mode === 'one') &&
        !workerCoreDocsHydratedRef.current
      ) {
        postWorkerMessage({ type: 'hydrate-core', artifacts })
        workerCoreDocsHydratedRef.current = true
      }

      workerLastRequestIdRef.current += 1
      const requestId = workerLastRequestIdRef.current
      postWorkerMessage({
        type: 'query',
        ...queryRequest,
      })

      watchdogTimeoutId = window.setTimeout(() => {
        if (workerLastResponseIdRef.current >= requestId || hasFirstQueryResultRef.current) {
          return
        }

        workerAvailableRef.current = false
        runQueryOnMainThread(queryRequest)
      }, QUERY_WORKER_WATCHDOG_MS)
    }

    if (
      (trimmedSemanticText.length > 0 ||
        queryRequestState.similarToGridId ||
        semanticQueryForRequest) &&
      !hasEmbeddingIndex
    ) {
      void ensureEmbeddingArtifacts()
    }

    return () => {
      if (watchdogTimeoutId !== null) {
        window.clearTimeout(watchdogTimeoutId)
      }
    }
  }, [
    artifacts,
    hasEmbeddingIndex,
    queryRequestState,
    semanticImageQueryName,
    semanticQuery,
    semanticQueryKey,
  ])

  React.useEffect(() => {
    const trimmedSemanticText = queryRequestState.q.trim()

    if (
      queryRequestState.similarToGridId ||
      semanticImageQueryName !== null ||
      trimmedSemanticText.length === 0
    ) {
      return
    }

    const requestKey = `text:${trimmedSemanticText}`
    if (semanticQueryKey === requestKey || embeddingRequestKeyRef.current === requestKey) {
      return
    }

    embeddingRequestIdRef.current += 1
    embeddingRequestKeyRef.current = requestKey
    setSemanticQuery(null)
    setSemanticQueryKey(null)
    setIsEmbeddingPending(true)
    postEmbeddingWorkerMessage({
      type: 'embed-text',
      requestId: embeddingRequestIdRef.current,
      text: trimmedSemanticText,
    })
    void ensureEmbeddingArtifacts()
  }, [
    queryRequestState.q,
    queryRequestState.similarToGridId,
    semanticImageQueryName,
    semanticQueryKey,
  ])

  React.useEffect(() => {
    writeBookmarksSelectedGridId(sessionStorageStore, selectedGridId)
  }, [selectedGridId])

  React.useEffect(() => {
    let frameId = 0
    let lastScrollY = -1

    const persistScroll = () => {
      frameId = 0
      const scrollY = Math.max(0, Math.round(window.scrollY))
      if (scrollY !== lastScrollY) {
        lastScrollY = scrollY
        writeBookmarksScrollSnapshot(sessionStorageStore, scrollY)
      }
    }

    const handleScroll = () => {
      if (frameId !== 0) {
        return
      }

      frameId = window.requestAnimationFrame(persistScroll)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('visibilitychange', persistScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', persistScroll)
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
      persistScroll()
    }
  }, [])

  const docsById = React.useMemo(() => {
    const map = new Map<string, TweetDoc>()
    for (const chunk of artifacts?.docsChunks ?? []) {
      for (const doc of chunk.docs) {
        map.set(doc.id, doc)
      }
    }
    return map
  }, [artifacts])

  const gridById = React.useMemo(() => {
    const map = new Map<string, GridItem>()
    for (const item of artifacts?.gridAll ?? []) {
      map.set(item.gridId, item)
    }
    return map
  }, [artifacts])

  const visibleItems = React.useMemo(
    () => {
      const cached = visibleItemsCache.get(queryResult.orderedGridIds)
      if (cached) return cached
      const items = new Array<GridItem>(queryResult.orderedGridIds.length)
      let count = 0
      for (const gridId of queryResult.orderedGridIds) {
        const item = gridById.get(gridId)
        if (item) items[count++] = item
      }
      items.length = count
      visibleItemsCache.set(queryResult.orderedGridIds, items)
      return items
    },
    [gridById, queryResult.orderedGridIds],
  )
  const displayedQueryState = React.useMemo(
    () => ({
      ...queryState,
      q: searchInputValue,
    }),
    [queryState, searchInputValue],
  )

  const selection = React.useMemo(() => parseGridSelection(selectedGridId), [selectedGridId])

  const patchQueryState = React.useCallback((patch: Partial<QueryState>) => {
    setQueryState((current) => {
      return applyQueryStatePatch(current, patch, {
        generateSeed: createQuerySeed,
      })
    })
  }, [])

  const clearSemanticQueryVector = React.useCallback(() => {
    embeddingRequestKeyRef.current = null
    setSemanticQuery(null)
    setSemanticQueryKey(null)
    setSemanticImageQueryName(null)
    setSemanticImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current)
      }
      return null
    })
    setIsEmbeddingPending(false)
  }, [])

  React.useEffect(() => {
    if (searchInputValue === queryState.q) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      clearSemanticQueryVector()
      patchQueryState({
        q: searchInputValue,
        similarToGridId: undefined,
      })
    }, SEARCH_QUERY_COMMIT_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [clearSemanticQueryVector, patchQueryState, queryState.q, searchInputValue])

  const requestImageSemanticQuery = (file: File) => {
    const requestKey = `image:${file.name}:${file.size}:${file.lastModified}`

    embeddingRequestIdRef.current += 1
    embeddingRequestKeyRef.current = requestKey
    setSemanticQuery(null)
    setSemanticQueryKey(null)
    setSemanticImageQueryName(file.name)
    setSemanticImagePreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current)
      }
      return URL.createObjectURL(file)
    })
    setIsEmbeddingPending(true)
    patchQueryState({
      q: '',
      similarToGridId: undefined,
      dir: 'desc',
    })
    postEmbeddingWorkerMessage({
      type: 'embed-image',
      requestId: embeddingRequestIdRef.current,
      file,
    })
    void ensureEmbeddingArtifacts()
  }

  const browseSimilar = (gridId: string) => {
    clearSemanticQueryVector()
    patchQueryState({
      q: '',
      similarToGridId: gridId,
      dir: 'desc',
    })
    setSelectedGridId(null)
    void ensureEmbeddingArtifacts()
  }

  const clearSemanticSource = () => {
    clearSemanticQueryVector()
    patchQueryState({
      similarToGridId: undefined,
      q: '',
    })
  }

  const onRerandomize = React.useCallback(() => {
    setQueryState((current) => {
      return rerandomizeQueryState(current, {
        generateSeed: createQuerySeed,
      })
    })
  }, [])

  const queueScrollAnchor = React.useCallback((anchor: MasonryScrollAnchor | null) => {
    if (!anchor) {
      return
    }

    scrollAnchorRequestIdRef.current += 1
    setScrollAnchorRequest({
      ...anchor,
      requestId: scrollAnchorRequestIdRef.current,
    })
  }, [])

  const updateZoom = React.useCallback(
    (resolveNextZoom: (currentZoom: number) => number) => {
      const currentState = queryStateRef.current
      const nextZoom = resolveNextZoom(currentState.zoom)

      if (nextZoom === currentState.zoom) {
        return
      }

      queueScrollAnchor(captureMasonryScrollAnchor())
      setQueryState((current) => {
        return {
          ...current,
          zoom: nextZoom,
        }
      })
    },
    [queueScrollAnchor],
  )

  const onZoomChange = React.useCallback(
    (delta: number) => {
      updateZoom((currentZoom) =>
        resolveNextBookmarksZoom({
          currentZoom,
          deltaColumns: delta,
          viewportWidth: windowWidth,
        }),
      )
    },
    [updateZoom, windowWidth],
  )

  return {
    docsById,
    masonryLayout,
    queryResult,
    queryState: displayedQueryState,
    loadingError,
    hasLoadedArtifacts: artifacts !== null,
    hasFirstQueryResult,
    isQueryPending: isQueryPending || isEmbeddingPending,
    semanticImageQueryName,
    semanticImagePreviewUrl,
    semanticSourceLabel: queryState.similarToGridId
      ? 'Similar'
      : semanticImageQueryName
        ? 'Image'
        : null,
    onScrollAnchorApplied: (requestId: number) =>
      setScrollAnchorRequest((current) =>
        current?.requestId === requestId ? null : current,
      ),
    selection,
    scrollAnchorRequest,
    visibleItems,
    canResetZoom: queryState.zoom !== DEFAULT_QUERY_STATE.zoom,
    onSearchChange: (value: string) => {
      setSearchInputValue(value)
    },
    onSortChange: (value: QueryState['sort']) => patchQueryState({ sort: value }),
    onDirectionToggle: () =>
      patchQueryState({ dir: queryState.dir === 'desc' ? 'asc' : 'desc' }),
    onModeChange: (value: QueryState['mode']) => patchQueryState({ mode: value }),
    onImmersiveChange: (value: boolean) => patchQueryState({ immersive: value }),
    onImageSearch: requestImageSemanticQuery,
    onClearSemanticSource: clearSemanticSource,
    onInitialMediaReady: noop,
    onBrowseSimilar: browseSimilar,
    onKeepSeedChange: (value: boolean) => patchQueryState({ keepSeed: value }),
    onRerandomize,
    onZoomIn: () => onZoomChange(BOOKMARKS_ZOOM_STEP),
    onZoomOut: () => onZoomChange(-BOOKMARKS_ZOOM_STEP),
    onPinchZoom: onZoomChange,
    onZoomReset: () => updateZoom(() => DEFAULT_QUERY_STATE.zoom),
    onOpenLightbox: (gridId: string) => setSelectedGridId(gridId),
    onLightboxSelectionChange: (gridId: string) => setSelectedGridId(gridId),
    onCloseLightbox: () => setSelectedGridId(null),
  }
}
