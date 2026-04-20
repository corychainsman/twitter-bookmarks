import { describe, expect, it } from 'vitest'

import { resolveBookmarksMasonryCellStyle } from '@/components/grid/masonry-cell-style'

describe('resolveBookmarksMasonryCellStyle', () => {
  it('preserves fully positioned masonry cells', () => {
    expect(
      resolveBookmarksMasonryCellStyle({
        left: 320,
        position: 'absolute',
        top: 640,
        width: 196,
      }),
    ).toEqual({
      left: 320,
      position: 'absolute',
      top: 640,
      width: 196,
    })
  })

  it('hides measurement-phase cells while keeping them measurable', () => {
    expect(
      resolveBookmarksMasonryCellStyle({
        height: 'auto',
        width: 196,
      }),
    ).toEqual({
      height: 'auto',
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      top: 0,
      visibility: 'hidden',
      width: 196,
      zIndex: -1,
    })
  })
})
