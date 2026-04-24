import { describe, expect, it } from 'vitest'

import {
  TOOLBAR_DRAWER_TOP_GAP,
  resolveToolbarDrawerLayout,
} from '@/components/toolbar/toolbar-drawer-sizing'

describe('resolveToolbarDrawerLayout', () => {
  it('uses the measured content height when it fits inside the viewport cap', () => {
    expect(
      resolveToolbarDrawerLayout({
        bodyHeight: 240,
        headerHeight: 24,
        safeAreaBottom: 12,
        viewportHeight: 600,
      }),
    ).toEqual({
      contentHeight: 276,
      maxDrawerHeight: 580,
      snapPoint: 276,
      bodyMaxHeight: 240,
      isOverflowing: false,
    })
  })

  it('clamps the snap point and body height when content exceeds the viewport cap', () => {
    expect(
      resolveToolbarDrawerLayout({
        bodyHeight: 520,
        headerHeight: 28,
        safeAreaBottom: 16,
        viewportHeight: 480,
      }),
    ).toEqual({
      contentHeight: 564,
      maxDrawerHeight: 460,
      snapPoint: 460,
      bodyMaxHeight: 416,
      isOverflowing: true,
    })
  })

  it('respects custom top-gap and safe-area offsets in the final clamp', () => {
    expect(
      resolveToolbarDrawerLayout({
        bodyHeight: 300,
        headerHeight: 20,
        safeAreaBottom: 34,
        viewportHeight: 700,
        topGap: TOOLBAR_DRAWER_TOP_GAP + 10,
      }),
    ).toEqual({
      contentHeight: 354,
      maxDrawerHeight: 670,
      snapPoint: 354,
      bodyMaxHeight: 300,
      isOverflowing: false,
    })
  })
})
