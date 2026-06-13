import { useEffect, useRef, useState } from 'react'

import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { formatPostedDate } from '@/lib/format'
import { thumbhashToDataUrl } from '@/lib/thumbhash-placeholder'
import { resolveTwitterImageSourceSet } from '@/lib/twitter-media-url'
import { Badge } from '@/components/ui/badge'
import {
  candidateFromEntry,
  AUTOPLAY_ROOT_MARGIN,
  AUTOPLAY_THRESHOLD,
} from '@/components/media/autoplay'

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
  onOpen: () => void
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

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
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
    if (shouldPlay) {
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [shouldPlay])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload={initialMedia ? 'metadata' : 'none'}
      width={width}
      height={height}
      style={aspectRatio ? { aspectRatio } : undefined}
      className="app-media-image relative block h-auto w-full"
    />
  )
}

export function MediaTile({
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
  const aspectRatio =
    item.aspectRatio ??
    (item.width && item.height && item.width > 0 && item.height > 0
      ? item.width / item.height
      : undefined)
  const imageSources = resolveTwitterImageSourceSet(isMotion ? previewUrl : item.thumbUrl, {
    devicePixelRatio: imageDevicePixelRatio,
    renderedWidth: imageRenderedWidth,
    sizes: imageSizes,
  })
  const placeholderUrl = thumbhashToDataUrl(item.thumbhash)

  return (
    <article className="app-tile group">
      <button
        type="button"
        className="app-tile-button cursor-pointer text-left"
        onClick={onOpen}
      >
        <div className="relative overflow-hidden bg-black">
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
          ) : (
            <img
              src={imageSources.src}
              srcSet={imageSources.srcSet}
              sizes={imageSources.sizes}
              alt={tweet?.text || 'Bookmarked media'}
              decoding="async"
              fetchPriority={fetchPriority}
              loading={loading}
              data-initial-media={initialMedia ? 'true' : undefined}
              width={item.width}
              height={item.height}
              style={aspectRatio ? { aspectRatio } : undefined}
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
                  {item.mediaType.replace('_', ' ')}
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
              <span>{formatPostedDate(tweet?.postedAt)}</span>
              <span>{tweet?.folderNames[0] || 'Unfoldered'}</span>
            </div>
          </div>
        ) : null}
      </button>
    </article>
  )
}
