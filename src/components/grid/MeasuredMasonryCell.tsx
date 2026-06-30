import { useCallback, type CSSProperties, type ReactNode } from 'react'

type MeasuredMasonryCellProps = {
  children: ReactNode
  gridId: string
  index: number
  isMeasurement: boolean
  parent: {
    invalidateCellSizeAfterRender?: (cell: {
      columnIndex: number
      rowIndex: number
    }) => void
  }
  style: CSSProperties
}

export function MeasuredMasonryCell({
  children,
  gridId,
  index,
  isMeasurement,
  parent,
  style,
}: MeasuredMasonryCellProps) {
  const registerChild = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element || !isMeasurement) {
        return
      }

      parent.invalidateCellSizeAfterRender?.({
        columnIndex: 0,
        rowIndex: index,
      })
    },
    [index, isMeasurement, parent],
  )

  return (
    <div
      ref={registerChild}
      className="app-masonry-cell"
      style={style}
      data-grid-id={gridId}
    >
      {children}
    </div>
  )
}
