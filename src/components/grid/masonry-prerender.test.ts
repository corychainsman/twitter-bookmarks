import { describe, expect, it } from 'vitest'

import { resolveMasonryInitialItemCount } from '@/components/grid/masonry-prerender'

describe('resolveMasonryInitialItemCount', () => {
  it('renders a deeper prerender buffer in standard mode', () => {
    expect(
      resolveMasonryInitialItemCount({
        itemCount: 500,
        columnCount: 4,
        immersive: false,
      }),
    ).toBe(56)
  })

  it('renders an even deeper prerender buffer in immersive mode', () => {
    expect(
      resolveMasonryInitialItemCount({
        itemCount: 500,
        columnCount: 4,
        immersive: true,
      }),
    ).toBe(80)
  })

  it('never asks for more items than exist', () => {
    expect(
      resolveMasonryInitialItemCount({
        itemCount: 18,
        columnCount: 4,
        immersive: true,
      }),
    ).toBe(18)
  })
})
