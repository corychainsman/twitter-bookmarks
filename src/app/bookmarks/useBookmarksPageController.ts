import * as React from 'react'

import type {
  CoreArtifacts,
  SearchArtifacts,
} from '@/features/bookmarks/export-artifacts'
import type { GridItem, QueryResult, QueryState, TweetDoc } from '@/features/bookmarks/model'
import { loadCoreArtifacts, loadSearchArtifacts } from '@/features/bookmarks/data-loader'
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

type HydratedArtifacts = CoreArtifacts & Partial<SearchArtifacts>

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
      queryRequestSort,
      queryRequestText,
    ],
  )
  const masonryLayout = React.useMemo(
    () => resolveMasonryLayout({ viewportWidth: windowWidth, zoom: queryState.zoom }),
    [queryState.zoom, windowWidth],
  )
  const workerRef = React.useRef<Worker | null>(null)
  const searchHydrationRef = React.useRef<Promise<void> | null>(null)
  const queryStateRef = React.useRef(initialQueryState)
  const scrollAnchorRequestIdRef = React.useRef(0)
  const [isQueryPending, startTransition] = React.useTransition()

  const postWorkerMessage = React.useEffectEvent((message: QueryWorkerRequest) => {
    workerRef.current?.postMessage(message)
  })

  const ensureSearchArtifacts = React.useEffectEvent(async () => {
    const currentArtifacts = artifacts

    if (!currentArtifacts || currentArtifacts.searchIndex || searchHydrationRef.current) {
      return
    }

    const loadPromise = loadSearchArtifacts(currentArtifacts.manifest)
      .then((searchArtifacts) => {
        setArtifacts((current) =>
          current && current.manifest.buildId === currentArtifacts.manifest.buildId
            ? { ...current, ...searchArtifacts }
            : current,
        )
        setLoadingError(null)
        postWorkerMessage({
          type: 'hydrate-search',
          artifacts: searchArtifacts,
        })
      })
      .catch((error) => {
        setLoadingError(
          error instanceof Error ? error.message : 'Failed to load bookmark search data.',
        )
      })
      .finally(() => {
        if (searchHydrationRef.current === loadPromise) {
          searchHydrationRef.current = null
        }
      })

    searchHydrationRef.current = loadPromise
    await loadPromise
  })

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

      if (message.type === 'needs-search') {
        void ensureSearchArtifacts()
        return
      }

      setLoadingError(message.message)
    }

    return () => {
      writeBookmarksScrollSnapshot(sessionStorageStore, window.scrollY)
      worker.terminate()
      workerRef.current = null
    }
  }, [initialQueryState, initialSessionState.scrollY, startTransition])

  React.useEffect(() => {
    queryStateRef.current = queryState
  }, [queryState])

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

    postWorkerMessage({
      type: 'query',
      state: queryRequestState,
    })

    if (queryRequestState.q.trim().length > 0 && !artifacts.searchIndex) {
      void ensureSearchArtifacts()
    }
  }, [artifacts, queryRequestState])

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

  const selection = React.useMemo(() => parseGridSelection(selectedGridId), [selectedGridId])

  const patchQueryState = React.useCallback((patch: Partial<QueryState>) => {
    setQueryState((current) => {
      return applyQueryStatePatch(current, patch, {
        generateSeed: createQuerySeed,
      })
    })
  }, [])

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
    queryState,
    loadingError,
    hasLoadedArtifacts: artifacts !== null,
    isQueryPending,
    onScrollAnchorApplied: (requestId: number) =>
      setScrollAnchorRequest((current) =>
        current?.requestId === requestId ? null : current,
      ),
    selection,
    scrollAnchorRequest,
    visibleItems,
    canResetZoom: queryState.zoom !== DEFAULT_QUERY_STATE.zoom,
    onSearchChange: (value: string) => patchQueryState({ q: value }),
    onSortChange: (value: QueryState['sort']) => patchQueryState({ sort: value }),
    onDirectionToggle: () =>
      patchQueryState({ dir: queryState.dir === 'desc' ? 'asc' : 'desc' }),
    onModeChange: (value: QueryState['mode']) => patchQueryState({ mode: value }),
    onImmersiveChange: (value: boolean) => patchQueryState({ immersive: value }),
    onKeepSeedChange: (value: boolean) => patchQueryState({ keepSeed: value }),
    onRerandomize,
    onZoomIn: () => onZoomChange(BOOKMARKS_ZOOM_STEP),
    onZoomOut: () => onZoomChange(-BOOKMARKS_ZOOM_STEP),
    onZoomReset: () => updateZoom(() => DEFAULT_QUERY_STATE.zoom),
    onOpenLightbox: (gridId: string) => setSelectedGridId(gridId),
    onCloseLightbox: () => setSelectedGridId(null),
  }
}
