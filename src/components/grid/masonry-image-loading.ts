import type { CSSProperties } from 'react'

const VIEWPORT_HIGH_PRIORITY_LOOKAHEAD_MULTIPLIER = 0.25
const VIEWPORT_EAGER_LOOKAHEAD_MULTIPLIER = 1
const VIEWPORT_SCROLL_AHEAD_HIGH_PRIORITY_MULTIPLIER = 0.75
const VIEWPORT_SCROLL_AHEAD_EAGER_MULTIPLIER = 2
const INITIAL_HIGH_PRIORITY_ITEM_COUNT = 12

export type MasonryScrollDirection = 'down' | 'none' | 'up'

export type MasonryImageLoadingStrategy = {
  fetchPriority: 'high' | 'low' | 'auto'
  initialMedia: boolean
  loading: 'eager' | 'lazy'
}

const LAZY_LOW_PRIORITY_STRATEGY: MasonryImageLoadingStrategy = {
  fetchPriority: 'low',
  initialMedia: false,
  loading: 'lazy',
}
const EAGER_LOW_PRIORITY_STRATEGY: MasonryImageLoadingStrategy = {
  fetchPriority: 'low',
  initialMedia: false,
  loading: 'eager',
}
const EAGER_HIGH_PRIORITY_STRATEGY: MasonryImageLoadingStrategy = {
  fetchPriority: 'high',
  initialMedia: false,
  loading: 'eager',
}
const INITIAL_HIGH_PRIORITY_STRATEGY: MasonryImageLoadingStrategy = {
  fetchPriority: 'high',
  initialMedia: true,
  loading: 'eager',
}
function resolveCssPixelValue(value: CSSProperties['top']): number | null {
  if (typeof value === 'number') {
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
    return LAZY_LOW_PRIORITY_STRATEGY
  }

  const initialMedia =
    input.index < Math.min(input.eagerItemCount, INITIAL_HIGH_PRIORITY_ITEM_COUNT) &&
    input.viewportScrollTop <= Math.max(1, input.viewportHeight)
  if (initialMedia) return INITIAL_HIGH_PRIORITY_STRATEGY
  const cellTop = resolveCssPixelValue(input.cellTop)
  const cellHeight = Math.max(1, input.cellHeight)

  if (cellTop === null || input.viewportHeight <= 0) {
    return LAZY_LOW_PRIORITY_STRATEGY
  }

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
  const viewportTop = input.viewportScrollTop
  const viewportBottom = viewportTop + input.viewportHeight
  const highPriorityTop = Math.max(
    0,
    viewportTop - input.viewportHeight * highPriorityBeforeMultiplier,
  )
  const highPriorityBottom =
    viewportBottom + input.viewportHeight * highPriorityAfterMultiplier
  const eagerTop = Math.max(0, viewportTop - input.viewportHeight * eagerBeforeMultiplier)
  const eagerBottom = viewportBottom + input.viewportHeight * eagerAfterMultiplier
  const isHighPriority =
    cellBottom >= highPriorityTop && cellTop <= highPriorityBottom
  const isEager =
    isHighPriority || (cellBottom >= eagerTop && cellTop <= eagerBottom)

  if (isHighPriority) return EAGER_HIGH_PRIORITY_STRATEGY
  return isEager ? EAGER_LOW_PRIORITY_STRATEGY : LAZY_LOW_PRIORITY_STRATEGY
}
