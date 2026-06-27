const BASE_TILE_WIDTH = 380
const HORIZONTAL_VIEWPORT_PADDING = 48
const MAX_LAYOUT_VIEWPORT_WIDTH = 1920
const MIN_AVAILABLE_WIDTH = 320
export const MAX_BOOKMARKS_COLUMN_COUNT = 50

export const DEFAULT_BOOKMARKS_ZOOM = 1
export const BOOKMARKS_ZOOM_STEP = 1
const masonryLayoutCache = new Map<number, Map<number, ReturnType<typeof resolveMasonryLayout>>>()

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
  const cachedByZoom = masonryLayoutCache.get(input.viewportWidth) ?? (masonryLayoutCache.set(input.viewportWidth, new Map()), masonryLayoutCache.get(input.viewportWidth)!)
  const cached = cachedByZoom.get(input.zoom)
  if (cached) return cached
  const availableWidth = Math.max(
    MIN_AVAILABLE_WIDTH,
    Math.min(input.viewportWidth, MAX_LAYOUT_VIEWPORT_WIDTH) - HORIZONTAL_VIEWPORT_PADDING,
  )
  const baseColumnCount = Math.max(1, Math.floor(availableWidth / BASE_TILE_WIDTH))
  const maxColumnCount = Math.max(baseColumnCount, MAX_BOOKMARKS_COLUMN_COUNT)
  const zoomLevel = normalizeBookmarksZoom(input.zoom)
  const desiredColumnCount = baseColumnCount - (zoomLevel - DEFAULT_BOOKMARKS_ZOOM)
  const columnCount = Math.max(1, Math.min(maxColumnCount, desiredColumnCount))

  const layout = {
    availableWidth,
    baseColumnCount,
    columnCount,
    maxColumnCount,
    targetWidth: Math.round((availableWidth / columnCount) * 100) / 100,
  }
  cachedByZoom.set(input.zoom, layout)
  return layout
}

export function resolveNextBookmarksZoom(input: {
  currentZoom: number
  deltaColumns: number
  viewportWidth: number
}): number {
  const availableWidth = Math.max(
    MIN_AVAILABLE_WIDTH,
    Math.min(input.viewportWidth, MAX_LAYOUT_VIEWPORT_WIDTH) - HORIZONTAL_VIEWPORT_PADDING,
  )
  const baseColumnCount = Math.max(1, Math.floor(availableWidth / BASE_TILE_WIDTH))
  const maxColumnCount = Math.max(baseColumnCount, MAX_BOOKMARKS_COLUMN_COUNT)
  const currentColumnCount = Math.max(
    1,
    Math.min(maxColumnCount, baseColumnCount - (normalizeBookmarksZoom(input.currentZoom) - DEFAULT_BOOKMARKS_ZOOM)),
  )
  const targetColumnCount = Math.max(
    1,
    Math.min(maxColumnCount, currentColumnCount - input.deltaColumns),
  )

  return DEFAULT_BOOKMARKS_ZOOM + (baseColumnCount - targetColumnCount)
}
