import * as React from 'react'

type InitialMediaReadyOptions = {
  containerElement: HTMLElement | null
  enabled: boolean
  onReady?: () => void
}

export function useInitialMediaReady({
  containerElement,
  enabled,
  onReady,
}: InitialMediaReadyOptions): boolean {
  const hasReportedRef = React.useRef(false)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (hasReportedRef.current || !containerElement || !enabled) {
      return undefined
    }

    let frameId = 0
    const cleanupCallbacks: Array<() => void> = []

    const reportReady = () => {
      if (hasReportedRef.current) return
      hasReportedRef.current = true
      setReady(true)
      onReady?.()
    }

    frameId = window.requestAnimationFrame(() => {
      const images = containerElement.querySelectorAll<HTMLImageElement>(
        'img[data-initial-media="true"]',
      )
      let remaining = 0

      for (const image of images) {
        if (!image.complete) remaining += 1
      }

      if (images.length === 0 || remaining === 0) {
        reportReady()
        return
      }

      const handleSettled = () => {
        remaining -= 1
        if (remaining <= 0) reportReady()
      }

      for (const image of images) {
        if (image.complete) continue
        image.addEventListener('load', handleSettled, { once: true })
        image.addEventListener('error', handleSettled, { once: true })
        cleanupCallbacks.push(() => {
          image.removeEventListener('load', handleSettled)
          image.removeEventListener('error', handleSettled)
        })
      }
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      cleanupCallbacks.forEach((cleanup) => cleanup())
    }
  }, [containerElement, enabled, onReady])

  return ready
}
