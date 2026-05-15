import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react'

import Lightbox from 'yet-another-react-lightbox'
import { Zoom } from 'yet-another-react-lightbox/plugins'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  HeartIcon,
  MessageCircleIcon,
  Repeat2Icon,
  SparklesIcon,
  XIcon,
} from 'lucide-react'

import type { TweetDoc } from '@/features/bookmarks/model'
import { formatCompactNumber, formatPostedDateTime } from '@/lib/format'
import {
  getLightboxDetailsPanelWidth,
  getLightboxMediaPaddingBottom,
  isLightboxImageRenderedAtNativeSize,
} from '@/components/lightbox/lightbox-layout'
import {
  createBookmarksLightboxSlides,
  createLightboxPreloadCandidates,
} from '@/components/lightbox/lightbox-slides'
import { Button } from '@/components/ui/button'
import { preloadMediaCandidates } from '@/lib/media-preload'
import { cn } from '@/lib/utils'

type LightboxSelection = {
  tweetId: string
  mediaIndex: number
}

type BookmarksLightboxProps = {
  docsById: Map<string, TweetDoc>
  selection: LightboxSelection | null
  onClose: () => void
  onBrowseSimilar: (gridId: string) => void
}

type TweetEmbedSlide = {
  type: 'tweet-embed'
  tweetUrl: string
  poster?: string
  width?: number
  height?: number
}

type DirectVideoSlide = {
  type: 'video'
  src: string
  poster?: string
  width?: number
  height?: number
  loop?: boolean
  muted?: boolean
}

const LightboxRenderer = Lightbox as unknown as ComponentType<Record<string, unknown>>
const BACKDROP_CLICK_MOVEMENT_TOLERANCE_PX = 8

function isPointInsideElement(element: Element | null | undefined, x: number, y: number) {
  if (!(element instanceof HTMLElement)) {
    return false
  }

  const rect = element.getBoundingClientRect()
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function getSlideMediaElement(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-lightbox-media-content], .yarl__slide_image')
}

function getViewportSize() {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
    }
  }

  return {
    width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight),
  }
}

type TweetDetailsPanelProps = {
  tweet: TweetDoc
  postedDateTime: string
  currentIndex: number
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onBrowseSimilar: (gridId: string) => void
}

function EngagementStat({
  icon: Icon,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  value?: number
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-base/6 text-muted-foreground sm:text-sm/6">
      <Icon className="size-4 shrink-0" />
      <span className="tabular-nums text-foreground">{formatCompactNumber(value)}</span>
    </div>
  )
}

function TweetDetailsPanel({
  tweet,
  postedDateTime,
  currentIndex,
  expanded,
  onExpandedChange,
  onBrowseSimilar,
}: TweetDetailsPanelProps) {
  return (
    <aside
      className={cn(
        'pointer-events-auto flex w-full flex-col border-[var(--app-lightbox-border)] bg-[var(--app-lightbox-surface)] text-[var(--foreground)] shadow-2xl shadow-black/40 backdrop-blur-2xl',
        'max-lg:max-h-[min(78svh,34rem)] max-lg:rounded-t-[var(--app-panel-radius)] max-lg:border-t max-lg:px-4 max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))] max-lg:pt-2',
        'lg:h-full lg:w-[var(--lightbox-details-width)] lg:border-l lg:px-6 lg:py-[calc(1.25rem+env(safe-area-inset-top))]',
      )}
    >
      <button
        type="button"
        className="mx-auto flex h-8 w-full max-w-36 items-center justify-center rounded-[var(--app-control-radius)] text-muted-foreground lg:hidden"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse tweet details' : 'Expand tweet details'}
        onClick={() => onExpandedChange(!expanded)}
      >
        {expanded ? <ChevronDownIcon className="size-4" /> : <ChevronUpIcon className="size-4" />}
      </button>

      <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
        <div className="flex flex-col gap-4 lg:gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base/6 font-semibold sm:text-sm/6">
                  {tweet.authorName || 'Unknown author'}
                </p>
                {tweet.authorHandle ? (
                  <p className="truncate text-base/6 text-muted-foreground sm:text-sm/6">
                    @{tweet.authorHandle}
                  </p>
                ) : null}
              </div>
            </div>

            <p
              className={cn(
                'app-lightbox-copy text-pretty text-foreground/92',
                expanded ? '' : 'line-clamp-2 lg:line-clamp-none',
              )}
            >
              {tweet.text}
            </p>

            {postedDateTime ? (
              <a
                href={tweet.url}
                target="_blank"
                rel="noreferrer"
                className="text-base/6 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:text-sm/6"
              >
                {postedDateTime}
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-[var(--app-lightbox-border)] py-3 lg:py-4">
            <EngagementStat icon={MessageCircleIcon} value={tweet.replies} />
            <EngagementStat icon={Repeat2Icon} value={tweet.reposts} />
            <EngagementStat icon={HeartIcon} value={tweet.likes} />
          </div>

          <div className={cn('flex flex-col gap-4', expanded ? '' : 'max-lg:hidden')}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit cursor-pointer rounded-[var(--app-control-radius)] border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--foreground)] hover:border-[color-mix(in_srgb,var(--app-control-border)_45%,var(--foreground)_55%)] hover:bg-[color-mix(in_srgb,var(--app-control-surface)_70%,var(--foreground)_30%)] focus-visible:border-[var(--ring)]"
              onClick={() => onBrowseSimilar(`${tweet.id}:${currentIndex}`)}
            >
              <SparklesIcon data-icon="inline-start" />
              Find similar
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function BookmarksLightbox({
  docsById,
  selection,
  onClose,
  onBrowseSimilar,
}: BookmarksLightboxProps) {
  const tweet = selection ? docsById.get(selection.tweetId) : undefined
  const postedDateTime = tweet ? formatPostedDateTime(tweet.postedAt) : ''
  const selectionKey = selection ? `${selection.tweetId}:${selection.mediaIndex}` : ''
  const [currentIndex, setCurrentIndex] = useState(selection?.mediaIndex ?? 0)
  const [viewport, setViewport] = useState(getViewportSize)
  const [detailsExpandedState, setDetailsExpandedState] = useState({
    selectionKey,
    expanded: false,
  })
  const [detailsPanelCollapsed, setDetailsPanelCollapsed] = useState(false)
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const backdropPointerRef = useRef<{
    pointerId: number
    x: number
    y: number
    startedOnBackdrop: boolean
  } | null>(null)
  const [footerClearance, setFooterClearance] = useState(240)
  const detailsPanelWidth = getLightboxDetailsPanelWidth(viewport)
  const isDesktopLightbox = detailsPanelWidth > 0
  const effectiveDetailsPanelWidth =
    isDesktopLightbox && detailsPanelCollapsed ? 0 : detailsPanelWidth
  const mediaFooterClearance = isDesktopLightbox ? 0 : footerClearance
  const showDetailsPanel = !isDesktopLightbox || !detailsPanelCollapsed
  const detailsExpanded =
    detailsExpandedState.selectionKey === selectionKey ? detailsExpandedState.expanded : false

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleResize = () => setViewport(getViewportSize())
    const visualViewport = window.visualViewport

    window.addEventListener('resize', handleResize)
    visualViewport?.addEventListener('resize', handleResize)
    visualViewport?.addEventListener('scroll', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      visualViewport?.removeEventListener('resize', handleResize)
      visualViewport?.removeEventListener('scroll', handleResize)
    }
  }, [])

  useEffect(() => {
    const node = controlsRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const measure = () => {
      setFooterClearance(Math.ceil(node.getBoundingClientRect().height))
    }

    measure()

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [tweet?.id])

  const slides = useMemo(() => createBookmarksLightboxSlides(tweet), [tweet])
  const currentSlide = slides[currentIndex]
  const showNavigation = slides.length > 1
  const showZoomButton =
    currentSlide !== undefined &&
    isLightboxImageRenderedAtNativeSize(currentSlide, viewport, {
      footerClearance: mediaFooterClearance,
      sidePanelWidth: effectiveDetailsPanelWidth,
    })

  useEffect(() => {
    preloadMediaCandidates(createLightboxPreloadCandidates(slides, currentIndex), {
      concurrency: 3,
    })
  }, [currentIndex, slides])

  if (!selection || !tweet) {
    return null
  }

  return (
    <LightboxRenderer
      key={`${selection.tweetId}:${selection.mediaIndex}`}
      open
      close={onClose}
      index={selection.mediaIndex}
      slides={slides}
      carousel={{
        finite: true,
      }}
      controller={{
        closeOnBackdropClick: true,
      }}
      plugins={[Zoom]}
      on={{
        view: ({ index }: { index: number }) => setCurrentIndex(index),
      }}
      render={{
        ...(showNavigation
          ? {}
          : {
              buttonPrev: () => null,
              buttonNext: () => null,
            }),
        buttonClose: () => (
          <button
            type="button"
            className="yarl__button fixed top-3 left-3 z-40 rounded-full bg-black/35 backdrop-blur-sm hover:bg-black/55"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <XIcon className="size-6" />
          </button>
        ),
        slide: ({ slide }: { slide: DirectVideoSlide | TweetEmbedSlide | { type?: string } }) =>
          slide.type === 'video' ? (
            <div className="flex h-full w-full items-center justify-center px-4">
              <video
                data-lightbox-media-content
                src={(slide as DirectVideoSlide).src}
                poster={(slide as DirectVideoSlide).poster}
                controls
                playsInline
                preload="metadata"
                autoPlay={(slide as DirectVideoSlide).muted}
                loop={(slide as DirectVideoSlide).loop}
                muted={(slide as DirectVideoSlide).muted}
                className="max-h-full max-w-full bg-black object-contain"
              />
            </div>
          ) : undefined,
        controls: () => (
          <div
            ref={controlsRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center lg:inset-y-0 lg:right-0 lg:left-auto lg:items-start lg:justify-end"
            style={
              {
                '--lightbox-details-width': `${detailsPanelWidth}px`,
              } as CSSProperties
            }
          >
            {isDesktopLightbox ? (
              <button
                type="button"
                className="pointer-events-auto mt-4 mr-3 hidden size-10 cursor-pointer items-center justify-center rounded-full border border-[var(--app-control-border)] bg-black/45 text-[var(--foreground)] backdrop-blur-sm hover:border-[color-mix(in_srgb,var(--app-control-border)_45%,var(--foreground)_55%)] hover:bg-black/65 focus-visible:border-[var(--ring)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:flex"
                aria-label={detailsPanelCollapsed ? 'Show tweet details' : 'Hide tweet details'}
                title={detailsPanelCollapsed ? 'Show tweet details' : 'Hide tweet details'}
                onClick={() => setDetailsPanelCollapsed((collapsed) => !collapsed)}
              >
                {detailsPanelCollapsed ? (
                  <ChevronsLeftIcon className="size-5" />
                ) : (
                  <ChevronsRightIcon className="size-5" />
                )}
              </button>
            ) : null}

            {showDetailsPanel ? (
              <TweetDetailsPanel
                tweet={tweet}
                postedDateTime={postedDateTime}
                currentIndex={currentIndex}
                expanded={detailsExpanded}
                onExpandedChange={(expanded) => {
                  setDetailsExpandedState({
                    selectionKey,
                    expanded,
                  })
                }}
                onBrowseSimilar={onBrowseSimilar}
              />
            ) : null}
          </div>
        ),
        slideContainer: ({ slide, children }: { slide: { type?: string }; children: unknown }) => (
          <div
            className="box-border flex h-full w-full touch-pan-y items-center justify-center"
            style={{
              paddingBottom:
                slide.type === 'tweet-embed'
                  ? `${mediaFooterClearance}px`
                  : isDesktopLightbox
                    ? 0
                    : getLightboxMediaPaddingBottom(slide),
              paddingRight: isDesktopLightbox ? effectiveDetailsPanelWidth : 0,
            }}
            onPointerDownCapture={(event) => {
              const container = event.currentTarget
              const mediaElement = getSlideMediaElement(container)
              backdropPointerRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                startedOnBackdrop:
                  !isPointInsideElement(mediaElement, event.clientX, event.clientY) &&
                  !isPointInsideElement(controlsRef.current, event.clientX, event.clientY),
              }
            }}
            onPointerUpCapture={(event) => {
              const pointer = backdropPointerRef.current
              backdropPointerRef.current = null

              if (!pointer || pointer.pointerId !== event.pointerId || !pointer.startedOnBackdrop) {
                return
              }

              const movement = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y)
              if (movement > BACKDROP_CLICK_MOVEMENT_TOLERANCE_PX) {
                return
              }

              const container = event.currentTarget
              const mediaElement = getSlideMediaElement(container)
              const endedOnBackdrop =
                !isPointInsideElement(mediaElement, event.clientX, event.clientY) &&
                !isPointInsideElement(controlsRef.current, event.clientX, event.clientY)

              if (endedOnBackdrop) {
                onClose()
              }
            }}
          >
            {children as ReactNode}
          </div>
        ),
        buttonZoom: ({
          disabled,
          zoom,
          zoomIn,
          zoomOut,
          minZoom,
          maxZoom,
        }: {
          disabled: boolean
          zoom: number
          zoomIn: () => void
          zoomOut: () => void
          minZoom: number
          maxZoom: number
        }) =>
          showZoomButton ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="yarl__button"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={disabled || zoom <= minZoom}
                onClick={zoomOut}
              >
                -
              </button>
              <button
                type="button"
                className="yarl__button"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={disabled || zoom >= maxZoom}
                onClick={zoomIn}
              >
                +
              </button>
            </div>
          ) : null,
      }}
    />
  )
}
