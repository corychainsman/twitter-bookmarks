import { useCallback, type CSSProperties, type ReactNode } from 'react'

type MeasuredMasonryCellProps = {
  children: ReactNode
  gridId: string
  index: number
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
  parent,
  style,
}: MeasuredMasonryCellProps) {
  const registerChild = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return
      }

      parent.invalidateCellSizeAfterRender?.({
        columnIndex: 0,
        rowIndex: index,
      })
    },
    [index, parent],
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
