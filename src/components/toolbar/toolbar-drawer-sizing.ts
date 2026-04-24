export const TOOLBAR_DRAWER_TOP_GAP = 20

type ResolveToolbarDrawerLayoutOptions = {
  bodyHeight: number
  headerHeight: number
  safeAreaBottom: number
  viewportHeight: number
  topGap?: number
}

export type ToolbarDrawerLayout = {
  contentHeight: number
  maxDrawerHeight: number
  snapPoint: number
  bodyMaxHeight: number
  isOverflowing: boolean
}

function clampSize(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

export function getToolbarDrawerViewportHeight() {
  if (typeof window === 'undefined') {
    return 0
  }

  return clampSize(
    window.visualViewport?.height
      ?? window.innerHeight
      ?? document.documentElement.clientHeight,
  )
}

export function resolveToolbarDrawerLayout({
  bodyHeight,
  headerHeight,
  safeAreaBottom,
  viewportHeight,
  topGap = TOOLBAR_DRAWER_TOP_GAP,
}: ResolveToolbarDrawerLayoutOptions): ToolbarDrawerLayout {
  const resolvedBodyHeight = clampSize(bodyHeight)
  const resolvedHeaderHeight = clampSize(headerHeight)
  const resolvedSafeAreaBottom = clampSize(safeAreaBottom)
  const resolvedViewportHeight = clampSize(viewportHeight)
  const resolvedTopGap = clampSize(topGap)
  const maxDrawerHeight = Math.max(0, resolvedViewportHeight - resolvedTopGap)
  const contentHeight = resolvedBodyHeight + resolvedHeaderHeight + resolvedSafeAreaBottom
  const snapPoint = Math.min(contentHeight, maxDrawerHeight)
  const bodyMaxHeight = Math.max(0, snapPoint - resolvedHeaderHeight - resolvedSafeAreaBottom)

  return {
    contentHeight,
    maxDrawerHeight,
    snapPoint,
    bodyMaxHeight,
    isOverflowing: contentHeight > maxDrawerHeight,
  }
}
