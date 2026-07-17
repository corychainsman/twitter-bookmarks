import { Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { shouldPlayForVisibility } from "./autoplay-policy"
import { useAutoplayPreferences } from "./use-autoplay-preferences"

interface VideoPreviewProps {
  src: string
  poster?: string
  label: string
  className?: string
  preloadMargin?: string
}

export function VideoPreview({
  src,
  poster,
  label,
  className,
  preloadMargin = "100% 0px",
}: VideoPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameCallbackRef = useRef<number | undefined>(undefined)
  const [sourceAdmitted, setSourceAdmitted] = useState(false)
  const [ambientPlaying, setAmbientPlaying] = useState(false)
  const [hoverPlaying, setHoverPlaying] = useState(false)
  const [presentedSrc, setPresentedSrc] = useState<string | undefined>()
  const { ambientAllowed } = useAutoplayPreferences()
  const shouldPlay = ambientAllowed ? ambientPlaying : hoverPlaying
  const hasPresentedFrame = presentedSrc === src

  useEffect(() => () => {
    const video = videoRef.current

    if (video && frameCallbackRef.current !== undefined) {
      video.cancelVideoFrameCallback?.(frameCallbackRef.current)
    }
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setSourceAdmitted((admitted) => admitted || entry.isIntersecting)
      },
      { rootMargin: preloadMargin, threshold: 0 },
    )

    observer.observe(root)
    return () => observer.disconnect()
  }, [preloadMargin])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        setAmbientPlaying((current) =>
          shouldPlayForVisibility(entry.intersectionRatio, current),
        )
      },
      { threshold: [0, 0.05, 0.1, 1] },
    )

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (shouldPlay) {
      void video.play().catch(() => {
        setAmbientPlaying(false)
        setHoverPlaying(false)
      })
    }
    else video.pause()
  }, [shouldPlay, sourceAdmitted])

  const revealPresentedFrame = () => {
    const video = videoRef.current

    if (!video || hasPresentedFrame) return

    if (video.requestVideoFrameCallback) {
      frameCallbackRef.current = video.requestVideoFrameCallback(() => {
        frameCallbackRef.current = undefined
        setPresentedSrc(src)
      })
      return
    }

    requestAnimationFrame(() => setPresentedSrc(src))
  }

  return (
    <div
      ref={rootRef}
      className={className}
      onPointerEnter={() => {
        if (!ambientAllowed && window.matchMedia("(hover: hover)").matches) {
          setSourceAdmitted(true)
          setHoverPlaying(true)
        }
      }}
      onPointerLeave={() => {
        setHoverPlaying(false)
      }}
    >
      <video
        ref={videoRef}
        aria-label={label}
        className="size-full object-contain"
        data-grid-skip=""
        loop
        muted
        onPlaying={revealPresentedFrame}
        playsInline
        poster={poster}
        preload={sourceAdmitted ? "auto" : "none"}
        src={sourceAdmitted ? src : undefined}
      />
      {poster && !hasPresentedFrame && (
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 size-full select-none object-contain"
          decoding="sync"
          draggable={false}
          src={poster}
        />
      )}
      {!ambientAllowed && (
        <div className="pointer-events-none absolute end-2 top-2 z-20 rounded-full bg-black/65 p-2 text-white ring-1 ring-white/10">
          <Play className="size-4 shrink-0 fill-current stroke-current" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
