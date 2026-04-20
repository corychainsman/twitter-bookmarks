import * as React from 'react'

import { ensureTwitterWidgets } from '@/lib/twitter-widgets'

type TweetEmbedProps = {
  url: string
  availableBox: {
    width: number
    height: number
  }
  fallbackBox: {
    width: number
    height: number
  }
  className?: string
}

const TWEET_EMBED_FIT_CONFIG = {
  growthThreshold: 0.03,
  overflowTolerancePx: 0,
  shrinkSafetyWidthPx: 22,
  shrinkSafetyHeightPx: 1,
  maxAttempts: 5,
}

const TWEET_EMBED_SETTLE_DELAY_MS = 120
const TWEET_EMBED_TIMEOUT_MS = 10000

function toTwitterUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'x.com' || parsed.hostname === 'www.x.com') {
      parsed.hostname = 'twitter.com'
    }
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url.replace('https://x.com/', 'https://twitter.com/')
  }
}

function clampRenderWidth(width: number): number {
  return Math.max(1, Math.min(1920, Math.floor(width)))
}

function getInitialRenderWidth(availableWidth: number, fallbackWidth: number): number {
  const preferredWidth =
    Number.isFinite(availableWidth) && availableWidth > 0 ? availableWidth : fallbackWidth
  return clampRenderWidth(preferredWidth)
}

export function TweetEmbed({ url, availableBox, fallbackBox, className }: TweetEmbedProps) {
  const tweetUrl = React.useMemo(() => toTwitterUrl(url), [url])
  const initialWidth = React.useMemo(
    () => getInitialRenderWidth(availableBox.width, fallbackBox.width),
    [availableBox.width, fallbackBox.width],
  )
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const [resolvedWidth, setResolvedWidth] = React.useState(initialWidth)

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    let cancelled = false
    const activeObservers: ResizeObserver[] = []
    const activeTimeouts: number[] = []

    const cleanup = () => {
      activeObservers.forEach((observer) => observer.disconnect())
      activeTimeouts.forEach((timeout) => window.clearTimeout(timeout))
      activeObservers.length = 0
      activeTimeouts.length = 0
    }

    const waitForTargetAndSettle = (): Promise<{ width: number; height: number }> =>
      new Promise((resolve, reject) => {
        const measureElement = (element: Element) => {
          if (!(element instanceof HTMLElement)) {
            return null
          }

          const rect = element.getBoundingClientRect()
          const nextWidth = Number(rect.width.toFixed(2))
          const nextHeight = Number(rect.height.toFixed(2))
          if (nextWidth <= 0 || nextHeight <= 0) {
            return null
          }

          return { width: nextWidth, height: nextHeight }
        }

        const attachSettler = (element: Element) => {
          let lastBox: { width: number; height: number } | null = null
          let settleTimeout: number | null = null

          const finalize = () => {
            if (!lastBox) {
              reject(new Error('Twitter embed never produced a measurable size'))
              return
            }

            resolve(lastBox)
          }

          const scheduleFinalize = () => {
            if (settleTimeout !== null) {
              window.clearTimeout(settleTimeout)
            }

            settleTimeout = window.setTimeout(finalize, TWEET_EMBED_SETTLE_DELAY_MS)
            activeTimeouts.push(settleTimeout)
          }

          const measure = () => {
            const nextBox = measureElement(element)
            if (!nextBox) {
              return
            }

            lastBox = nextBox
            scheduleFinalize()
          }

          measure()

          if (typeof ResizeObserver === 'undefined') {
            scheduleFinalize()
            return
          }

          const resizeObserver = new ResizeObserver(() => {
            measure()
          })
          resizeObserver.observe(element)
          activeObservers.push(resizeObserver)
        }

        const mutationObserver = new MutationObserver(() => {
          const target = host.querySelector('twitter-widget, iframe')
          if (!target) {
            return
          }

          mutationObserver.disconnect()
          attachSettler(target)
        })

        const timeout = window.setTimeout(() => {
          mutationObserver.disconnect()
          reject(new Error('Twitter embed timed out'))
        }, TWEET_EMBED_TIMEOUT_MS)
        activeTimeouts.push(timeout)

        mutationObserver.observe(host, { childList: true, subtree: true })

        const target = host.querySelector('twitter-widget, iframe')
        if (target) {
          mutationObserver.disconnect()
          attachSettler(target)
        }
      })

    const renderAttempt = async (width: number, attempt: number): Promise<void> => {
      if (cancelled) {
        return
      }

      const normalizedWidth = clampRenderWidth(width)
      host.innerHTML = ''

      const blockquote = document.createElement('blockquote')
      blockquote.className = 'twitter-tweet m-0'
      blockquote.setAttribute('data-media-max-width', String(normalizedWidth))
      blockquote.setAttribute('data-dnt', 'true')
      blockquote.setAttribute('theme', 'dark')

      const anchor = document.createElement('a')
      anchor.href = tweetUrl
      blockquote.appendChild(anchor)
      host.appendChild(blockquote)

      const twttr = await ensureTwitterWidgets()
      twttr.widgets.load(host)

      const measuredBox = await waitForTargetAndSettle()
      if (cancelled) {
        return
      }

      const overflowWidth = measuredBox.width - availableBox.width
      const overflowHeight = measuredBox.height - availableBox.height
      const hasOverflow =
        overflowWidth > TWEET_EMBED_FIT_CONFIG.overflowTolerancePx ||
        overflowHeight > TWEET_EMBED_FIT_CONFIG.overflowTolerancePx

      const safeAvailableWidth = Math.max(
        1,
        availableBox.width - TWEET_EMBED_FIT_CONFIG.shrinkSafetyWidthPx,
      )
      const safeAvailableHeight = Math.max(
        1,
        availableBox.height - TWEET_EMBED_FIT_CONFIG.shrinkSafetyHeightPx,
      )

      const fitScale = Math.min(
        (hasOverflow ? safeAvailableWidth : availableBox.width) / measuredBox.width,
        (hasOverflow ? safeAvailableHeight : availableBox.height) / measuredBox.height,
      )

      const nextWidth =
        Number.isFinite(fitScale) && fitScale > 0
          ? clampRenderWidth(normalizedWidth * fitScale)
          : normalizedWidth

      const shouldRetryShrink =
        hasOverflow &&
        nextWidth < normalizedWidth &&
        attempt < TWEET_EMBED_FIT_CONFIG.maxAttempts
      const shouldRetryGrow =
        !hasOverflow &&
        fitScale > 1 + TWEET_EMBED_FIT_CONFIG.growthThreshold &&
        nextWidth > normalizedWidth &&
        attempt < TWEET_EMBED_FIT_CONFIG.maxAttempts

      if (shouldRetryShrink || shouldRetryGrow) {
        return renderAttempt(nextWidth, attempt + 1)
      }

      setResolvedWidth(normalizedWidth)
      setStatus('ready')
    }

    setStatus('loading')
    setResolvedWidth(initialWidth)

    renderAttempt(initialWidth, 0).catch(() => {
      if (!cancelled) {
        setStatus('error')
      }
    })

    return () => {
      cancelled = true
      cleanup()
    }
  }, [tweetUrl, initialWidth, availableBox.width, availableBox.height, fallbackBox.width])

  const wrapperStyle =
    status === 'ready'
      ? {
          width: resolvedWidth,
          maxWidth: '100%',
          overflow: 'hidden' as const,
        }
      : status === 'error'
        ? {
            width: initialWidth,
          }
        : {
            position: 'fixed' as const,
            left: -10000,
            top: 0,
            width: initialWidth,
            visibility: 'hidden' as const,
            pointerEvents: 'none' as const,
          }

  const hostStyle =
    status === 'error'
      ? {
          display: 'none',
        }
      : {
          width: resolvedWidth,
        }

  return (
    <div className={`app-tweet-embed ${className ?? ''}`.trim()} style={wrapperStyle}>
      <div ref={hostRef} className="h-full w-full" style={hostStyle} />
      {status === 'error' ? (
        <div className="mt-3 text-center text-sm text-white/75">
          <a
            href={tweetUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Open this post on X
          </a>
        </div>
      ) : null}
    </div>
  )
}
