import { describe, expect, it } from 'vitest'

import { resolveMasonryViewportTopInset } from '@/components/grid/masonry-viewport'

describe('resolveMasonryViewportTopInset', () => {
  it('returns zero when the toolbar does not overlap the grid', () => {
    expect(
      resolveMasonryViewportTopInset({
        containerTop: 96,
        toolbarBottom: 72,
      }),
    ).toBe(0)
  })

  it('returns the overlapping toolbar height when the grid starts beneath it', () => {
    expect(
      resolveMasonryViewportTopInset({
        containerTop: 40,
        toolbarBottom: 72,
      }),
    ).toBe(32)
  })

  it('uses the full toolbar height once the grid has scrolled behind it', () => {
    expect(
      resolveMasonryViewportTopInset({
        containerTop: -160,
        toolbarBottom: 72,
      }),
    ).toBe(72)
  })
})

