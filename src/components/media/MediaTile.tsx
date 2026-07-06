import { memo, type CSSProperties, type MouseEventHandler, useEffect, useRef, useState } from 'react'

import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { formatPostedDate } from '@/lib/format'
import { captureMediaHandoff } from '@/lib/media-handoff'
import { thumbhashToDataUrl } from '@/lib/thumbhash-placeholder'
import {
  isMirroredImageUrl,
  resolveMirroredImageFallbackSourceSet,
  resolveTwitterImageSourceSet,
  type TwitterImageSourceSet,
} from '@/lib/twitter-media-url'
import { Badge } from '@/components/ui/badge'
import {
  candidateFromEntry,
  AUTOPLAY_ROOT_MARGIN,
  AUTOPLAY_THRESHOLD,
} from '@/components/media/autoplay'

const MEDIA_TYPE_LABEL = { animated_gif: 'animated gif', photo: 'photo', video: 'video' }
const IMAGE_SRC_ATTACH_DELAY_MS = 12_000
const IMAGE_SRC_ATTACH_ROOT_MARGIN = '900px 0px'
const aspectRatioStyleCache = new WeakMap<GridItem, CSSProperties | null>()
const postedDateCache = new WeakMap<TweetDoc, string>()
const imageSourcesCache = new WeakMap<
  GridItem,
  { sourceUrl: string; byKey: Map<number | string, TwitterImageSourceSet> }
>()

type MediaTileProps = {
  item: GridItem
  tweet: TweetDoc | undefined
  immersive: boolean
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
  initialMedia?: boolean
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
  initialMedia: boolean
}

function VideoGridTile({
  src,
  poster,
  aspectRatio,
  width,
  height,
  gridId,
  initialMedia,
}: VideoGridTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [shouldPlay, setShouldPlay] = useState(false)
  const [isPrewarmed, setIsPrewarmed] = useState(false)
  const canAttachSrc = initialMedia || shouldPlay || isPrewarmed

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
  }, [gridId, initialMedia])

  // Attach the src (preload="metadata") well before the tile reaches the active-play
  // band, so the connection + faststart moov atom are already fetched by the time
  // autoplay actually needs to start — same lookahead distance images use.
  useEffect(() => {
    if (initialMedia) return undefined
    const el = videoRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsPrewarmed(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsPrewarmed(true)
          observer.disconnect()
        }
      },
      { rootMargin: IMAGE_SRC_ATTACH_ROOT_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [initialMedia])

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
  loading = 'lazy',
  fetchPriority = 'auto',
  initialMedia = false,
  imageDevicePixelRatio,
  imageRenderedWidth,
  imageSizes,
  onOpen,
}: MediaTileProps) {
  const isMotion = item.mediaType === 'video' || item.mediaType === 'animated_gif'
  const previewUrl = item.posterUrl ?? item.thumbUrl
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
  const imageSourcesKey =
    imageDevicePixelRatio === 1 && imageRenderedWidth && imageSizes === `${imageRenderedWidth}px`
      ? imageRenderedWidth
      : `${imageDevicePixelRatio ?? ''}|${imageRenderedWidth ?? ''}|${imageSizes ?? ''}`
  const imageSourcesRecord = imageSourcesCache.get(item) ?? (imageSourcesCache.set(item, {
    sourceUrl: isMotion ? previewUrl : item.thumbUrl,
    byKey: new Map(),
  }), imageSourcesCache.get(item)!)
  const imageSourceUrl = imageSourcesRecord.sourceUrl
  let imageSources = imageSourcesRecord.byKey.get(imageSourcesKey)
  if (!imageSources) {
    imageSources = resolveTwitterImageSourceSet(imageSourceUrl, {
      devicePixelRatio: imageDevicePixelRatio,
      renderedWidth: imageRenderedWidth,
      sizes: imageSizes,
    })
    imageSourcesRecord.byKey.set(imageSourcesKey, imageSources)
  }
  const mirroredFallbackSources = isMirroredImageUrl(imageSourceUrl)
    ? resolveMirroredImageFallbackSourceSet(imageSourceUrl, {
        devicePixelRatio: imageDevicePixelRatio,
        renderedWidth: imageRenderedWidth,
        sizes: imageSizes,
      })
    : null
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
  const [deferredImageSrcReady, setDeferredImageSrcReady] = useState(false)
  const shouldAttachImageSrc = initialMedia || loading === 'eager' || deferredImageSrcReady
  const shouldRenderAvifPicture = isMirroredImageUrl(imageSourceUrl)

  useEffect(() => {
    if (initialMedia || loading === 'eager') {
      return undefined
    }

    const element = mediaRef.current

    if (!element || typeof IntersectionObserver === 'undefined') {
      setDeferredImageSrcReady(true)
      return undefined
    }

    const timeoutId = window.setTimeout(() => setDeferredImageSrcReady(true), IMAGE_SRC_ATTACH_DELAY_MS)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDeferredImageSrcReady(true)
          window.clearTimeout(timeoutId)
          observer.disconnect()
        }
      },
      { rootMargin: IMAGE_SRC_ATTACH_ROOT_MARGIN },
    )
    observer.observe(element)

    return () => {
      window.clearTimeout(timeoutId)
      observer.disconnect()
    }
  }, [initialMedia, loading])

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
          {isMotion ? (
            <VideoGridTile
              src={item.previewUrl ?? item.fullUrl}
              poster={imageSources.src}
              aspectRatio={aspectRatio}
              width={item.width}
              height={item.height}
              gridId={item.gridId}
              initialMedia={initialMedia}
            />
          ) : shouldRenderAvifPicture ? (
            <picture>
              {shouldAttachImageSrc ? (
                <source
                  type="image/avif"
                  srcSet={imageSources.srcSet ?? imageSources.src}
                  sizes={imageSources.sizes}
                />
              ) : null}
              <img
                src={shouldAttachImageSrc ? mirroredFallbackSources?.src : undefined}
                srcSet={shouldAttachImageSrc ? mirroredFallbackSources?.srcSet : undefined}
                sizes={shouldAttachImageSrc ? mirroredFallbackSources?.sizes : undefined}
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
            </picture>
          ) : (
            <img
              src={shouldAttachImageSrc ? imageSources.src : undefined}
              srcSet={shouldAttachImageSrc ? imageSources.srcSet : undefined}
              sizes={shouldAttachImageSrc ? imageSources.sizes : undefined}
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
