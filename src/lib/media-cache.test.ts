import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isConnectionEligibleForBackgroundWarm,
  registerMediaCacheWorker,
  warmMediaCache,
} from '@/lib/media-cache'

const originalServiceWorker = navigator.serviceWorker
const originalConnection = (navigator as Navigator & { connection?: unknown }).connection

function defineServiceWorker(value: Partial<ServiceWorkerContainer> | undefined) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value,
  })
}

function defineConnection(value: unknown) {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value,
  })
}

function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value,
  })
}

describe('media cache worker helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    setSecureContext(false)
    defineServiceWorker(originalServiceWorker)
    defineConnection(originalConnection)
  })

  it('registers the static media cache worker at the Vite base scope', () => {
    const register = vi.fn()
    setSecureContext(true)
    defineServiceWorker({
      register,
    })

    registerMediaCacheWorker()

    expect(register).toHaveBeenCalledWith('http://localhost:3000/media-cache-sw.js', {
      scope: 'http://localhost:3000/',
    })
  })

  it('posts only cacheable Twitter media URLs to the active worker', () => {
    const postMessage = vi.fn()
    setSecureContext(true)
    defineServiceWorker({
      controller: {
        postMessage,
      } as unknown as ServiceWorker,
    })

    expect(
      warmMediaCache([
        'https://pbs.twimg.com/media/abc.jpg?name=large',
        'https://video.twimg.com/ext_tw_video/video.mp4',
        'https://example.com/not-cached.jpg',
      ]),
    ).toEqual([
      'https://pbs.twimg.com/media/abc.jpg?name=large',
      'https://video.twimg.com/ext_tw_video/video.mp4',
    ])
    expect(postMessage).toHaveBeenCalledWith({
      type: 'warm-media-cache',
      urls: [
        'https://pbs.twimg.com/media/abc.jpg?name=large',
        'https://video.twimg.com/ext_tw_video/video.mp4',
      ],
    })
  })

  it('allows background warming when there is no Network Information API', () => {
    defineConnection(undefined)
    expect(isConnectionEligibleForBackgroundWarm()).toBe(true)
  })

  it('skips background warming on save-data connections', () => {
    defineConnection({ saveData: true, effectiveType: '4g' })
    expect(isConnectionEligibleForBackgroundWarm()).toBe(false)
  })

  it('skips background warming on slow effective connection types', () => {
    defineConnection({ saveData: false, effectiveType: '2g' })
    expect(isConnectionEligibleForBackgroundWarm()).toBe(false)
  })

  it('allows background warming on fast connections', () => {
    defineConnection({ saveData: false, effectiveType: '4g' })
    expect(isConnectionEligibleForBackgroundWarm()).toBe(true)
  })
})
