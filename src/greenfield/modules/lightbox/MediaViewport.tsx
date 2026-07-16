import { useGesture } from "@use-gesture/react"
import { motion, useMotionValue, useReducedMotion } from "motion/react"
import { useCallback, useRef, useState } from "react"

import type { MediaAsset } from "@/greenfield/contracts/domain"

interface MediaViewportProps {
  media: MediaAsset
  sharedElement?: boolean
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export function MediaViewport({
  media,
  sharedElement = false,
  onClose,
  onPrevious,
  onNext,
}: MediaViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const reduceMotion = useReducedMotion()
  const [zoomed, setZoomed] = useState(false)
  const [videoControlsVisible, setVideoControlsVisible] = useState(false)

  const reset = useCallback(() => {
    scale.set(1)
    x.set(0)
    y.set(0)
    setZoomed(false)
  }, [scale, x, y])

  const zoomAt = useCallback((nextScale: number, clientX: number, clientY: number) => {
    const previousScale = scale.get()
    const value = clamp(nextScale, 1, 5)
    const container = containerRef.current

    if (container && previousScale > 0 && value > 1) {
      const rect = container.getBoundingClientRect()
      const focusX = clientX - (rect.left + rect.width / 2)
      const focusY = clientY - (rect.top + rect.height / 2)
      const ratio = value / previousScale
      x.set(focusX - (focusX - x.get()) * ratio)
      y.set(focusY - (focusY - y.get()) * ratio)
    }

    scale.set(value)
    setZoomed(value > 1.01)
    if (value === 1) {
      x.set(0)
      y.set(0)
    }
  }, [scale, x, y])

  useGesture(
    {
      onPinch: ({ offset: [nextScale], origin: [clientX, clientY] }) => {
        zoomAt(nextScale, clientX, clientY)
      },
      onWheel: ({ event, delta: [, deltaY] }) => {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        zoomAt(scale.get() - deltaY * 0.006, event.clientX, event.clientY)
      },
      onDrag: ({
        offset: [offsetX, offsetY],
        movement: [mx, my],
        last,
        velocity: [vx, vy],
      }) => {
        if (scale.get() > 1.01) {
          x.set(offsetX)
          y.set(offsetY)
          return
        }

        if (!last) return
        if (Math.abs(mx) > Math.abs(my) && (Math.abs(mx) > 72 || vx > 0.55)) {
          if (mx > 0) onPrevious()
          else onNext()
          return
        }

        if (my > 88 || (my > 0 && vy > 0.65)) onClose()
      },
    },
    {
      drag: { from: () => [x.get(), y.get()], filterTaps: true },
      pinch: {
        from: () => [scale.get(), 0],
        scaleBounds: { min: 1, max: 5 },
        pinchOnWheel: false,
      },
      eventOptions: { passive: false },
      target: containerRef,
    },
  )

  const largest = media.lightbox.at(-1) ?? media.wall.at(-1)

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden bg-black/35"
      onDoubleClick={reset}
    >
      <motion.div
        layoutId={sharedElement ? `media-${media.id}` : undefined}
        className="flex size-full items-center justify-center"
        style={{ scale, x, y }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.08, duration: 0.42 }}
      >
        {media.kind === "video" && media.previewVideoUrl ? (
          <video
            aria-label={media.title}
            aria-description="Press Enter or Space to show video controls"
            autoPlay
            className="max-h-full max-w-full object-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            controls={videoControlsVisible}
            loop
            muted
            onBlur={() => setVideoControlsVisible(false)}
            onKeyDown={(event) => {
              if (!videoControlsVisible && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault()
                setVideoControlsVisible(true)
              }
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setVideoControlsVisible(true)
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setVideoControlsVisible(false)
            }}
            onPointerUp={(event) => {
              if (event.pointerType !== "mouse") {
                setVideoControlsVisible((visible) => !visible)
              }
            }}
            playsInline
            poster={media.poster?.url}
            src={media.previewVideoUrl}
            tabIndex={0}
          />
        ) : (
          <picture>
            <img
              alt={media.title}
              className="max-h-[calc(100dvh-5rem)] max-w-full select-none object-contain"
              draggable={false}
              height={media.height}
              sizes="(min-width: 1024px) calc(100vw - 22rem), 100vw"
              src={largest?.url}
              srcSet={media.lightbox.map((candidate) => `${candidate.url} ${candidate.width}w`).join(", ")}
              width={media.width}
            />
          </picture>
        )}
      </motion.div>
      {zoomed && (
        <button
          type="button"
          className="absolute bottom-4 rounded-full bg-black/65 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={reset}
        >
          Reset zoom
        </button>
      )}
    </div>
  )
}
