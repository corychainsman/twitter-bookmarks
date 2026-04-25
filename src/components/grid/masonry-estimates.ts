import {
  CellMeasurerCache,
} from 'react-virtualized'

import type { GridItem } from '@/features/bookmarks/model'

const FALLBACK_MEDIA_ASPECT_RATIO = 1
const NON_IMMERSIVE_CHROME_HEIGHT = 108

export type BookmarksMasonryCache = {
  clear(rowIndex: number, columnIndex: number): void
  clearAll(): void
  columnWidth(params: { index: number }): number
  readonly defaultHeight: number
  readonly defaultWidth: number
  getHeight(rowIndex: number, columnIndex?: number): number
  getWidth(rowIndex: number, columnIndex?: number): number
  has(rowIndex: number, columnIndex: number): boolean
  hasFixedHeight(): boolean
  hasFixedWidth(): boolean
  rowHeight(params: { index: number }): number
  set(rowIndex: number, columnIndex: number, width: number, height: number): void
}

export function resolveBookmarksMasonryColumnWidth(input: {
  containerWidth: number
  columnCount: number
}): number {
  return Math.max(1, Math.floor(input.containerWidth / Math.max(1, input.columnCount)))
}

export function resolveGridItemAspectRatio(item: GridItem): number {
  if (Number.isFinite(item.aspectRatio) && item.aspectRatio && item.aspectRatio > 0) {
    return item.aspectRatio
  }

  if (
    Number.isFinite(item.width) &&
    item.width &&
    item.width > 0 &&
    Number.isFinite(item.height) &&
    item.height &&
    item.height > 0
  ) {
    return item.width / item.height
  }

  return FALLBACK_MEDIA_ASPECT_RATIO
}

export function estimateBookmarksMasonryHeight(input: {
  item: GridItem
  columnWidth: number
  immersive: boolean
}): number {
  const mediaHeight = Math.max(
    1,
    Math.round(input.columnWidth / resolveGridItemAspectRatio(input.item)),
  )

  return input.immersive ? mediaHeight : mediaHeight + NON_IMMERSIVE_CHROME_HEIGHT
}

class EstimatedBookmarksMasonryCache implements BookmarksMasonryCache {
  private readonly measuredCache: CellMeasurerCache
  private readonly estimatedHeights: number[]

  readonly defaultHeight: number
  readonly defaultWidth: number

  constructor(estimatedHeights: number[], columnWidth: number, defaultHeight: number) {
    this.estimatedHeights = estimatedHeights
    this.defaultHeight = defaultHeight
    this.defaultWidth = columnWidth
    this.measuredCache = new CellMeasurerCache({
      defaultHeight,
      defaultWidth: columnWidth,
      fixedWidth: true,
    })
  }

  clear(rowIndex: number, columnIndex: number): void {
    this.measuredCache.clear(rowIndex, columnIndex)
  }

  clearAll(): void {
    this.measuredCache.clearAll()
  }

  columnWidth = ({ index }: { index: number }) => this.getWidth(index)

  getHeight(rowIndex: number, columnIndex = 0): number {
    return this.measuredCache.has(rowIndex, columnIndex)
      ? this.measuredCache.getHeight(rowIndex, columnIndex)
      : this.estimatedHeights[rowIndex] ?? this.defaultHeight
  }

  getWidth(rowIndex: number, columnIndex = 0): number {
    return this.measuredCache.has(rowIndex, columnIndex)
      ? this.measuredCache.getWidth(rowIndex, columnIndex)
      : this.defaultWidth
  }

  has(rowIndex: number, columnIndex: number): boolean {
    return this.measuredCache.has(rowIndex, columnIndex)
  }

  hasFixedHeight(): boolean {
    return this.measuredCache.hasFixedHeight()
  }

  hasFixedWidth(): boolean {
    return this.measuredCache.hasFixedWidth()
  }

  rowHeight = ({ index }: { index: number }) => this.getHeight(index)

  set(rowIndex: number, columnIndex: number, width: number, height: number): void {
    this.measuredCache.set(rowIndex, columnIndex, width, height)
  }
}

export function createEstimatedBookmarksMasonryCache(input: {
  items: GridItem[]
  columnWidth: number
  immersive: boolean
}): BookmarksMasonryCache {
  const estimatedHeights = input.items.map((item) =>
    estimateBookmarksMasonryHeight({
      item,
      columnWidth: input.columnWidth,
      immersive: input.immersive,
    }),
  )
  const defaultHeight = estimatedHeights[0] ?? input.columnWidth

  return new EstimatedBookmarksMasonryCache(
    estimatedHeights,
    input.columnWidth,
    defaultHeight,
  )
}
