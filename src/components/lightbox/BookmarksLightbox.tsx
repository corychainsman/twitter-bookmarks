import { useEffect, useMemo, useState } from 'react'

import Lightbox from 'yet-another-react-lightbox'
import { Video, Zoom } from 'yet-another-react-lightbox/plugins'
import { HeartIcon, MessageCircleIcon, Repeat2Icon } from 'lucide-react'

import type { TweetDoc } from '@/features/bookmarks/model'
import { formatCompactNumber, formatPostedDate } from '@/lib/format'
import {
  getLightboxMediaPaddingBottom,
  isLightboxImageRenderedAtNativeSize,
} from '@/components/lightbox/lightbox-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

type LightboxSelection = {
  tweetId: string
  mediaIndex: number
}

type BookmarksLightboxProps = {
  docsById: Map<string, TweetDoc>
  selection: LightboxSelection | null
  onClose: () => void
}

export function BookmarksLightbox({
  docsById,
  selection,
  onClose,
}: BookmarksLightboxProps) {
  const tweet = selection ? docsById.get(selection.tweetId) : undefined
  const postedDate = tweet ? formatPostedDate(tweet.postedAt) : ''
  const [currentIndex, setCurrentIndex] = useState(selection?.mediaIndex ?? 0)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }))

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

  const slides = useMemo(
    () =>
      (tweet?.media ?? []).map((media) =>
        media.type === 'photo'
          ? {
              src: media.fullUrl,
              width: media.width,
              height: media.height,
              alt: tweet?.text ?? '',
            }
          : {
              type: 'video' as const,
              poster: media.posterUrl,
              width: media.width,
              height: media.height,
              autoPlay: true,
              controls: true,
              loop: media.type === 'animated_gif',
              muted: true,
              playsInline: true,
              sources: (media.variants ?? [{ url: media.fullUrl, contentType: 'video/mp4' }]).map(
                (variant) => ({
                  src: variant.url,
                  type: variant.contentType ?? 'video/mp4',
                }),
              ),
            },
      ),
    [tweet?.media, tweet?.text],
  )
  const currentSlide = slides[currentIndex]
  const showNavigation = slides.length > 1
  const showZoomButton =
    currentSlide !== undefined && isLightboxImageRenderedAtNativeSize(currentSlide, viewport)

  if (!selection || !tweet) {
    return null
  }

  return (
    <Lightbox
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
      plugins={[Video, Zoom]}
      video={{
        controls: true,
        muted: true,
        playsInline: true,
      }}
      on={{
        view: ({ index }) => setCurrentIndex(index),
      }}
      render={{
        ...(showNavigation
          ? {}
          : {
              buttonPrev: () => null,
              buttonNext: () => null,
            }),
        controls: () => (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-4">
            <Card className="app-lightbox-card pointer-events-auto w-full max-w-3xl shadow-2xl">
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

                <div className="flex flex-wrap gap-2">
                  {tweet.folderNames.map((folderName) => (
                    <Badge key={folderName} variant="secondary">
                      {folderName}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ),
        slideContainer: ({ slide, children }) => (
          <div
            className="box-border flex h-full w-full items-center justify-center"
            style={{ paddingBottom: getLightboxMediaPaddingBottom(slide) }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onClose()
              }
            }}
          >
            {children}
          </div>
        ),
        buttonZoom: ({ disabled, zoom, zoomIn, zoomOut, minZoom, maxZoom }) =>
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
