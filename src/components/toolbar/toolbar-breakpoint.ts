export const MORE_SURFACE_BREAKPOINT = 640
export const MORE_SURFACE_MAX_DIMENSION = 960

function getMatchMediaMatches(query: string): boolean {
  return globalThis.window?.matchMedia?.(query)?.matches ?? false
}

function isTouchLikeEnvironment(): boolean {
  return (
    getMatchMediaMatches('(pointer: coarse)') ||
    getMatchMediaMatches('(hover: none)') ||
    (globalThis.navigator?.maxTouchPoints ?? 0) > 0
  )
}

function isPhoneSizedViewport() {
  const width = globalThis.window?.innerWidth ?? 0
  const height = globalThis.window?.innerHeight ?? 0
  const shortSide = Math.min(width, height)
  const longSide = Math.max(width, height)

  return shortSide < MORE_SURFACE_BREAKPOINT && longSide < MORE_SURFACE_MAX_DIMENSION
}

export function shouldUseDesktopMoreSurface() {
  if (typeof window === 'undefined') {
    return true
  }

  return !(isPhoneSizedViewport() && isTouchLikeEnvironment())
}

export function shouldUseBottomToolbarDock() {
  return !shouldUseDesktopMoreSurface()
}
