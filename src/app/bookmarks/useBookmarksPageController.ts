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

function updateUrlFromState(state: QueryState) {
  const params = serializeQueryState(state)
  const nextQuery = params.toString()
  const nextUrl =
    nextQuery.length > 0 ? `${window.location.pathname}?${nextQuery}` : window.location.pathname
  window.history.replaceState(null, '', nextUrl)
}

function parseGridSelection(gridId: string | null): { tweetId: string; mediaIndex: number } | null {
  if (!gridId) {
    return null
  }

  const [tweetId, mediaIndex] = gridId.split(':')
  if (!tweetId || mediaIndex == null) {
    return null
  }

  return {
    tweetId,
    mediaIndex: Number(mediaIndex),
  }
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
  const [artifacts, setArtifacts] = React.useState<HydratedArtifacts | null>(null)
  const [loadingError, setLoadingError] = React.useState<string | null>(null)
  const [queryResult, setQueryResult] = React.useState<QueryResult>({
    total: 0,
    orderedGridIds: [],
  })
  const [selectedGridId, setSelectedGridId] = React.useState<string | null>(
    initialSessionState.selectedGridId,
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
  const embeddingHydrationRef = React.useRef(false)
  const backgroundEmbeddingPreloadRef = React.useRef<number | null>(null)
  const embeddingRequestIdRef = React.useRef(0)
  const embeddingRequestKeyRef = React.useRef<string | null>(null)
  const queryStateRef = React.useRef(initialQueryState)
  const scrollAnchorRequestIdRef = React.useRef(0)
  const [isQueryPending, startTransition] = React.useTransition()

  const postWorkerMessage = React.useEffectEvent((message: QueryWorkerRequest) => {
    workerRef.current?.postMessage(message)
  })

  const postEmbeddingWorkerMessage = React.useEffectEvent((message: EmbeddingWorkerRequest) => {
    embeddingWorkerRef.current?.postMessage(message)
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

  const scheduleBackgroundEmbeddingPreload = () => {
    if (backgroundEmbeddingPreloadRef.current !== null) {
      return
    }

    const preload = () => {
      backgroundEmbeddingPreloadRef.current = null
      void ensureEmbeddingArtifacts()
      postEmbeddingWorkerMessage({
        type: 'warmup-text',
      })
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }

    if (idleWindow.requestIdleCallback) {
      backgroundEmbeddingPreloadRef.current = idleWindow.requestIdleCallback(preload, {
        timeout: 500,
      })
      return
    }

    backgroundEmbeddingPreloadRef.current = window.setTimeout(preload, 250)
  }

  React.useEffect(() => {
    return () => {
      const preloadHandle = backgroundEmbeddingPreloadRef.current
      if (preloadHandle === null) {
        return
      }

      const idleWindow = window as Window & {
        cancelIdleCallback?: (handle: number) => void
      }

      if (idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(preloadHandle)
      } else {
        window.clearTimeout(preloadHandle)
      }
    }
  }, [])

  React.useEffect(() => {
    updateUrlFromState(initialQueryState)
    window.scrollTo({
      top: initialSessionState.scrollY,
      behavior: 'auto',
    })

    const worker = new Worker(new URL('../../workers/query.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<QueryWorkerResponse>) => {
      const message = event.data

      if (message.type === 'result') {
        startTransition(() => {
          setQueryResult(message.result)
        })
        setLoadingError(null)
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
  }, [initialQueryState, initialSessionState.scrollY, startTransition])

  React.useEffect(() => {
    const worker = new Worker(new URL('../../workers/embedding.worker.ts', import.meta.url), {
      type: 'module',
    })
    embeddingWorkerRef.current = worker
    worker.onmessage = (event: MessageEvent<EmbeddingWorkerResponse>) => {
      const message = event.data

      if (message.requestId !== embeddingRequestIdRef.current) {
        return
      }

      setIsEmbeddingPending(false)

      if (message.type === 'result') {
        setSemanticQuery({
          source: message.source,
          vector: message.vector,
        })
        setSemanticQueryKey(embeddingRequestKeyRef.current)
        setLoadingError(null)
        return
      }

      setLoadingError(message.message)
    }

    return () => {
      worker.terminate()
      embeddingWorkerRef.current = null
      embeddingRequestKeyRef.current = null
    }
  }, [])

  React.useEffect(() => {
    queryStateRef.current = queryState
  }, [queryState])

  React.useEffect(() => {
    setSearchInputValue(queryState.q)
  }, [queryState.q])

  React.useEffect(() => {
    updateUrlFromState(queryState)
  }, [queryState])

  React.useEffect(() => {
    const handlePopState = () => {
      setQueryState(
        parseQueryState(new URLSearchParams(window.location.search), {
          generateSeed: createQuerySeed,
        }),
      )
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
        setHasEmbeddingIndex(false)
        postWorkerMessage({
          type: 'hydrate-core',
          artifacts: coreArtifacts,
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
    if (!artifacts || !workerRef.current) {
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

    postWorkerMessage({
      type: 'query',
      state: queryRequestState,
      semanticQuery: semanticQueryForRequest ?? undefined,
    })

    if (
      (trimmedSemanticText.length > 0 ||
        queryRequestState.similarToGridId ||
        semanticQueryForRequest) &&
      !hasEmbeddingIndex
    ) {
      void ensureEmbeddingArtifacts()
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

    const persistScroll = () => {
      frameId = 0
      writeBookmarksScrollSnapshot(sessionStorageStore, window.scrollY)
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
    () =>
      queryResult.orderedGridIds
        .map((gridId) => gridById.get(gridId))
        .filter((item): item is GridItem => item !== undefined),
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
    onInitialMediaReady: scheduleBackgroundEmbeddingPreload,
    onBrowseSimilar: browseSimilar,
    onKeepSeedChange: (value: boolean) => patchQueryState({ keepSeed: value }),
    onRerandomize,
    onZoomIn: () => onZoomChange(BOOKMARKS_ZOOM_STEP),
    onZoomOut: () => onZoomChange(-BOOKMARKS_ZOOM_STEP),
    onPinchZoom: onZoomChange,
    onZoomReset: () => updateZoom(() => DEFAULT_QUERY_STATE.zoom),
    onOpenLightbox: (gridId: string) => setSelectedGridId(gridId),
    onCloseLightbox: () => setSelectedGridId(null),
  }
}
