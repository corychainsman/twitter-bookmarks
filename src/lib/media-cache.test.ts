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
    vi.unstubAllGlobals()
    setSecureContext(false)
    defineServiceWorker(originalServiceWorker)
  })

  it('clears legacy media caches before registering the cleanup worker', async () => {
    const register = vi.fn().mockResolvedValue({
      active: { state: 'activated' },
      installing: null,
      waiting: null,
    })
    const deleteCache = vi.fn().mockResolvedValue(true)
    setSecureContext(true)
    defineServiceWorker({
      register,
    })
    vi.stubGlobal('caches', {
      delete: deleteCache,
      keys: vi.fn().mockResolvedValue([
        'twitter-bookmarks-media-v1',
        'twitter-bookmarks-media-v2',
        'unrelated-cache',
      ]),
    })

    await registerMediaCacheWorker()

    expect(deleteCache).toHaveBeenCalledTimes(4)
    expect(deleteCache).toHaveBeenCalledWith('twitter-bookmarks-media-v1')
    expect(deleteCache).toHaveBeenCalledWith('twitter-bookmarks-media-v2')
    expect(register).toHaveBeenCalledWith('http://localhost:3000/media-cache-sw.js', {
      scope: 'http://localhost:3000/',
    })
  })
})
