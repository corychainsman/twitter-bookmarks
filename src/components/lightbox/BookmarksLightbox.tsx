import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'

import Lightbox from 'yet-another-react-lightbox'
import { Zoom } from 'yet-another-react-lightbox/plugins'
import { HeartIcon, MessageCircleIcon, Repeat2Icon, SparklesIcon } from 'lucide-react'

import type { TweetDoc } from '@/features/bookmarks/model'
import { formatCompactNumber, formatPostedDate } from '@/lib/format'
import {
  getAvailableLightboxBox,
  getContainedBoxWithinBounds,
  getLightboxMediaPaddingBottom,
  isLightboxImageRenderedAtNativeSize,
} from '@/components/lightbox/lightbox-layout'
import { TweetEmbed } from '@/components/media/TweetEmbed'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { withTwitterOriginalJpg } from '@/lib/twitter-media-url'

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

export function BookmarksLightbox({
  docsById,
  selection,
  onClose,
  onBrowseSimilar,
}: BookmarksLightboxProps) {
  const tweet = selection ? docsById.get(selection.tweetId) : undefined
  const postedDate = tweet ? formatPostedDate(tweet.postedAt) : ''
  const [currentIndex, setCurrentIndex] = useState(selection?.mediaIndex ?? 0)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const tweetStageRef = useRef<HTMLDivElement | null>(null)
  const backdropPointerRef = useRef<{
    pointerId: number
    x: number
    y: number
    startedOnBackdrop: boolean
  } | null>(null)
  const [footerClearance, setFooterClearance] = useState(240)
  const [tweetStageBox, setTweetStageBox] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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

  useEffect(() => {
    const node = tweetStageRef.current
    if (!node || typeof window === 'undefined') {
      setTweetStageBox(null)
      return undefined
    }

    const measure = () => {
      const rect = node.getBoundingClientRect()
      const styles = window.getComputedStyle(node)
      const width =
        rect.width - Number.parseFloat(styles.paddingLeft) - Number.parseFloat(styles.paddingRight)
      const height =
        rect.height - Number.parseFloat(styles.paddingTop) - Number.parseFloat(styles.paddingBottom)

      setTweetStageBox({
        width: Math.max(0, Number(width.toFixed(2))),
        height: Math.max(0, Number(height.toFixed(2))),
      })
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [currentIndex, tweet?.id])

  const slides = useMemo(
    () =>
      (tweet?.media ?? []).map((media) =>
        media.type === 'photo'
          ? {
              src: withTwitterOriginalJpg(media.fullUrl),
              width: media.width,
              height: media.height,
              alt: tweet?.text ?? '',
            }
          : {
              type: 'tweet-embed' as const,
              tweetUrl: tweet?.url ?? '',
              poster: media.posterUrl,
              width: media.width,
              height: media.height,
            },
      ),
    [tweet?.media, tweet?.text, tweet?.url],
  )
  const currentSlide = slides[currentIndex]
  const showNavigation = slides.length > 1
  const showZoomButton =
    currentSlide?.type !== 'tweet-embed' &&
    currentSlide !== undefined &&
    isLightboxImageRenderedAtNativeSize(currentSlide, viewport)
  const measuredAvailableBox =
    currentSlide?.type === 'tweet-embed' && tweetStageBox && tweetStageBox.width > 0 && tweetStageBox.height > 0
      ? tweetStageBox
      : undefined

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
        slide: ({ slide }: { slide: TweetEmbedSlide | { type?: string } }) =>
          slide.type === 'tweet-embed' ? (
            <div
              ref={slide === currentSlide ? tweetStageRef : undefined}
              className="flex h-full w-full items-center justify-center px-4"
            >
              <div data-lightbox-media-content>
                <TweetEmbed
                  url={(slide as TweetEmbedSlide).tweetUrl}
                  availableBox={
                    measuredAvailableBox ??
                    getAvailableLightboxBox(slide as TweetEmbedSlide, viewport, {
                      footerClearance,
                    })
                  }
                  fallbackBox={getContainedBoxWithinBounds(
                    slide as TweetEmbedSlide,
                    measuredAvailableBox ??
                      getAvailableLightboxBox(slide as TweetEmbedSlide, viewport, {
                        footerClearance,
                      }),
                  )}
                  className="overflow-hidden"
                />
              </div>
            </div>
          ) : undefined,
        controls: () => (
          <div
            ref={controlsRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4"
          >
            <Card className="pointer-events-auto w-full max-w-3xl border border-[var(--app-lightbox-border)] bg-[var(--app-lightbox-surface)] text-[var(--foreground)] rounded-[var(--app-panel-radius)] ring-0 shadow-none">
              <CardContent className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-semibold text-foreground">
                      {tweet.authorName || 'Unknown author'}
                    </span>
                    {tweet.authorHandle ? (
                      <span className="text-muted-foreground">@{tweet.authorHandle}</span>
                    ) : null}
                    <span className="text-muted-foreground/60">&middot;</span>
                    <a
                      href={tweet.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {postedDate}
                    </a>
                  </div>
                  <p className="app-lightbox-copy text-foreground/90">{tweet.text}</p>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MessageCircleIcon className="size-4" />
                    <span>{formatCompactNumber(tweet.replies)}</span>
                    <span>replies</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Repeat2Icon className="size-4" />
                    <span>{formatCompactNumber(tweet.reposts)}</span>
                    <span>reposts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HeartIcon className="size-4" />
                    <span>{formatCompactNumber(tweet.likes)}</span>
                    <span>likes</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {tweet.folderNames.map((folderName) => (
                      <Badge key={folderName} variant="secondary">
                        {folderName}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-[var(--app-control-radius)] border-[var(--app-control-border)] bg-[var(--app-control-surface)] text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--app-control-surface)_88%,var(--foreground)_12%)]"
                    onClick={() => onBrowseSimilar(`${tweet.id}:${currentIndex}`)}
                  >
                    <SparklesIcon data-icon="inline-start" />
                    Similar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ),
        slideContainer: ({ slide, children }: { slide: { type?: string }; children: unknown }) => (
          <div
            className="box-border flex h-full w-full items-center justify-center"
            style={{
              paddingBottom:
                slide.type === 'tweet-embed'
                  ? `${footerClearance}px`
                  : getLightboxMediaPaddingBottom(slide),
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
