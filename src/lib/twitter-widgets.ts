export type TwitterWidgetApi = {
  widgets: {
    load: (element?: HTMLElement) => void
  }
  ready: (callback: () => void) => void
  _e?: Array<() => void>
}

declare global {
  interface Window {
    twttr?: TwitterWidgetApi
  }
}

let twitterWidgetsPromise: Promise<TwitterWidgetApi> | null = null

function ensureTwitterStub() {
  if (typeof window === 'undefined' || window.twttr) {
    return
  }

  const readyQueue: Array<() => void> = []

  window.twttr = {
    widgets: {
      load: () => {},
    },
    ready: (callback: () => void) => {
      readyQueue.push(callback)
    },
    _e: readyQueue,
  }
}

export function ensureTwitterWidgets(): Promise<TwitterWidgetApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Twitter widgets require a browser environment'))
  }

  if (window.twttr?.widgets.load && !window.twttr._e) {
    return Promise.resolve(window.twttr)
  }

  if (!twitterWidgetsPromise) {
    twitterWidgetsPromise = new Promise<TwitterWidgetApi>((resolve, reject) => {
      ensureTwitterStub()

      const rejectAndReset = (error: Error) => {
        twitterWidgetsPromise = null
        reject(error)
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-twitter-widgets="true"]',
      )

      const handleReady = () => {
        if (!window.twttr) {
          rejectAndReset(new Error('Twitter widgets failed to initialize'))
          return
        }

        window.twttr.ready(() => resolve(window.twttr as TwitterWidgetApi))
      }

      if (existingScript) {
        if (window.twttr?.widgets.load && !window.twttr._e) {
          resolve(window.twttr)
          return
        }

        existingScript.addEventListener('load', handleReady, { once: true })
        existingScript.addEventListener(
          'error',
          () => rejectAndReset(new Error('Twitter widgets failed to load')),
          { once: true },
        )

        if (existingScript.dataset.twitterWidgetsLoaded === 'true') {
          handleReady()
        }

        return
      }

      const script = document.createElement('script')
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.charset = 'utf-8'
      script.dataset.twitterWidgets = 'true'
      script.addEventListener(
        'load',
        () => {
          script.dataset.twitterWidgetsLoaded = 'true'
          handleReady()
        },
        { once: true },
      )
      script.addEventListener(
        'error',
        () => rejectAndReset(new Error('Twitter widgets failed to load')),
        { once: true },
      )
      document.head.appendChild(script)
    })
  }

  return twitterWidgetsPromise
}
