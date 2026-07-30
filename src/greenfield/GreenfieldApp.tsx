import { useQuery } from "@tanstack/react-query"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useGesture } from "@use-gesture/react"
import { LoaderCircle } from "lucide-react"
import { LayoutGroup, useReducedMotion } from "motion/react"
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  CommittedWallState,
  FacetSelection,
  MediaAsset,
  MediaRecord,
} from "@/greenfield/contracts/domain"
import {
  mediaOptions,
  useApiTransport,
  useDiscovery,
  useResultCount,
  useSourceSuggestions,
} from "@/greenfield/data"
import { VideoPreview } from "@/greenfield/modules/playback/VideoPreview"
import {
  createCompositionEngine,
  stabilizeWallTail,
} from "@/greenfield/modules/composition"
import type {
  ControlFilterValues,
  FilterRangeConfig,
} from "@/greenfield/modules/controls"
import { MediaWallShell } from "@/greenfield/shell"
import {
  MediaWall,
  ResponsivePicture,
  type MediaWallHandle,
  type WallMediaRenderContext,
} from "@/greenfield/modules/wall"
import {
  planWallNavigation,
  validateWallSearch,
  type WallMutation,
} from "@/greenfield/router"

const compositionEngine = createCompositionEngine()
const loadMediaLightbox = () => import("@/greenfield/modules/lightbox/MediaLightbox")
  .then((module) => ({ default: module.MediaLightbox }))
const MediaLightbox = lazy(loadMediaLightbox)
const DENSITY_MIN = 0.6
const DENSITY_MAX = 1.75
const FILTER_RANGE: FilterRangeConfig = {
  min: 320,
  max: 3_840,
  step: 160,
  unit: "px",
}
const SORT_OPTIONS = [
  { value: "curated" as const, label: "Curated" },
  { value: "random" as const, label: "Random" },
  { value: "newest" as const, label: "Newest" },
  { value: "oldest" as const, label: "Oldest" },
]
interface AnchorSnapshot {
  mediaId: string
  top: number
}

interface DensityPreview {
  value: number
  originX: number
  originY: number
}

function clampDensity(value: number) {
  return Math.min(DENSITY_MAX, Math.max(DENSITY_MIN, value))
}

function dedupeRecords(pages: MediaRecord[][]) {
  const records = new Map<string, MediaRecord>()
  for (const page of pages) {
    for (const record of page) records.set(record.id, record)
  }
  return [...records.values()]
}

function controlsFromFilters(filters: FacetSelection[]): ControlFilterValues {
  const values = new Map(filters.map((filter) => [filter.id, filter.values]))
  const width = values.get("width")?.[0]?.split(":").map(Number)
  const date = values.get("date")?.[0]

  return {
    mediaKinds: (values.get("kind") ?? []).filter(
      (value): value is "image" | "video" => value === "image" || value === "video",
    ),
    sources: (values.get("source") ?? []).map((source) => ({ id: source, label: source })),
    widthRange:
      width?.length === 2 && Number.isFinite(width[0]) && Number.isFinite(width[1])
        ? [width[0]!, width[1]!]
        : [FILTER_RANGE.min, FILTER_RANGE.max],
    date: date
      ? date.startsWith("custom:")
        ? {
            preset: "custom",
            from: date.split(":")[1] || undefined,
            to: date.split(":")[2] || undefined,
          }
        : { preset: date as ControlFilterValues["date"]["preset"] }
      : { preset: "any" },
  }
}

function filtersFromControls(value: ControlFilterValues): FacetSelection[] {
  const filters: FacetSelection[] = []
  if (value.mediaKinds.length) filters.push({ id: "kind", values: value.mediaKinds })
  if (value.sources.length) {
    filters.push({ id: "source", values: value.sources.map((source) => source.id) })
  }
  if (
    value.widthRange[0] !== FILTER_RANGE.min ||
    value.widthRange[1] !== FILTER_RANGE.max
  ) {
    filters.push({ id: "width", values: [`${value.widthRange[0]}:${value.widthRange[1]}`] })
  }
  if (value.date.preset !== "any") {
    const dateValue = value.date.preset === "custom"
      ? `custom:${value.date.from ?? ""}:${value.date.to ?? ""}`
      : value.date.preset
    filters.push({ id: "date", values: [dateValue] })
  }
  return filters
}

function useAutoDensity() {
  const read = () => {
    if (typeof window === "undefined") return 1
    if (window.innerWidth < 480) return 0.72
    if (window.innerWidth < 768) return 0.82
    if (window.innerWidth < 1_280) return 0.92
    return 1
  }
  const [density, setDensity] = useState(read)

  useEffect(() => {
    let timeout: number | undefined
    const update = () => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => setDensity(read()), 180)
    }
    window.addEventListener("resize", update)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener("resize", update)
    }
  }, [])

  return density
}

function WallLoadingState() {
  return (
    <div aria-label="Loading media" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton
          key={index}
          className={index % 4 === 0 ? "aspect-[4/5]" : "aspect-square"}
        />
      ))}
    </div>
  )
}

function renderWallMedia(asset: MediaAsset, context: WallMediaRenderContext) {
  if (asset.kind === "video" && asset.previewVideoUrl) {
    return (
      <VideoPreview
        className="relative size-full"
        label={asset.title}
        poster={asset.poster?.url}
        preloadMargin={context.preloadMargin}
        src={asset.previewVideoUrl}
      />
    )
  }

  return (
    <ResponsivePicture
      asset={asset}
      className="size-full select-none object-contain"
      preloadMargin={context.preloadMargin}
      priority={context.priority}
      sizes={context.sizes}
    />
  )
}

export function GreenfieldApp() {
  const navigate = useNavigate()
  const routeState = useRouterState()
  const routeSearch = routeState.location.search
  const search = useMemo(
    () => validateWallSearch(routeSearch) as CommittedWallState,
    [routeSearch],
  )
  const pathname = routeState.location.pathname
  const selectedMediaId = pathname.startsWith("/media/")
    ? decodeURIComponent(pathname.slice("/media/".length))
    : undefined
  const reduceMotion = useReducedMotion()
  const transport = useApiTransport()
  const discovery = useDiscovery(search)
  const fetchNextPage = discovery.fetchNextPage
  const autoDensity = useAutoDensity()
  const wallRef = useRef<MediaWallHandle>(null)
  const wallScaleRef = useRef<HTMLDivElement>(null)
  const gestureDensityRef = useRef(1)
  const pendingAnchorRef = useRef<AnchorSnapshot | null>(null)
  const returnFocusMediaIdRef = useRef<string | undefined>(undefined)
  const [openedFromWall, setOpenedFromWall] = useState(false)
  const [searchDraftState, setSearchDraftState] = useState(() => ({
    committed: search.q,
    value: search.q,
  }))
  const [filterRailOpen, setFilterRailOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [sourceQuery, setSourceQuery] = useState("")
  const [mobileDraftFilters, setMobileDraftFilters] = useState<ControlFilterValues>(() =>
    controlsFromFilters(search.filters),
  )
  const [densityPreview, setDensityPreview] = useState<DensityPreview>()

  const searchDraft = searchDraftState.committed === search.q
    ? searchDraftState.value
    : search.q
  const setSearchDraft = useCallback((value: string) => {
    setSearchDraftState({ committed: search.q, value })
  }, [search.q])

  const records = useMemo(
    () => dedupeRecords(discovery.data?.pages.map((page) => page.records) ?? []),
    [discovery.data?.pages],
  )
  const tiles = useMemo(
    () => compositionEngine.compose(records, search),
    [records, search],
  )
  const stableWall = useMemo(
    () => stabilizeWallTail(tiles, discovery.hasNextPage),
    [discovery.hasNextPage, tiles],
  )
  const committedControls = useMemo(
    () => controlsFromFilters(search.filters),
    [search.filters],
  )
  const mobileDraftState = useMemo(
    () => ({ ...search, filters: filtersFromControls(mobileDraftFilters) }),
    [mobileDraftFilters, search],
  )
  const mobileCount = useResultCount(mobileDraftState)
  const sourceSuggestions = useSourceSuggestions(sourceQuery)
  const loadedMedia = useMemo(
    () => records.flatMap((record) => record.assets),
    [records],
  )
  const selectedLoadedMedia = loadedMedia.find((media) => media.id === selectedMediaId)
  const selectedLoadedRecord = records.find((record) =>
    record.assets.some((media) => media.id === selectedMediaId),
  )
  const directMedia = useQuery({
    ...mediaOptions(transport, selectedMediaId ?? "__no-media__"),
    enabled: Boolean(selectedMediaId && !selectedLoadedMedia),
  })
  const selectedMedia = selectedLoadedMedia ?? directMedia.data?.media
  const selectedRecord = selectedLoadedRecord ?? directMedia.data?.record
  const navigableMedia = useMemo(() => {
    const seen = new Set<string>()
    return stableWall.tiles
      .flatMap((tile) => tile.media)
      .filter((media) => !seen.has(media.id) && seen.add(media.id))
  }, [stableWall.tiles])
  const firstPage = discovery.data?.pages[0]
  const committedDensity = search.density === "auto" ? autoDensity : search.density
  const shownDensity = densityPreview?.value ?? search.density
  const draftScale = densityPreview ? densityPreview.value / committedDensity : 1

  const captureAnchor = useCallback(() => {
    const wall = wallRef.current?.getElement()
    if (!wall) return
    const centerY = window.innerHeight / 2
    const candidates = [...wall.querySelectorAll<HTMLElement>("[data-media-id]")]
    const closest = candidates
      .map((element) => ({
        element,
        distance: Math.abs(element.getBoundingClientRect().top - centerY),
      }))
      .toSorted((left, right) => left.distance - right.distance)[0]?.element
    if (closest?.dataset.mediaId) {
      pendingAnchorRef.current = {
        mediaId: closest.dataset.mediaId,
        top: closest.getBoundingClientRect().top,
      }
    }
  }, [])

  const previewDensity = useCallback((
    value: number,
    origin?: { clientX: number; clientY: number },
  ) => {
    if (!pendingAnchorRef.current) captureAnchor()
    setDensityPreview((current) => {
      if (current) return { ...current, value }

      const wall = wallScaleRef.current
      const wallRect = wall?.getBoundingClientRect()
      const originX = wallRect
        ? (origin?.clientX ?? window.innerWidth / 2) - wallRect.left
        : window.innerWidth / 2
      const originY = wall
        ? (origin?.clientY ?? window.innerHeight / 2) - wall.getBoundingClientRect().top
        : window.innerHeight / 2
      return { value, originX, originY }
    })
  }, [captureAnchor])

  const restoreAnchor = useCallback(() => {
    const anchor = pendingAnchorRef.current
    const wall = wallRef.current?.getElement()
    if (!anchor || !wall) return
    const target = [...wall.querySelectorAll<HTMLElement>("[data-media-id]")].find(
      (element) => element.dataset.mediaId === anchor.mediaId,
    )
    if (!target) return
    window.scrollBy({ top: target.getBoundingClientRect().top - anchor.top, behavior: "auto" })
    pendingAnchorRef.current = null
  }, [])

  useEffect(() => {
    if (!pendingAnchorRef.current) return
    const firstFrame = requestAnimationFrame(() => {
      wallRef.current?.repack()
    })
    const fallback = window.setTimeout(restoreAnchor, 350)

    return () => {
      cancelAnimationFrame(firstFrame)
      window.clearTimeout(fallback)
    }
  }, [restoreAnchor, tiles])

  useEffect(() => {
    const mediaId = returnFocusMediaIdRef.current
    if (selectedMediaId || !mediaId) return

    const frame = requestAnimationFrame(() => {
      if (wallRef.current?.focusMedia(mediaId)) {
        returnFocusMediaIdRef.current = undefined
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedMediaId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadMediaLightbox()
    }, 1_500)
    return () => window.clearTimeout(timeout)
  }, [])

  const commit = useCallback(
    (mutation: WallMutation) => {
      const plan = planWallNavigation(search, mutation)
      if (plan.landing === "preserve-anchor" && !pendingAnchorRef.current) {
        captureAnchor()
      }
      const replace = plan.history === "replace"
      if (selectedMediaId) {
        void navigate({
          to: "/media/$mediaId",
          params: { mediaId: selectedMediaId },
          search: plan.search,
          replace,
        })
      } else {
        void navigate({ to: "/", search: plan.search, replace })
      }
      if (plan.landing === "top") {
        requestAnimationFrame(() =>
          window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }),
        )
      }
    },
    [captureAnchor, navigate, reduceMotion, search, selectedMediaId],
  )

  const openMedia = useCallback(
    (mediaId: string) => {
      setOpenedFromWall(true)
      returnFocusMediaIdRef.current = mediaId
      void loadMediaLightbox()
      void navigate({
        to: "/media/$mediaId",
        params: { mediaId },
        search,
        resetScroll: false,
      })
    },
    [navigate, search],
  )

  const replaceLightboxMedia = useCallback(
    (mediaId: string) => {
      void navigate({
        to: "/media/$mediaId",
        params: { mediaId },
        search,
        replace: true,
        resetScroll: false,
      })
    },
    [navigate, search],
  )

  const moveLightbox = useCallback(
    (offset: number) => {
      if (!selectedMediaId || navigableMedia.length === 0) return
      const currentIndex = navigableMedia.findIndex((media) => media.id === selectedMediaId)
      const nextIndex = currentIndex < 0
        ? 0
        : (currentIndex + offset + navigableMedia.length) % navigableMedia.length
      const next = navigableMedia[nextIndex]
      if (next) replaceLightboxMedia(next.id)
    },
    [navigableMedia, replaceLightboxMedia, selectedMediaId],
  )

  const closeLightbox = useCallback(() => {
    if (openedFromWall && window.history.length > 1) {
      setOpenedFromWall(false)
      window.history.back()
      return
    }
    void navigate({ to: "/", search, replace: true, resetScroll: false })
  }, [navigate, openedFromWall, search])

  const requestNextPage = useCallback(async () => {
    await fetchNextPage()
  }, [fetchNextPage])

  useGesture(
    {
      onPinch: ({ event, first, last, offset: [scale], origin: [clientX, clientY] }) => {
        event.preventDefault()
        if (first) gestureDensityRef.current = committedDensity
        const nextDensity = clampDensity(gestureDensityRef.current * scale)
        previewDensity(nextDensity, { clientX, clientY })
        if (last) {
          setDensityPreview(undefined)
          commit({ type: "density", density: nextDensity })
        }
      },
      onWheel: ({ event, first, last, delta: [, deltaY] }) => {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        if (first) gestureDensityRef.current = committedDensity
        const nextDensity = clampDensity(
          gestureDensityRef.current * Math.exp(-deltaY * 0.003),
        )
        gestureDensityRef.current = nextDensity
        previewDensity(nextDensity, { clientX: event.clientX, clientY: event.clientY })
        if (last) {
          setDensityPreview(undefined)
          commit({ type: "density", density: nextDensity })
        }
      },
    },
    {
      eventOptions: { passive: false },
      target: wallScaleRef,
      pinch: { from: () => [1, 0], pinchOnWheel: false },
    },
  )

  const broadenedFilters = firstPage?.relaxedFilters ?? []

  return (
    <LayoutGroup id="media-wall">
      <MediaWallShell
        searchDraft={searchDraft}
        searchPlaceholder="Search media"
        resultPending={discovery.isFetching}
        filters={committedControls}
        filterRange={FILTER_RANGE}
        sourceSuggestions={sourceSuggestions.data ?? []}
        sourceQuery={sourceQuery}
        sourceSearching={sourceSuggestions.isFetching}
        mobileDraftResultCount={mobileCount.data?.count}
        mobileDraftCountPending={mobileCount.isFetching}
        filterRailOpen={filterRailOpen}
        mobileFiltersOpen={mobileFiltersOpen}
        mode={search.mode}
        sort={search.sort}
        sortOptions={SORT_OPTIONS}
        density={{
          value: shownDensity,
          effectiveValue: committedDensity,
          min: DENSITY_MIN,
          max: DENSITY_MAX,
          step: 0.025,
        }}
        onSearchDraftChange={setSearchDraft}
        onSearchSubmit={(q) => commit({ type: "search", q })}
        onDesktopFiltersChange={(filters) =>
          commit({ type: "filters", filters: filtersFromControls(filters) })
        }
        onMobileFilterDraftChange={setMobileDraftFilters}
        onFiltersCommit={(filters) => {
          setMobileDraftFilters(filters)
          commit({ type: "filters", filters: filtersFromControls(filters) })
        }}
        onSourceQueryChange={setSourceQuery}
        onFilterRailOpenChange={(open) => {
          captureAnchor()
          setFilterRailOpen(open)
        }}
        onMobileFiltersOpenChange={(open) => {
          if (open) setMobileDraftFilters(committedControls)
          setMobileFiltersOpen(open)
        }}
        onModeChange={(mode) => commit({ type: "mode", mode })}
        onSortChange={(sort) => commit({ type: "sort", sort })}
        onDensityDraft={previewDensity}
        onDensityCommit={(density) => {
          setDensityPreview(undefined)
          commit({ type: "density", density })
        }}
        onDensityAuto={() => {
          setDensityPreview(undefined)
          commit({ type: "density", density: "auto" })
        }}
        onShuffle={() => commit({ type: "shuffle" })}
        onFilterRailLayoutCommit={() => {
          wallRef.current?.repack()
          requestAnimationFrame(restoreAnchor)
        }}
        wallClassName="pb-12"
      >
        {firstPage && !firstPage.exact && (
          <div className="flex flex-col gap-3 border-b border-white/8 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-pretty text-base text-muted-foreground sm:text-sm">
              No exact matches. These related results relax the smallest possible set of filters.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() =>
                commit({
                  type: "adopt-broader-filters",
                  filters: search.filters.filter(
                    (filter) => !broadenedFilters.some((relaxed) => relaxed.id === filter.id),
                  ),
                })
              }
            >
              Use broader filters
            </Button>
          </div>
        )}

        {discovery.isPending ? (
          <WallLoadingState />
        ) : discovery.isError ? (
          <div className="grid min-h-[55dvh] place-items-center p-6 text-center">
            <div className="flex max-w-sm flex-col gap-3">
              <h1 className="text-balance text-2xl font-semibold tracking-tight">
                The wall could not be refreshed
              </h1>
              <p className="text-pretty text-base text-muted-foreground sm:text-sm">
                The previous wall remains available when cached. Retry when the connection returns.
              </p>
              <Button type="button" variant="outline" onClick={() => void discovery.refetch()}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div
            ref={wallScaleRef}
            className="touch-pan-y will-change-transform [transform:scale(var(--wall-draft-scale))]"
            style={{
              "--wall-draft-scale": draftScale,
              transformOrigin: `${densityPreview?.originX ?? 0}px ${densityPreview?.originY ?? 0}px`,
            } as CSSProperties}
          >
            <MediaWall
              ref={wallRef}
              tiles={stableWall.tiles}
              density={committedDensity}
              hasNextPage={discovery.hasNextPage}
              onOpenMedia={openMedia}
              onLayoutComplete={restoreAnchor}
              renderMedia={renderWallMedia}
              onRequestAppend={requestNextPage}
            />
            {stableWall.bufferedTileCount > 0 && (
              <div
                role="status"
                className="flex min-h-16 items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
                Loading more media…
              </div>
            )}
          </div>
        )}
      </MediaWallShell>

      <Suspense fallback={null}>
        <MediaLightbox
          media={selectedMedia}
          record={selectedRecord}
          sharedElement={openedFromWall}
          onClose={closeLightbox}
          onPrevious={() => moveLightbox(-1)}
          onNext={() => moveLightbox(1)}
          onSelectSibling={replaceLightboxMedia}
        />
      </Suspense>
    </LayoutGroup>
  )
}
