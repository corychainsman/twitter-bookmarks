import { afterEach, describe, expect, it, vi } from 'vitest'

import { shouldUseDesktopMoreSurface } from '@/components/toolbar/toolbar-breakpoint'

const originalMatchMedia = window.matchMedia
const originalInnerWidth = window.innerWidth
const originalInnerHeight = window.innerHeight
const originalMaxTouchPoints = navigator.maxTouchPoints

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  })
}

function setTouchPoints(value: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value,
  })
}

function setMatchMedia(
  matches: Record<string, boolean>,
) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => {
      const result = matches[query] ?? false
      return {
        matches: result,
        media: query,
        onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList
    }),
  })
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
  setViewport(originalInnerWidth, originalInnerHeight)
  setTouchPoints(originalMaxTouchPoints)
  vi.restoreAllMocks()
})

describe('shouldUseDesktopMoreSurface', () => {
  it('keeps popover on desktop-like narrow windows', () => {
    setViewport(520, 920)
    setTouchPoints(0)
    setMatchMedia({
      '(pointer: coarse)': false,
      '(hover: none)': false,
    })

    expect(shouldUseDesktopMoreSurface()).toBe(true)
  })

  it('switches to the bottom sheet on phone-like touch viewports', () => {
    setViewport(390, 844)
    setTouchPoints(5)
    setMatchMedia({
      '(pointer: coarse)': true,
      '(hover: none)': true,
    })

    expect(shouldUseDesktopMoreSurface()).toBe(false)
  })
})
