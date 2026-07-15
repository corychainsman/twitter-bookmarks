import { afterEach, describe, expect, it, vi } from 'vitest'

import { startMediaViewTransition } from '@/lib/media-view-transition'

describe('startMediaViewTransition', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, 'startViewTransition')
  })

  it('uses a same-document view transition when supported', async () => {
    const update = vi.fn()
    const finished = Promise.resolve()
    const startViewTransition = vi.fn((callback: () => void) => {
      callback()
      return { finished }
    })
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))

    expect(startMediaViewTransition(update)).toBe(finished)
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('updates immediately when reduced motion is requested', () => {
    const update = vi.fn()
    const startViewTransition = vi.fn()
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition,
    })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    expect(startMediaViewTransition(update)).toBeNull()
    expect(startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
