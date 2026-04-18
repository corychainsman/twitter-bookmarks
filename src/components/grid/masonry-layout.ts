const BASE_TILE_WIDTH = 380
const MIN_TILE_WIDTH = 160
const HORIZONTAL_VIEWPORT_PADDING = 48
const MIN_AVAILABLE_WIDTH = 320
export const MAX_BOOKMARKS_COLUMN_COUNT = 50

export const DEFAULT_BOOKMARKS_ZOOM = 1
export const BOOKMARKS_ZOOM_STEP = 1

export function normalizeBookmarksZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.round(zoom) : DEFAULT_BOOKMARKS_ZOOM
}

export function resolveMasonryLayout(input: {
  viewportWidth: number
  zoom: number
}): {
  availableWidth: number
  baseColumnCount: number
  columnCount: number
  maxColumnCount: number
  targetWidth: number
} {
  const availableWidth = Math.max(
    MIN_AVAILABLE_WIDTH,
    input.viewportWidth - HORIZONTAL_VIEWPORT_PADDING,
  )
  const baseColumnCount = Math.max(1, Math.floor(availableWidth / BASE_TILE_WIDTH))
  const maxColumnCount = Math.max(
    baseColumnCount,
    Math.max(MAX_BOOKMARKS_COLUMN_COUNT, Math.floor(availableWidth / MIN_TILE_WIDTH)),
  )
  const zoomLevel = normalizeBookmarksZoom(input.zoom)
  const desiredColumnCount = baseColumnCount - (zoomLevel - DEFAULT_BOOKMARKS_ZOOM)
  const columnCount = Math.max(1, Math.min(maxColumnCount, desiredColumnCount))

  return {
    availableWidth,
    baseColumnCount,
    columnCount,
    maxColumnCount,
    targetWidth: Number((availableWidth / columnCount).toFixed(2)),
  }
}

export function resolveNextBookmarksZoom(input: {
  currentZoom: number
  deltaColumns: number
  viewportWidth: number
}): number {
  const currentLayout = resolveMasonryLayout({
    viewportWidth: input.viewportWidth,
    zoom: input.currentZoom,
  })
  const targetColumnCount = Math.max(
    1,
    Math.min(currentLayout.maxColumnCount, currentLayout.columnCount - input.deltaColumns),
  )

  return DEFAULT_BOOKMARKS_ZOOM + (currentLayout.baseColumnCount - targetColumnCount)
}
