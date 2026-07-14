import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerMediaCacheWorker } from '@/lib/media-cache'

const originalServiceWorker = navigator.serviceWorker

function defineServiceWorker(value: Partial<ServiceWorkerContainer> | undefined) {
  Object.defineProperty(navigator, 'serviceWorker', {
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
})
