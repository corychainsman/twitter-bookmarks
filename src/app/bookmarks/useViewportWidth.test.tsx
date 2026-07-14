import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useViewportWidth } from '@/app/bookmarks/useViewportWidth'

describe('useViewportWidth', () => {
  afterEach(() => vi.restoreAllMocks())

  it('coalesces resize bursts into one animation-frame update', () => {
    let pendingFrame: FrameRequestCallback | null = null
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        pendingFrame = callback
        return 1
      })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900, writable: true })

    const { result } = renderHook(() => useViewportWidth())
    expect(result.current).toBe(900)

    act(() => {
      window.innerWidth = 800
      window.dispatchEvent(new Event('resize'))
      window.innerWidth = 700
      window.dispatchEvent(new Event('resize'))
    })
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

    act(() => pendingFrame?.(0))
    expect(result.current).toBe(700)
  })
})
