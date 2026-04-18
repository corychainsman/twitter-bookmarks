import { describe, expect, it } from 'vitest'

import {
  distributeItemsByColumnOrder,
  shouldUseStaticColumnLayout,
} from '@/components/grid/column-distribution'

describe('shouldUseStaticColumnLayout', () => {
  it('uses the static layout for small result sets', () => {
    expect(
      shouldUseStaticColumnLayout({
        itemCount: 5,
        columnCount: 4,
      }),
    ).toBe(true)
  })

  it('keeps virtualization for larger result sets', () => {
    expect(
      shouldUseStaticColumnLayout({
        itemCount: 80,
        columnCount: 4,
      }),
    ).toBe(false)
  })
})

describe('distributeItemsByColumnOrder', () => {
  it('keeps the final orphan left-justified by distributing items round-robin', () => {
    expect(distributeItemsByColumnOrder([1, 2, 3, 4, 5], 4)).toEqual([
      [1, 5],
      [2],
      [3],
      [4],
    ])
  })

  it('does not emit empty columns when the requested column count exceeds the item count', () => {
    expect(distributeItemsByColumnOrder([1, 2, 3], 50)).toEqual([[1], [2], [3]])
  })
})
