import { memo, type CSSProperties, type MouseEventHandler, useEffect, useRef, useState } from 'react'

import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { formatPostedDate } from '@/lib/format'
import { captureMediaHandoff } from '@/lib/media-handoff'
import { thumbhashToDataUrl } from '@/lib/thumbhash-placeholder'
import {
  resolveGridMediaDelivery,
  type MediaRequestState,
} from '@/features/bookmarks/media-delivery'
import { Badge } from '@/components/ui/badge'
import {
  candidateFromEntry,
  AUTOPLAY_ROOT_MARGIN,
  AUTOPLAY_THRESHOLD,
} from '@/components/media/autoplay'

const MEDIA_TYPE_LABEL = { animated_gif: 'animated gif', photo: 'photo', video: 'video' }
const aspectRatioStyleCache = new WeakMap<GridItem, CSSProperties | null>()
const postedDateCache = new WeakMap<TweetDoc, string>()

type MediaTileProps = {
  item: GridItem
  tweet: TweetDoc | undefined
  immersive: boolean
  requestState?: MediaRequestState
  imageDevicePixelRatio?: number
  imageRenderedWidth?: number
  imageSizes?: string
  onOpen: MouseEventHandler<HTMLButtonElement>
}

type VideoGridTileProps = {
  src: string
  poster?: string
  aspectRatio?: number
  width?: number
  height?: number
  gridId: string
  requestState: MediaRequestState
}

function VideoGridTile({
  src,
  poster,
  aspectRatio,
  width,
  height,
  gridId,
  requestState,
}: VideoGridTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [shouldPlay, setShouldPlay] = useState(false)
  const canAttachSrc = requestState !== 'deferred'

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setShouldPlay(candidateFromEntry(gridId, entry).isActiveBand)
        }
      },
      { threshold: [0, AUTOPLAY_THRESHOLD, 1], rootMargin: AUTOPLAY_ROOT_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [gridId])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (shouldPlay && canAttachSrc) {
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [canAttachSrc, shouldPlay])

  return (
    <video
      ref={videoRef}
      src={canAttachSrc ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload={canAttachSrc ? 'metadata' : 'none'}
      width={width}
      height={height}
      style={aspectRatio ? { aspectRatio } : undefined}
      className="app-media-image relative block h-auto w-full"
    />
  )
}

export const MediaTile = memo(function MediaTile({
  item,
  tweet,
  immersive,
  requestState = 'admitted',
  imageDevicePixelRatio,
  imageRenderedWidth,
  imageSizes,
  onOpen,
}: MediaTileProps) {
  const initialMedia = requestState === 'initial'
  // Images always expose their concrete R2 original and srcset to the browser.
  // Native lazy loading owns request admission; requestState remains relevant
  // only to video source attachment and the small first-paint priority set.
  const shouldAttachImageSrc = true
  const loading = initialMedia ? 'eager' : 'lazy'
  const fetchPriority = initialMedia ? 'high' : 'auto'
  let aspectRatioStyle = aspectRatioStyleCache.get(item)
  if (aspectRatioStyle === undefined) {
    const aspectRatio =
      item.aspectRatio ??
      (item.width && item.height && item.width > 0 && item.height > 0
        ? item.width / item.height
        : undefined)
    aspectRatioStyle = aspectRatio ? { aspectRatio } : null
    aspectRatioStyleCache.set(item, aspectRatioStyle)
  }
  const aspectRatio = aspectRatioStyle?.aspectRatio as number | undefined
  const delivery = resolveGridMediaDelivery(item, {
    devicePixelRatio: imageDevicePixelRatio,
    renderedWidth: imageRenderedWidth,
    sizes: imageSizes,
  })
  let postedDate = 'Unknown date'
  if (!immersive && tweet) {
    postedDate = postedDateCache.get(tweet) ?? ''
    if (!postedDate) {
      postedDate = formatPostedDate(tweet.postedAt)
      postedDateCache.set(tweet, postedDate)
    }
  }
  const placeholderUrl = thumbhashToDataUrl(item.thumbhash)
  const mediaRef = useRef<HTMLDivElement>(null)
  const [failedOptimizedGridId, setFailedOptimizedGridId] = useState<string | null>(null)
  const useImageFallback = failedOptimizedGridId === item.gridId

  const handleOpen: MouseEventHandler<HTMLButtonElement> = (event) => {
    captureMediaHandoff(item.gridId, mediaRef.current?.querySelector('video, img') ?? null)
    onOpen(event)
  }

  return (
    <article className="app-tile group">
      <button
        type="button"
        className="app-tile-button cursor-pointer text-left"
        data-grid-id={item.gridId}
        onClick={handleOpen}
      >
        <div ref={mediaRef} className="relative overflow-hidden bg-black">
          {placeholderUrl ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `url(${placeholderUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : null}
          {delivery.isMotion ? (
            <VideoGridTile
              src={delivery.previewUrl ?? item.fullUrl}
              poster={delivery.image.src}
              aspectRatio={aspectRatio}
              width={item.width}
              height={item.height}
              gridId={item.gridId}
              requestState={requestState}
            />
          ) : delivery.renderOptimizedPicture && !useImageFallback ? (
            <picture>
              {shouldAttachImageSrc ? (
                <source
                  type="image/avif"
                  srcSet={delivery.image.srcSet ?? delivery.image.src}
                  sizes={delivery.image.sizes}
                />
              ) : null}
              <img
                src={shouldAttachImageSrc ? delivery.fallback?.src : undefined}
                srcSet={shouldAttachImageSrc ? delivery.fallback?.srcSet : undefined}
                sizes={shouldAttachImageSrc ? delivery.fallback?.sizes : undefined}
                alt={tweet?.text || 'Bookmarked media'}
                decoding="async"
                fetchPriority={fetchPriority}
                loading={loading}
                data-initial-media={initialMedia ? 'true' : undefined}
                width={item.width}
                height={item.height}
                style={aspectRatioStyle ?? undefined}
                className="app-media-image relative block h-auto w-full"
                onError={() => setFailedOptimizedGridId(item.gridId)}
              />
            </picture>
          ) : (
            <img
              src={
                shouldAttachImageSrc
                  ? useImageFallback
                    ? delivery.fallback?.src ?? delivery.image.src
                    : delivery.image.src
                  : undefined
              }
              srcSet={
                shouldAttachImageSrc && !useImageFallback ? delivery.image.srcSet : undefined
              }
              sizes={
                shouldAttachImageSrc && !useImageFallback ? delivery.image.sizes : undefined
              }
              alt={tweet?.text || 'Bookmarked media'}
              decoding="async"
              fetchPriority={fetchPriority}
              loading={loading}
              data-initial-media={initialMedia ? 'true' : undefined}
              width={item.width}
              height={item.height}
              style={aspectRatioStyle ?? undefined}
              className="app-media-image relative block h-auto w-full"
            />
          )}

          {!immersive ? (
            <div className="app-media-scrim pointer-events-none absolute inset-x-0 bottom-0 p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="secondary"
                  className="rounded-[var(--app-control-radius)] border border-[var(--app-media-badge-border)] bg-[var(--app-media-badge-surface)] text-[0.625rem] font-medium tracking-[0.2em] text-[var(--foreground)] uppercase"
                >
                  {MEDIA_TYPE_LABEL[item.mediaType]}
                </Badge>
                {tweet?.authorHandle ? (
                  <span className="text-[0.6875rem] font-medium text-white/80">@{tweet.authorHandle}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {!immersive ? (
          <div className="flex flex-col gap-2.5 px-3 pt-2.5 pb-3">
            <p className="app-tile-copy line-clamp-3">
              {tweet?.text || 'Loading tweet details…'}
            </p>
            <div className="app-tile-meta flex items-center justify-between gap-3">
              <span>{postedDate}</span>
              <span>{tweet?.folderNames[0] || 'Unfoldered'}</span>
            </div>
          </div>
        ) : null}
      </button>
    </article>
  )
})
