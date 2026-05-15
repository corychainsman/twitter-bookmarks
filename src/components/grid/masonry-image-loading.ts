import type { CSSProperties } from 'react'

const VIEWPORT_HIGH_PRIORITY_LOOKAHEAD_MULTIPLIER = 0.25
const VIEWPORT_EAGER_LOOKAHEAD_MULTIPLIER = 2
const VIEWPORT_SCROLL_AHEAD_HIGH_PRIORITY_MULTIPLIER = 1
const VIEWPORT_SCROLL_AHEAD_EAGER_MULTIPLIER = 4
const INITIAL_HIGH_PRIORITY_ITEM_COUNT = 12

export type MasonryScrollDirection = 'down' | 'none' | 'up'

export type MasonryImageLoadingStrategy = {
  fetchPriority: 'high' | 'low' | 'auto'
  initialMedia: boolean
  loading: 'eager' | 'lazy'
}

function resolveCssPixelValue(value: CSSProperties['top']): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function resolveBookmarksMasonryImageLoadingStrategy(input: {
  cellHeight: number
  cellTop: CSSProperties['top']
  eagerItemCount: number
  index: number
  isPositioned: boolean
  scrollDirection: MasonryScrollDirection
  viewportHeight: number
  viewportScrollTop: number
}): MasonryImageLoadingStrategy {
  if (!input.isPositioned) {
    return {
      fetchPriority: 'low',
      initialMedia: false,
      loading: 'lazy',
    }
  }

  const initialMedia =
    input.index < input.eagerItemCount &&
    input.viewportScrollTop <= Math.max(1, input.viewportHeight)
  const initialHighPriority =
    initialMedia && input.index < Math.min(input.eagerItemCount, INITIAL_HIGH_PRIORITY_ITEM_COUNT)
  const cellTop = resolveCssPixelValue(input.cellTop)
  const cellHeight = Math.max(1, input.cellHeight)

  if (cellTop === null || input.viewportHeight <= 0) {
    return {
      fetchPriority: initialHighPriority ? 'high' : 'low',
      initialMedia,
      loading: initialMedia ? 'eager' : 'lazy',
    }
  }

  const viewportTop = input.viewportScrollTop
  const viewportBottom = viewportTop + input.viewportHeight
  const cellBottom = cellTop + cellHeight
  const highPriorityBeforeMultiplier =
    input.scrollDirection === 'up' ? VIEWPORT_SCROLL_AHEAD_HIGH_PRIORITY_MULTIPLIER : 0.5
  const highPriorityAfterMultiplier =
    input.scrollDirection === 'down'
      ? VIEWPORT_SCROLL_AHEAD_HIGH_PRIORITY_MULTIPLIER
      : VIEWPORT_HIGH_PRIORITY_LOOKAHEAD_MULTIPLIER
  const eagerBeforeMultiplier =
    input.scrollDirection === 'up' ? VIEWPORT_SCROLL_AHEAD_EAGER_MULTIPLIER : 1
  const eagerAfterMultiplier =
    input.scrollDirection === 'down'
      ? VIEWPORT_SCROLL_AHEAD_EAGER_MULTIPLIER
      : VIEWPORT_EAGER_LOOKAHEAD_MULTIPLIER
  const highPriorityTop = Math.max(
    0,
    viewportTop - input.viewportHeight * highPriorityBeforeMultiplier,
  )
  const highPriorityBottom =
    viewportBottom + input.viewportHeight * highPriorityAfterMultiplier
  const eagerTop = Math.max(0, viewportTop - input.viewportHeight * eagerBeforeMultiplier)
  const eagerBottom = viewportBottom + input.viewportHeight * eagerAfterMultiplier
  const isHighPriority =
    initialHighPriority || (cellBottom >= highPriorityTop && cellTop <= highPriorityBottom)
  const isEager =
    initialMedia || isHighPriority || (cellBottom >= eagerTop && cellTop <= eagerBottom)

  return {
    fetchPriority: isHighPriority ? 'high' : 'low',
    initialMedia,
    loading: isEager ? 'eager' : 'lazy',
  }
}
