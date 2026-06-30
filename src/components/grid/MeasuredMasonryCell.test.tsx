import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MeasuredMasonryCell } from '@/components/grid/MeasuredMasonryCell'

describe('MeasuredMasonryCell', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('invalidates the parent when the measurement cell is attached', () => {
    const invalidateCellSizeAfterRender = vi.fn()

    render(
      <MeasuredMasonryCell
        gridId="tweet-1:0"
        index={3}
        parent={{ invalidateCellSizeAfterRender }}
        style={{ width: 200 }}
      >
        <div>Measured content</div>
      </MeasuredMasonryCell>,
    )

    expect(invalidateCellSizeAfterRender).toHaveBeenCalledWith({
      columnIndex: 0,
      rowIndex: 3,
    })
  })

  it('does not require react-virtualized parent internals outside invalidation', () => {
    render(
      <MeasuredMasonryCell
        gridId="tweet-1:0"
        index={0}
        parent={{}}
        style={{ width: 200 }}
      >
        <div>Measured content</div>
      </MeasuredMasonryCell>,
    )

    const cell = document.querySelector('[data-grid-id="tweet-1:0"]')

    expect(cell).toHaveClass('app-masonry-cell')
  })
})
