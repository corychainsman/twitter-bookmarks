import * as React from 'react'

import type { CoreArtifacts } from '@/features/bookmarks/export-artifacts'
import type { SemanticQuery } from '@/features/bookmarks/embedding-artifacts'
import { getGridItemIndex, getTweetDocIndex } from '@/features/bookmarks/artifact-indexes'
import { resolveEmbeddingIndexUrl } from '@/features/bookmarks/artifact-url'
import type {
  GridItem,
  QueryResult,
  QueryState,
} from '@/features/bookmarks/model'
import { loadCoreArtifactsProgressive } from '@/features/bookmarks/data-loader'
import {
  readBookmarksSessionState,
  writeBookmarksScrollSnapshot,
  writeBookmarksSelectedGridId,
} from '@/features/bookmarks/session-state'
import {
  applyQueryStatePatch,
  createQuerySeed,
  DEFAULT_QUERY_STATE,
  rerandomizeQueryState,
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
  isBookmarksQueryError,
  runBookmarksQuery,
} from '@/features/bookmarks/query-engine'
import {
  buildBookmarksLocationPath,
  parseBookmarksLocation,
  parseGridSelection,
} from '@/features/bookmarks/location-state'
import {
  bookmarksQueryNeedsDocs,
  canUseDefaultFirstPaint,
  createBookmarksQuery,
  createBookmarksViewKey,
  createSemanticTextQueryKey,
  type BookmarksQuery,
} from '@/features/bookmarks/query-request'
import { sessionStorageStore } from '@/lib/storage'
import type {
  QueryWorkerRequest,
  QueryWorkerResponse,
} from '@/workers/query-worker-protocol'
import type {
  EmbeddingWorkerRequest,
  EmbeddingWorkerResponse,
} from '@/workers/embedding-worker-protocol'
import { useViewportWidth } from '@/app/bookmarks/useViewportWidth'

type HydratedArtifacts = CoreArtifacts

const SEARCH_QUERY_COMMIT_DELAY_MS = 180
const QUERY_WORKER_WATCHDOG_MS = 1_500
const visibleItemsCache = new WeakMap<string[], GridItem[]>()

function updateUrlFromState(state: QueryState, selectedGridId: string | null) {
  const nextUrl = buildBookmarksLocationPath(window.location.pathname, state, selectedGridId)
  if (nextUrl === `${window.location.pathname}${window.location.search}`) return
  window.history.replaceState(null, '', nextUrl)
}

export function useBookmarksPageController() {
  const initialSessionState = React.useMemo(
    () => readBookmarksSessionState(sessionStorageStore),
    [],
  )
  const initialLocationState = React.useMemo(
    () => parseBookmarksLocation(new URLSearchParams(window.location.search), {
      generateSeed: createQuerySeed,
    }),
    [],
  )
  const initialQueryState = initialLocationState.queryState
  const initialSelectedGridId = initialLocationState.selectedGridId
  const [artifacts, setArtifacts] = React.useState<HydratedArtifacts | null>(null)
  const [firstPaintItems, setFirstPaintItems] = React.useState<GridItem[]>([])
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
  const windowWidth = useViewportWidth()
  const deferredQuery = React.useDeferredValue(queryState.q)
  const queryRequestState = React.useMemo(
    () => createBookmarksQuery({
      q: deferredQuery,
      sort: queryState.sort,
      dir: queryState.dir,
      mode: queryState.mode,
      preferMotion: queryState.preferMotion,
      similarToGridId: queryState.similarToGridId,
      seed: queryState.seed,
    }),
    [
      deferredQuery,
      queryState.dir,
      queryState.mode,
      queryState.preferMotion,
      queryState.seed,
      queryState.similarToGridId,
      queryState.sort,
    ],
  )
  const masonryLayout = React.useMemo(
    () => resolveMasonryLayout({ viewportWidth: windowWidth, zoom: queryState.zoom }),
    [queryState.zoom, windowWidth],
  )
  // Identifies "which view is this" (same query = same view), not "what content is
  // currently in it" — so the masonry grid doesn't remount (and re-request every
  // image) when firstPaintItems hands off to the real, larger query result for the
  // same default view. Deliberately excludes manifest.buildId: it transitions from
  // "unloaded" to its real value exactly at that handoff, and artifacts load only
  // once per session, so keying on it forces a remount at the worst moment while
  // never capturing a genuine mid-session dataset change.
  const viewKey = React.useMemo(() => createBookmarksViewKey(queryRequestState), [queryRequestState])
  const workerRef = React.useRef<Worker | null>(null)
  const embeddingWorkerRef = React.useRef<Worker | null>(null)
  const workerCoreDocsHydratedRef = React.useRef(false)
  const workerAvailableRef = React.useRef(true)
  const workerLastRequestIdRef = React.useRef(0)
  const workerLastResponseIdRef = React.useRef(0)
  const hasFirstQueryResultRef = React.useRef(false)
  const lastQueryRequestRef = React.useRef<{
    semanticQuery?: SemanticQuery
    query: BookmarksQuery
  } | null>(null)
  const embeddingHydrationRef = React.useRef(false)
  const embeddingRequestIdRef = React.useRef(0)
  const embeddingRequestKeyRef = React.useRef<string | null>(null)
  const hasMarkedInitialMediaReadyRef = React.useRef(false)
  const queryStateRef = React.useRef(initialQueryState)
  const queryRequestStateRef = React.useRef(queryRequestState)
  const scrollAnchorRequestIdRef = React.useRef(0)
  const [isQueryPending, startTransition] = React.useTransition()

  const applyQueryResult = React.useEffectEvent((result: QueryResult) => {
    // hasFirstQueryResult and queryResult must commit in the same render: if the
    // former flips true a render before the latter lands, visibleItems briefly reads
    // a stale (empty) queryResult and flashes the "no media" empty state.
    startTransition(() => {
      setQueryResult(result)
      setHasFirstQueryResult(true)
    })
    hasFirstQueryResultRef.current = true
    setLoadingError(null)
  })

  const runQueryOnMainThread = React.useEffectEvent((input: {
    semanticQuery?: SemanticQuery
    query: BookmarksQuery
  }) => {
    const currentArtifacts = artifacts
    if (!currentArtifacts) {
      return
    }

    try {
      applyQueryResult(runBookmarksQuery(currentArtifacts, input.query, input.semanticQuery))
    } catch (error) {
      if (isBookmarksQueryError(error, 'embeddings-not-hydrated')) {
        void ensureEmbeddingArtifacts()
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
      if (lastQueryRequestRef.current) {
        runQueryOnMainThread(lastQueryRequestRef.current)
      }
    }
    worker.onmessageerror = () => {
      workerAvailableRef.current = false
      setLoadingError('Bookmark query worker could not exchange data; using in-page fallback.')
      if (lastQueryRequestRef.current) {
        runQueryOnMainThread(lastQueryRequestRef.current)
      }
    }
    worker.onmessage = (event: MessageEvent<QueryWorkerResponse>) => {
      const message = event.data
      if ('requestId' in message && message.requestId !== undefined) {
        workerLastResponseIdRef.current = Math.max(
          workerLastResponseIdRef.current,
          message.requestId,
        )
        if (message.requestId !== workerLastRequestIdRef.current) return
      }

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
    queryRequestStateRef.current = queryRequestState
  }, [queryRequestState])

  React.useEffect(() => {
    setSearchInputValue(queryState.q)
  }, [queryState.q])

  React.useEffect(() => {
    updateUrlFromState(queryState, selectedGridId)
  }, [queryState, selectedGridId])

  React.useEffect(() => {
    const handlePopState = () => {
      const locationState = parseBookmarksLocation(
        new URLSearchParams(window.location.search),
        { generateSeed: createQuerySeed },
      )
      setQueryState(locationState.queryState)
      setSelectedGridId(locationState.selectedGridId)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    let hydratedCoreArtifacts: CoreArtifacts | null = null
    let pendingDocsChunks: CoreArtifacts['docsChunks'] | null = null

    const applyDocsChunks = (docsChunks: CoreArtifacts['docsChunks']) => {
      if (cancelled || docsChunks.length === 0) return
      pendingDocsChunks = docsChunks
      if (!hydratedCoreArtifacts) return

      if (!workerCoreDocsHydratedRef.current) {
        postWorkerMessage({
          type: 'hydrate-docs',
          buildId: hydratedCoreArtifacts.manifest.buildId,
          docsChunks,
        })
        workerCoreDocsHydratedRef.current = true
      }

      setArtifacts((current) =>
        current && current.manifest.buildId === hydratedCoreArtifacts?.manifest.buildId
          ? { ...current, docsChunks }
          : current,
      )
    }

    void loadCoreArtifactsProgressive({
      deferBackgroundUntilPaint: canUseDefaultFirstPaint(queryRequestStateRef.current),
    })
      .then(({ manifest, firstPaintItems: initialItems, coreReady, docsReady }) => {
        if (cancelled) return

        if (initialItems.length > 0 && canUseDefaultFirstPaint(queryRequestStateRef.current)) {
          setFirstPaintItems(initialItems)
          applyQueryResult({
            total: manifest.gridItemCountAll,
            orderedGridIds: initialItems.map((item) => item.gridId),
          })
        }

        void coreReady
          .then((coreArtifacts) => {
            if (cancelled) return

            hydratedCoreArtifacts = coreArtifacts
            workerCoreDocsHydratedRef.current = coreArtifacts.docsChunks.length > 0
            setArtifacts(coreArtifacts)
            setHasEmbeddingIndex(false)
            postWorkerMessage({
              type: 'hydrate-core',
              artifacts: coreArtifacts,
            })

            if (pendingDocsChunks) applyDocsChunks(pendingDocsChunks)
          })
          .catch((error: unknown) => {
            if (cancelled) return
            setLoadingError(
              error instanceof Error ? error.message : 'Failed to load bookmark data.',
            )
          })

        void docsReady.then(applyDocsChunks).catch((error: unknown) => {
          if (cancelled) return
          setLoadingError(
            error instanceof Error ? error.message : 'Failed to load bookmark data.',
          )
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
    if (!artifacts || (workerAvailableRef.current && !workerRef.current)) {
      return
    }

    const trimmedSemanticText = queryRequestState.q.trim()
    const expectedTextQueryKey = createSemanticTextQueryKey(trimmedSemanticText)
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
    const queryNeedsDocs = bookmarksQueryNeedsDocs(queryRequestState)
    if (queryNeedsDocs && artifacts.docsChunks.length === 0) {
      // Docs are still streaming in behind the grid artifacts; this effect re-runs
      // when they land, so hold the query instead of computing an empty result.
      return
    }

    const queryRequest = {
      query: queryRequestState,
      semanticQuery: semanticQueryForRequest ?? undefined,
    }
    lastQueryRequestRef.current = queryRequest

    let watchdogTimeoutId: number | null = null
    if (!workerAvailableRef.current) {
      runQueryOnMainThread(queryRequest)
    } else {
      workerLastRequestIdRef.current += 1
      const requestId = workerLastRequestIdRef.current
      postWorkerMessage({
        type: 'query',
        requestId,
        ...queryRequest,
      })

      watchdogTimeoutId = window.setTimeout(() => {
        if (workerLastResponseIdRef.current >= requestId) {
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

    const requestKey = createSemanticTextQueryKey(trimmedSemanticText)
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

  const docsById = React.useMemo(
    () => getTweetDocIndex(artifacts?.docsChunks ?? []).byId,
    [artifacts?.docsChunks],
  )

  const gridById = React.useMemo(
    () => getGridItemIndex(artifacts?.gridAll ?? firstPaintItems).byId,
    [artifacts?.gridAll, firstPaintItems],
  )

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

  const markInitialMediaReady = React.useCallback(() => {
    if (!hasMarkedInitialMediaReadyRef.current) {
      hasMarkedInitialMediaReadyRef.current = true
      performance.mark('bookmarks-initial-media-ready')
    }
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
    hasLoadedArtifacts: artifacts !== null || firstPaintItems.length > 0,
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
    viewKey,
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
    onInitialMediaReady: markInitialMediaReady,
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
