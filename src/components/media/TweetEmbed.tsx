import * as React from 'react'

import { ensureTwitterWidgets } from '@/lib/twitter-widgets'

type TweetEmbedProps = {
  tweetId: string
  url: string
  className?: string
}

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

export function TweetEmbed({
  tweetId,
  url,
  className,
}: TweetEmbedProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading')
  const tweetUrl = React.useMemo(() => toTwitterUrl(url), [url])

  React.useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    let cancelled = false
    setStatus('loading')

    ensureTwitterWidgets()
      .then((twttr) => {
        twttr.widgets.load(host)

        return new Promise<void>((resolve, reject) => {
          const observer = new MutationObserver(() => {
            if (!host.querySelector('iframe')) {
              return
            }

            window.clearTimeout(timeout)
            observer.disconnect()
            resolve()
          })

          const timeout = window.setTimeout(() => {
            observer.disconnect()
            reject(new Error('Twitter embed timed out'))
          }, 10000)

          observer.observe(host, { childList: true, subtree: true })

          if (host.querySelector('iframe')) {
            window.clearTimeout(timeout)
            observer.disconnect()
            resolve()
          }
        })
      })
      .then(() => {
        if (!cancelled) {
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [tweetId])

  return (
    <div className={className}>
      <div ref={hostRef}>
        <blockquote
          className="twitter-tweet"
          data-media-max-width="1920"
          data-dnt="true"
          theme="dark"
        >
          <a href={tweetUrl}></a>
        </blockquote>
      </div>
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
