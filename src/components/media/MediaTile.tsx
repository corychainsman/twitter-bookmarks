import * as React from 'react'

import type { GridItem, TweetDoc } from '@/features/bookmarks/model'
import { formatPostedDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import {
  AUTOPLAY_ROOT_MARGIN,
  AUTOPLAY_THRESHOLD,
  candidateFromEntry,
  getAutoplayCoordinator,
} from '@/components/media/autoplay'

type MediaTileProps = {
  item: GridItem
  tweet: TweetDoc | undefined
  immersive: boolean
  onOpen: () => void
}

function useAutoplayState(autoplayId: string, enabled: boolean) {
  const ref = React.useRef<HTMLVideoElement | null>(null)
  const [autoplayFailed, setAutoplayFailed] = React.useState(false)
  const [shouldPlay, setShouldPlay] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node || !enabled) {
      setShouldPlay(false)
      return
    }

    const coordinator = getAutoplayCoordinator()
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) {
          return
        }

        coordinator.update(candidateFromEntry(autoplayId, entry))
      },
      {
        rootMargin: AUTOPLAY_ROOT_MARGIN,
        threshold: [0, AUTOPLAY_THRESHOLD, 0.75],
      },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
      coordinator.remove(autoplayId)
      node.pause()
    }
  }, [autoplayId, enabled])

  React.useEffect(() => {
    if (!enabled) {
      return
    }

    return getAutoplayCoordinator().subscribe(autoplayId, setShouldPlay)
  }, [autoplayId, enabled])

  React.useEffect(() => {
    const node = ref.current
    if (!node || !enabled) {
      return
    }

    if (!shouldPlay) {
      node.pause()
      return
    }

    void node.play()
      .then(() => {
        setAutoplayFailed(false)
      })
      .catch(() => {
        setAutoplayFailed(true)
      })
  }, [enabled, shouldPlay])

  return { ref, autoplayFailed }
}

export function MediaTile({ item, tweet, immersive, onOpen }: MediaTileProps) {
  const isMotion = item.mediaType === 'video' || item.mediaType === 'animated_gif'
  const { ref, autoplayFailed } = useAutoplayState(item.gridId, isMotion)

  return (
    <article className="app-tile group transition-transform duration-300 hover:-translate-y-0.5">
      <button
        type="button"
        className="block w-full cursor-pointer text-left"
        onClick={onOpen}
      >
        <div className="relative overflow-hidden bg-black">
          {isMotion ? (
            <>
              <video
                ref={ref}
                className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
                muted
                loop
                playsInline
                preload="metadata"
                poster={item.posterUrl}
              >
                <source src={item.fullUrl} type="video/mp4" />
              </video>
              {autoplayFailed && !immersive ? (
                <div className="absolute inset-x-3 bottom-3 rounded-md bg-black/70 px-3 py-2 text-xs text-white">
                  Autoplay was blocked. Open the lightbox to control playback.
                </div>
              ) : null}
            </>
          ) : (
            <img
              src={item.thumbUrl}
              alt={tweet?.text || 'Bookmarked media'}
              loading="lazy"
              className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
            />
          )}

          {!immersive ? (
            <div className="app-media-scrim pointer-events-none absolute inset-x-0 bottom-0 p-3">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="secondary"
                  className="app-media-badge border text-[10px] font-medium tracking-[0.2em] uppercase"
                >
                  {item.mediaType.replace('_', ' ')}
                </Badge>
                {tweet?.authorHandle ? (
                  <span className="text-[11px] font-medium text-white/80">@{tweet.authorHandle}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {!immersive ? (
          <div className="flex flex-col gap-2.5 px-3 pb-3 pt-2.5">
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
