import { JustifiedInfiniteGrid } from "@egjs/react-infinitegrid"
import { Play } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import type { Density, MediaAsset, WallTile } from "../../contracts/domain"
import { ResponsivePicture } from "./ResponsivePicture"
import {
  collageFlexWeight,
  createCollageLayout,
  type CollageLayoutNode,
} from "./collageGeometry"
import {
  findSpatialNeighbor,
  type SpatialDirection,
  type SpatialRect,
} from "./spatialNavigation"
import {
  getJustifiedColumnRange,
  getJustifiedSizeRange,
  getTileDimensions,
  getWallRenderThreshold,
} from "./tileGeometry"

type GridRequestAppendEvent = Parameters<
  NonNullable<ComponentProps<typeof JustifiedInfiniteGrid>["onRequestAppend"]>
>[0]

const DEFAULT_SIZES = "(max-width: 639px) 58vw, (max-width: 1023px) 38vw, 24vw"

export interface WallOpenContext {
  tileId: string
  recordId: string
  mediaIndex: number
}

export interface WallAppendRequest {
  afterGroupKey: string | number | undefined
  requestedGroupKeys: Array<string | number>
  isVirtual: boolean
}

export interface WallMediaRenderContext extends WallOpenContext {
  preloadMargin: string
  priority: boolean
  sizes: string
}

export interface MediaWallHandle {
  focusMedia(mediaId: string): boolean
  getElement(): HTMLElement | null
  repack(): void
}

export interface MediaWallProps {
  tiles: WallTile[]
  onOpenMedia: (mediaId: string, context: WallOpenContext) => void
  onRequestAppend?: (request: WallAppendRequest) => Promise<void> | void
  onAppendError?: (error: unknown) => void
  onActiveMediaChange?: (mediaId: string) => void
  onLayoutComplete?: () => void
  renderMedia?: (asset: MediaAsset, context: WallMediaRenderContext) => ReactNode
  density?: Density
  hasNextPage?: boolean
  ariaLabel?: string
  className?: string
  gap?: number
  priorityTileCount?: number
  sizes?: string
}

function focusKey(tile: WallTile, media: MediaAsset): string {
  return `${tile.id}\u001f${media.id}`
}

const DefaultMedia = memo(function DefaultMedia({
  asset,
  preloadMargin,
  priority,
  sizes,
}: {
  asset: MediaAsset
  preloadMargin: string
  priority: boolean
  sizes: string
}) {
  return (
    <>
      <ResponsivePicture
        asset={asset}
        className="size-full select-none object-contain"
        preloadMargin={preloadMargin}
        priority={priority}
        sizes={sizes}
      />
      {asset.kind === "video" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute end-2 top-2 grid size-7 place-items-center rounded-full bg-black/65 text-white ring-1 ring-white/15 backdrop-blur-sm"
        >
          <Play aria-hidden="true" className="size-3.5 fill-current" />
        </span>
      )}
    </>
  )
})

function rectForElement(element: HTMLElement): SpatialRect | undefined {
  const id = element.dataset.wallFocusId

  if (!id) {
    return undefined
  }

  const rect = element.getBoundingClientRect()

  return {
    id,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

function mountedFocusTargets(element: HTMLElement | null): HTMLButtonElement[] {
  if (!element) {
    return []
  }

  return [...element.querySelectorAll<HTMLButtonElement>("[data-wall-focus-id]")]
    .filter((target) => !target.disabled && target.getAttribute("aria-hidden") !== "true")
}

const MediaWallRoot = forwardRef<MediaWallHandle, MediaWallProps>(function MediaWall(
  {
    tiles,
    onOpenMedia,
    onRequestAppend,
    onAppendError,
    onActiveMediaChange,
    onLayoutComplete,
    renderMedia,
    density = "auto",
    hasNextPage = false,
    ariaLabel = "Media results",
    className,
    gap = 4,
    priorityTileCount = 8,
    sizes = DEFAULT_SIZES,
  },
  forwardedRef,
) {
  const reduceMotion = useReducedMotion()
  const wallElementRef = useRef<HTMLElement>(null)
  const gridRef = useRef<JustifiedInfiniteGrid>(null)
  const appendRequestRef = useRef<Promise<void> | null>(null)
  const focusKeys = useMemo(
    () => tiles.flatMap((tile) => tile.media.map((media) => focusKey(tile, media))),
    [tiles],
  )
  const [activeFocusKey, setActiveFocusKey] = useState<string | undefined>(focusKeys[0])
  const effectiveFocusKey = activeFocusKey && focusKeys.includes(activeFocusKey)
    ? activeFocusKey
    : focusKeys[0]
  const sizeRange = useMemo(() => getJustifiedSizeRange(density), [density])
  const renderThreshold = useMemo(() => getWallRenderThreshold(density), [density])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      gridRef.current?.renderItems({ useResize: true })
    })

    return () => cancelAnimationFrame(frame)
  }, [density, gap, tiles])

  useEffect(() => {
    const wallElement = wallElementRef.current

    if (!wallElement || typeof MutationObserver === "undefined") {
      return
    }

    const reconcileMountedTarget = () => {
      const targets = mountedFocusTargets(wallElement)

      setActiveFocusKey((current) => {
        if (targets.some((target) => target.dataset.wallFocusId === current)) {
          return current
        }

        return targets[0]?.dataset.wallFocusId ?? current
      })
    }
    const observer = new MutationObserver(reconcileMountedTarget)

    observer.observe(wallElement, { childList: true, subtree: true })
    reconcileMountedTarget()

    return () => observer.disconnect()
  }, [tiles])

  const focusMedia = useCallback((mediaId: string): boolean => {
    const target = mountedFocusTargets(wallElementRef.current)
      .find((element) => element.dataset.mediaId === mediaId)

    if (!target) {
      return false
    }

    setActiveFocusKey(target.dataset.wallFocusId)
    target.focus()
    return true
  }, [])

  useImperativeHandle(forwardedRef, () => ({
    focusMedia,
    getElement: () => wallElementRef.current,
    repack: () => {
      gridRef.current?.renderItems({ useResize: true })
    },
  }), [focusMedia])

  const handleRequestAppend = useCallback((event: GridRequestAppendEvent) => {
    if (!hasNextPage || !onRequestAppend) {
      event.reachEnd()
      return
    }

    event.wait()
    const currentRequest = appendRequestRef.current

    if (currentRequest) {
      void currentRequest.then(
        () => event.ready(),
        () => event.ready(),
      )
      return
    }

    const request = Promise.resolve().then(() => onRequestAppend({
      afterGroupKey: event.groupKey,
      requestedGroupKeys: event.nextGroupKeys,
      isVirtual: event.isVirtual,
    }))

    appendRequestRef.current = request
    void request.then(
      () => {
        appendRequestRef.current = null
        event.ready()
      },
      (error: unknown) => {
        appendRequestRef.current = null
        event.ready()
        onAppendError?.(error)
      },
    )
  }, [hasNextPage, onAppendError, onRequestAppend])

  const moveFocus = useCallback((
    event: KeyboardEvent<HTMLButtonElement>,
    currentFocusKey: string,
  ) => {
    const keyDirections: Partial<Record<string, SpatialDirection>> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    }
    const direction = keyDirections[event.key]
    const targets = mountedFocusTargets(wallElementRef.current)

    if (event.key === "Home" || event.key === "End") {
      const target = event.key === "Home" ? targets[0] : targets.at(-1)

      if (target) {
        event.preventDefault()
        setActiveFocusKey(target.dataset.wallFocusId)
        target.focus()
      }
      return
    }

    if (!direction) {
      return
    }

    const rects = targets.flatMap((target) => {
      const rect = rectForElement(target)
      return rect ? [rect] : []
    })
    const nextFocusKey = findSpatialNeighbor(rects, currentFocusKey, direction)
    const nextTarget = targets.find(
      (target) => target.dataset.wallFocusId === nextFocusKey,
    )

    if (!nextTarget) {
      return
    }

    event.preventDefault()
    setActiveFocusKey(nextFocusKey)
    nextTarget.focus()
  }, [])

  return (
    <section
      ref={wallElementRef}
      aria-label={ariaLabel}
      className={className}
    >
      <JustifiedInfiniteGrid
        ref={gridRef}
        aria-label={ariaLabel}
        role="list"
        className="relative min-h-[40vh] w-full"
        columnRange={(grid) => getJustifiedColumnRange(grid.getContainerInlineSize())}
        gap={gap}
        isCroppedSize={false}
        isReachEnd={!hasNextPage}
        passUnstretchRow
        sizeRange={sizeRange}
        stretch={false}
        threshold={renderThreshold}
        useRecycle
        useResizeObserver
        useTransform={false}
        onRequestAppend={handleRequestAppend}
        onRenderComplete={onLayoutComplete}
      >
        {tiles.map((tile, tileIndex) => {
          const dimensions = getTileDimensions(tile, density)
          const priority = tileIndex < priorityTileCount
          const layout = createCollageLayout(tile.media)

          const renderCollageNode = (
            node: CollageLayoutNode,
            path: string,
          ): ReactNode => {
            if (node.kind === "media") {
              const media = tile.media[node.mediaIndex]
              if (!media) return null

              const mediaIndex = node.mediaIndex
              const itemFocusKey = focusKey(tile, media)
              const context: WallMediaRenderContext = {
                tileId: tile.id,
                recordId: tile.recordId,
                mediaIndex,
                preloadMargin: `${renderThreshold}px 0px`,
                priority,
                sizes,
              }

              return (
                <button
                  key={path}
                  type="button"
                  aria-label={`Open ${media.title}`}
                  className="group relative size-full min-h-0 min-w-0 overflow-hidden bg-black text-start outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  data-media-id={media.id}
                  data-wall-focus-id={itemFocusKey}
                  tabIndex={itemFocusKey === effectiveFocusKey ? 0 : -1}
                  onClick={() => onOpenMedia(media.id, context)}
                  onFocus={() => {
                    setActiveFocusKey(itemFocusKey)
                    onActiveMediaChange?.(media.id)
                  }}
                  onKeyDown={(event) => moveFocus(event, itemFocusKey)}
                >
                  <motion.div
                    layout
                    layoutId={`media-${media.id}`}
                    className="relative size-full"
                    data-media-layout-id={`media-${media.id}`}
                    transition={reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", bounce: 0.08, duration: 0.38 }}
                  >
                    {renderMedia
                      ? renderMedia(media, context)
                      : (
                          <DefaultMedia
                            asset={media}
                            preloadMargin={context.preloadMargin}
                            priority={priority}
                            sizes={sizes}
                          />
                        )}
                  </motion.div>
                  {mediaIndex === tile.media.length - 1 && tile.overflowCount > 0 && (
                    <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 text-xl font-semibold text-white tabular-nums backdrop-blur-[1px]">
                      +{tile.overflowCount}
                      <span className="sr-only"> more media assets</span>
                    </span>
                  )}
                </button>
              )
            }

            return (
              <div
                key={path}
                className={`flex size-full min-h-0 min-w-0 ${node.kind === "row" ? "flex-row" : "flex-col"}`}
              >
                {node.children.map((child, childIndex) => (
                  <div
                    key={`${path}-${childIndex}`}
                    className="min-h-0 min-w-0"
                    style={{
                      flexBasis: 0,
                      flexGrow: collageFlexWeight(node, child),
                    }}
                  >
                    {renderCollageNode(child, `${path}-${childIndex}`)}
                  </div>
                ))}
              </div>
            )
          }

          return (
            <article
              key={tile.id}
              data-grid-groupkey={tile.groupKey}
              data-tile-aspect-ratio={dimensions.width / dimensions.height}
              data-tile-id={tile.id}
              role="listitem"
              className="overflow-hidden bg-black"
              style={{
                width: dimensions.width,
                height: dimensions.height,
              }}
            >
              <div className="size-full bg-black">
                {renderCollageNode(layout, tile.id)}
              </div>
            </article>
          )
        })}
      </JustifiedInfiniteGrid>
    </section>
  )
})

export const MediaWall = memo(MediaWallRoot)
