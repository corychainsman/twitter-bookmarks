import { useCallback, useEffect, useRef, useState } from 'react'

import type { MediaRequestState } from '@/features/bookmarks/media-delivery'
import {
  AUTOPLAY_OBSERVER_THRESHOLDS,
  candidateFromEntry,
  GRID_VIDEO_AUTOPLAY,
} from '@/components/media/autoplay'
import { usePageVisible } from '@/components/media/usePageVisible'

type GridVideoPreviewProps = {
  src: string
  poster?: string
  aspectRatio?: number
  width?: number
  height?: number
  gridId: string
  playbackEnabled?: boolean
  requestState: MediaRequestState
}

/**
 * Owns the complete grid-preview lifecycle: one-way source admission,
 * viewport playback eligibility, visibility recovery, and looping fallback.
 */
export function GridVideoPreview({
  src,
  poster,
  aspectRatio,
  width,
  height,
  gridId,
  playbackEnabled = true,
  requestState,
}: GridVideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pageVisible = usePageVisible()
  const pageVisibleRef = useRef(pageVisible)
  const shouldPlayRef = useRef(false)
  const sourceIsAdmitted = requestState !== 'deferred'
  const [hasAttachedSrc, setHasAttachedSrc] = useState(sourceIsAdmitted)
  const hasAttachedSrcRef = useRef(hasAttachedSrc)
  const playbackEnabledRef = useRef(playbackEnabled)
  const recoveryFrameRef = useRef<number | null>(null)
  const recoveryAttemptedRef = useRef(false)

  if (sourceIsAdmitted && !hasAttachedSrc) {
    setHasAttachedSrc(true)
  }

  const synchronizePlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const shouldBePlaying =
      playbackEnabledRef.current &&
      shouldPlayRef.current &&
      hasAttachedSrcRef.current &&
      pageVisibleRef.current

    if (shouldBePlaying) {
      if (video.paused) {
        void video.play()?.catch(() => {})
      }
    } else if (!video.paused) {
      video.pause()
    }
  }, [])

  const schedulePlaybackRecovery = useCallback(() => {
    if (
      recoveryAttemptedRef.current ||
      !playbackEnabledRef.current ||
      !shouldPlayRef.current ||
      !hasAttachedSrcRef.current ||
      !pageVisibleRef.current
    ) return

    recoveryAttemptedRef.current = true

    if (recoveryFrameRef.current !== null) {
      window.cancelAnimationFrame(recoveryFrameRef.current)
    }
    recoveryFrameRef.current = window.requestAnimationFrame(() => {
      recoveryFrameRef.current = null
      synchronizePlayback()
    })
  }, [synchronizePlayback])

  useEffect(() => {
    hasAttachedSrcRef.current = hasAttachedSrc
    synchronizePlayback()
  }, [hasAttachedSrc, synchronizePlayback])

  useEffect(() => {
    playbackEnabledRef.current = playbackEnabled
    recoveryAttemptedRef.current = false
    synchronizePlayback()
  }, [playbackEnabled, synchronizePlayback])

  useEffect(() => {
    pageVisibleRef.current = pageVisible
    recoveryAttemptedRef.current = false
    synchronizePlayback()
  }, [pageVisible, synchronizePlayback])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !hasAttachedSrc) return undefined

    if (typeof IntersectionObserver === 'undefined') {
      shouldPlayRef.current = true
      synchronizePlayback()
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const next = candidateFromEntry(
            gridId,
            entry,
            shouldPlayRef.current,
          ).isActiveBand
          if (next !== shouldPlayRef.current) {
            recoveryAttemptedRef.current = false
          }
          shouldPlayRef.current = next
          synchronizePlayback()
        }
      },
      {
        threshold: AUTOPLAY_OBSERVER_THRESHOLDS,
        rootMargin: GRID_VIDEO_AUTOPLAY.rootMargin,
      },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [gridId, hasAttachedSrc, synchronizePlayback])

  useEffect(() => () => {
    if (recoveryFrameRef.current !== null) {
      window.cancelAnimationFrame(recoveryFrameRef.current)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      src={hasAttachedSrc ? src : undefined}
      poster={hasAttachedSrc ? poster : undefined}
      muted
      loop
      playsInline
      preload={hasAttachedSrc ? 'metadata' : 'none'}
      width={width}
      height={height}
      style={aspectRatio ? { aspectRatio } : undefined}
      onCanPlay={synchronizePlayback}
      onEnded={(event) => {
        event.currentTarget.currentTime = 0
        synchronizePlayback()
      }}
      onPause={schedulePlaybackRecovery}
      className="app-media-image relative block h-auto w-full"
    />
  )
}
