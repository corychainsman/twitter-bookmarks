import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BOOKMARKS_ZOOM,
  MAX_BOOKMARKS_COLUMN_COUNT,
  normalizeBookmarksZoom,
  resolveNextBookmarksZoom,
  resolveMasonryLayout,
} from '@/components/grid/masonry-layout'

describe('normalizeBookmarksZoom', () => {
  it('falls back to the default zoom level for invalid input', () => {
    expect(normalizeBookmarksZoom(Number.NaN)).toBe(DEFAULT_BOOKMARKS_ZOOM)
  })

  it('rounds legacy fractional zoom values to integer steps', () => {
    expect(normalizeBookmarksZoom(1.7)).toBe(2)
    expect(normalizeBookmarksZoom(0.9)).toBe(1)
  })
})

describe('resolveMasonryLayout', () => {
  it('removes one column for each positive zoom step', () => {
    const baseLayout = resolveMasonryLayout({
      viewportWidth: 1200,
      zoom: DEFAULT_BOOKMARKS_ZOOM,
    })
    const zoomedInLayout = resolveMasonryLayout({
      viewportWidth: 1200,
      zoom: DEFAULT_BOOKMARKS_ZOOM + 1,
    })

    expect(baseLayout.columnCount).toBe(3)
    expect(zoomedInLayout.columnCount).toBe(2)
  })

  it('adds one column for each negative zoom step', () => {
    const baseLayout = resolveMasonryLayout({
      viewportWidth: 1200,
      zoom: DEFAULT_BOOKMARKS_ZOOM,
    })
    const zoomedOutLayout = resolveMasonryLayout({
      viewportWidth: 1200,
      zoom: DEFAULT_BOOKMARKS_ZOOM - 1,
    })

    expect(baseLayout.columnCount).toBe(3)
    expect(zoomedOutLayout.columnCount).toBe(4)
  })

  it('allows zooming all the way out to 50 columns', () => {
    const zoomedOutLayout = resolveMasonryLayout({
      viewportWidth: 1200,
      zoom: -100,
    })

    expect(zoomedOutLayout.maxColumnCount).toBe(MAX_BOOKMARKS_COLUMN_COUNT)
    expect(zoomedOutLayout.columnCount).toBe(MAX_BOOKMARKS_COLUMN_COUNT)
  })

  it('keeps the max column count capped at 50 on wide viewports', () => {
    const layout = resolveMasonryLayout({
      viewportWidth: 20_000,
      zoom: -100,
    })

    expect(layout.maxColumnCount).toBe(MAX_BOOKMARKS_COLUMN_COUNT)
    expect(layout.columnCount).toBe(MAX_BOOKMARKS_COLUMN_COUNT)
  })
})

describe('resolveNextBookmarksZoom', () => {
  it('steps the actual column count by exactly one column per click', () => {
    const removeColumn = resolveNextBookmarksZoom({
      currentZoom: DEFAULT_BOOKMARKS_ZOOM,
      deltaColumns: 1,
      viewportWidth: 1200,
    })
    const addColumn = resolveNextBookmarksZoom({
      currentZoom: DEFAULT_BOOKMARKS_ZOOM,
      deltaColumns: -1,
      viewportWidth: 1200,
    })

    expect(resolveMasonryLayout({ viewportWidth: 1200, zoom: removeColumn }).columnCount).toBe(2)
    expect(resolveMasonryLayout({ viewportWidth: 1200, zoom: addColumn }).columnCount).toBe(4)
  })

  it('changes the rendered column count by one for every enabled click across a zoom range', () => {
    for (let currentZoom = -20; currentZoom <= 20; currentZoom += 1) {
      const currentLayout = resolveMasonryLayout({
        viewportWidth: 1200,
        zoom: currentZoom,
      })

      if (currentLayout.columnCount > 1) {
        const nextZoom = resolveNextBookmarksZoom({
          currentZoom,
          deltaColumns: 1,
          viewportWidth: 1200,
        })

        expect(resolveMasonryLayout({ viewportWidth: 1200, zoom: nextZoom }).columnCount).toBe(
          currentLayout.columnCount - 1,
        )
      }

      if (currentLayout.columnCount < currentLayout.maxColumnCount) {
        const nextZoom = resolveNextBookmarksZoom({
          currentZoom,
          deltaColumns: -1,
          viewportWidth: 1200,
        })

        expect(resolveMasonryLayout({ viewportWidth: 1200, zoom: nextZoom }).columnCount).toBe(
          currentLayout.columnCount + 1,
        )
      }
    }
  })

  it('stops at one column when zooming in repeatedly', () => {
    const nextZoom = resolveNextBookmarksZoom({
      currentZoom: 3,
      deltaColumns: 1,
      viewportWidth: 1200,
    })

    expect(resolveMasonryLayout({ viewportWidth: 1200, zoom: nextZoom }).columnCount).toBe(1)
  })

  it('stops at 50 columns when zooming out repeatedly', () => {
    const nextZoom = resolveNextBookmarksZoom({
      currentZoom: -100,
      deltaColumns: -1,
      viewportWidth: 1200,
    })

    expect(resolveMasonryLayout({ viewportWidth: 1200, zoom: nextZoom }).columnCount).toBe(
      MAX_BOOKMARKS_COLUMN_COUNT,
    )
  })
})
